import { useSearchParams } from "react-router-dom";
import { useAuditLogs } from "@/features/queries";
import {
  EmptyState,
  ErrorState,
  Input,
  Pager,
  Panel,
  PanelHeader,
  Select,
  Spinner,
  TableShell,
} from "@/components/common/ui";
import { dateTime, titleCase } from "@/lib/format";

const ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "CREATE_QUOTATION",
  "UPDATE_QUOTATION",
  "ACCEPT_QUOTATION",
  "CONVERT_QUOTATION",
  "CREATE_INVOICE",
  "UPDATE_INVOICE",
  "FINALIZE_INVOICE",
  "CANCEL_INVOICE",
  "PRICE_OVERRIDE",
  "CREATE_PAYMENT",
  "DELETE_PAYMENT",
  "UPDATE_PRODUCT",
  "UPDATE_COMPANY_SETTINGS",
  "EXPORT_REPORT",
];

interface Override {
  lineNumber: number;
  productName: string;
  masterPrice: string;
  enteredPrice: string;
  direction: string;
}

export function AuditLogs() {
  const [params, setParams] = useSearchParams();

  const page = Number(params.get("page") ?? 1);
  const action = params.get("action") ?? undefined;
  const dateFrom = params.get("dateFrom") ?? undefined;
  const dateTo = params.get("dateTo") ?? undefined;

  const { data, isLoading, error, refetch } = useAuditLogs({ page, limit: 50, action, dateFrom, dateTo });

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-display text-2xl text-ink">Audit logs</h1>
        <p className="mt-1 text-xs text-muted">
          Every financial action is recorded, including the price billed against each product's list price.
        </p>
      </header>

      <Panel>
        <PanelHeader
          title="Activity"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                className="w-36"
                aria-label="From date"
                value={dateFrom ?? ""}
                onChange={(e) => setParam("dateFrom", e.target.value || undefined)}
              />
              <Input
                type="date"
                className="w-36"
                aria-label="To date"
                value={dateTo ?? ""}
                onChange={(e) => setParam("dateTo", e.target.value || undefined)}
              />
              <Select
                className="w-48"
                aria-label="Filter by action"
                value={action ?? ""}
                onChange={(e) => setParam("action", e.target.value || undefined)}
              >
                <option value="">All actions</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {titleCase(a)}
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
          <EmptyState title="Nothing recorded in this range" />
        ) : (
          <>
            <TableShell
              head={
                <>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Who</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Record</th>
                  <th className="px-4 py-2">Detail</th>
                </>
              }
            >
              {data?.data.map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="px-4 py-2.5 text-xs text-muted">{dateTime(log.createdAt)}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{log.user?.name ?? "System"}</td>
                  <td className="px-4 py-2.5">
                    <span className="type-data text-[11px] text-ink">{log.action.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {log.entityType}
                    {log.entityId && <span className="type-data block text-[10px]">{log.entityId.slice(0, 8)}</span>}
                  </td>
                  <td className="max-w-md px-4 py-2.5 text-xs text-ink-soft">{renderDetail(log.action, log.newValues)}</td>
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

/** Price overrides are spelled out, because that is what a reviewer is looking for. */
function renderDetail(action: string, newValues: unknown): string {
  if (!newValues || typeof newValues !== "object") return "—";
  const values = newValues as Record<string, unknown>;

  if (action === "PRICE_OVERRIDE" && Array.isArray(values.overrides)) {
    return (values.overrides as Override[])
      .map((o) => `${o.productName}: list ${o.masterPrice} → billed ${o.enteredPrice}`)
      .join("; ");
  }

  const parts = Object.entries(values)
    .filter(([, value]) => value !== null && typeof value !== "object")
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return parts.length > 0 ? parts.join(", ") : "—";
}
