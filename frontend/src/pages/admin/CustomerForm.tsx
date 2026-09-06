import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCustomer, useSaveCustomer } from "@/features/queries";
import { STATE_CODES } from "@/components/forms/DocumentEditor";
import { Button, ErrorState, Field, Input, Panel, PanelHeader, Select, Spinner, Textarea } from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";
import { titleCase } from "@/lib/format";
import type { CustomerType } from "@/types";

const TYPES: CustomerType[] = ["INDIVIDUAL", "COMPANY", "SCHOOL", "COLLEGE", "GOVERNMENT", "INSTITUTION", "OTHER"];

interface AddressDraft {
  line1: string;
  line2: string;
  city: string;
  pincode: string;
}

export function CustomerForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const { data: customer, isLoading, error, refetch } = useCustomer(isEdit ? id : undefined);
  const save = useSaveCustomer(id);

  if (isEdit && isLoading) return <Spinner label="Loading customer" />;
  if (isEdit && (error || !customer)) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <CustomerFormBody
      key={customer?.id ?? "new"}
      isEdit={isEdit}
      initial={customer}
      isSaving={save.isPending}
      onSubmit={async (body) => {
        try {
          const saved = await save.mutateAsync(body);
          toast.success(isEdit ? "Customer updated" : "Customer added");
          navigate(`/admin/customers/${saved.id}`);
        } catch (err) {
          toast.error(errorMessage(err, "Could not save the customer"));
        }
      }}
      onCancel={() => navigate(isEdit ? `/admin/customers/${id}` : "/admin/customers")}
    />
  );
}

function CustomerFormBody({
  isEdit,
  initial,
  isSaving,
  onSubmit,
  onCancel,
}: {
  isEdit: boolean;
  initial?: ReturnType<typeof useCustomer>["data"];
  isSaving: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const billingSeed = initial?.addresses?.find((a) => a.addressType === "BILLING") ?? initial?.addresses?.[0];
  const shippingSeed = initial?.addresses?.find((a) => a.addressType === "SHIPPING");

  const [form, setForm] = useState({
    customerType: (initial?.customerType ?? "COMPANY") as CustomerType,
    name: initial?.name ?? "",
    companyName: initial?.companyName ?? "",
    contactPerson: initial?.contactPerson ?? "",
    phone: initial?.phone ?? "",
    alternatePhone: initial?.alternatePhone ?? "",
    email: initial?.email ?? "",
    gstin: initial?.gstin ?? "",
    pan: initial?.pan ?? "",
    stateCode: initial?.stateCode ?? "33",
    notes: initial?.notes ?? "",
    isActive: initial?.isActive ?? true,
  });

  const [billing, setBilling] = useState<AddressDraft>({
    line1: billingSeed?.line1 ?? "",
    line2: billingSeed?.line2 ?? "",
    city: billingSeed?.city ?? "",
    pincode: billingSeed?.pincode ?? "",
  });

  const [shipToSame, setShipToSame] = useState(!shippingSeed);
  const [shipping, setShipping] = useState<AddressDraft>({
    line1: shippingSeed?.line1 ?? "",
    line2: shippingSeed?.line2 ?? "",
    city: shippingSeed?.city ?? "",
    pincode: shippingSeed?.pincode ?? "",
  });

  const state = STATE_CODES.find((s) => s.code === form.stateCode);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  // Phone is optional, but if something is typed it must be a real number, not
  // a stray character or two.
  const phoneValid = form.phone.trim().length === 0 || form.phone.trim().length >= 6;
  const canSubmit = form.name.trim().length >= 2 && phoneValid;

  const submit = () => {
    if (!canSubmit) return;

    const addresses: Record<string, unknown>[] = [];
    if (billing.line1.trim()) {
      addresses.push({
        addressType: "BILLING",
        line1: billing.line1.trim(),
        line2: billing.line2.trim() || null,
        city: billing.city.trim(),
        state: state?.name ?? "",
        stateCode: form.stateCode,
        pincode: billing.pincode.trim() || null,
        isDefault: true,
      });
      if (!shipToSame && shipping.line1.trim()) {
        addresses.push({
          addressType: "SHIPPING",
          line1: shipping.line1.trim(),
          line2: shipping.line2.trim() || null,
          city: shipping.city.trim(),
          state: state?.name ?? "",
          stateCode: form.stateCode,
          pincode: shipping.pincode.trim() || null,
          isDefault: true,
        });
      }
    }

    onSubmit({
      customerType: form.customerType,
      name: form.name.trim(),
      companyName: form.companyName.trim() || null,
      contactPerson: form.contactPerson.trim() || null,
      phone: form.phone.trim() || null,
      alternatePhone: form.alternatePhone.trim() || null,
      email: form.email.trim() || null,
      gstin: form.gstin.trim().toUpperCase() || null,
      pan: form.pan.trim().toUpperCase() || null,
      state: state?.name ?? "",
      stateCode: form.stateCode,
      notes: form.notes.trim() || null,
      isActive: form.isActive,
      ...(addresses.length > 0 ? { addresses } : {}),
    });
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-display text-2xl text-ink">{isEdit ? "Edit customer" : "New customer"}</h1>
        <p className="mt-1 text-xs text-muted">
          The state you set here decides whether their invoices carry CGST + SGST or IGST.
        </p>
      </header>

      <Panel>
        <PanelHeader title="Who they are" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer type" htmlFor="type">
            <Select id="type" value={form.customerType} onChange={(e) => set({ customerType: e.target.value as CustomerType })}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Name" htmlFor="name" required hint="The person or the institution.">
            <Input id="name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>

          <Field label="Organisation name" htmlFor="company" hint="Prints on the invoice when set.">
            <Input id="company" value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} />
          </Field>

          <Field label="Contact person" htmlFor="contact">
            <Input id="contact" value={form.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} />
          </Field>

          <Field
            label="Phone"
            htmlFor="phone"
            hint={phoneValid ? "Optional — leave blank if you don't have one yet." : undefined}
            error={!phoneValid ? "Enter at least 6 digits, or clear it" : undefined}
          >
            <Input
              id="phone"
              inputMode="tel"
              aria-invalid={!phoneValid}
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </Field>

          <Field label="Alternate phone" htmlFor="alt-phone">
            <Input id="alt-phone" inputMode="tel" value={form.alternatePhone} onChange={(e) => set({ alternatePhone: e.target.value })} />
          </Field>

          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>

          <Field label="GSTIN" htmlFor="gstin" hint="Leave blank for unregistered buyers.">
            <Input
              id="gstin"
              className="type-data uppercase"
              maxLength={15}
              value={form.gstin}
              onChange={(e) => set({ gstin: e.target.value })}
            />
          </Field>

          <Field label="PAN" htmlFor="pan">
            <Input id="pan" className="type-data uppercase" maxLength={10} value={form.pan} onChange={(e) => set({ pan: e.target.value })} />
          </Field>

          <Field label="State" htmlFor="state" required hint="Decides the tax treatment.">
            <Select id="state" value={form.stateCode} onChange={(e) => set({ stateCode: e.target.value })}>
              {STATE_CODES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" htmlFor="status">
            <Select id="status" value={form.isActive ? "active" : "inactive"} onChange={(e) => set({ isActive: e.target.value === "active" })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Billing address"
          description="A registered customer, or any invoice of ₹50,000 or more, needs this before the invoice can be issued."
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Address line 1" htmlFor="b1" className="sm:col-span-2">
            <Input id="b1" value={billing.line1} onChange={(e) => setBilling({ ...billing, line1: e.target.value })} />
          </Field>
          <Field label="Address line 2" htmlFor="b2" className="sm:col-span-2">
            <Input id="b2" value={billing.line2} onChange={(e) => setBilling({ ...billing, line2: e.target.value })} />
          </Field>
          <Field label="City / town" htmlFor="bcity">
            <Input id="bcity" value={billing.city} onChange={(e) => setBilling({ ...billing, city: e.target.value })} />
          </Field>
          <Field label="PIN code" htmlFor="bpin">
            <Input
              id="bpin"
              className="type-data"
              inputMode="numeric"
              maxLength={6}
              value={billing.pincode}
              onChange={(e) => setBilling({ ...billing, pincode: e.target.value })}
            />
          </Field>
        </div>

        <div className="border-t border-hairline px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={shipToSame} onChange={(e) => setShipToSame(e.target.checked)} />
            Deliveries go to the billing address
          </label>
        </div>

        {!shipToSame && (
          <div className="grid gap-4 border-t border-hairline p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Delivery line 1" htmlFor="s1" className="sm:col-span-2">
              <Input id="s1" value={shipping.line1} onChange={(e) => setShipping({ ...shipping, line1: e.target.value })} />
            </Field>
            <Field label="Delivery line 2" htmlFor="s2" className="sm:col-span-2">
              <Input id="s2" value={shipping.line2} onChange={(e) => setShipping({ ...shipping, line2: e.target.value })} />
            </Field>
            <Field label="City / town" htmlFor="scity">
              <Input id="scity" value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} />
            </Field>
            <Field label="PIN code" htmlFor="spin">
              <Input
                id="spin"
                className="type-data"
                inputMode="numeric"
                maxLength={6}
                value={shipping.pincode}
                onChange={(e) => setShipping({ ...shipping, pincode: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Internal notes" description="Only staff see these — they never print on a document." />
        <div className="p-4">
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </Panel>

      <div className="flex gap-2">
        <Button onClick={submit} disabled={!canSubmit || isSaving}>
          {isSaving ? "Saving…" : isEdit ? "Save customer" : "Add customer"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
