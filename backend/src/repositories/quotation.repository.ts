import { Prisma, PrismaClient, QuotationStatus } from "@prisma/client";
import type { PrismaTransaction } from "../db/prisma";

export interface QuotationQuery {
  search?: string;
  customerId?: string;
  status?: QuotationStatus;
  dateFrom?: Date;
  dateTo?: Date;
  skip: number;
  take: number;
}

const fullInclude = {
  customer: true,
  items: { orderBy: { lineNumber: "asc" } },
  createdBy: { select: { id: true, name: true, email: true } },
  invoice: { select: { id: true, invoiceNumber: true, status: true } },
} satisfies Prisma.QuotationInclude;

export type QuotationFull = Prisma.QuotationGetPayload<{ include: typeof fullInclude }>;

export class QuotationRepository {
  constructor(private db: PrismaClient) {}

  private buildWhere(query: QuotationQuery): Prisma.QuotationWhereInput {
    return {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            quotationDate: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { quotationNumber: { contains: query.search } },
              { customer: { name: { contains: query.search } } },
              { customer: { companyName: { contains: query.search } } },
            ],
          }
        : {}),
    };
  }

  async list(query: QuotationQuery) {
    const where = this.buildWhere(query);
    const [rows, total] = await Promise.all([
      this.db.quotation.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, companyName: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ quotationDate: "desc" }, { createdAt: "desc" }],
        skip: query.skip,
        take: query.take,
      }),
      this.db.quotation.count({ where }),
    ]);
    return { rows, total };
  }

  findById(id: string, tx?: PrismaTransaction): Promise<QuotationFull | null> {
    return (tx ?? this.db).quotation.findUnique({ where: { id }, include: fullInclude });
  }

  create(data: Prisma.QuotationCreateInput, tx?: PrismaTransaction): Promise<QuotationFull> {
    return (tx ?? this.db).quotation.create({ data, include: fullInclude });
  }

  /** Header update plus a wholesale replacement of the lines, in one transaction. */
  async replace(
    id: string,
    header: Prisma.QuotationUpdateInput,
    items: Omit<Prisma.QuotationItemCreateManyInput, "quotationId">[],
  ): Promise<QuotationFull> {
    return this.db.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      await tx.quotation.update({ where: { id }, data: header });
      await tx.quotationItem.createMany({ data: items.map((i) => ({ ...i, quotationId: id })) });
      return tx.quotation.findUniqueOrThrow({ where: { id }, include: fullInclude });
    });
  }

  updateStatus(
    id: string,
    status: QuotationStatus,
    extra: Prisma.QuotationUpdateInput = {},
    tx?: PrismaTransaction,
  ): Promise<QuotationFull> {
    return (tx ?? this.db).quotation.update({
      where: { id },
      data: { status, ...extra },
      include: fullInclude,
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.quotation.delete({ where: { id } });
  }

  listByCustomer(customerId: string, take = 50) {
    return this.db.quotation.findMany({
      where: { customerId },
      orderBy: { quotationDate: "desc" },
      take,
      select: {
        id: true,
        quotationNumber: true,
        quotationDate: true,
        validUntil: true,
        grandTotal: true,
        status: true,
      },
    });
  }

  /** Quotations past their validity date that nobody has decided on yet. */
  async markExpired(asOf: Date = new Date()): Promise<number> {
    const result = await this.db.quotation.updateMany({
      where: { status: { in: ["DRAFT", "SENT"] }, validUntil: { lt: asOf } },
      data: { status: "EXPIRED" },
    });
    return result.count;
  }

  countByStatus(dateFrom?: Date, dateTo?: Date) {
    return this.db.quotation.groupBy({
      by: ["status"],
      where:
        dateFrom || dateTo
          ? { quotationDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
          : {},
      _count: { _all: true },
      _sum: { grandTotal: true },
    });
  }
}
