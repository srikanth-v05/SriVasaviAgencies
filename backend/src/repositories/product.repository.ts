import { Prisma, PrismaClient, Product } from "@prisma/client";
import type { PrismaTransaction } from "../db/prisma";

export interface ProductQuery {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  showOnWebsite?: boolean;
  skip: number;
  take: number;
}

const withRelations = {
  category: { select: { id: true, name: true, slug: true, zoneCode: true } },
  unit: { select: { id: true, name: true, shortName: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof withRelations }>;

export class ProductRepository {
  constructor(private db: PrismaClient) {}

  async list(query: ProductQuery): Promise<{ rows: ProductWithRelations[]; total: number }> {
    const where: Prisma.ProductWhereInput = {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.showOnWebsite === undefined ? {} : { showOnWebsite: query.showOnWebsite }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { productCode: { contains: query.search } },
              { hsnCode: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.product.findMany({
        where,
        include: withRelations,
        orderBy: { name: "asc" },
        skip: query.skip,
        take: query.take,
      }),
      this.db.product.count({ where }),
    ]);

    return { rows, total };
  }

  findById(id: string, tx?: PrismaTransaction): Promise<ProductWithRelations | null> {
    return (tx ?? this.db).product.findUnique({ where: { id }, include: withRelations });
  }

  findBySlug(slug: string): Promise<ProductWithRelations | null> {
    return this.db.product.findUnique({ where: { slug }, include: withRelations });
  }

  findByCode(productCode: string): Promise<ProductWithRelations | null> {
    return this.db.product.findUnique({ where: { productCode }, include: withRelations });
  }

  /** Batch lookup used when pricing document lines, to avoid an N+1 per line. */
  findManyByIds(ids: string[], tx?: PrismaTransaction): Promise<ProductWithRelations[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return (tx ?? this.db).product.findMany({ where: { id: { in: ids } }, include: withRelations });
  }

  slugExists(slug: string): Promise<boolean> {
    return this.db.product.findUnique({ where: { slug }, select: { id: true } }).then((r) => r !== null);
  }

  codeExists(productCode: string): Promise<boolean> {
    return this.db.product.findUnique({ where: { productCode }, select: { id: true } }).then((r) => r !== null);
  }

  count(): Promise<number> {
    return this.db.product.count();
  }

  create(data: Prisma.ProductCreateInput): Promise<ProductWithRelations> {
    return this.db.product.create({ data, include: withRelations });
  }

  update(id: string, data: Prisma.ProductUpdateInput): Promise<ProductWithRelations> {
    return this.db.product.update({ where: { id }, data, include: withRelations });
  }

  setStatus(id: string, isActive: boolean): Promise<Product> {
    return this.db.product.update({ where: { id }, data: { isActive } });
  }

  async delete(id: string): Promise<void> {
    await this.db.product.delete({ where: { id } });
  }

  /** A product referenced by any document must never be hard-deleted. */
  async usageCount(id: string): Promise<number> {
    const [quotationLines, invoiceLines] = await Promise.all([
      this.db.quotationItem.count({ where: { productId: id } }),
      this.db.invoiceItem.count({ where: { productId: id } }),
    ]);
    return quotationLines + invoiceLines;
  }
}
