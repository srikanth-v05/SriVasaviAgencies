import { Prisma } from "@prisma/client";
import { ProductRepository, type ProductQuery } from "../repositories/product.repository";
import { MasterDataRepository } from "../repositories/master-data.repository";
import { AuditService, AuditAction } from "./audit.service";
import { NotFoundError, ValidationError, ConflictError } from "../utils/errors";
import { uniqueSlug } from "../utils/slug";

export interface ProductInput {
  /** Assigned automatically (PRD-0001, PRD-0002, ...) when not given. */
  productCode?: string | null;
  name: string;
  categoryId?: string | null;
  description?: string | null;
  dilutionRatio?: string | null;
  packSize?: string | null;
  imageUrl?: string | null;
  hsnCode?: string | null;
  defaultPrice: number;
  defaultGstRate: number;
  unitId: string;
  isActive?: boolean;
  showOnWebsite?: boolean;
}

export class ProductService {
  constructor(
    private productRepository: ProductRepository,
    private masterDataRepository: MasterDataRepository,
    private auditService: AuditService,
  ) {}

  list(query: ProductQuery) {
    return this.productRepository.list(query);
  }

  async getById(id: string) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundError("Product not found");
    return product;
  }

  async getBySlug(slug: string) {
    const product = await this.productRepository.findBySlug(slug);
    if (!product) throw new NotFoundError("Product not found");
    return product;
  }

  async create(input: ProductInput) {
    await this.assertUnitExists(input.unitId);

    const productCode = input.productCode?.trim() || (await this.nextProductCode());
    const slug = await uniqueSlug(input.name, (s) => this.productRepository.slugExists(s));
    const product = await this.productRepository.create({
      ...this.toPersistable(input),
      productCode,
      slug,
      unit: { connect: { id: input.unitId } },
      ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
    });

    await this.auditService.record(AuditAction.CREATE_PRODUCT, {
      entityType: "Product",
      entityId: product.id,
      newValues: product,
    });
    return product;
  }

  async update(id: string, input: Partial<ProductInput>) {
    const before = await this.productRepository.findById(id);
    if (!before) throw new NotFoundError("Product not found");
    if (input.unitId) await this.assertUnitExists(input.unitId);

    const data: Prisma.ProductUpdateInput = {
      ...(input.productCode ? { productCode: input.productCode } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dilutionRatio !== undefined ? { dilutionRatio: input.dilutionRatio } : {}),
      ...(input.packSize !== undefined ? { packSize: input.packSize } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.hsnCode !== undefined ? { hsnCode: input.hsnCode } : {}),
      ...(input.defaultPrice !== undefined ? { defaultPrice: new Prisma.Decimal(input.defaultPrice) } : {}),
      ...(input.defaultGstRate !== undefined ? { defaultGstRate: new Prisma.Decimal(input.defaultGstRate) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.showOnWebsite !== undefined ? { showOnWebsite: input.showOnWebsite } : {}),
      ...(input.unitId ? { unit: { connect: { id: input.unitId } } } : {}),
      ...(input.categoryId === undefined
        ? {}
        : input.categoryId === null
          ? { category: { disconnect: true } }
          : { category: { connect: { id: input.categoryId } } }),
    };

    const product = await this.productRepository.update(id, data);

    // Changing the master price never rewrites history: existing documents hold
    // their own snapshots (architecture.md §2.2).
    await this.auditService.record(AuditAction.UPDATE_PRODUCT, {
      entityType: "Product",
      entityId: id,
      oldValues: before,
      newValues: product,
    });
    return product;
  }

  async setStatus(id: string, isActive: boolean) {
    await this.getById(id);
    const product = await this.productRepository.setStatus(id, isActive);
    await this.auditService.record(AuditAction.UPDATE_PRODUCT, {
      entityType: "Product",
      entityId: id,
      newValues: { isActive },
    });
    return product;
  }

  /**
   * A product that appears on any quotation or invoice is deactivated rather
   * than deleted, so historical documents keep a resolvable reference.
   */
  async remove(id: string) {
    const product = await this.getById(id);
    const usage = await this.productRepository.usageCount(id);

    if (usage > 0) {
      throw new ConflictError(
        `This product appears on ${usage} document line(s) and cannot be deleted. Deactivate it instead.`,
      );
    }

    await this.productRepository.delete(id);
    await this.auditService.record(AuditAction.DELETE_PRODUCT, {
      entityType: "Product",
      entityId: id,
      oldValues: product,
    });
  }

  private async assertUnitExists(unitId: string) {
    const unit = await this.masterDataRepository.findUnitById(unitId);
    if (!unit) throw new ValidationError("The selected unit does not exist");
  }

  /** Generated from a running count, with a collision check to cover gaps left by deletions. */
  private async nextProductCode(): Promise<string> {
    let sequence = (await this.productRepository.count()) + 1;
    let candidate = `PRD-${String(sequence).padStart(4, "0")}`;
    while (await this.productRepository.codeExists(candidate)) {
      sequence += 1;
      candidate = `PRD-${String(sequence).padStart(4, "0")}`;
    }
    return candidate;
  }

  private toPersistable(input: ProductInput) {
    return {
      name: input.name,
      description: input.description ?? null,
      dilutionRatio: input.dilutionRatio ?? null,
      packSize: input.packSize ?? null,
      imageUrl: input.imageUrl ?? null,
      hsnCode: input.hsnCode ?? null,
      defaultPrice: new Prisma.Decimal(input.defaultPrice),
      defaultGstRate: new Prisma.Decimal(input.defaultGstRate),
      isActive: input.isActive ?? true,
      showOnWebsite: input.showOnWebsite ?? true,
    };
  }
}
