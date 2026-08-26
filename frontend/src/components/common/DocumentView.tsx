import type { DocumentLine, DocumentTotals as Totals } from "@/types";
import { amount, money, percent, quantity } from "@/lib/format";
import { TableShell } from "./ui";

/** Read-only rendering of a saved document's lines — the stored snapshot, verbatim. */
export function DocumentLines({ items, isIgst }: { items: DocumentLine[]; isIgst: boolean }) {
  return (
    <TableShell
      head={
        <>
          <th className="w-8 px-3 py-2">#</th>
          <th className="px-3 py-2">Description</th>
          <th className="w-24 px-3 py-2">HSN</th>
          <th className="w-20 px-3 py-2 text-right">Qty</th>
          <th className="w-16 px-3 py-2">Unit</th>
          <th className="w-24 px-3 py-2 text-right">Rate</th>
          <th className="w-24 px-3 py-2 text-right">Taxable</th>
          <th className="w-16 px-3 py-2 text-right">GST</th>
          <th className="w-28 px-3 py-2 text-right">{isIgst ? "IGST" : "CGST + SGST"}</th>
          <th className="w-28 px-3 py-2 text-right">Amount</th>
        </>
      }
    >
      {items.map((item) => (
        <tr key={item.id ?? item.lineNumber}>
          <td className="px-3 py-2.5 text-xs text-muted">{item.lineNumber}</td>
          <td className="px-3 py-2.5">
            <p className="text-sm text-ink">{item.productNameSnapshot}</p>
            {Number(item.lineDiscount) > 0 && (
              <p className="type-data text-[11px] text-muted">Less discount {amount(item.lineDiscount)}</p>
            )}
            {item.masterPriceSnapshot !== null && Number(item.masterPriceSnapshot) !== Number(item.unitPrice) && (
              <p className="type-data text-[11px] text-muted">
                List price was {amount(item.masterPriceSnapshot)} · billed at {amount(item.unitPrice)}
              </p>
            )}
          </td>
          <td className="type-data px-3 py-2.5 text-xs text-ink-soft">{item.hsnCodeSnapshot ?? "—"}</td>
          <td className="cell-num px-3 py-2.5 text-sm">{quantity(item.quantity)}</td>
          <td className="px-3 py-2.5 text-xs text-ink-soft">{item.unitSnapshot}</td>
          <td className="cell-num px-3 py-2.5 text-sm">{amount(item.unitPrice)}</td>
          <td className="cell-num px-3 py-2.5 text-sm">{amount(item.lineTaxableValue)}</td>
          <td className="cell-num px-3 py-2.5 text-xs text-muted">{percent(item.gstRate)}</td>
          <td className="cell-num px-3 py-2.5 text-sm">
            {isIgst ? amount(item.igstAmount) : amount(Number(item.cgstAmount) + Number(item.sgstAmount))}
          </td>
          <td className="cell-num px-3 py-2.5 text-sm font-medium">{amount(item.lineTotal)}</td>
        </tr>
      ))}
    </TableShell>
  );
}

export function DocumentTotals({
  totals,
  isIgst,
  extraRows,
}: {
  totals: Totals;
  isIgst: boolean;
  extraRows?: [string, string][];
}) {
  const rows: [string, string][] = [
    ["Subtotal", money(totals.subtotal)],
    ...(Number(totals.discountTotal) > 0 ? ([["Discount", `− ${money(totals.discountTotal)}`]] as [string, string][]) : []),
    ["Taxable value", money(totals.taxableTotal)],
    ...(isIgst
      ? ([["IGST", money(totals.igstTotal)]] as [string, string][])
      : ([
          ["CGST", money(totals.cgstTotal)],
          ["SGST", money(totals.sgstTotal)],
        ] as [string, string][])),
    ...(Number(totals.roundOff) !== 0 ? ([["Round off", money(totals.roundOff)]] as [string, string][]) : []),
  ];

  return (
    <dl className="divide-y divide-hairline text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between px-4 py-2">
          <dt className="text-muted">{label}</dt>
          <dd className="type-data text-ink">{value}</dd>
        </div>
      ))}
      <div className="flex justify-between bg-brand px-4 py-2.5">
        <dt className="text-sm font-medium text-white">Grand total</dt>
        <dd className="type-data text-sm font-semibold text-white">{money(totals.grandTotal)}</dd>
      </div>
      {extraRows?.map(([label, value]) => (
        <div key={label} className="flex justify-between px-4 py-2">
          <dt className="text-muted">{label}</dt>
          <dd className="type-data text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Buyer block as it will print on the document. */
export function PartyBlock({
  title,
  name,
  gstin,
  address,
  phone,
  state,
}: {
  title: string;
  name: string;
  gstin?: string | null;
  address?: string | null;
  phone?: string | null;
  state?: string | null;
}) {
  return (
    <div>
      <p className="type-eyebrow text-[10px]">{title}</p>
      <p className="mt-1.5 text-sm font-medium text-ink">{name}</p>
      {address && <p className="mt-0.5 text-xs leading-relaxed text-muted">{address}</p>}
      {state && <p className="text-xs text-muted">{state}</p>}
      {gstin && <p className="type-data mt-1 text-[11px] text-ink-soft">GSTIN {gstin}</p>}
      {phone && <p className="type-data text-[11px] text-muted">{phone}</p>}
    </div>
  );
}
