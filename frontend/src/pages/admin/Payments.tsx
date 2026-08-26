import { Link, useSearchParams } from "react-router-dom";
import { useDeletePayment, usePayments } from "@/features/queries";
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
import { errorMessage, useToast } from "@/components/common/Toast";
import { date, money, titleCase } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

const METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"];

export function Payments() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { can } = useAuth();

  const page = Number(params.get("page") ?? 1);
  const paymentMethod = params.get("paymentMethod") ?? undefined;
  const dateFrom = params.get("dateFrom") ?? undefined;
  const dateTo = params.get("dateTo") ?? undefined;

  const { data, isLoading, error, refetch } = usePayments({ page, limit: 25, paymentMethod, dateFrom, dateTo });
  const remove = useDeletePayment();

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const total = (data?.data ?? []).reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-display text-2xl text-ink">Payments</h1>
        <p className="mt-1 text-xs text-muted">
          Receipts are recorded against an invoice. Open an invoice to add one.
        </p>
      </header>

      <Panel>
        <PanelHeader
          title="Collections"
          description={data?.data.length ? `${money(total)} on this page` : undefined}
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
                className="w-40"
                aria-label="Filter by method"
                value={paymentMethod ?? ""}
                onChange={(e) => setParam("paymentMethod", e.target.value || undefined)}
              >
                <option value="">All methods</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {titleCase(m)}
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
          <EmptyState title="No payments in this range" description="Record one from the invoice it belongs to." />
        ) : (
          <>
            <TableShell
              head={
                <>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Invoice</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2">Reference</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="w-10 px-4 py-2" />
                </>
              }
            >
              {data?.data.map((payment) => (
                <tr key={payment.id} className="transition-colors hover:bg-ground">
                  <td className="px-4 py-2.5 text-xs text-muted">{date(payment.paymentDate)}</td>
                  <td className="px-4 py-2.5">
                    {payment.invoice ? (
                      <Link to={`/admin/invoices/${payment.invoice.id}`} className="type-data text-xs text-brand hover:underline">
                        {payment.invoice.invoiceNumber ?? "Draft"}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-sm">
                    {payment.invoice?.customer?.companyName ?? payment.invoice?.customer?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{titleCase(payment.paymentMethod)}</td>
                  <td className="type-data px-4 py-2.5 text-xs text-muted">{payment.referenceNumber ?? "—"}</td>
                  <td className="cell-num px-4 py-2.5 text-sm">{money(payment.amount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {can("payments:write") && (
                      <button
                        type="button"
                        aria-label="Delete payment"
                        className="rounded px-1.5 py-1 text-xs text-muted hover:text-danger"
                        onClick={() =>
                          void (async () => {
                            if (!window.confirm("Remove this payment? The invoice balance will be recalculated.")) return;
                            try {
                              await remove.mutateAsync(payment.id);
                              toast.success("Payment removed");
                            } catch (err) {
                              toast.error(errorMessage(err));
                            }
                          })()
                        }
                      >
                        ✕
                      </button>
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
