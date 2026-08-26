import { InvoiceStatus, Prisma, PrismaClient } from "@prisma/client";
import type { PrismaTransaction } from "../db/prisma";

export interface InvoiceQuery {
  search?: string;
  customerId?: string;
  status?: InvoiceStatus;
  dateFrom?: Date;
  dateTo?: Date;
  /** "PAID" | "UNPAID" | "PARTIAL" | "OVERDUE" — derived, not a column. */
  paymentStatus?: string;
  skip: number;
  take: number;
}

const fullInclude = {
  customer: { include: { addresses: true } },
  items: { orderBy: { lineNumber: "asc" } },
  payments: { orderBy: { paymentDate: "desc" } },
  createdBy: { select: { id: true, name: true, email: true } },
  quotation: { select: { id: true, quotationNumber: true } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceFull = Prisma.InvoiceGetPayload<{ include: typeof fullInclude }>;

/** Invoices that represent a live receivable. Drafts and cancellations do not. */
export const RECEIVABLE_STATUSES: InvoiceStatus[] = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];
/** Invoices that count as real sales for reporting and GST. */
export const SALES_STATUSES: InvoiceStatus[] = ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"];

export class InvoiceRepository {
  constructor(private db: PrismaClient) {}

  private buildWhere(query: InvoiceQuery): Prisma.InvoiceWhereInput {
    const paymentFilter: Prisma.InvoiceWhereInput =
      query.paymentStatus === "PAID"
        ? { status: "PAID" }
        : query.paymentStatus === "PARTIAL"
          ? { status: "PARTIALLY_PAID" }
          : query.paymentStatus === "OVERDUE"
            ? { status: "OVERDUE" }
            : query.paymentStatus === "UNPAID"
              ? { status: { in: RECEIVABLE_STATUSES } }
              : {};

    return {
      ...paymentFilter,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            invoiceDate: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { invoiceNumber: { contains: query.search } },
              { customer: { name: { contains: query.search } } },
              { customer: { companyName: { contains: query.search } } },
            ],
          }
        : {}),
    };
  }

  async list(query: InvoiceQuery) {
    const where = this.buildWhere(query);
    const [rows, total] = await Promise.all([
      this.db.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, companyName: true, gstin: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
        skip: query.skip,
        take: query.take,
      }),
      this.db.invoice.count({ where }),
    ]);
    return { rows, total };
  }

  findById(id: string, tx?: PrismaTransaction): Promise<InvoiceFull | null> {
    return (tx ?? this.db).invoice.findUnique({ where: { id }, include: fullInclude });
  }

  create(data: Prisma.InvoiceCreateInput, tx?: PrismaTransaction): Promise<InvoiceFull> {
    return (tx ?? this.db).invoice.create({ data, include: fullInclude });
  }

  async replace(
    id: string,
    header: Prisma.InvoiceUpdateInput,
    items: Omit<Prisma.InvoiceItemCreateManyInput, "invoiceId">[],
  ): Promise<InvoiceFull> {
    return this.db.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({ where: { id }, data: header });
      await tx.invoiceItem.createMany({ data: items.map((i) => ({ ...i, invoiceId: id })) });
      return tx.invoice.findUniqueOrThrow({ where: { id }, include: fullInclude });
    });
  }

  update(id: string, data: Prisma.InvoiceUpdateInput, tx?: PrismaTransaction): Promise<InvoiceFull> {
    return (tx ?? this.db).invoice.update({ where: { id }, data, include: fullInclude });
  }

  async delete(id: string): Promise<void> {
    await this.db.invoice.delete({ where: { id } });
  }

  listByCustomer(customerId: string, take = 50) {
    return this.db.invoice.findMany({
      where: { customerId },
      orderBy: { invoiceDate: "desc" },
      take,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        grandTotal: true,
        amountPaid: true,
        balanceDue: true,
        status: true,
      },
    });
  }

  /** Flip issued invoices past their due date to OVERDUE. */
  async markOverdue(asOf: Date = new Date()): Promise<number> {
    const result = await this.db.invoice.updateMany({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate: { lt: asOf },
        balanceDue: { gt: 0 },
      },
      data: { status: "OVERDUE" },
    });
    return result.count;
  }

  salesAggregate(where: Prisma.InvoiceWhereInput) {
    return this.db.invoice.aggregate({
      where: { status: { in: SALES_STATUSES }, ...where },
      _sum: {
        taxableTotal: true,
        cgstTotal: true,
        sgstTotal: true,
        igstTotal: true,
        grandTotal: true,
        amountPaid: true,
        balanceDue: true,
      },
      _count: { _all: true },
    });
  }

  findManyForReport(where: Prisma.InvoiceWhereInput) {
    return this.db.invoice.findMany({
      where: { status: { in: SALES_STATUSES }, ...where },
      include: { customer: true, items: { orderBy: { lineNumber: "asc" } } },
      orderBy: [{ invoiceDate: "asc" }, { invoiceNumber: "asc" }],
    });
  }
}
