import { Category, GstRate, Prisma, PrismaClient, Unit } from "@prisma/client";

/** Categories, units and GST rates — small lookup tables with the same shape of access. */
export class MasterDataRepository {
  constructor(private db: PrismaClient) {}

  // Categories
  listCategories(includeInactive = false): Promise<Category[]> {
    return this.db.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  findCategoryBySlug(slug: string): Promise<Category | null> {
    return this.db.category.findUnique({ where: { slug } });
  }

  createCategory(data: Prisma.CategoryCreateInput): Promise<Category> {
    return this.db.category.create({ data });
  }

  updateCategory(id: string, data: Prisma.CategoryUpdateInput): Promise<Category> {
    return this.db.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.db.category.delete({ where: { id } });
  }

  countProductsInCategory(id: string): Promise<number> {
    return this.db.product.count({ where: { categoryId: id } });
  }

  // Units
  listUnits(includeInactive = false): Promise<Unit[]> {
    return this.db.unit.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  findUnitById(id: string): Promise<Unit | null> {
    return this.db.unit.findUnique({ where: { id } });
  }

  createUnit(data: Prisma.UnitCreateInput): Promise<Unit> {
    return this.db.unit.create({ data });
  }

  updateUnit(id: string, data: Prisma.UnitUpdateInput): Promise<Unit> {
    return this.db.unit.update({ where: { id }, data });
  }

  async deleteUnit(id: string): Promise<void> {
    await this.db.unit.delete({ where: { id } });
  }

  // GST rates
  listGstRates(): Promise<GstRate[]> {
    return this.db.gstRate.findMany({ where: { isActive: true }, orderBy: { rate: "asc" } });
  }

  createGstRate(data: Prisma.GstRateCreateInput): Promise<GstRate> {
    return this.db.gstRate.create({ data });
  }
}
