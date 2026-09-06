import { Link, useSearchParams } from "react-router-dom";
import { useCustomers } from "@/features/queries";
import {
  EmptyState,
  ErrorState,
  LinkButton,
  Pager,
  Panel,
  PanelHeader,
  Select,
  Spinner,
  TableShell,
} from "@/components/common/ui";
import { titleCase } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

const TYPES = ["INDIVIDUAL", "COMPANY", "SCHOOL", "COLLEGE", "GOVERNMENT", "INSTITUTION", "OTHER"];

export function Customers() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();

  const page = Number(params.get("page") ?? 1);
  const customerType = params.get("customerType") ?? undefined;
  const search = params.get("search") ?? undefined;

  const { data, isLoading, error, refetch } = useCustomers({ page, limit: 25, customerType, search });

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-display text-2xl text-ink">Customers</h1>
          <p className="mt-1 text-xs text-muted">Individuals and institutions you quote and invoice.</p>
        </div>
        {can("customers:write") && <LinkButton to="/admin/customers/new">New customer</LinkButton>}
      </header>

      <Panel>
        <PanelHeader
          title="All customers"
          actions={
            <div className="flex flex-wrap gap-2">
              <input
                className="field-input w-48"
                placeholder="Name, phone or GSTIN"
                defaultValue={search ?? ""}
                aria-label="Search customers"
                onKeyDown={(e) => {
                  if (e.key === "Enter") setParam("search", (e.target as HTMLInputElement).value.trim() || undefined);
                }}
              />
              <Select
                className="w-40"
                value={customerType ?? ""}
                onChange={(e) => setParam("customerType", e.target.value || undefined)}
                aria-label="Filter by type"
              >
                <option value="">All types</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </Select>
            </div>
          }
        />

        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : data && data.data.length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="Add the organisations and individuals you supply."
            action={can("customers:write") ? <LinkButton to="/admin/customers/new" size="sm">New customer</LinkButton> : undefined}
          />
        ) : (
          <>
            <TableShell
              head={
                <>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Phone</th>
                  <th className="px-4 py-2">GSTIN</th>
                  <th className="px-4 py-2">State</th>
                  <th className="px-4 py-2">Status</th>
                </>
              }
            >
              {data?.data.map((customer) => (
                <tr key={customer.id} className="transition-colors hover:bg-ground">
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/customers/${customer.id}`} className="text-sm text-brand hover:underline">
                      {customer.companyName ?? customer.name}
                    </Link>
                    {customer.companyName && <p className="text-[11px] text-muted">{customer.name}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{titleCase(customer.customerType)}</td>
                  <td className="type-data px-4 py-2.5 text-xs text-ink-soft">{customer.phone ?? "—"}</td>
                  <td className="type-data px-4 py-2.5 text-xs text-ink-soft">{customer.gstin ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {customer.state} ({customer.stateCode})
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {customer.isActive ? (
                      <span className="text-zone-green">Active</span>
                    ) : (
                      <span className="text-muted">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
            {data?.pagination && (
              <Pager
                page={data.pagination.page}
                pages={data.pagination.pages}
                total={data.pagination.total}
                onChange={(p) => setParam("page", String(p))}
              />
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
