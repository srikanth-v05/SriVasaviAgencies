import fs from "fs";
import path from "path";
import { Category } from "@prisma/client";
import { ProductRepository } from "../repositories/product.repository";
import { MasterDataRepository } from "../repositories/master-data.repository";
import { withRetry } from "../db/retry";
import { serialize } from "../utils/serialize";
import { logger } from "../config/logger";
import { env } from "../config/env";

export interface PublicCatalogProduct {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  description: string | null;
  dilutionRatio: string | null;
  packSize: string | null;
  imageUrl: string | null;
  hsnCode: string | null;
  indicativePrice: number;
  gstRate: number;
  category: { id: string; name: string; slug: string; zoneCode: string | null } | null;
  unit: { id: string; name: string; shortName: string };
}

interface ProductRow {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  description: string | null;
  dilutionRatio: string | null;
  packSize: string | null;
  imageUrl: string | null;
  hsnCode: string | null;
  defaultPrice: unknown;
  defaultGstRate: unknown;
  category: { id: string; name: string; slug: string; zoneCode: string | null } | null;
  unit: { id: string; name: string; shortName: string };
}

/** Effectively "no limit" for the one internal read that builds the whole cache. */
const WHOLE_CATALOGUE = 100_000;

const CATALOG_DIR = path.resolve(env.STORAGE_DIR, "catalog");
const CATALOG_FILE = path.join(CATALOG_DIR, "catalog.json");

function toPublicProduct(product: ProductRow): PublicCatalogProduct {
  return {
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    slug: product.slug,
    description: product.description,
    dilutionRatio: product.dilutionRatio,
    packSize: product.packSize,
    imageUrl: product.imageUrl,
    hsnCode: product.hsnCode,
    indicativePrice: product.defaultPrice as number,
    gstRate: product.defaultGstRate as number,
    category: product.category,
    unit: product.unit,
  };
}

/**
 * The public website's product catalogue (products + categories), written to
 * a real catalog.json file on disk (under STORAGE_DIR) and held in memory for
 * serving every visitor without a database round trip. Only an authenticated
 * admin write — creating, editing, deactivating or deleting a product or
 * category, or an explicit catalog import — rebuilds it; anonymous public
 * traffic always reads this file/cache, never the database directly.
 *
 * A process restart also rebuilds it once at boot, so a rare cold-start
 * failure here just means the very first visitor after startup (or after an
 * admin edit) pays for the rebuild — nobody else does.
 */
export class CatalogCacheService {
  private products: PublicCatalogProduct[] = [];
  private categories: Category[] = [];
  private ready: Promise<void>;

  constructor(
    private productRepository: ProductRepository,
    private masterDataRepository: MasterDataRepository,
  ) {
    this.ready = this.rebuild();
  }

  async rebuild(): Promise<void> {
    try {
      const [{ rows }, categories] = await withRetry(
        () =>
          Promise.all([
            this.productRepository.list({ isActive: true, showOnWebsite: true, skip: 0, take: WHOLE_CATALOGUE }),
            this.masterDataRepository.listCategories(),
          ]),
        { label: "catalogCache.rebuild" },
      );
      this.products = serialize(rows.map(toPublicProduct));
      this.categories = serialize(categories);
      this.writeToDisk();
    } catch (error) {
      logger.error({ err: error }, "Failed to rebuild the public catalogue cache — serving the previous snapshot");
    }
  }

  /** Best-effort — a disk write failure must never take the public catalogue down. */
  private writeToDisk(): void {
    try {
      fs.mkdirSync(CATALOG_DIR, { recursive: true });
      const payload = { generatedAt: new Date().toISOString(), categories: this.categories, products: this.products };
      fs.writeFileSync(CATALOG_FILE, JSON.stringify(payload, null, 2));
    } catch (error) {
      logger.warn({ err: error, file: CATALOG_FILE }, "Could not write catalog.json to disk");
    }
  }

  private async ensureBuiltOnce(): Promise<void> {
    await this.ready;
  }

  async list(options: { search?: string; categoryId?: string; skip: number; take: number }) {
    await this.ensureBuiltOnce();
    let rows = this.products;

    if (options.categoryId) {
      rows = rows.filter((p) => p.category?.id === options.categoryId);
    }
    if (options.search) {
      const needle = options.search.toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(needle) || p.productCode.toLowerCase().includes(needle));
    }

    return { rows: rows.slice(options.skip, options.skip + options.take), total: rows.length };
  }

  async bySlug(slug: string): Promise<PublicCatalogProduct | undefined> {
    await this.ensureBuiltOnce();
    return this.products.find((p) => p.slug === slug);
  }

  async allCategories(): Promise<Category[]> {
    await this.ensureBuiltOnce();
    return this.categories;
  }
}
