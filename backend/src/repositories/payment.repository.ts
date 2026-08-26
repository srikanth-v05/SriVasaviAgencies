import { PaymentMethod, Prisma, PrismaClient } from "@prisma/client";
import type { PrismaTransaction } from "../db/prisma";

export interface PaymentQuery {
  invoiceId?: string;
  customerId?: string;
  paymentMethod?: PaymentMethod;
  dateFrom?: Date;
  dateTo?: Date;
  skip: number;
  take: number;
}

const fullInclude = {
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      grandTotal: true,
      balanceDue: true,
      status: true,
      customer: { select: { id: true, name: true, companyName: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.PaymentInclude;

export type PaymentFull = Prisma.PaymentGetPayload<{ include: typeof fullInclude }>;

export class PaymentRepository {
  constructor(private db: PrismaClient) {}

  private buildWhere(query: PaymentQuery): Prisma.PaymentWhereInput {
    return {
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.customerId ? { invoice: { customerId: query.customerId } } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            paymentDate: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };
  }

  async list(query: PaymentQuery) {
    const where = this.buildWhere(query);
    const [rows, total] = await Promise.all([
      this.db.payment.findMany({
        where,
        include: fullInclude,
        orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
        skip: query.skip,
        take: query.take,
      }),
      this.db.payment.count({ where }),
    ]);
    return { rows, total };
  }

  findById(id: string, tx?: PrismaTransaction): Promise<PaymentFull | null> {
    return (tx ?? this.db).payment.findUnique({ where: { id }, include: fullInclude });
  }

  create(data: Prisma.PaymentCreateInput, tx?: PrismaTransaction): Promise<PaymentFull> {
    return (tx ?? this.db).payment.create({ data, include: fullInclude });
  }

  update(id: string, data: Prisma.PaymentUpdateInput, tx?: PrismaTransaction): Promise<PaymentFull> {
    return (tx ?? this.db).payment.update({ where: { id }, data, include: fullInclude });
  }

  async delete(id: string, tx?: PrismaTransaction): Promise<void> {
    await (tx ?? this.db).payment.delete({ where: { id } });
  }

  /** Total received against one invoice — the source of truth for amountPaid. */
  async sumForInvoice(invoiceId: string, tx?: PrismaTransaction): Promise<Prisma.Decimal> {
    const result = await (tx ?? this.db).payment.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  listByCustomer(customerId: string, take = 50) {
    return this.db.payment.findMany({
      where: { invoice: { customerId } },
      orderBy: { paymentDate: "desc" },
      take,
      include: { invoice: { select: { id: true, invoiceNumber: true } } },
    });
  }

  collectionsByMethod(dateFrom?: Date, dateTo?: Date) {
    return this.db.payment.groupBy({
      by: ["paymentMethod"],
      where:
        dateFrom || dateTo
          ? { paymentDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
          : {},
      _sum: { amount: true },
      _count: { _all: true },
    });
  }
}
