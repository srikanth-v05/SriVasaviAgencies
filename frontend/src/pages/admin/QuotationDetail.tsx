import { Link, useNavigate, useParams } from "react-router-dom";
import { openPdf } from "@/api/client";
import { useConvertQuotation, useDeleteQuotation, useQuotation, useQuotationAction } from "@/features/queries";
import { DocumentLines, DocumentTotals, PartyBlock } from "@/components/common/DocumentView";
import { Button, ErrorState, Panel, PanelHeader, Spinner, StatusPill } from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";
import { date } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

export function QuotationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();

  const { data: quotation, isLoading, error, refetch } = useQuotation(id);
  const action = useQuotationAction();
  const convert = useConvertQuotation();
  const remove = useDeleteQuotation();

  if (isLoading) return <Spinner label="Loading quotation" />;
  if (error || !quotation) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const isIgst = Number(quotation.igstTotal) > 0;
  const editable = quotation.status === "DRAFT" || quotation.status === "SENT";
  const writable = can("quotations:write");

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const billing = quotation.customer.addresses?.find((a) => a.addressType === "BILLING") ?? quotation.customer.addresses?.[0];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="type-display text-2xl text-ink">{quotation.quotationNumber ?? "Draft quotation"}</h1>
            <StatusPill status={quotation.status} />
          </div>
          <p className="mt-1 text-xs text-muted">
            Raised {date(quotation.quotationDate)}
            {quotation.validUntil && ` · valid until ${date(quotation.validUntil)}`}
            {quotation.createdBy && ` · by ${quotation.createdBy.name}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void openPdf(`/quotations/${quotation.id}/pdf`)}>
            View PDF
          </Button>

          {writable && editable && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/quotations/${quotation.id}/edit`)}>
              Edit
            </Button>
          )}

          {writable && quotation.status === "DRAFT" && (
            <Button size="sm" onClick={() => void run("Marked as sent", () => action.mutateAsync({ id: quotation.id, action: "send" }))}>
              Mark as sent
            </Button>
          )}

          {writable && (quotation.status === "SENT" || quotation.status === "DRAFT") && (
            <>
              <Button size="sm" onClick={() => void run("Quotation accepted", () => action.mutateAsync({ id: quotation.id, action: "accept" }))}>
                Accepted
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void run("Quotation rejected", () => action.mutateAsync({ id: quotation.id, action: "reject" }))}
              >
                Rejected
              </Button>
            </>
          )}

          {writable && quotation.status === "ACCEPTED" && can("invoices:write") && (
            <Button
              size="sm"
              onClick={() =>
                void (async () => {
                  try {
                    const invoice = await convert.mutateAsync(quotation.id);
                    toast.success("Draft invoice created from this quotation");
                    navigate(`/admin/invoices/${invoice.id}`);
                  } catch (err) {
                    toast.error(errorMessage(err));
                  }
                })()
              }
            >
              Convert to invoice
            </Button>
          )}

          {writable && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void (async () => {
                  try {
                    const copy = await action.mutateAsync({ id: quotation.id, action: "duplicate" });
                    toast.success(`Copied to ${copy.quotationNumber}`);
                    navigate(`/admin/quotations/${copy.id}`);
                  } catch (err) {
                    toast.error(errorMessage(err));
                  }
                })()
              }
            >
              Duplicate
            </Button>
          )}

          {writable && quotation.status === "DRAFT" && (
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                void (async () => {
                  if (!window.confirm("Delete this draft quotation? This cannot be undone.")) return;
                  try {
                    await remove.mutateAsync(quotation.id);
                    toast.success("Draft deleted");
                    navigate("/admin/quotations");
                  } catch (err) {
                    toast.error(errorMessage(err));
                  }
                })()
              }
            >
              Delete
            </Button>
          )}
        </div>
      </header>

      {quotation.invoice && (
        <p className="panel px-4 py-2.5 text-xs text-ink-soft">
          Converted to invoice{" "}
          <Link to={`/admin/invoices/${quotation.invoice.id}`} className="type-data text-brand hover:underline">
            {quotation.invoice.invoiceNumber ?? "draft"}
          </Link>
          .
        </p>
      )}

      <Panel>
        <div className="grid gap-6 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <PartyBlock
            title="Quotation for"
            name={quotation.customer.companyName ?? quotation.customer.name}
            gstin={quotation.customer.gstin}
            address={billing ? [billing.line1, billing.line2, `${billing.city} ${billing.pincode}`].filter(Boolean).join(", ") : null}
            phone={quotation.customer.phone}
            state={`${quotation.customer.state} (${quotation.customer.stateCode})`}
          />
          <div>
            <p className="type-eyebrow text-[10px]">Place of supply</p>
            <p className="mt-1.5 text-sm text-ink">
              {quotation.placeOfSupply} ({quotation.placeOfSupplyStateCode})
            </p>
            <p className="mt-1 text-xs text-muted">{isIgst ? "Inter-state — IGST" : "Intra-state — CGST + SGST"}</p>
          </div>
          <div>
            <p className="type-eyebrow text-[10px]">Date</p>
            <p className="mt-1.5 text-sm text-ink">{date(quotation.quotationDate)}</p>
          </div>
          <div>
            <p className="type-eyebrow text-[10px]">Valid until</p>
            <p className="mt-1.5 text-sm text-ink">{date(quotation.validUntil)}</p>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Items" description="Values saved with the quotation — later product changes do not affect them." />
        <DocumentLines items={quotation.items} isIgst={isIgst} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel>
          <PanelHeader title="Notes and terms" />
          <div className="space-y-3 p-4 text-xs leading-relaxed text-ink-soft">
            {quotation.notes && <p className="whitespace-pre-wrap">{quotation.notes}</p>}
            {quotation.termsAndConditions && <p className="whitespace-pre-wrap text-muted">{quotation.termsAndConditions}</p>}
            {!quotation.notes && !quotation.termsAndConditions && <p className="text-muted">None recorded.</p>}
          </div>
        </Panel>

        <Panel className="h-fit">
          <PanelHeader title="Totals" />
          <DocumentTotals totals={quotation} isIgst={isIgst} />
        </Panel>
      </div>
    </div>
  );
}
