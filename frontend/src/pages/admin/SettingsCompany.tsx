import { useState } from "react";
import { useCompany, useSaveCompany } from "@/features/queries";
import { STATE_CODES } from "@/components/forms/DocumentEditor";
import { Button, ErrorState, Field, Input, Panel, PanelHeader, Select, Spinner, Textarea } from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";
import type { CompanySettings } from "@/types";

export function SettingsCompany() {
  const { data, isLoading, error, refetch } = useCompany();

  if (isLoading) return <Spinner label="Loading company settings" />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return <SettingsBody key={data?.id ?? "new"} initial={data ?? undefined} />;
}

function SettingsBody({ initial }: { initial?: CompanySettings }) {
  const save = useSaveCompany();
  const toast = useToast();

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    tradeName: initial?.tradeName ?? "",
    legalName: initial?.legalName ?? "",
    gstin: initial?.gstin ?? "",
    pan: initial?.pan ?? "",
    addressLine1: initial?.addressLine1 ?? "",
    addressLine2: initial?.addressLine2 ?? "",
    city: initial?.city ?? "",
    stateCode: initial?.stateCode ?? "33",
    pincode: initial?.pincode ?? "",
    phone: initial?.phone ?? "",
    alternatePhone: initial?.alternatePhone ?? "",
    email: initial?.email ?? "",
    website: initial?.website ?? "",
    logoUrl: initial?.logoUrl ?? "",
    googleMapsUrl: initial?.googleMapsUrl ?? "",
    justdialUrl: initial?.justdialUrl ?? "",
    googlePlaceId: initial?.googlePlaceId ?? "",
    bankName: initial?.bankName ?? "",
    bankAccountName: initial?.bankAccountName ?? "",
    bankAccountNumber: initial?.bankAccountNumber ?? "",
    bankIfsc: initial?.bankIfsc ?? "",
    bankBranch: initial?.bankBranch ?? "",
    upiId: initial?.upiId ?? "",
    quotationPrefix: initial?.quotationPrefix ?? "SVA/QT",
    invoicePrefix: initial?.invoicePrefix ?? "SVA",
    defaultPaymentTerms: initial?.defaultPaymentTerms ?? "Net 15 days",
    defaultQuotationValidityDays: String(initial?.defaultQuotationValidityDays ?? 15),
    defaultInvoiceNotes: initial?.defaultInvoiceNotes ?? "",
    termsAndConditions: initial?.termsAndConditions ?? "",
    roundingMode: initial?.roundingMode ?? "NEAREST_RUPEE",
    allowZeroValueBilling: initial?.allowZeroValueBilling ?? false,
  });

  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const state = STATE_CODES.find((s) => s.code === form.stateCode);

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.addressLine1.trim().length >= 3 &&
    form.city.trim() &&
    /^\d{6}$/.test(form.pincode) &&
    form.phone.trim().length >= 6 &&
    form.email.includes("@");

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await save.mutateAsync({
        ...form,
        tradeName: form.tradeName.trim() || null,
        legalName: form.legalName.trim() || null,
        gstin: form.gstin.trim().toUpperCase() || null,
        pan: form.pan.trim().toUpperCase() || null,
        addressLine2: form.addressLine2.trim() || null,
        state: state?.name ?? "",
        alternatePhone: form.alternatePhone.trim() || null,
        website: form.website.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
        googleMapsUrl: form.googleMapsUrl.trim() || null,
        justdialUrl: form.justdialUrl.trim() || null,
        googlePlaceId: form.googlePlaceId.trim() || null,
        bankName: form.bankName.trim() || null,
        bankAccountName: form.bankAccountName.trim() || null,
        bankAccountNumber: form.bankAccountNumber.trim() || null,
        bankIfsc: form.bankIfsc.trim().toUpperCase() || null,
        bankBranch: form.bankBranch.trim() || null,
        upiId: form.upiId.trim() || null,
        defaultInvoiceNotes: form.defaultInvoiceNotes.trim() || null,
        termsAndConditions: form.termsAndConditions.trim() || null,
        defaultQuotationValidityDays: Number(form.defaultQuotationValidityDays),
      } as never);
      toast.success("Company settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Could not save the settings"));
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-display text-2xl text-ink">Company settings</h1>
        <p className="mt-1 text-xs text-muted">
          Your state code decides whether an invoice carries CGST + SGST or IGST, so it must match your GST registration certificate. These details print on every document.
        </p>
      </header>

      <Panel>
        <PanelHeader title="Business" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Business name" htmlFor="name" required>
            <Input id="name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Trade name" htmlFor="trade" hint="Prints as the heading if set.">
            <Input id="trade" value={form.tradeName} onChange={(e) => set({ tradeName: e.target.value })} />
          </Field>
          <Field label="Legal name" htmlFor="legal">
            <Input id="legal" value={form.legalName} onChange={(e) => set({ legalName: e.target.value })} />
          </Field>
          <Field label="GSTIN" htmlFor="gstin">
            <Input id="gstin" className="type-data uppercase" maxLength={15} value={form.gstin} onChange={(e) => set({ gstin: e.target.value })} />
          </Field>
          <Field label="PAN" htmlFor="pan">
            <Input id="pan" className="type-data uppercase" maxLength={10} value={form.pan} onChange={(e) => set({ pan: e.target.value })} />
          </Field>
          <Field label="Phone" htmlFor="phone" required>
            <Input id="phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Second phone" htmlFor="alt-phone">
            <Input id="alt-phone" value={form.alternatePhone} onChange={(e) => set({ alternatePhone: e.target.value })} />
          </Field>
          <Field label="Email" htmlFor="email" required>
            <Input id="email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input id="website" value={form.website} onChange={(e) => set({ website: e.target.value })} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Address" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Address line 1" htmlFor="a1" required className="sm:col-span-2">
            <Input id="a1" value={form.addressLine1} onChange={(e) => set({ addressLine1: e.target.value })} />
          </Field>
          <Field label="Address line 2" htmlFor="a2" className="sm:col-span-2">
            <Input id="a2" value={form.addressLine2} onChange={(e) => set({ addressLine2: e.target.value })} />
          </Field>
          <Field label="City" htmlFor="city" required>
            <Input id="city" value={form.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="PIN code" htmlFor="pin" required>
            <Input
              id="pin"
              className="type-data"
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={(e) => set({ pincode: e.target.value })}
            />
          </Field>
          <Field label="State" htmlFor="state" required hint="Your place of business for GST." className="sm:col-span-2">
            <Select id="state" value={form.stateCode} onChange={(e) => set({ stateCode: e.target.value })}>
              {STATE_CODES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Website &amp; listings"
          description="Used by the public site. The listing links appear beside the reviews section."
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Logo" htmlFor="logo" hint="A path under /public, or a full URL.">
            <Input id="logo" value={form.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} />
          </Field>
          <Field label="Google Maps listing" htmlFor="gmaps" hint="The share link for your Google Business Profile.">
            <Input id="gmaps" placeholder="https://maps.app.goo.gl/…" value={form.googleMapsUrl} onChange={(e) => set({ googleMapsUrl: e.target.value })} />
          </Field>
          <Field label="JustDial listing" htmlFor="jd" hint="Reviews from here are added by hand — JustDial has no API.">
            <Input id="jd" placeholder="https://www.justdial.com/…" value={form.justdialUrl} onChange={(e) => set({ justdialUrl: e.target.value })} />
          </Field>
          <Field
            label="Google Place ID"
            htmlFor="placeid"
            hint="With a GOOGLE_PLACES_API_KEY on the server, this switches on automatic review import."
          >
            <Input id="placeid" className="type-data" placeholder="ChIJ…" value={form.googlePlaceId} onChange={(e) => set({ googlePlaceId: e.target.value })} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Banking" description="Prints on quotations and invoices so customers can pay." />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Bank" htmlFor="bank">
            <Input id="bank" value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} />
          </Field>
          <Field label="Branch" htmlFor="branch">
            <Input id="branch" value={form.bankBranch} onChange={(e) => set({ bankBranch: e.target.value })} />
          </Field>
          <Field label="Account name" htmlFor="acname">
            <Input id="acname" value={form.bankAccountName} onChange={(e) => set({ bankAccountName: e.target.value })} />
          </Field>
          <Field label="Account number" htmlFor="acno">
            <Input id="acno" className="type-data" value={form.bankAccountNumber} onChange={(e) => set({ bankAccountNumber: e.target.value })} />
          </Field>
          <Field label="IFSC" htmlFor="ifsc">
            <Input id="ifsc" className="type-data uppercase" value={form.bankIfsc} onChange={(e) => set({ bankIfsc: e.target.value })} />
          </Field>
          <Field label="UPI ID" htmlFor="upi">
            <Input id="upi" className="type-data" value={form.upiId} onChange={(e) => set({ upiId: e.target.value })} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Documents" description="Numbering restarts each financial year, e.g. SVA/2026-27/0001." />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Quotation prefix" htmlFor="qprefix">
            <Input id="qprefix" className="type-data" value={form.quotationPrefix} onChange={(e) => set({ quotationPrefix: e.target.value })} />
          </Field>
          <Field label="Invoice prefix" htmlFor="iprefix">
            <Input id="iprefix" className="type-data" value={form.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.target.value })} />
          </Field>
          <Field label="Quotation validity (days)" htmlFor="validity">
            <Input
              id="validity"
              type="number"
              min={1}
              max={365}
              className="type-data text-right"
              value={form.defaultQuotationValidityDays}
              onChange={(e) => set({ defaultQuotationValidityDays: e.target.value })}
            />
          </Field>
          <Field label="Default payment terms" htmlFor="terms" className="sm:col-span-2">
            <Input id="terms" value={form.defaultPaymentTerms} onChange={(e) => set({ defaultPaymentTerms: e.target.value })} />
          </Field>
          <Field label="Rounding" htmlFor="rounding" hint="Applied to the grand total.">
            <Select id="rounding" value={form.roundingMode} onChange={(e) => set({ roundingMode: e.target.value as "NONE" | "NEAREST_RUPEE" })}>
              <option value="NEAREST_RUPEE">Nearest rupee</option>
              <option value="NONE">No rounding</option>
            </Select>
          </Field>
          <Field label="Default invoice notes" htmlFor="inotes" className="sm:col-span-2 lg:col-span-3">
            <Textarea id="inotes" value={form.defaultInvoiceNotes} onChange={(e) => set({ defaultInvoiceNotes: e.target.value })} />
          </Field>
          <Field label="Terms and conditions" htmlFor="tandc" className="sm:col-span-2 lg:col-span-3">
            <Textarea id="tandc" rows={5} value={form.termsAndConditions} onChange={(e) => set({ termsAndConditions: e.target.value })} />
          </Field>
        </div>

        <div className="border-t border-hairline px-4 py-3">
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.allowZeroValueBilling}
              onChange={(e) => set({ allowZeroValueBilling: e.target.checked })}
            />
            <span>
              Allow zero-value lines
              <span className="mt-0.5 block text-xs text-muted">
                Off by default. Turn this on only if free-of-charge lines are part of how you actually invoice.
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <div className="flex gap-2">
        <Button onClick={submit} disabled={!canSubmit || save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
