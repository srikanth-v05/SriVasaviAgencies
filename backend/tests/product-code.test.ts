import { describe, it, expect, vi } from "vitest";
import { ProductService, type ProductInput } from "../src/services/product.service";

const BASE_INPUT: ProductInput = {
  name: "Test Cleaner 5L",
  defaultPrice: 500,
  defaultGstRate: 18,
  unitId: "unit-1",
};

/** A ProductService wired to in-memory fakes, sufficient for exercising create(). */
function buildService(existingCodes: string[]) {
  const codes = new Set(existingCodes);
  let productCount = existingCodes.length;

  const productRepository = {
    count: vi.fn(async () => productCount),
    codeExists: vi.fn(async (code: string) => codes.has(code)),
    slugExists: vi.fn(async () => false),
    create: vi.fn(async (data: Record<string, unknown>) => {
      const code = data.productCode as string;
      codes.add(code);
      productCount += 1;
      return { id: `product-${productCount}`, ...data };
    }),
  };

  const masterDataRepository = { findUnitById: vi.fn(async () => ({ id: "unit-1" })) };
  const auditService = { record: vi.fn(async () => undefined) };

  const service = new ProductService(
    productRepository as never,
    masterDataRepository as never,
    auditService as never,
  );

  return { service, productRepository };
}

describe("ProductService — product code assignment", () => {
  it("assigns PRD-0001 to the first product when no code is given", async () => {
    const { service } = buildService([]);
    const product = await service.create({ ...BASE_INPUT });
    expect(product.productCode).toBe("PRD-0001");
  });

  it("continues the sequence from the current product count", async () => {
    const { service } = buildService(["PRD-0001", "PRD-0002", "PRD-0003"]);
    const product = await service.create({ ...BASE_INPUT });
    expect(product.productCode).toBe("PRD-0004");
  });

  it("skips a code that already exists, covering gaps left by deletions", async () => {
    // Two products exist, but PRD-0003 (not PRD-0003 -> next) is already taken —
    // e.g. product #3 was deleted and recreated by hand with that exact code.
    const { service } = buildService(["PRD-0001", "PRD-0003"]);
    const product = await service.create({ ...BASE_INPUT });
    expect(product.productCode).toBe("PRD-0004");
  });

  it("honours an explicitly supplied product code instead of generating one", async () => {
    const { service, productRepository } = buildService([]);
    const product = await service.create({ ...BASE_INPUT, productCode: "CUSTOM-01" });
    expect(product.productCode).toBe("CUSTOM-01");
    expect(productRepository.count).not.toHaveBeenCalled();
  });
});
