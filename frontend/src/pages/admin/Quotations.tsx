import { Link, useSearchParams } from "react-router-dom";
import { useQuotations } from "@/features/queries";
import { EmptyState, ErrorState, LinkButton, Pager, Panel, PanelHeader, Select, Spinner, StatusPill, TableShell } from "@/components/common/ui";
import { money, date } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED", "CANCELLED"];

export function Quotations() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();

  const page = Number(params.get("page") ?? 1);
  const status = params.get("status") ?? undefined;
  const search = params.get("search") ?? undefined;

  const { data, isLoading, error, refetch } = useQuotations({ page, limit: 25, status, search });

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
          <h1 className="type-display text-2xl text-ink">Quotations</h1>
          <p className="mt-1 text-xs text-muted">Priced offers. Convert an accepted one to raise the invoice.</p>
        </div>
        {can("quotations:write") && <LinkButton to="/admin/quotations/new">New quotation</LinkButton>}
      </header>

      <Panel>
        <PanelHeader
          title="All quotations"
          actions={
            <div className="flex flex-wrap gap-2">
              <input
                className="field-input w-44"
                placeholder="Number or customer"
                defaultValue={search ?? ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setParam("search", (e.target as HTMLInputElement).value.trim() || undefined);
                }}
                aria-label="Search quotations"
              />
              <Select
                className="w-40"
                value={status ?? ""}
                onChange={(e) => setParam("status", e.target.value || undefined)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
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
            title="No quotations here"
            description="Quotations you raise will be listed here, newest first."
            action={can("quotations:write") ? <LinkButton to="/admin/quotations/new" size="sm">New quotation</LinkButton> : undefined}
          />
        ) : (
          <>
            <TableShell
              head={
                <>
                  <th className="px-4 py-2">Number</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Valid until</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2">Status</th>
                </>
              }
            >
              {data?.data.map((q) => (
                <tr key={q.id} className="transition-colors hover:bg-ground">
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/quotations/${q.id}`} className="type-data text-xs text-brand hover:underline">
                      {q.quotationNumber ?? "Draft"}
                    </Link>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-sm">
                    {q.customer?.companyName ?? q.customer?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{date(q.quotationDate)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{date(q.validUntil)}</td>
                  <td className="cell-num px-4 py-2.5">{money(q.grandTotal)}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={q.status} />
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
