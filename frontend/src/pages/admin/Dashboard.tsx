import { Link } from "react-router-dom";
import {
  IndianRupee,
  CalendarDays,
  Users,
  AlertTriangle,
  FileClock,
  FileCheck2,
  Landmark,
  Wallet,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { useDashboard } from "@/features/queries";
import { ErrorState, Panel, PanelHeader, Spinner, StatusPill, EmptyState } from "@/components/common/ui";
import { money, moneyCompact, date } from "@/lib/format";

type IconType = LucideIcon;

/** Admin dashboard (architecture.md §21). */
export function Dashboard() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) return <Spinner label="Loading dashboard" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const c = data.cards;

  const cards: { label: string; value: string; sub?: string; to?: string; tone?: "warn"; icon: IconType }[] = [
    { label: "Today's sales", value: money(c.todaySales), sub: `${c.todayInvoiceCount} invoice(s)`, icon: IndianRupee },
    { label: "This month's sales", value: money(c.monthSales), sub: `${c.monthInvoiceCount} invoice(s)`, to: "/admin/reports/sales", icon: CalendarDays },
    { label: "Total customers", value: String(c.totalCustomers), to: "/admin/customers", icon: Users },
    {
      label: "Outstanding",
      value: money(c.outstandingAmount),
      sub: `${c.overdueInvoices} overdue`,
      to: "/admin/invoices?paymentStatus=UNPAID",
      tone: Number(c.outstandingAmount) > 0 ? "warn" : undefined,
      icon: AlertTriangle,
    },
    { label: "Pending quotations", value: String(c.pendingQuotations), to: "/admin/quotations?status=SENT", icon: FileClock },
    { label: "Accepted quotations", value: String(c.acceptedQuotations), to: "/admin/quotations?status=ACCEPTED", icon: FileCheck2 },
    { label: "GST this month", value: money(c.gstCollected), to: "/admin/reports/gst", icon: Landmark },
    { label: "Received this month", value: money(c.paymentsReceived), to: "/admin/payments", icon: Wallet },
  ];

  const chartMax = Math.max(1, ...data.charts.monthlySales.map((m) => Number(m.total)));

  return (
    <div className="space-y-8">
      <header className="rise">
        <p className="type-eyebrow text-gold">Overview</p>
        <h1 className="type-display mt-2 text-3xl text-ink">Dashboard</h1>
        <p className="mt-1.5 text-xs text-muted">Figures come from issued invoices only — drafts are never counted as sales.</p>
      </header>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const warn = card.tone === "warn";
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    warn ? "bg-zone-amber/12 text-zone-amber" : "bg-brand-tint/70 text-brand"
                  }`}
                  aria-hidden
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                {card.to && (
                  <ArrowUpRight className="h-4 w-4 text-faint transition-colors group-hover:text-brand" strokeWidth={2} aria-hidden />
                )}
              </div>
              <p className="type-eyebrow mt-4 text-[10px]">{card.label}</p>
              <p className={`type-data mt-1.5 text-2xl font-medium ${warn ? "text-zone-amber" : "text-ink"}`}>
                {card.value}
              </p>
              {card.sub && <p className="mt-1 text-[11px] text-muted">{card.sub}</p>}
            </>
          );

          return card.to ? (
            <Link key={card.label} to={card.to} className="card-interactive group p-5">
              {body}
            </Link>
          ) : (
            <div key={card.label} className="panel p-5">
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------------------------------ sales chart */}
        <Panel>
          <PanelHeader title="Sales, last 12 months" description="Invoiced value including GST" />
          <div className="p-5">
            {data.charts.monthlySales.length === 0 ? (
              <EmptyState title="No invoices yet" description="Issue your first invoice to see the trend here." />
            ) : (
              <div className="flex h-48 items-end gap-1.5" role="img" aria-label="Monthly sales bar chart">
                {data.charts.monthlySales.map((month) => {
                  const height = Math.max(3, (Number(month.total) / chartMax) * 100);
                  const label = new Date(month.period).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
                  return (
                    <div key={month.period} className="group flex flex-1 flex-col items-center gap-1.5">
                      <span className="type-data text-[9px] text-brand opacity-0 transition-opacity group-hover:opacity-100">
                        {moneyCompact(month.total)}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-brand/70 to-brand-bright transition-all duration-200 group-hover:from-brand group-hover:to-brand-bright"
                        style={{ height: `${height}%` }}
                        title={`${label}: ${money(month.total)}`}
                      />
                      <span className="type-data text-[9px] text-muted">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        {/* --------------------------------------------- top customers */}
        <Panel>
          <PanelHeader title="Top customers" description="By invoiced value over the last 12 months" />
          {data.topCustomers.length === 0 ? (
            <EmptyState title="No customer sales yet" />
          ) : (
            <ul className="divide-y divide-hairline">
              {data.topCustomers.map((row, i) => (
                <li key={row.customerId} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
                  <Link to={`/admin/customers/${row.customerId}`} className="flex min-w-0 items-center gap-3 text-sm text-ink hover:text-brand">
                    <span className="type-data flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ground-deep text-[11px] text-ink-soft">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{row.customer?.companyName ?? row.customer?.name ?? "—"}</span>
                      <span className="text-[11px] text-muted">{row.invoiceCount} invoice(s)</span>
                    </span>
                  </Link>
                  <span className="type-data shrink-0 text-sm font-medium text-ink">{money(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Recent quotations" actions={<Link to="/admin/quotations" className="text-xs font-medium text-brand hover:underline">All</Link>} />
          <RecentList
            rows={data.recentQuotations.map((q) => ({
              id: q.id,
              to: `/admin/quotations/${q.id}`,
              primary: q.quotationNumber ?? "Draft",
              secondary: date(q.quotationDate),
              amount: money(q.grandTotal),
              status: q.status,
            }))}
            emptyLabel="No quotations yet"
          />
        </Panel>

        <Panel>
          <PanelHeader title="Recent invoices" actions={<Link to="/admin/invoices" className="text-xs font-medium text-brand hover:underline">All</Link>} />
          <RecentList
            rows={data.recentInvoices.map((i) => ({
              id: i.id,
              to: `/admin/invoices/${i.id}`,
              primary: i.invoiceNumber ?? "Draft",
              secondary: date(i.invoiceDate),
              amount: money(i.grandTotal),
              status: i.status,
            }))}
            emptyLabel="No invoices yet"
          />
        </Panel>

        <Panel>
          <PanelHeader title="Recent payments" actions={<Link to="/admin/payments" className="text-xs font-medium text-brand hover:underline">All</Link>} />
          <RecentList
            rows={data.recentPayments.map((p) => ({
              id: p.id,
              to: p.invoice ? `/admin/invoices/${p.invoice.id}` : "/admin/payments",
              primary: p.invoice?.invoiceNumber ?? "Payment",
              secondary: date(p.paymentDate),
              amount: money(p.amount),
              status: p.paymentMethod,
            }))}
            emptyLabel="No payments yet"
          />
        </Panel>
      </div>
    </div>
  );
}

function RecentList({
  rows,
  emptyLabel,
}: {
  rows: { id: string; to: string; primary: string; secondary: string; amount: string; status: string }[];
  emptyLabel: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyLabel} />;

  return (
    <ul className="divide-y divide-hairline">
      {rows.map((row) => (
        <li key={row.id}>
          <Link to={row.to} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
            <div className="min-w-0">
              <p className="type-data truncate text-xs text-ink">{row.primary}</p>
              <p className="text-[11px] text-muted">{row.secondary}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className="type-data text-xs font-medium text-ink">{row.amount}</p>
              <StatusPill status={row.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
