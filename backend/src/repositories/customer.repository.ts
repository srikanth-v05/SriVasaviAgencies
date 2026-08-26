import { Customer, CustomerType, Prisma, PrismaClient } from "@prisma/client";
import type { PrismaTransaction } from "../db/prisma";

export interface CustomerQuery {
  search?: string;
  customerType?: CustomerType;
  isActive?: boolean;
  skip: number;
  take: number;
}

const withAddresses = { addresses: true } satisfies Prisma.CustomerInclude;
export type CustomerWithAddresses = Prisma.CustomerGetPayload<{ include: typeof withAddresses }>;

export class CustomerRepository {
  constructor(private db: PrismaClient) {}

  async list(query: CustomerQuery): Promise<{ rows: CustomerWithAddresses[]; total: number }> {
    const where: Prisma.CustomerWhereInput = {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.customerType ? { customerType: query.customerType } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { companyName: { contains: query.search } },
              { phone: { contains: query.search } },
              { gstin: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.customer.findMany({
        where,
        include: withAddresses,
        orderBy: { name: "asc" },
        skip: query.skip,
        take: query.take,
      }),
      this.db.customer.count({ where }),
    ]);

    return { rows, total };
  }

  findById(id: string, tx?: PrismaTransaction): Promise<CustomerWithAddresses | null> {
    return (tx ?? this.db).customer.findUnique({ where: { id }, include: withAddresses });
  }

  create(data: Prisma.CustomerCreateInput): Promise<CustomerWithAddresses> {
    return this.db.customer.create({ data, include: withAddresses });
  }

  update(id: string, data: Prisma.CustomerUpdateInput): Promise<CustomerWithAddresses> {
    return this.db.customer.update({ where: { id }, data, include: withAddresses });
  }

  setStatus(id: string, isActive: boolean): Promise<Customer> {
    return this.db.customer.update({ where: { id }, data: { isActive } });
  }

  async delete(id: string): Promise<void> {
    await this.db.customer.delete({ where: { id } });
  }

  async replaceAddresses(
    customerId: string,
    addresses: Omit<Prisma.CustomerAddressCreateManyInput, "customerId">[],
  ): Promise<void> {
    await this.db.$transaction([
      this.db.customerAddress.deleteMany({ where: { customerId } }),
      this.db.customerAddress.createMany({ data: addresses.map((a) => ({ ...a, customerId })) }),
    ]);
  }

  async documentCount(id: string): Promise<number> {
    const [quotations, invoices] = await Promise.all([
      this.db.quotation.count({ where: { customerId: id } }),
      this.db.invoice.count({ where: { customerId: id } }),
    ]);
    return quotations + invoices;
  }

  /**
   * Outstanding = the total still due across every invoice that is issued and
   * not cancelled. Cancelled and draft documents carry no receivable.
   */
  async outstanding(customerId: string): Promise<Prisma.Decimal> {
    const result = await this.db.invoice.aggregate({
      where: {
        customerId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      _sum: { balanceDue: true },
    });
    return result._sum.balanceDue ?? new Prisma.Decimal(0);
  }
}
