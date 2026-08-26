import { Prisma } from "@prisma/client";
import { ReportRepository, type ReportFilters, type PeriodGrain } from "../repositories/report.repository";
import { CustomerRepository } from "../repositories/customer.repository";

const ZERO = new Prisma.Decimal(0);

/** Reports (architecture.md §19). Every figure comes from stored document snapshots. */
export class ReportService {
  constructor(
    private reportRepository: ReportRepository,
    private customerRepository: CustomerRepository,
  ) {}

  async sales(filters: ReportFilters, grain: PeriodGrain = "month") {
    const [summary, byPeriod, byCustomer, byProduct, byGstRate] = await Promise.all([
      this.reportRepository.salesSummary(filters),
      this.reportRepository.salesByPeriod(filters, grain),
      this.reportRepository.salesByCustomer(filters),
      this.reportRepository.salesByProduct(filters),
      this.reportRepository.salesByGstRate(filters),
    ]);

    return {
      summary: {
        invoiceCount: summary._count._all,
        subtotal: summary._sum.subtotal ?? ZERO,
        discountTotal: summary._sum.discountTotal ?? ZERO,
        taxableTotal: summary._sum.taxableTotal ?? ZERO,
        cgstTotal: summary._sum.cgstTotal ?? ZERO,
        sgstTotal: summary._sum.sgstTotal ?? ZERO,
        igstTotal: summary._sum.igstTotal ?? ZERO,
        gstTotal: (summary._sum.cgstTotal ?? ZERO)
          .plus(summary._sum.sgstTotal ?? ZERO)
          .plus(summary._sum.igstTotal ?? ZERO),
        grandTotal: summary._sum.grandTotal ?? ZERO,
        amountPaid: summary._sum.amountPaid ?? ZERO,
        balanceDue: summary._sum.balanceDue ?? ZERO,
      },
      byPeriod,
      byCustomer: byCustomer.map((row) => ({
        customerId: row.customerId,
        customer: row.customer,
        invoiceCount: row._count._all,
        taxable: row._sum.taxableTotal ?? ZERO,
        total: row._sum.grandTotal ?? ZERO,
        paid: row._sum.amountPaid ?? ZERO,
        outstanding: row._sum.balanceDue ?? ZERO,
      })),
      byProduct: byProduct.map((row) => ({
        product: row.productNameSnapshot,
        unit: row.unitSnapshot,
        lineCount: row._count._all,
        quantity: row._sum.quantity ?? ZERO,
        taxable: row._sum.lineTaxableValue ?? ZERO,
        gst: (row._sum.cgstAmount ?? ZERO).plus(row._sum.sgstAmount ?? ZERO).plus(row._sum.igstAmount ?? ZERO),
        total: row._sum.lineTotal ?? ZERO,
      })),
      byGstRate: byGstRate.map((row) => ({
        gstRate: row.gstRate,
        lineCount: row._count._all,
        taxable: row._sum.lineTaxableValue ?? ZERO,
        cgst: row._sum.cgstAmount ?? ZERO,
        sgst: row._sum.sgstAmount ?? ZERO,
        igst: row._sum.igstAmount ?? ZERO,
        total: row._sum.lineTotal ?? ZERO,
      })),
    };
  }

  /** Quotation funnel with the conversion percentage (architecture.md §19). */
  async quotations(filters: ReportFilters) {
    const rows = await this.reportRepository.quotationFunnel(filters);

    const byStatus = Object.fromEntries(
      rows.map((r) => [r.status, { count: r._count._all, value: r._sum.grandTotal ?? ZERO }]),
    );

    const total = rows.reduce((acc, r) => acc + r._count._all, 0);
    const converted = byStatus.CONVERTED?.count ?? 0;
    const accepted = (byStatus.ACCEPTED?.count ?? 0) + converted;

    return {
      byStatus,
      total,
      accepted,
      converted,
      // Conversion rate is measured against quotations that reached a decision,
      // so open drafts do not drag the number down.
      conversionPercentage: total === 0 ? 0 : Number(((converted / total) * 100).toFixed(2)),
      acceptancePercentage: total === 0 ? 0 : Number(((accepted / total) * 100).toFixed(2)),
    };
  }

  async customers(filters: ReportFilters) {
    const byCustomer = await this.reportRepository.salesByCustomer(filters);
    return byCustomer.map((row) => ({
      customerId: row.customerId,
      customer: row.customer,
      invoiceCount: row._count._all,
      taxable: row._sum.taxableTotal ?? ZERO,
      total: row._sum.grandTotal ?? ZERO,
      paid: row._sum.amountPaid ?? ZERO,
      outstanding: row._sum.balanceDue ?? ZERO,
    }));
  }

  async payments(filters: ReportFilters) {
    const [payments, byMethod] = await Promise.all([
      this.reportRepository.paymentsInRange(filters),
      this.reportRepository.paymentsByMethod(filters),
    ]);

    const totalCollected = payments.reduce((acc, p) => acc.plus(p.amount), ZERO);
    const byDay = new Map<string, Prisma.Decimal>();
    for (const payment of payments) {
      const key = payment.paymentDate.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? ZERO).plus(payment.amount));
    }

    return {
      totalCollected,
      paymentCount: payments.length,
      byMethod: byMethod.map((m) => ({
        method: m.paymentMethod,
        count: m._count._all,
        amount: m._sum.amount ?? ZERO,
      })),
      byDay: [...byDay.entries()].map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)),
      payments,
    };
  }

  /** Outstanding and overdue receivables, with an ageing breakdown. */
  async outstanding(filters: ReportFilters) {
    const invoices = await this.reportRepository.outstandingInvoices(filters);
    const now = Date.now();

    const buckets = { current: ZERO, days30: ZERO, days60: ZERO, days90: ZERO, days90plus: ZERO };
    let overdueTotal = ZERO;

    const rows = invoices.map((invoice) => {
      const dueDate = invoice.dueDate;
      const daysOverdue = dueDate ? Math.floor((now - dueDate.getTime()) / 86400000) : 0;
      const balance = invoice.balanceDue;

      if (daysOverdue <= 0) buckets.current = buckets.current.plus(balance);
      else if (daysOverdue <= 30) buckets.days30 = buckets.days30.plus(balance);
      else if (daysOverdue <= 60) buckets.days60 = buckets.days60.plus(balance);
      else if (daysOverdue <= 90) buckets.days90 = buckets.days90.plus(balance);
      else buckets.days90plus = buckets.days90plus.plus(balance);

      if (daysOverdue > 0) overdueTotal = overdueTotal.plus(balance);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate,
        customer: invoice.customer,
        grandTotal: invoice.grandTotal,
        amountPaid: invoice.amountPaid,
        balanceDue: balance,
        daysOverdue: Math.max(0, daysOverdue),
        status: invoice.status,
      };
    });

    return {
      totalOutstanding: rows.reduce((acc, r) => acc.plus(r.balanceDue), ZERO),
      overdueTotal,
      invoiceCount: rows.length,
      ageing: buckets,
      invoices: rows,
    };
  }

  /**
   * GST summary (architecture.md §19, §20). B2B and B2C are split because the
   * return treats them differently.
   */
  async gst(filters: ReportFilters) {
    const [summary, byRate, hsn, b2b, b2c] = await Promise.all([
      this.reportRepository.salesSummary(filters),
      this.reportRepository.salesByGstRate(filters),
      this.reportRepository.hsnSummary(filters),
      this.reportRepository.invoicesForGstReturn(filters, "B2B"),
      this.reportRepository.invoicesForGstReturn(filters, "B2C"),
    ]);

    const segment = (invoices: typeof b2b) => ({
      invoiceCount: invoices.length,
      taxable: invoices.reduce((acc, i) => acc.plus(i.taxableTotal), ZERO),
      cgst: invoices.reduce((acc, i) => acc.plus(i.cgstTotal), ZERO),
      sgst: invoices.reduce((acc, i) => acc.plus(i.sgstTotal), ZERO),
      igst: invoices.reduce((acc, i) => acc.plus(i.igstTotal), ZERO),
      total: invoices.reduce((acc, i) => acc.plus(i.grandTotal), ZERO),
    });

    return {
      summary: {
        invoiceCount: summary._count._all,
        taxableTotal: summary._sum.taxableTotal ?? ZERO,
        cgstTotal: summary._sum.cgstTotal ?? ZERO,
        sgstTotal: summary._sum.sgstTotal ?? ZERO,
        igstTotal: summary._sum.igstTotal ?? ZERO,
        grandTotal: summary._sum.grandTotal ?? ZERO,
      },
      byRate: byRate.map((r) => ({
        gstRate: r.gstRate,
        taxable: r._sum.lineTaxableValue ?? ZERO,
        cgst: r._sum.cgstAmount ?? ZERO,
        sgst: r._sum.sgstAmount ?? ZERO,
        igst: r._sum.igstAmount ?? ZERO,
        total: r._sum.lineTotal ?? ZERO,
      })),
      b2b: segment(b2b),
      b2c: segment(b2c),
      hsn: this.shapeHsn(hsn),
    };
  }

  async hsn(filters: ReportFilters) {
    return this.shapeHsn(await this.reportRepository.hsnSummary(filters));
  }

  private shapeHsn(rows: Awaited<ReturnType<ReportRepository["hsnSummary"]>>) {
    return rows.map((r) => ({
      hsnCode: r.hsnCodeSnapshot ?? "(not set)",
      unit: r.unitSnapshot,
      gstRate: r.gstRate,
      quantity: r._sum.quantity ?? ZERO,
      taxable: r._sum.lineTaxableValue ?? ZERO,
      cgst: r._sum.cgstAmount ?? ZERO,
      sgst: r._sum.sgstAmount ?? ZERO,
      igst: r._sum.igstAmount ?? ZERO,
      total: r._sum.lineTotal ?? ZERO,
    }));
  }

  customerLedger(customerId: string) {
    return this.customerRepository.outstanding(customerId);
  }
}
