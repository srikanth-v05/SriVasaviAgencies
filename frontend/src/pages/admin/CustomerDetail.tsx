import { Link, useNavigate, useParams } from "react-router-dom";
import { download } from "@/api/client";
import { useCustomer, useCustomerLedger } from "@/features/queries";
import {
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  Panel,
  PanelHeader,
  Spinner,
  StatusPill,
  TableShell,
} from "@/components/common/ui";
import { amount, date, money, titleCase } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();

  const { data: customer, isLoading, error, refetch } = useCustomer(id);
  const { data: ledger } = useCustomerLedger(id);

  if (isLoading) return <Spinner label="Loading customer" />;
  if (error || !customer) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const billing = customer.addresses?.find((a) => a.addressType === "BILLING") ?? customer.addresses?.[0];
  const shipping = customer.addresses?.find((a) => a.addressType === "SHIPPING");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="type-display text-2xl text-ink">{customer.companyName ?? customer.name}</h1>
          <p className="mt-1 text-xs text-muted">
            {titleCase(customer.customerType)} · {customer.state} ({customer.stateCode})
            {customer.gstin && ` · GSTIN ${customer.gstin}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("exports:read") && (
            <Button variant="secondary" size="sm" onClick={() => void download("/exports/customer-ledger.xlsx", { customerId: customer.id })}>
              Export ledger
            </Button>
          )}
          {can("quotations:write") && <LinkButton to="/admin/quotations/new" variant="secondary" size="sm">New quotation</LinkButton>}
          {can("customers:write") && (
            <Button size="sm" onClick={() => navigate(`/admin/customers/${customer.id}/edit`)}>
              Edit
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Panel>
          <PanelHeader title="Details" />
          <dl className="grid gap-5 p-4 sm:grid-cols-2">
            <div>
              <dt className="type-eyebrow text-[10px]">Contact</dt>
              <dd className="mt-1.5 text-sm text-ink">{customer.contactPerson ?? customer.name}</dd>
              {customer.phone && <dd className="type-data text-xs text-muted">{customer.phone}</dd>}
              {customer.alternatePhone && <dd className="type-data text-xs text-muted">{customer.alternatePhone}</dd>}
              {!customer.phone && !customer.alternatePhone && !customer.email && (
                <dd className="text-xs text-faint">No contact number on file</dd>
              )}
              {customer.email && <dd className="text-xs text-muted">{customer.email}</dd>}
            </div>

            <div>
              <dt className="type-eyebrow text-[10px]">Tax</dt>
              <dd className="type-data mt-1.5 text-sm text-ink">{customer.gstin ?? "Unregistered"}</dd>
              {customer.pan && <dd className="type-data text-xs text-muted">PAN {customer.pan}</dd>}
            </div>

            <div>
              <dt className="type-eyebrow text-[10px]">Billing address</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink">
                {billing
                  ? [billing.line1, billing.line2, `${billing.city} ${billing.pincode}`, billing.state].filter(Boolean).join(", ")
                  : "Not recorded"}
              </dd>
            </div>

            <div>
              <dt className="type-eyebrow text-[10px]">Delivery address</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink">
                {shipping
                  ? [shipping.line1, shipping.line2, `${shipping.city} ${shipping.pincode}`, shipping.state].filter(Boolean).join(", ")
                  : "Same as billing"}
              </dd>
            </div>

            {customer.notes && (
              <div className="sm:col-span-2">
                <dt className="type-eyebrow text-[10px]">Internal notes</dt>
                <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{customer.notes}</dd>
              </div>
            )}
          </dl>
        </Panel>

        <Panel className="h-fit">
          <PanelHeader title="Account" />
          <dl className="divide-y divide-hairline text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-muted">Outstanding</dt>
              <dd className={`type-data ${Number(ledger?.outstanding ?? 0) > 0 ? "text-zone-amber" : "text-ink"}`}>
                {money(ledger?.outstanding ?? 0)}
              </dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-muted">Ledger balance</dt>
              <dd className="type-data text-ink">{money(ledger?.closingBalance ?? 0)}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-muted">Entries</dt>
              <dd className="type-data text-ink">{ledger?.entries.length ?? 0}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Ledger" description="Invoices debit the account, payments credit it." />
        {!ledger || ledger.entries.length === 0 ? (
          <EmptyState title="No transactions yet" description="Quotations do not appear here until they become invoices." />
        ) : (
          <TableShell
            head={
              <>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2 text-right">Debit</th>
                <th className="px-4 py-2 text-right">Credit</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </>
            }
          >
            {ledger.entries.map((entry) => (
              <tr key={`${entry.type}-${entry.referenceId}`}>
                <td className="px-4 py-2.5 text-xs text-muted">{date(entry.date)}</td>
                <td className="px-4 py-2.5">
                  <StatusPill status={entry.type === "INVOICE" ? "ISSUED" : "PAID"} />
                </td>
                <td className="px-4 py-2.5">
                  {entry.type === "INVOICE" ? (
                    <Link to={`/admin/invoices/${entry.referenceId}`} className="type-data text-xs text-brand hover:underline">
                      {entry.reference}
                    </Link>
                  ) : (
                    <span className="type-data text-xs text-ink-soft">{entry.reference}</span>
                  )}
                </td>
                <td className="cell-num px-4 py-2.5 text-sm">{Number(entry.debit) ? amount(entry.debit) : "—"}</td>
                <td className="cell-num px-4 py-2.5 text-sm">{Number(entry.credit) ? amount(entry.credit) : "—"}</td>
                <td className="cell-num px-4 py-2.5 text-sm font-medium">{amount(entry.balance)}</td>
              </tr>
            ))}
          </TableShell>
        )}
      </Panel>
    </div>
  );
}
