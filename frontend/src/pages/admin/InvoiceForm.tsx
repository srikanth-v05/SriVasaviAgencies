import { useNavigate, useParams } from "react-router-dom";
import { DocumentEditor, type DocumentPayload } from "@/components/forms/DocumentEditor";
import { useInvoice, useSaveInvoice } from "@/features/queries";
import { ErrorState, Spinner } from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";

export function InvoiceForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const { data: invoice, isLoading, error, refetch } = useInvoice(isEdit ? id : undefined);
  const save = useSaveInvoice(id);

  if (isEdit && isLoading) return <Spinner label="Loading invoice" />;
  if (isEdit && (error || !invoice)) return <ErrorState error={error} onRetry={() => void refetch()} />;

  if (invoice && invoice.invoiceNumber) {
    return (
      <ErrorState
        error={new Error(`${invoice.invoiceNumber} has been issued and can no longer be edited. Cancel it and raise a fresh invoice if the figures must change.`)}
      />
    );
  }

  const onSubmit = async (payload: DocumentPayload) => {
    try {
      const saved = await save.mutateAsync({
        customerId: payload.customerId,
        invoiceDate: payload.date,
        dueDate: payload.secondaryDate || null,
        placeOfSupply: payload.placeOfSupply || undefined,
        placeOfSupplyStateCode: payload.placeOfSupplyStateCode || undefined,
        paymentTerms: payload.paymentTerms || null,
        notes: payload.notes || null,
        termsAndConditions: payload.termsAndConditions || null,
        poNumber: payload.poNumber || null,
        vehicleNumber: payload.vehicleNumber || null,
        items: payload.items,
      });
      toast.success(isEdit ? "Invoice updated" : "Draft invoice created");
      navigate(`/admin/invoices/${saved.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not save the invoice"));
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-display text-2xl text-ink">{isEdit ? "Edit draft invoice" : "New invoice"}</h1>
        <p className="mt-1 text-xs text-muted">
          Saved as a draft. It becomes a numbered tax invoice only when you issue it.
        </p>
      </header>

      <DocumentEditor
        kind="invoice"
        submitLabel={isEdit ? "Save draft" : "Create draft invoice"}
        isSubmitting={save.isPending}
        onCancel={() => navigate(isEdit ? `/admin/invoices/${id}` : "/admin/invoices")}
        onSubmit={onSubmit}
        initial={
          invoice
            ? {
                customerId: invoice.customerId,
                date: invoice.invoiceDate,
                secondaryDate: invoice.dueDate,
                notes: invoice.notes,
                termsAndConditions: invoice.termsAndConditions,
                paymentTerms: invoice.paymentTerms,
                poNumber: invoice.poNumber,
                vehicleNumber: invoice.vehicleNumber,
                items: invoice.items,
              }
            : undefined
        }
      />
    </div>
  );
}
