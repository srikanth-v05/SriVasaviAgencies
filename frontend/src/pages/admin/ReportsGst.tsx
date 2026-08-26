import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { download } from "@/api/client";
import { useReport } from "@/features/queries";
import { Button, EmptyState, ErrorState, Input, Panel, PanelHeader, Spinner, TableShell } from "@/components/common/ui";
import { amount, date, money, percent, quantity } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

interface Segment {
  invoiceCount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

interface GstReport {
  summary: { invoiceCount: number; taxableTotal: number; cgstTotal: number; sgstTotal: number; igstTotal: number; grandTotal: number };
  byRate: { gstRate: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }[];
  b2b: Segment;
  b2c: Segment;
  hsn: { hsnCode: string; unit: string; gstRate: number; quantity: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }[];
}

interface OutstandingReport {
  totalOutstanding: number;
  overdueTotal: number;
  invoiceCount: number;
  ageing: { current: number; days30: number; days60: number; days90: number; days90plus: number };
  invoices: {
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    dueDate: string | null;
    customer: { id: string; name: string; companyName: string | null; phone: string } | null;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
    daysOverdue: number;
  }[];
}

export function ReportsGst() {
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();

  const dateFrom = params.get("dateFrom") ?? undefined;
  const dateTo = params.get("dateTo") ?? undefined;
  const query = { dateFrom, dateTo };

  const { data, isLoading, error, refetch } = useReport<GstReport>("gst", query);
  const { data: outstanding } = useReport<OutstandingReport>("outstanding", query);

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-display text-2xl text-ink">GST &amp; exports</h1>
          <p className="mt-1 text-xs text-muted">
            A working register to reconcile against. Map it to the current official template at filing time.
          </p>
        </div>
        {can("exports:read") && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void download("/exports/gst.xlsx", query)}>
              GST workbook
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void download("/exports/hsn.xlsx", query)}>
              HSN summary
            </Button>
          </div>
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
            </div>
          }
        />

        {isLoading ? (
          <Spinner />
        ) : error || !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          <dl className="grid gap-px border-t border-hairline bg-hairline sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Invoices", String(data.summary.invoiceCount)],
              ["Taxable value", money(data.summary.taxableTotal)],
              ["CGST", money(data.summary.cgstTotal)],
              ["SGST", money(data.summary.sgstTotal)],
              ["IGST", money(data.summary.igstTotal)],
              ["Invoiced", money(data.summary.grandTotal)],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface px-4 py-3">
                <dt className="type-eyebrow text-[10px]">{label}</dt>
                <dd className="type-data mt-1 text-sm text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      {data && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="B2B and B2C" description="Split on whether the buyer holds a GSTIN." />
            <TableShell
              head={
                <>
                  <th className="px-4 py-2">Segment</th>
                  <th className="px-4 py-2 text-right">Invoices</th>
                  <th className="px-4 py-2 text-right">Taxable</th>
                  <th className="px-4 py-2 text-right">Tax</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </>
              }
            >
              {([
                ["B2B (registered)", data.b2b],
                ["B2C (unregistered)", data.b2c],
              ] as [string, Segment][]).map(([label, segment]) => (
                <tr key={label}>
                  <td className="px-4 py-2.5 text-sm">{label}</td>
                  <td className="cell-num px-4 py-2.5 text-xs">{segment.invoiceCount}</td>
                  <td className="cell-num px-4 py-2.5 text-sm">{amount(segment.taxable)}</td>
                  <td className="cell-num px-4 py-2.5 text-sm">
                    {amount(Number(segment.cgst) + Number(segment.sgst) + Number(segment.igst))}
                  </td>
                  <td className="cell-num px-4 py-2.5 text-sm">{amount(segment.total)}</td>
                </tr>
              ))}
            </TableShell>
          </Panel>

          <Panel>
            <PanelHeader title="Rate-wise summary" />
            {data.byRate.length === 0 ? (
              <EmptyState title="Nothing in this range" />
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
                {data.byRate.map((row) => (
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
      )}

      {data && (
        <Panel>
          <PanelHeader title="HSN summary" description="Quantity and value by HSN code, unit and rate." />
          {data.hsn.length === 0 ? (
            <EmptyState title="Nothing in this range" />
          ) : (
            <TableShell
              head={
                <>
                  <th className="px-4 py-2">HSN</th>
                  <th className="px-4 py-2">Unit</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-4 py-2 text-right">Quantity</th>
                  <th className="px-4 py-2 text-right">Taxable</th>
                  <th className="px-4 py-2 text-right">CGST</th>
                  <th className="px-4 py-2 text-right">SGST</th>
                  <th className="px-4 py-2 text-right">IGST</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </>
              }
            >
              {data.hsn.map((row, index) => (
                <tr key={`${row.hsnCode}-${row.unit}-${row.gstRate}-${index}`}>
                  <td className="type-data px-4 py-2.5 text-sm">{row.hsnCode}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{row.unit}</td>
                  <td className="cell-num px-4 py-2.5 text-xs">{percent(row.gstRate)}</td>
                  <td className="cell-num px-4 py-2.5 text-sm">{quantity(row.quantity)}</td>
                  <td className="cell-num px-4 py-2.5 text-sm">{amount(row.taxable)}</td>
                  <td className="cell-num px-4 py-2.5 text-sm">{amount(row.cgst)}</td>
                  <td className="cell-num px-4 py-2.5 text-sm">{amount(row.sgst)}</td>
                  <td className="cell-num px-4 py-2.5 text-sm">{amount(row.igst)}</td>
                  <td className="cell-num px-4 py-2.5 text-sm font-medium">{amount(row.total)}</td>
                </tr>
              ))}
            </TableShell>
          )}
        </Panel>
      )}

      {outstanding && (
        <Panel>
          <PanelHeader
            title="Outstanding"
            description={`${money(outstanding.totalOutstanding)} across ${outstanding.invoiceCount} invoice(s), ${money(outstanding.overdueTotal)} overdue.`}
          />
          <dl className="grid gap-px border-y border-hairline bg-hairline sm:grid-cols-5">
            {[
              ["Not yet due", outstanding.ageing.current],
              ["1–30 days", outstanding.ageing.days30],
              ["31–60 days", outstanding.ageing.days60],
              ["61–90 days", outstanding.ageing.days90],
              ["Over 90 days", outstanding.ageing.days90plus],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-surface px-4 py-3">
                <dt className="type-eyebrow text-[10px]">{label as string}</dt>
                <dd className="type-data mt-1 text-sm text-ink">{money(value as number)}</dd>
              </div>
            ))}
          </dl>

          {outstanding.invoices.length === 0 ? (
            <EmptyState title="Nothing outstanding" description="Every issued invoice has been settled." />
          ) : (
            <TableShell
              head={
                <>
                  <th className="px-4 py-2">Invoice</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2 text-right">Overdue</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </>
              }
            >
              {outstanding.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/invoices/${invoice.id}`} className="type-data text-xs text-brand hover:underline">
                      {invoice.invoiceNumber ?? "Draft"}
                    </Link>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-sm">
                    {invoice.customer?.companyName ?? invoice.customer?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{date(invoice.dueDate)}</td>
                  <td className={`cell-num px-4 py-2.5 text-xs ${invoice.daysOverdue > 0 ? "text-zone-red" : "text-muted"}`}>
                    {invoice.daysOverdue > 0 ? `${invoice.daysOverdue} d` : "—"}
                  </td>
                  <td className="cell-num px-4 py-2.5 text-sm">{amount(invoice.grandTotal)}</td>
                  <td className="cell-num px-4 py-2.5 text-sm text-zone-amber">{amount(invoice.balanceDue)}</td>
                </tr>
              ))}
            </TableShell>
          )}
        </Panel>
      )}
    </div>
  );
}
