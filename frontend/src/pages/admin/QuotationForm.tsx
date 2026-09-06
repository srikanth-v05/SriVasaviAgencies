import { useNavigate, useParams } from "react-router-dom";
import { DocumentEditor, type DocumentPayload } from "@/components/forms/DocumentEditor";
import { useQuotation, useSaveQuotation } from "@/features/queries";
import { ErrorState, Spinner } from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";

export function QuotationForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const { data: quotation, isLoading, error, refetch } = useQuotation(isEdit ? id : undefined);
  const save = useSaveQuotation(id);

  if (isEdit && isLoading) return <Spinner label="Loading quotation" />;
  if (isEdit && (error || !quotation)) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const onSubmit = async (payload: DocumentPayload) => {
    try {
      const saved = await save.mutateAsync({
        customerId: payload.customerId,
        quotationDate: payload.date,
        validUntil: payload.secondaryDate || null,
        placeOfSupply: payload.placeOfSupply || undefined,
        placeOfSupplyStateCode: payload.placeOfSupplyStateCode || undefined,
        notes: payload.notes || null,
        termsAndConditions: payload.termsAndConditions || null,
        items: payload.items,
      });
      toast.success(isEdit ? "Quotation updated" : `Quotation ${saved.quotationNumber} created`);
      navigate(`/admin/quotations/${saved.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not save the quotation"));
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-display text-2xl text-ink">
          {isEdit ? `Edit ${quotation?.quotationNumber ?? "quotation"}` : "New quotation"}
        </h1>
        <p className="mt-1 text-xs text-muted">
          Enter any price you have agreed. The product list price is a starting point, not a limit.
        </p>
      </header>

      <DocumentEditor
        kind="quotation"
        submitLabel={isEdit ? "Save quotation" : "Create quotation"}
        isSubmitting={save.isPending}
        onCancel={() => navigate(isEdit ? `/admin/quotations/${id}` : "/admin/quotations")}
        onSubmit={onSubmit}
        initial={
          quotation
            ? {
                customerId: quotation.customerId,
                date: quotation.quotationDate,
                secondaryDate: quotation.validUntil,
                placeOfSupplyStateCode: quotation.placeOfSupplyStateCode,
                notes: quotation.notes,
                termsAndConditions: quotation.termsAndConditions,
                items: quotation.items,
              }
            : undefined
        }
      />
    </div>
  );
}
