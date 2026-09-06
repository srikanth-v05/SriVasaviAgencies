import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCompany, useCustomers, useProducts } from "@/features/queries";
import { previewDocument, stateCodeFromGstin, type DraftLine } from "@/lib/gst";
import { money, amount, today, dateInput } from "@/lib/format";
import { Button, Field, Input, Panel, PanelHeader, Select, Textarea } from "@/components/common/ui";
import type { DiscountType, DocumentLine, Product } from "@/types";

/**
 * Type-to-filter product search, replacing a plain <select> that would
 * otherwise list every product in the catalogue — unusable once there are
 * more than a handful.
 */
function ProductPicker({
  products,
  value,
  onPick,
  ariaLabel,
}: {
  products: Product[];
  value: string | null;
  onPick: (productId: string) => void;
  ariaLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === value) ?? null;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const needle = query.trim().toLowerCase();
  const matches = (
    needle
      ? products.filter((p) => p.name.toLowerCase().includes(needle) || p.productCode.toLowerCase().includes(needle))
      : products
  ).slice(0, 50);

  const pick = (productId: string) => {
    onPick(productId);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Input
        aria-label={ariaLabel}
        value={open ? query : (selected?.name ?? "")}
        placeholder="Type to search products…"
        onFocus={() => {
          setQuery("");
          setOpen(true);
          setHighlight(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const match = matches[highlight];
            if (match) pick(match.id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <div className="panel absolute z-10 mt-1 max-h-64 w-full overflow-y-auto py-1">
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs text-muted hover:bg-ground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick("")}
          >
            Free-text line…
          </button>
          {matches.length === 0 ? (
            <p className="px-3 py-1.5 text-xs text-muted">No matching products</p>
          ) : (
            matches.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`block w-full px-3 py-1.5 text-left text-sm ${i === highlight ? "bg-ground" : "hover:bg-ground"}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(p.id)}
              >
                {p.name} <span className="type-data text-xs text-muted">({p.productCode})</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export interface EditorLine extends DraftLine {
  key: string;
  productId: string | null;
  productName: string;
  productCode: string | null;
  hsnCode: string | null;
  unit: string;
  /** The product master price at the time the line was added — reference only. */
  masterPrice: number | null;
}

export interface DocumentPayload {
  customerId: string;
  date: string;
  secondaryDate: string;
  placeOfSupply: string;
  notes: string;
  termsAndConditions: string;
  paymentTerms?: string;
  poNumber?: string;
  vehicleNumber?: string;
  items: {
    productId: string | null;
    productName: string;
    productCode: string | null;
    hsnCode: string | null;
    unit: string;
    quantity: number;
    unitPrice: number;
    discountType: DiscountType;
    discountValue: number;
    gstRate: number;
  }[];
}

interface Props {
  kind: "quotation" | "invoice";
  initial?: {
    customerId?: string;
    date?: string;
    secondaryDate?: string | null;
    placeOfSupply?: string | null;
    notes?: string | null;
    termsAndConditions?: string | null;
    paymentTerms?: string | null;
    poNumber?: string | null;
    vehicleNumber?: string | null;
    items?: DocumentLine[];
  };
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (payload: DocumentPayload) => void;
  onCancel?: () => void;
}

let lineCounter = 0;
const newKey = () => `line-${++lineCounter}`;

function emptyLine(): EditorLine {
  return {
    key: newKey(),
    productId: null,
    productName: "",
    productCode: null,
    hsnCode: null,
    unit: "",
    masterPrice: null,
    quantity: 1,
    unitPrice: 0,
    discountType: "NONE",
    discountValue: 0,
    gstRate: 18,
  };
}

function fromExisting(item: DocumentLine): EditorLine {
  return {
    key: newKey(),
    productId: item.productId,
    productName: item.productNameSnapshot,
    productCode: item.productCodeSnapshot,
    hsnCode: item.hsnCodeSnapshot,
    unit: item.unitSnapshot,
    masterPrice: item.masterPriceSnapshot,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discountType: item.discountType,
    discountValue: Number(item.discountValue),
    gstRate: Number(item.gstRate),
  };
}

/**
 * The quotation / invoice line editor.
 *
 * The unit price column is a plain, unconstrained input. The product master
 * price is shown beside it as a reference and the difference is stated
 * neutrally — the system records the override, and never blocks or warns on it
 * (architecture.md §2.1, §13, §30).
 */
export function DocumentEditor({ kind, initial, submitLabel, isSubmitting, onSubmit, onCancel }: Props) {
  const { data: company } = useCompany();
  const { data: customerPage } = useCustomers({ limit: 200, isActive: true });
  const { data: productPage } = useProducts({ limit: 200, isActive: true });

  const customers = customerPage?.data ?? [];
  const products = productPage?.data ?? [];

  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [documentDate, setDocumentDate] = useState(dateInput(initial?.date) || today());
  const [secondaryDate, setSecondaryDate] = useState(dateInput(initial?.secondaryDate));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [terms, setTerms] = useState(initial?.termsAndConditions ?? "");
  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms ?? "");
  const [poNumber, setPoNumber] = useState(initial?.poNumber ?? "");
  const [vehicleNumber, setVehicleNumber] = useState(initial?.vehicleNumber ?? "");
  const [lines, setLines] = useState<EditorLine[]>(
    initial?.items?.length ? initial.items.map(fromExisting) : [emptyLine()],
  );
  const [placeOfSupply, setPlaceOfSupply] = useState(initial?.placeOfSupply ?? "");
  const [bulkCount, setBulkCount] = useState("1");

  const customer = customers.find((c) => c.id === customerId);
  // The CGST/SGST vs IGST split always follows the customer's GSTIN — a
  // customer with several delivery branches has one GST registration, so
  // which branch this particular document is for (typed into "Place of
  // supply" below) never changes the tax treatment.
  const customerStateCode = customer ? (stateCodeFromGstin(customer.gstin) ?? customer.stateCode) : "";
  const isInterState = Boolean(company && customerStateCode && company.stateCode !== customerStateCode);

  const totals = useMemo(
    () => previewDocument(lines, isInterState, company?.roundingMode ?? "NEAREST_RUPEE"),
    [lines, isInterState, company?.roundingMode],
  );

  const updateLine = (key: string, patch: Partial<EditorLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const pickProduct = (key: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      updateLine(key, { productId: null, masterPrice: null });
      return;
    }
    // Selecting a product seeds the line from the master. Anything typed afterwards wins.
    updateLine(key, {
      productId: product.id,
      productName: product.name,
      productCode: product.productCode,
      hsnCode: product.hsnCode,
      unit: product.unit.shortName,
      masterPrice: Number(product.defaultPrice),
      unitPrice: Number(product.defaultPrice),
      gstRate: Number(product.defaultGstRate),
    });
  };

  const canSubmit =
    Boolean(customerId) && lines.length > 0 && lines.every((l) => l.productName.trim() && l.unit.trim() && l.quantity > 0);

  const submit = () => {
    if (!canSubmit || !customer) return;
    onSubmit({
      customerId,
      date: documentDate,
      secondaryDate,
      placeOfSupply: placeOfSupply.trim(),
      notes,
      termsAndConditions: terms,
      paymentTerms,
      poNumber,
      vehicleNumber,
      items: lines.map((line) => ({
        productId: line.productId,
        productName: line.productName.trim(),
        productCode: line.productCode,
        hsnCode: line.hsnCode,
        unit: line.unit.trim(),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountType: line.discountType,
        discountValue: Number(line.discountValue),
        gstRate: Number(line.gstRate),
      })),
    });
  };

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------- header */}
      <Panel>
        <PanelHeader title="Document details" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Customer" htmlFor="customer" required className="sm:col-span-2">
            <Select id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName ?? c.name} {c.gstin ? `· ${c.gstin}` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={kind === "quotation" ? "Quotation date" : "Invoice date"} htmlFor="doc-date" required>
            <Input id="doc-date" type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
          </Field>

          <Field label={kind === "quotation" ? "Valid until" : "Due date"} htmlFor="doc-date2">
            <Input id="doc-date2" type="date" value={secondaryDate} onChange={(e) => setSecondaryDate(e.target.value)} />
          </Field>

          <Field
            label="Place of supply"
            htmlFor="pos"
            hint={
              customer
                ? isInterState
                  ? `Tax follows ${customer.companyName ?? customer.name}'s GSTIN — different state, IGST applies.`
                  : `Tax follows ${customer.companyName ?? customer.name}'s GSTIN — same state, CGST and SGST apply.`
                : "Free text — e.g. which branch this delivery is for. Tax always follows the customer's GSTIN, not this field."
            }
            className="sm:col-span-2"
          >
            <Input
              id="pos"
              placeholder="e.g. Branch name or delivery location"
              value={placeOfSupply}
              onChange={(e) => setPlaceOfSupply(e.target.value)}
            />
          </Field>

          {kind === "invoice" && (
            <>
              <Field label="Payment terms" htmlFor="payment-terms" className="sm:col-span-2">
                <Input
                  id="payment-terms"
                  value={paymentTerms}
                  placeholder={company?.defaultPaymentTerms ?? "Net 15 days"}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </Field>

              <Field label="PO number" htmlFor="po-number" hint="Optional — the customer's own purchase-order reference.">
                <Input id="po-number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
              </Field>

              <Field label="Vehicle number" htmlFor="vehicle-number" hint="Optional — leave blank if not known yet.">
                <Input id="vehicle-number" className="type-data uppercase" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
              </Field>
            </>
          )}
        </div>
      </Panel>

      {/* -------------------------------------------------------- lines */}
      <Panel>
        <PanelHeader
          title="Items"
          description="The price you enter here is the price that bills. The master price is shown for reference only."
          actions={
            <div className="flex items-center gap-2">
              <Input
                aria-label="Number of lines to add"
                type="number"
                min={1}
                step="1"
                className="w-16 text-right"
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const count = Math.max(1, Math.floor(Number(bulkCount)) || 1);
                  setLines((c) => [...c, ...Array.from({ length: count }, emptyLine)]);
                  setBulkCount("1");
                }}
              >
                Add line{Number(bulkCount) > 1 ? "s" : ""}
              </Button>
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead className="bg-ground-deep/60">
              <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                <th className="w-8 px-2 py-2">#</th>
                <th className="px-2 py-2">Product / description</th>
                <th className="w-24 px-2 py-2">HSN</th>
                <th className="w-20 px-2 py-2 text-right">Qty</th>
                <th className="w-20 px-2 py-2">Unit</th>
                <th className="w-28 px-2 py-2 text-right">Rate</th>
                <th className="w-32 px-2 py-2">Discount</th>
                <th className="w-20 px-2 py-2 text-right">GST %</th>
                <th className="w-28 px-2 py-2 text-right">Line total</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {lines.map((line, index) => {
                const preview = totals.lines[index];
                const override =
                  line.masterPrice !== null && Number(line.unitPrice) !== Number(line.masterPrice)
                    ? Number(line.unitPrice) - Number(line.masterPrice)
                    : null;

                return (
                  <tr key={line.key} className="align-top">
                    <td className="px-2 py-2 text-xs text-muted">{index + 1}</td>

                    <td className="px-2 py-2">
                      <ProductPicker
                        ariaLabel={`Product for line ${index + 1}`}
                        products={products}
                        value={line.productId}
                        onPick={(productId) => pickProduct(line.key, productId)}
                      />
                      <Input
                        aria-label={`Description for line ${index + 1}`}
                        className="mt-1.5"
                        placeholder="Description as it should print"
                        value={line.productName}
                        onChange={(e) => updateLine(line.key, { productName: e.target.value })}
                      />
                    </td>

                    <td className="px-2 py-2">
                      <Input
                        aria-label={`HSN code for line ${index + 1}`}
                        className="type-data"
                        value={line.hsnCode ?? ""}
                        onChange={(e) => updateLine(line.key, { hsnCode: e.target.value || null })}
                      />
                    </td>

                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Quantity for line ${index + 1}`}
                        type="number"
                        min={0}
                        step="0.001"
                        className="type-data text-right"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                      />
                    </td>

                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Unit for line ${index + 1}`}
                        value={line.unit}
                        placeholder="Ltr"
                        onChange={(e) => updateLine(line.key, { unit: e.target.value })}
                      />
                    </td>

                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Unit price for line ${index + 1}`}
                        type="number"
                        min={0}
                        step="0.0001"
                        className="type-data text-right"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) })}
                      />
                      {line.masterPrice !== null && (
                        <p className="type-data mt-1 text-[10px] leading-tight text-muted">
                          List {amount(line.masterPrice)}
                          {override !== null && (
                            <span className={override > 0 ? " text-zone-blue" : " text-zone-amber"}>
                              {" "}
                              ({override > 0 ? "+" : ""}
                              {amount(override)})
                            </span>
                          )}
                        </p>
                      )}
                    </td>

                    <td className="px-2 py-2">
                      <Select
                        aria-label={`Discount type for line ${index + 1}`}
                        value={line.discountType}
                        onChange={(e) => updateLine(line.key, { discountType: e.target.value as DiscountType })}
                      >
                        <option value="NONE">None</option>
                        <option value="PERCENTAGE">Percent</option>
                        <option value="FIXED">Amount</option>
                      </Select>
                      {line.discountType !== "NONE" && (
                        <Input
                          aria-label={`Discount value for line ${index + 1}`}
                          type="number"
                          min={0}
                          step="0.01"
                          className="type-data mt-1.5 text-right"
                          value={line.discountValue}
                          onChange={(e) => updateLine(line.key, { discountValue: Number(e.target.value) })}
                        />
                      )}
                    </td>

                    <td className="px-2 py-2">
                      <Input
                        aria-label={`GST rate for line ${index + 1}`}
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        className="type-data text-right"
                        value={line.gstRate}
                        onChange={(e) => updateLine(line.key, { gstRate: Number(e.target.value) })}
                      />
                    </td>

                    <td className="cell-num px-2 py-3 text-sm text-ink">
                      {money(preview?.lineTotal ?? 0)}
                      <span className="block text-[10px] font-normal text-muted">
                        taxable {amount(preview?.taxable ?? 0)}
                      </span>
                    </td>

                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        aria-label={`Remove line ${index + 1}`}
                        className="rounded px-1.5 py-1 text-xs text-muted hover:bg-ground hover:text-danger"
                        onClick={() => setLines((c) => (c.length === 1 ? [emptyLine()] : c.filter((l) => l.key !== line.key)))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ------------------------------------------------------ totals */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel>
          <PanelHeader title="Notes and terms" />
          <div className="grid gap-4 p-4">
            <Field label="Notes" htmlFor="notes" hint="Prints on the document, above the terms.">
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Terms and conditions" htmlFor="terms" hint="Leave blank to use the company default.">
              <Textarea id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
            </Field>
          </div>
        </Panel>

        <Panel className="h-fit">
          <PanelHeader title="Totals" description={isInterState ? "Inter-state — IGST" : "Intra-state — CGST + SGST"} />
          <dl className="divide-y divide-hairline text-sm">
            {[
              ["Subtotal", totals.subtotal],
              ...(totals.discountTotal > 0 ? [["Discount", -totals.discountTotal] as [string, number]] : []),
              ["Taxable value", totals.taxableTotal],
              ...(isInterState
                ? ([["IGST", totals.igstTotal]] as [string, number][])
                : ([
                    ["CGST", totals.cgstTotal],
                    ["SGST", totals.sgstTotal],
                  ] as [string, number][])),
              ...(totals.roundOff !== 0 ? [["Round off", totals.roundOff] as [string, number]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between px-4 py-2">
                <dt className="text-muted">{label}</dt>
                <dd className="type-data text-ink">{money(value as number)}</dd>
              </div>
            ))}
            <div className="flex justify-between bg-brand px-4 py-2.5">
              <dt className="text-sm font-medium text-white">Grand total</dt>
              <dd className="type-data text-sm font-semibold text-white">{money(totals.grandTotal)}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-hairline p-4">
            <Button onClick={submit} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Saving…" : submitLabel}
            </Button>
            {onCancel && (
              <Button variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>

          <p className="border-t border-hairline px-4 py-3 text-[11px] leading-relaxed text-muted">
            These figures are a live preview. The saved document is recalculated on the server in exact paise.
          </p>
        </Panel>
      </div>

      {customers.length === 0 && (
        <p className="text-xs text-muted">
          No customers yet.{" "}
          <Link to="/admin/customers/new" className="text-brand hover:underline">
            Add one first
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/** GST state codes, used by the customer/company forms' own state pickers. */
export const STATE_CODES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

export type { Product };
