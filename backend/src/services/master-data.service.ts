import { Prisma } from "@prisma/client";
import { MasterDataRepository } from "../repositories/master-data.repository";
import { CatalogCacheService } from "./catalog-cache.service";
import { ConflictError, NotFoundError } from "../utils/errors";
import { slugify } from "../utils/slug";

/** Categories, units and GST rates (architecture.md §8, §22). */
export class MasterDataService {
  constructor(
    private repository: MasterDataRepository,
    private catalogCacheService: CatalogCacheService,
  ) {}

  listCategories(includeInactive = false) {
    return this.repository.listCategories(includeInactive);
  }

  async createCategory(input: { name: string; description?: string | null; zoneCode?: string | null; sortOrder?: number }) {
    const category = await this.repository.createCategory({
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? null,
      zoneCode: input.zoneCode ?? null,
      sortOrder: input.sortOrder ?? 0,
    });
    await this.catalogCacheService.rebuild();
    return category;
  }

  async updateCategory(
    id: string,
    input: { name?: string; description?: string | null; zoneCode?: string | null; sortOrder?: number; isActive?: boolean },
  ) {
    const data: Prisma.CategoryUpdateInput = {
      ...(input.name !== undefined ? { name: input.name, slug: slugify(input.name) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.zoneCode !== undefined ? { zoneCode: input.zoneCode } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
    const category = await this.repository.updateCategory(id, data);
    await this.catalogCacheService.rebuild();
    return category;
  }

  /** A category still holding products is deactivated rather than removed. */
  async deleteCategory(id: string) {
    const products = await this.repository.countProductsInCategory(id);
    if (products > 0) {
      throw new ConflictError(`This category holds ${products} product(s). Move or deactivate them first.`);
    }
    await this.repository.deleteCategory(id);
    await this.catalogCacheService.rebuild();
  }

  listUnits(includeInactive = false) {
    return this.repository.listUnits(includeInactive);
  }

  createUnit(input: { name: string; shortName: string }) {
    return this.repository.createUnit({ name: input.name, shortName: input.shortName });
  }

  async updateUnit(id: string, input: { name?: string; shortName?: string; isActive?: boolean }) {
    const unit = await this.repository.findUnitById(id);
    if (!unit) throw new NotFoundError("Unit not found");
    const updated = await this.repository.updateUnit(id, input);
    // A unit's name/short name is embedded in every cached product that uses it.
    await this.catalogCacheService.rebuild();
    return updated;
  }

  listGstRates() {
    return this.repository.listGstRates();
  }

  createGstRate(input: { rate: number; label: string }) {
    return this.repository.createGstRate({ rate: new Prisma.Decimal(input.rate), label: input.label });
  }
}
