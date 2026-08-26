import { Prisma } from "@prisma/client";
import { InvoiceRepository } from "../repositories/invoice.repository";
import { QuotationRepository } from "../repositories/quotation.repository";
import { PaymentRepository } from "../repositories/payment.repository";
import { CustomerRepository } from "../repositories/customer.repository";
import { ReportRepository } from "../repositories/report.repository";

const ZERO = new Prisma.Decimal(0);

/** Admin dashboard (architecture.md §21). */
export class DashboardService {
  constructor(
    private invoiceRepository: InvoiceRepository,
    private quotationRepository: QuotationRepository,
    private paymentRepository: PaymentRepository,
    private customerRepository: CustomerRepository,
    private reportRepository: ReportRepository,
  ) {}

  async summary() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfChart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      today,
      month,
      customers,
      outstanding,
      quotationFunnel,
      recentInvoices,
      recentQuotations,
      recentPayments,
      monthlySales,
      topCustomers,
      collections,
    ] = await Promise.all([
      this.invoiceRepository.salesAggregate({ invoiceDate: { gte: startOfToday } }),
      this.invoiceRepository.salesAggregate({ invoiceDate: { gte: startOfMonth } }),
      this.customerRepository.list({ skip: 0, take: 1, isActive: true }),
      this.reportRepository.outstandingInvoices({}),
      this.reportRepository.quotationFunnel({}),
      this.invoiceRepository.list({ skip: 0, take: 5 }),
      this.quotationRepository.list({ skip: 0, take: 5 }),
      this.paymentRepository.list({ skip: 0, take: 5 }),
      this.reportRepository.salesByPeriod({ dateFrom: startOfChart }, "month"),
      this.reportRepository.salesByCustomer({ dateFrom: startOfChart }),
      this.reportRepository.paymentsInRange({ dateFrom: startOfChart }),
    ]);

    const funnel = Object.fromEntries(quotationFunnel.map((q) => [q.status, q._count._all]));
    const overdue = outstanding.filter((i) => i.dueDate && i.dueDate.getTime() < now.getTime());
    const monthGst = (month._sum.cgstTotal ?? ZERO).plus(month._sum.sgstTotal ?? ZERO).plus(month._sum.igstTotal ?? ZERO);

    const collectionsByMonth = new Map<string, Prisma.Decimal>();
    for (const payment of collections) {
      const key = `${payment.paymentDate.getFullYear()}-${String(payment.paymentDate.getMonth() + 1).padStart(2, "0")}`;
      collectionsByMonth.set(key, (collectionsByMonth.get(key) ?? ZERO).plus(payment.amount));
    }

    return {
      cards: {
        todaySales: today._sum.grandTotal ?? ZERO,
        todayInvoiceCount: today._count._all,
        monthSales: month._sum.grandTotal ?? ZERO,
        monthInvoiceCount: month._count._all,
        totalCustomers: customers.total,
        outstandingAmount: outstanding.reduce((acc, i) => acc.plus(i.balanceDue), ZERO),
        pendingQuotations: (funnel.DRAFT ?? 0) + (funnel.SENT ?? 0),
        acceptedQuotations: funnel.ACCEPTED ?? 0,
        issuedInvoices: month._count._all,
        overdueInvoices: overdue.length,
        gstCollected: monthGst,
        paymentsReceived: collections
          .filter((p) => p.paymentDate >= startOfMonth)
          .reduce((acc, p) => acc.plus(p.amount), ZERO),
      },
      recentInvoices: recentInvoices.rows,
      recentQuotations: recentQuotations.rows,
      recentPayments: recentPayments.rows,
      topCustomers: topCustomers.slice(0, 5).map((row) => ({
        customerId: row.customerId,
        customer: row.customer,
        invoiceCount: row._count._all,
        total: row._sum.grandTotal ?? ZERO,
      })),
      charts: {
        monthlySales: monthlySales.map((row) => ({
          period: row.period,
          total: row.total,
          taxable: row.taxable,
          invoiceCount: row.invoiceCount,
        })),
        monthlyCollections: [...collectionsByMonth.entries()]
          .map(([month_, amount]) => ({ period: month_, amount }))
          .sort((a, b) => a.period.localeCompare(b.period)),
      },
    };
  }
}
