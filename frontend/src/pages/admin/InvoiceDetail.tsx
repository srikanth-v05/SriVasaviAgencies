import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { download } from "@/api/client";
import {
  useCancelInvoice,
  useDeleteInvoice,
  useDeletePayment,
  useFinalizeInvoice,
  useInvoice,
  useRecordPayment,
  useUpdateInvoicePoNumber,
} from "@/features/queries";
import { DocumentLines, DocumentTotals, PartyBlock } from "@/components/common/DocumentView";
import { Button, ErrorState, Field, Input, Panel, PanelHeader, Select, Spinner, StatusPill, TableShell, EmptyState } from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";
import { date, money, today, titleCase } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import type { PaymentMethod } from "@/types";

const METHODS: PaymentMethod[] = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"];

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();

  const { data: invoice, isLoading, error, refetch } = useInvoice(id);
  const finalize = useFinalizeInvoice();
  const cancel = useCancelInvoice();
  const remove = useDeleteInvoice();
  const recordPayment = useRecordPayment();
  const deletePayment = useDeletePayment();
  const updatePoNumber = useUpdateInvoicePoNumber();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payment, setPayment] = useState({ amount: "", paymentDate: today(), paymentMethod: "UPI" as PaymentMethod, referenceNumber: "" });
  const [editingPo, setEditingPo] = useState(false);
  const [poDraft, setPoDraft] = useState("");

  if (isLoading) return <Spinner label="Loading invoice" />;
  if (error || !invoice) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const isIgst = Number(invoice.igstTotal) > 0;
  const isIssued = Boolean(invoice.invoiceNumber);
  const isDraft = invoice.status === "DRAFT" || invoice.status === "READY_TO_ISSUE";
  const writable = can("invoices:write");

  const billing = invoice.customer.addresses?.find((a) => a.addressType === "BILLING") ?? invoice.customer.addresses?.[0];

  const submitPayment = async () => {
    try {
      await recordPayment.mutateAsync({
        invoiceId: invoice.id,
        amount: Number(payment.amount),
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber || null,
      });
      toast.success("Payment recorded");
      setPaymentOpen(false);
      setPayment({ amount: "", paymentDate: today(), paymentMethod: "UPI", referenceNumber: "" });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const savePoNumber = async () => {
    try {
      await updatePoNumber.mutateAsync({ id: invoice.id, poNumber: poDraft.trim() || null });
      toast.success("PO number updated");
      setEditingPo(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="type-display text-2xl text-ink">{invoice.invoiceNumber ?? "Draft invoice"}</h1>
            <StatusPill status={invoice.status} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {date(invoice.invoiceDate)}
            {invoice.dueDate && ` · due ${date(invoice.dueDate)}`}
            {invoice.quotation && (
              <>
                {" · from "}
                <Link to={`/admin/quotations/${invoice.quotation.id}`} className="type-data text-brand hover:underline">
                  {invoice.quotation.quotationNumber}
                </Link>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void download(`/invoices/${invoice.id}/pdf`, { download: "true" })}>
            Download PDF
          </Button>

          {writable && isDraft && (
            <>
              <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/invoices/${invoice.id}/edit`)}>
                Edit
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  void (async () => {
                    const raw = window.prompt(
                      "Issue this invoice. It can no longer be edited afterwards.\n\nLeave this blank to continue the normal numbering, or type a number to start (or resume) the series from there, e.g. 451:",
                    );
                    if (raw === null) return;

                    const trimmed = raw.trim();
                    const startSequence = trimmed ? Number(trimmed) : undefined;
                    if (trimmed && (!Number.isInteger(startSequence) || (startSequence as number) <= 0)) {
                      toast.error("Enter a whole number greater than 0, or leave it blank");
                      return;
                    }

                    try {
                      const issued = await finalize.mutateAsync({ id: invoice.id, startSequence });
                      toast.success(`Issued as ${issued.invoiceNumber}`);
                    } catch (err) {
                      toast.error(errorMessage(err));
                    }
                  })()
                }
              >
                Issue invoice
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  void (async () => {
                    if (!window.confirm("Delete this draft invoice?")) return;
                    try {
                      await remove.mutateAsync(invoice.id);
                      toast.success("Draft deleted");
                      navigate("/admin/invoices");
                    } catch (err) {
                      toast.error(errorMessage(err));
                    }
                  })()
                }
              >
                Delete
              </Button>
            </>
          )}

          {writable && can("payments:write") && isIssued && invoice.status !== "CANCELLED" && Number(invoice.balanceDue) > 0 && (
            <Button size="sm" onClick={() => setPaymentOpen((open) => !open)}>
              Record payment
            </Button>
          )}

          {writable && invoice.status !== "CANCELLED" && invoice.payments.length === 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                void (async () => {
                  const reason = window.prompt("Why is this invoice being cancelled? The record and its number are kept.");
                  if (!reason) return;
                  try {
                    await cancel.mutateAsync({ id: invoice.id, reason });
                    toast.success("Invoice cancelled");
                  } catch (err) {
                    toast.error(errorMessage(err));
                  }
                })()
              }
            >
              Cancel invoice
            </Button>
          )}
        </div>
      </header>

      {isDraft && (
        <p className="panel border-l-2 border-l-zone-amber px-4 py-2.5 text-xs text-ink-soft">
          This is a draft. It carries no invoice number and is not a valid tax invoice until you issue it.
        </p>
      )}

      {invoice.status === "CANCELLED" && (
        <p className="panel border-l-2 border-l-danger px-4 py-2.5 text-xs text-ink-soft">
          Cancelled{invoice.cancellationReason ? `: ${invoice.cancellationReason}` : ""}. The record and its number are
          retained for the audit trail.
        </p>
      )}

      {paymentOpen && (
        <Panel>
          <PanelHeader title="Record a payment" description={`${money(invoice.balanceDue)} outstanding on this invoice.`} />
          <div className="grid gap-4 p-4 sm:grid-cols-4">
            <Field label="Amount" htmlFor="pay-amount" required>
              <Input
                id="pay-amount"
                type="number"
                min={0}
                step="0.01"
                className="type-data text-right"
                value={payment.amount}
                onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              />
            </Field>
            <Field label="Date" htmlFor="pay-date">
              <Input id="pay-date" type="date" value={payment.paymentDate} onChange={(e) => setPayment({ ...payment, paymentDate: e.target.value })} />
            </Field>
            <Field label="Method" htmlFor="pay-method">
              <Select
                id="pay-method"
                value={payment.paymentMethod}
                onChange={(e) => setPayment({ ...payment, paymentMethod: e.target.value as PaymentMethod })}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {titleCase(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference" htmlFor="pay-ref" hint="UTR, cheque number, receipt no.">
              <Input id="pay-ref" value={payment.referenceNumber} onChange={(e) => setPayment({ ...payment, referenceNumber: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2 border-t border-hairline p-4">
            <Button onClick={submitPayment} disabled={!payment.amount || recordPayment.isPending}>
              {recordPayment.isPending ? "Saving…" : "Save payment"}
            </Button>
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <Panel>
        <div className="grid gap-6 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <PartyBlock
            title="Bill to"
            name={invoice.customerNameSnapshot ?? invoice.customer.companyName ?? invoice.customer.name}
            gstin={invoice.customerGstinSnapshot ?? invoice.customer.gstin}
            address={
              invoice.customerAddressSnapshot ??
              (billing ? [billing.line1, billing.line2, [billing.city, billing.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ") : null)
            }
            phone={invoice.customer.phone}
            state={`${invoice.customer.state} (${invoice.customer.stateCode})`}
          />
          <div>
            <p className="type-eyebrow text-[10px]">Place of supply</p>
            <p className="mt-1.5 text-sm text-ink">
              {invoice.placeOfSupply} ({invoice.placeOfSupplyStateCode})
            </p>
            <p className="mt-1 text-xs text-muted">{isIgst ? "Inter-state — IGST" : "Intra-state — CGST + SGST"}</p>
          </div>
          <div>
            <p className="type-eyebrow text-[10px]">Payment terms</p>
            <p className="mt-1.5 text-sm text-ink">{invoice.paymentTerms ?? "—"}</p>
          </div>
          <div>
            <p className="type-eyebrow text-[10px]">Balance due</p>
            <p className={`type-data mt-1.5 text-lg ${Number(invoice.balanceDue) > 0 ? "text-zone-amber" : "text-zone-green"}`}>
              {money(invoice.balanceDue)}
            </p>
          </div>
          <div>
            <p className="type-eyebrow text-[10px]">PO number</p>
            {editingPo ? (
              <div className="mt-1.5 flex items-center gap-1.5">
                <Input
                  autoFocus
                  className="h-7 w-28 text-sm"
                  value={poDraft}
                  onChange={(e) => setPoDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void savePoNumber();
                    if (e.key === "Escape") setEditingPo(false);
                  }}
                />
                <Button size="sm" disabled={updatePoNumber.isPending} onClick={() => void savePoNumber()}>
                  Save
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditingPo(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <p className="type-data mt-1.5 flex items-center gap-2 text-sm text-ink">
                {invoice.poNumber ?? "—"}
                {writable && (
                  <button
                    type="button"
                    className="text-xs font-normal text-muted underline decoration-dotted underline-offset-2 hover:text-ink"
                    onClick={() => {
                      setPoDraft(invoice.poNumber ?? "");
                      setEditingPo(true);
                    }}
                  >
                    Edit
                  </button>
                )}
              </p>
            )}
          </div>
          {invoice.vehicleNumber && (
            <div>
              <p className="type-eyebrow text-[10px]">Vehicle number</p>
              <p className="type-data mt-1.5 text-sm text-ink">{invoice.vehicleNumber}</p>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Items" />
        <DocumentLines items={invoice.items} isIgst={isIgst} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel>
          <PanelHeader title="Payments" description="Every receipt against this invoice." />
          {invoice.payments.length === 0 ? (
            <EmptyState title="Nothing received yet" />
          ) : (
            <TableShell
              head={
                <>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2">Reference</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="w-10 px-4 py-2" />
                </>
              }
            >
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{date(p.paymentDate)}</td>
                  <td className="px-4 py-2.5 text-xs">{titleCase(p.paymentMethod)}</td>
                  <td className="type-data px-4 py-2.5 text-xs text-muted">{p.referenceNumber ?? "—"}</td>
                  <td className="cell-num px-4 py-2.5 text-sm">{money(p.amount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {can("payments:write") && (
                      <button
                        type="button"
                        aria-label="Delete payment"
                        className="rounded px-1.5 py-1 text-xs text-muted hover:text-danger"
                        onClick={() =>
                          void (async () => {
                            if (!window.confirm("Remove this payment? The invoice balance will be recalculated.")) return;
                            try {
                              await deletePayment.mutateAsync(p.id);
                              toast.success("Payment removed");
                            } catch (err) {
                              toast.error(errorMessage(err));
                            }
                          })()
                        }
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </Panel>

        <Panel className="h-fit">
          <PanelHeader title="Totals" />
          <DocumentTotals
            totals={invoice}
            isIgst={isIgst}
            extraRows={[
              ["Amount paid", money(invoice.amountPaid)],
              ["Balance due", money(invoice.balanceDue)],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
