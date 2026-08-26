import { useSearchParams } from "react-router-dom";
import { download } from "@/api/client";
import { useReport } from "@/features/queries";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Panel,
  PanelHeader,
  Select,
  Spinner,
  TableShell,
} from "@/components/common/ui";
import { amount, money, moneyCompact, percent, quantity } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

interface SalesReport {
  summary: Record<string, number>;
  byPeriod: { period: string; invoiceCount: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }[];
  byCustomer: {
    customerId: string;
    customer: { name: string; companyName: string | null; gstin: string | null } | null;
    invoiceCount: number;
    taxable: number;
    total: number;
    paid: number;
    outstanding: number;
  }[];
  byProduct: { product: string; unit: string; quantity: number; taxable: number; gst: number; total: number }[];
  byGstRate: { gstRate: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }[];
}

export function ReportsSales() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();

  const dateFrom = params.get("dateFrom") ?? undefined;
  const dateTo = params.get("dateTo") ?? undefined;
  const grain = params.get("grain") ?? "month";

  const query = { dateFrom, dateTo, grain };
  const { data, isLoading, error, refetch } = useReport<SalesReport>("sales", query);

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const chartMax = Math.max(1, ...(data?.byPeriod ?? []).map((p) => Number(p.total)));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-display text-2xl text-ink">Sales reports</h1>
          <p className="mt-1 text-xs text-muted">Issued invoices only — drafts and cancellations are excluded.</p>
        </div>
        {can("exports:read") && (
          <Button variant="secondary" size="sm" onClick={() => void download("/exports/sales.xlsx", query)}>
            Export to Excel
          </Button>
        )}
      </header>

      <Panel>
        <PanelHeader
          title="Period"
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
              <Select className="w-32" aria-label="Group by" value={grain} onChange={(e) => setParam("grain", e.target.value)}>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </Select>
            </div>
          }
        />

        {isLoading ? (
          <Spinner />
        ) : error || !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          <>
            <dl className="grid gap-px border-y border-hairline bg-hairline sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Invoices", String(data.summary.invoiceCount ?? 0)],
                ["Taxable", money(data.summary.taxableTotal)],
                ["GST", money(data.summary.gstTotal)],
                ["Invoiced", money(data.summary.grandTotal)],
                ["Received", money(data.summary.amountPaid)],
                ["Outstanding", money(data.summary.balanceDue)],
              ].map(([label, value]) => (
                <div key={label} className="bg-surface px-4 py-3">
                  <dt className="type-eyebrow text-[10px]">{label}</dt>
                  <dd className="type-data mt-1 text-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="p-4">
              {data.byPeriod.length === 0 ? (
                <EmptyState title="No sales in this range" />
              ) : (
                <div className="flex h-40 items-end gap-1" role="img" aria-label="Sales by period">
                  {data.byPeriod.map((row) => (
                    <div key={row.period} className="group flex flex-1 flex-col items-center gap-1">
                      <span className="type-data text-[9px] text-muted opacity-0 group-hover:opacity-100">
                        {moneyCompact(row.total)}
                      </span>
                      <div
                        className="w-full bg-brand/80 group-hover:bg-brand"
                        style={{ height: `${Math.max(3, (Number(row.total) / chartMax) * 100)}%` }}
                        title={`${new Date(row.period).toLocaleDateString("en-IN")}: ${money(row.total)}`}
                      />
                      <span className="type-data text-[9px] text-muted">
                        {new Date(row.period).toLocaleDateString("en-IN", { month: "short", day: grain === "day" ? "2-digit" : undefined })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Panel>

      {data && (
        <>
          <Panel>
            <PanelHeader title="By customer" />
            {data.byCustomer.length === 0 ? (
              <EmptyState title="Nothing to show" />
            ) : (
              <TableShell
                head={
                  <>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">GSTIN</th>
                    <th className="px-4 py-2 text-right">Invoices</th>
                    <th className="px-4 py-2 text-right">Taxable</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">Received</th>
                    <th className="px-4 py-2 text-right">Outstanding</th>
                  </>
                }
              >
                {data.byCustomer.map((row) => (
                  <tr key={row.customerId}>
                    <td className="px-4 py-2.5 text-sm">{row.customer?.companyName ?? row.customer?.name ?? "—"}</td>
                    <td className="type-data px-4 py-2.5 text-xs text-muted">{row.customer?.gstin ?? "—"}</td>
                    <td className="cell-num px-4 py-2.5 text-xs">{row.invoiceCount}</td>
                    <td className="cell-num px-4 py-2.5 text-sm">{amount(row.taxable)}</td>
                    <td className="cell-num px-4 py-2.5 text-sm">{amount(row.total)}</td>
                    <td className="cell-num px-4 py-2.5 text-sm">{amount(row.paid)}</td>
                    <td className={`cell-num px-4 py-2.5 text-sm ${Number(row.outstanding) > 0 ? "text-zone-amber" : ""}`}>
                      {amount(row.outstanding)}
                    </td>
                  </tr>
                ))}
              </TableShell>
            )}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="By product" />
              {data.byProduct.length === 0 ? (
                <EmptyState title="Nothing to show" />
              ) : (
                <TableShell
                  head={
                    <>
                      <th className="px-4 py-2">Product</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Taxable</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </>
                  }
                >
                  {data.byProduct.map((row) => (
                    <tr key={`${row.product}-${row.unit}`}>
                      <td className="px-4 py-2.5 text-sm">{row.product}</td>
                      <td className="cell-num px-4 py-2.5 text-xs">
                        {quantity(row.quantity)} {row.unit}
                      </td>
                      <td className="cell-num px-4 py-2.5 text-sm">{amount(row.taxable)}</td>
                      <td className="cell-num px-4 py-2.5 text-sm">{amount(row.total)}</td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="By GST rate" />
              {data.byGstRate.length === 0 ? (
                <EmptyState title="Nothing to show" />
              ) : (
                <TableShell
                  head={
                    <>
                      <th className="px-4 py-2">Rate</th>
                      <th className="px-4 py-2 text-right">Taxable</th>
                      <th className="px-4 py-2 text-right">CGST</th>
                      <th className="px-4 py-2 text-right">SGST</th>
                      <th className="px-4 py-2 text-right">IGST</th>
                    </>
                  }
                >
                  {data.byGstRate.map((row) => (
                    <tr key={String(row.gstRate)}>
                      <td className="type-data px-4 py-2.5 text-sm">{percent(row.gstRate)}</td>
                      <td className="cell-num px-4 py-2.5 text-sm">{amount(row.taxable)}</td>
                      <td className="cell-num px-4 py-2.5 text-sm">{amount(row.cgst)}</td>
                      <td className="cell-num px-4 py-2.5 text-sm">{amount(row.sgst)}</td>
                      <td className="cell-num px-4 py-2.5 text-sm">{amount(row.igst)}</td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
