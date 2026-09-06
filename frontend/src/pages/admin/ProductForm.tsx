import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCategories, useGstRates, useProduct, useSaveProduct, useUnits } from "@/features/queries";
import { Button, ErrorState, Field, Input, Panel, PanelHeader, Select, Spinner, Textarea } from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";
import type { Product } from "@/types";

export function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const { data: product, isLoading, error, refetch } = useProduct(isEdit ? id : undefined);
  const save = useSaveProduct(id);

  if (isEdit && isLoading) return <Spinner label="Loading product" />;
  if (isEdit && (error || !product)) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <ProductFormBody
      key={product?.id ?? "new"}
      isEdit={isEdit}
      initial={product}
      isSaving={save.isPending}
      onCancel={() => navigate("/admin/products")}
      onSubmit={async (body) => {
        try {
          await save.mutateAsync(body);
          toast.success(isEdit ? "Product updated" : "Product added");
          navigate("/admin/products");
        } catch (err) {
          toast.error(errorMessage(err, "Could not save the product"));
        }
      }}
    />
  );
}

function ProductFormBody({
  isEdit,
  initial,
  isSaving,
  onSubmit,
  onCancel,
}: {
  isEdit: boolean;
  initial?: Product;
  isSaving: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { data: categories } = useCategories();
  const { data: units } = useUnits();
  const { data: gstRates } = useGstRates();

  const [form, setForm] = useState({
    productCode: initial?.productCode ?? "",
    name: initial?.name ?? "",
    categoryId: initial?.categoryId ?? "",
    description: initial?.description ?? "",
    dilutionRatio: initial?.dilutionRatio ?? "",
    packSize: initial?.packSize ?? "",
    hsnCode: initial?.hsnCode ?? "",
    defaultPrice: String(initial?.defaultPrice ?? ""),
    defaultGstRate: String(initial?.defaultGstRate ?? "18"),
    unitId: initial?.unitId ?? "",
    isActive: initial?.isActive ?? true,
    showOnWebsite: initial?.showOnWebsite ?? true,
  });

  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const unitId = form.unitId || units?.[0]?.id || "";
  const canSubmit = form.name.trim().length >= 2 && unitId && form.defaultPrice !== "";

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: form.name.trim(),
      categoryId: form.categoryId || null,
      description: form.description.trim() || null,
      dilutionRatio: form.dilutionRatio.trim() || null,
      packSize: form.packSize.trim() || null,
      hsnCode: form.hsnCode.trim() || null,
      defaultPrice: Number(form.defaultPrice),
      defaultGstRate: Number(form.defaultGstRate),
      unitId,
      isActive: form.isActive,
      showOnWebsite: form.showOnWebsite,
    });
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-display text-2xl text-ink">{isEdit ? "Edit product" : "New product"}</h1>
        <p className="mt-1 text-xs text-muted">
          Changing a price here affects future documents only. Quotations and invoices already raised keep their own figures.
        </p>
      </header>

      <Panel>
        <PanelHeader title="Product" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {isEdit && (
            <Field label="Product code" htmlFor="code" hint="Assigned automatically when the product was created.">
              <Input id="code" className="type-data" value={form.productCode} disabled />
            </Field>
          )}

          <Field label="Name" htmlFor="name" required className={isEdit ? "sm:col-span-2" : "sm:col-span-2 lg:col-span-3"}>
            <Input id="name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>

          <Field label="Category" htmlFor="category" hint="Sets the colour zone on the website.">
            <Select id="category" value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="">Uncategorised</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Unit" htmlFor="unit" required>
            <Select id="unit" value={unitId} onChange={(e) => set({ unitId: e.target.value })}>
              {units?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.shortName})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="HSN code" htmlFor="hsn" hint="Required before an invoice can be issued.">
            <Input id="hsn" className="type-data" value={form.hsnCode} onChange={(e) => set({ hsnCode: e.target.value })} />
          </Field>

          <Field label="List price" htmlFor="price" required hint="Per unit, before GST. A default only.">
            <Input
              id="price"
              type="number"
              min={0}
              step="0.0001"
              className="type-data text-right"
              value={form.defaultPrice}
              onChange={(e) => set({ defaultPrice: e.target.value })}
            />
          </Field>

          <Field label="GST rate" htmlFor="gst" required>
            <Select id="gst" value={form.defaultGstRate} onChange={(e) => set({ defaultGstRate: e.target.value })}>
              {(gstRates ?? [{ id: "d", rate: 18, label: "18%" }]).map((rate) => (
                <option key={rate.id} value={String(rate.rate)}>
                  {rate.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Pack size" htmlFor="pack" hint="For example: 5 Ltr can.">
            <Input id="pack" value={form.packSize} onChange={(e) => set({ packSize: e.target.value })} />
          </Field>

          <Field label="Dilution" htmlFor="dilution" hint="For example: 1:20. Drives the cost-in-use calculator.">
            <Input id="dilution" className="type-data" value={form.dilutionRatio} onChange={(e) => set({ dilutionRatio: e.target.value })} />
          </Field>

          <Field label="Description" htmlFor="description" className="sm:col-span-2 lg:col-span-3">
            <Textarea id="description" value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-6 border-t border-hairline px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
            Available for billing
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={form.showOnWebsite} onChange={(e) => set({ showOnWebsite: e.target.checked })} />
            Show in the public catalogue
          </label>
        </div>
      </Panel>

      <div className="flex gap-2">
        <Button onClick={submit} disabled={!canSubmit || isSaving}>
          {isSaving ? "Saving…" : isEdit ? "Save product" : "Add product"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
