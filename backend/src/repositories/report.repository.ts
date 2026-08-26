import { Prisma, PrismaClient } from "@prisma/client";
import { SALES_STATUSES, RECEIVABLE_STATUSES } from "./invoice.repository";

export interface ReportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  customerId?: string;
  productId?: string;
  gstRate?: number;
}

export type PeriodGrain = "day" | "week" | "month" | "year";

export interface PeriodRow {
  period: Date;
  invoiceCount: number;
  taxable: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  total: Prisma.Decimal;
}

/**
 * Reporting queries. Only invoices in a sales status are counted — drafts and
 * cancellations are never treated as revenue.
 */
export class ReportRepository {
  constructor(private db: PrismaClient) {}

  invoiceWhere(filters: ReportFilters): Prisma.InvoiceWhereInput {
    return {
      status: { in: SALES_STATUSES },
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            invoiceDate: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
    };
  }

  private itemWhere(filters: ReportFilters): Prisma.InvoiceItemWhereInput {
    return {
      invoice: this.invoiceWhere(filters),
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.gstRate !== undefined ? { gstRate: new Prisma.Decimal(filters.gstRate) } : {}),
    };
  }

  salesSummary(filters: ReportFilters) {
    return this.db.invoice.aggregate({
      where: this.invoiceWhere(filters),
      _sum: {
        subtotal: true,
        discountTotal: true,
        taxableTotal: true,
        cgstTotal: true,
        sgstTotal: true,
        igstTotal: true,
        roundOff: true,
        grandTotal: true,
        amountPaid: true,
        balanceDue: true,
      },
      _count: { _all: true },
    });
  }

  /** Sales bucketed by day / week / month / year (architecture.md §19). */
  async salesByPeriod(filters: ReportFilters, grain: PeriodGrain): Promise<PeriodRow[]> {
    // MySQL has no date_trunc, so each grain maps to the expression that returns
    // the first instant of its bucket. `grain` is validated against this fixed
    // map before it reaches the query, so nothing user-supplied is interpolated.
    const TRUNC: Record<PeriodGrain, string> = {
      day: "DATE(invoiceDate)",
      // Weeks start on Monday, matching ISO and the way a shop reads its week.
      week: "DATE_SUB(DATE(invoiceDate), INTERVAL WEEKDAY(invoiceDate) DAY)",
      month: "DATE_FORMAT(invoiceDate, '%Y-%m-01')",
      year: "DATE_FORMAT(invoiceDate, '%Y-01-01')",
    };
    const bucket = TRUNC[grain];
    if (!bucket) throw new Error(`Unsupported reporting grain: ${grain}`);

    const trunc = Prisma.raw(bucket);
    const statuses = Prisma.join(SALES_STATUSES.map((status) => Prisma.sql`${status}`));

    const rows = await this.db.$queryRaw<(Omit<PeriodRow, "period"> & { period: Date | string })[]>`
      SELECT ${trunc}                          AS period,
             COUNT(*)                          AS invoiceCount,
             COALESCE(SUM(taxableTotal), 0)    AS taxable,
             COALESCE(SUM(cgstTotal), 0)       AS cgst,
             COALESCE(SUM(sgstTotal), 0)       AS sgst,
             COALESCE(SUM(igstTotal), 0)       AS igst,
             COALESCE(SUM(grandTotal), 0)      AS total
      FROM invoices
      WHERE status IN (${statuses})
        AND (${filters.dateFrom ?? null} IS NULL OR invoiceDate >= ${filters.dateFrom ?? null})
        AND (${filters.dateTo ?? null} IS NULL OR invoiceDate <= ${filters.dateTo ?? null})
        AND (${filters.customerId ?? null} IS NULL OR customerId = ${filters.customerId ?? null})
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    // MySQL returns COUNT(*) as BigInt and the date expression as a string.
    return rows.map((row) => ({
      ...row,
      period: row.period instanceof Date ? row.period : new Date(row.period),
      invoiceCount: Number(row.invoiceCount),
    }));
  }

  async salesByCustomer(filters: ReportFilters) {
    const grouped = await this.db.invoice.groupBy({
      by: ["customerId"],
      where: this.invoiceWhere(filters),
      _sum: { taxableTotal: true, grandTotal: true, amountPaid: true, balanceDue: true },
      _count: { _all: true },
      orderBy: { _sum: { grandTotal: "desc" } },
    });

    const customers = await this.db.customer.findMany({
      where: { id: { in: grouped.map((g) => g.customerId) } },
      select: { id: true, name: true, companyName: true, gstin: true, customerType: true },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    return grouped.map((g) => ({ ...g, customer: byId.get(g.customerId) ?? null }));
  }

  salesByProduct(filters: ReportFilters) {
    return this.db.invoiceItem.groupBy({
      by: ["productNameSnapshot", "unitSnapshot"],
      where: this.itemWhere(filters),
      _sum: { quantity: true, lineTaxableValue: true, cgstAmount: true, sgstAmount: true, igstAmount: true, lineTotal: true },
      _count: { _all: true },
      orderBy: { _sum: { lineTotal: "desc" } },
    });
  }

  salesByGstRate(filters: ReportFilters) {
    return this.db.invoiceItem.groupBy({
      by: ["gstRate"],
      where: this.itemWhere(filters),
      _sum: { lineTaxableValue: true, cgstAmount: true, sgstAmount: true, igstAmount: true, lineTotal: true },
      _count: { _all: true },
      orderBy: { gstRate: "asc" },
    });
  }

  /** HSN-wise summary as required for the GST return (architecture.md §20). */
  hsnSummary(filters: ReportFilters) {
    return this.db.invoiceItem.groupBy({
      by: ["hsnCodeSnapshot", "unitSnapshot", "gstRate"],
      where: this.itemWhere(filters),
      _sum: { quantity: true, lineTaxableValue: true, cgstAmount: true, sgstAmount: true, igstAmount: true, lineTotal: true },
      orderBy: { hsnCodeSnapshot: "asc" },
    });
  }

  /** B2B = customer holds a GSTIN; B2C = everyone else. */
  invoicesForGstReturn(filters: ReportFilters, segment: "B2B" | "B2C" | "ALL" = "ALL") {
    const gstinFilter: Prisma.InvoiceWhereInput =
      segment === "B2B"
        ? { customer: { gstin: { not: null } } }
        : segment === "B2C"
          ? { customer: { is: { gstin: null } } }
          : {};

    return this.db.invoice.findMany({
      where: { ...this.invoiceWhere(filters), ...gstinFilter },
      include: { customer: true, items: { orderBy: { lineNumber: "asc" } } },
      orderBy: [{ invoiceDate: "asc" }, { invoiceNumber: "asc" }],
    });
  }

  quotationFunnel(filters: ReportFilters) {
    return this.db.quotation.groupBy({
      by: ["status"],
      where: {
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.dateFrom || filters.dateTo
          ? {
              quotationDate: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {}),
      },
      _count: { _all: true },
      _sum: { grandTotal: true },
    });
  }

  /** Every invoice still carrying a balance, oldest first. */
  outstandingInvoices(filters: ReportFilters) {
    return this.db.invoice.findMany({
      where: {
        status: { in: RECEIVABLE_STATUSES },
        balanceDue: { gt: 0 },
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.dateFrom || filters.dateTo
          ? {
              invoiceDate: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {}),
      },
      include: { customer: { select: { id: true, name: true, companyName: true, phone: true } } },
      orderBy: { dueDate: "asc" },
    });
  }

  paymentsInRange(filters: ReportFilters) {
    return this.db.payment.findMany({
      where: {
        ...(filters.dateFrom || filters.dateTo
          ? {
              paymentDate: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {}),
        ...(filters.customerId ? { invoice: { customerId: filters.customerId } } : {}),
      },
      include: {
        invoice: {
          select: { id: true, invoiceNumber: true, customer: { select: { id: true, name: true, companyName: true } } },
        },
      },
      orderBy: { paymentDate: "asc" },
    });
  }

  paymentsByMethod(filters: ReportFilters) {
    return this.db.payment.groupBy({
      by: ["paymentMethod"],
      where:
        filters.dateFrom || filters.dateTo
          ? {
              paymentDate: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {},
      _sum: { amount: true },
      _count: { _all: true },
    });
  }
}
