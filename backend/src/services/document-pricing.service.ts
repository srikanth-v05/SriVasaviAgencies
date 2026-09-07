import { Prisma } from "@prisma/client";
import { ProductRepository, type ProductWithRelations } from "../repositories/product.repository";
import { MasterDataRepository } from "../repositories/master-data.repository";
import type { ProductService } from "./product.service";
import { calculateDocument, type DiscountType, type LineInput, type RoundingMode, type SupplyType } from "../domain/gst";
import { paiseToDecimalString, parseScaled, formatScaled } from "../utils/money";
import { ValidationError } from "../utils/errors";
import type { PrismaTransaction } from "../db/prisma";

/** A line exactly as the API receives it. */
export interface LineDraft {
  productId?: string | null;
  productName?: string;
  productCode?: string | null;
  hsnCode?: string | null;
  unit?: string;
  quantity: string | number;
  /** Omit to fall back to the product master default. Any value given here wins. */
  unitPrice?: string | number | null;
  discountType?: DiscountType;
  discountValue?: string | number | null;
  /** Omit to fall back to the product's default GST rate. */
  gstRate?: string | number | null;
}

/** A line priced, taxed, and shaped for persistence — the snapshot itself. */
export interface PricedLine {
  lineNumber: number;
  productId: string | null;
  productNameSnapshot: string;
  productCodeSnapshot: string | null;
  hsnCodeSnapshot: string | null;
  unitSnapshot: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  masterPriceSnapshot: Prisma.Decimal | null;
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  lineDiscount: Prisma.Decimal;
  grossValue: Prisma.Decimal;
  lineTaxableValue: Prisma.Decimal;
  gstRate: Prisma.Decimal;
  cgstRate: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstRate: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export interface DocumentHeaderTotals {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxableTotal: Prisma.Decimal;
  cgstTotal: Prisma.Decimal;
  sgstTotal: Prisma.Decimal;
  igstTotal: Prisma.Decimal;
  roundOff: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

/** Recorded whenever the entered price differs from the master price (architecture.md §30). */
export interface PriceOverride {
  lineNumber: number;
  productId: string | null;
  productName: string;
  masterPrice: string;
  enteredPrice: string;
  direction: "ABOVE_MASTER" | "BELOW_MASTER";
}

export interface PricingResult {
  supplyType: SupplyType;
  lines: PricedLine[];
  totals: DocumentHeaderTotals;
  priceOverrides: PriceOverride[];
}

export interface PriceDocumentInput {
  lines: LineDraft[];
  companyStateCode: string;
  placeOfSupplyStateCode: string;
  roundingMode: RoundingMode;
  allowZeroValueBilling: boolean;
  tx?: PrismaTransaction;
}

/**
 * Turns raw line input into priced, taxed, persistence-ready snapshots.
 *
 * Quotations and invoices both go through here, which is what guarantees that
 * converting a quotation cannot change its tax treatment: the same inputs run
 * through the same engine.
 *
 * The rule this module exists to protect: **an explicitly entered unit price is
 * used verbatim**. The product master price is consulted only when no price was
 * entered, and is otherwise kept purely as an audit snapshot. There is no
 * minimum, no maximum, and no warning based on it (architecture.md §2.1, §13, §30).
 */
export class DocumentPricingService {
  constructor(
    private productRepository: ProductRepository,
    private productService: ProductService,
    private masterDataRepository: MasterDataRepository,
  ) {}

  async price(input: PriceDocumentInput): Promise<PricingResult> {
    if (input.lines.length === 0) {
      throw new ValidationError("A document needs at least one line item");
    }

    const draftLines = await this.autoCreateMissingProducts(input.lines, input.tx);
    const products = await this.loadProducts(draftLines, input.tx);
    const resolved = draftLines.map((line, index) => this.resolveLine(line, index, products));

    const calculation = calculateDocument({
      lines: resolved.map((r) => r.engineInput),
      companyStateCode: input.companyStateCode,
      placeOfSupplyStateCode: input.placeOfSupplyStateCode,
      roundingMode: input.roundingMode,
    });

    const lines: PricedLine[] = resolved.map((r, index) => {
      const tax = calculation.lines[index]!;

      if (tax.lineTaxableValue === 0n && !input.allowZeroValueBilling) {
        throw new ValidationError(
          `Line ${index + 1} ("${r.productName}") has a value of zero. Enable zero-value billing in company settings if this is intended.`,
        );
      }

      return {
        lineNumber: index + 1,
        productId: r.productId,
        productNameSnapshot: r.productName,
        productCodeSnapshot: r.productCode,
        hsnCodeSnapshot: r.hsnCode,
        unitSnapshot: r.unit,
        quantity: new Prisma.Decimal(formatScaled(parseScaled(r.engineInput.quantity, 3), 3)),
        unitPrice: new Prisma.Decimal(formatScaled(parseScaled(r.engineInput.unitPrice, 4), 4)),
        masterPriceSnapshot: r.masterPrice === null ? null : new Prisma.Decimal(r.masterPrice),
        discountType: r.engineInput.discountType ?? "NONE",
        discountValue: new Prisma.Decimal(formatScaled(parseScaled(r.engineInput.discountValue ?? 0, 4), 4)),
        lineDiscount: dec(tax.lineDiscount),
        grossValue: dec(tax.grossValue),
        lineTaxableValue: dec(tax.lineTaxableValue),
        gstRate: new Prisma.Decimal(tax.gstRate),
        cgstRate: new Prisma.Decimal(tax.cgstRate),
        cgstAmount: dec(tax.cgstAmount),
        sgstRate: new Prisma.Decimal(tax.sgstRate),
        sgstAmount: dec(tax.sgstAmount),
        igstRate: new Prisma.Decimal(tax.igstRate),
        igstAmount: dec(tax.igstAmount),
        lineTotal: dec(tax.lineTotal),
      };
    });

    return {
      supplyType: calculation.supplyType,
      lines,
      totals: {
        subtotal: dec(calculation.subtotal),
        discountTotal: dec(calculation.discountTotal),
        taxableTotal: dec(calculation.taxableTotal),
        cgstTotal: dec(calculation.cgstTotal),
        sgstTotal: dec(calculation.sgstTotal),
        igstTotal: dec(calculation.igstTotal),
        roundOff: dec(calculation.roundOff),
        grandTotal: dec(calculation.grandTotal),
      },
      priceOverrides: collectOverrides(resolved),
    };
  }

  /**
   * A line typed free-hand (no product picked) becomes a new product in the
   * master catalogue rather than a one-off snapshot with nothing behind it —
   * so it shows up in the picker and reports the next time it's billed. A
   * name that already matches an existing product links to it instead of
   * creating a duplicate.
   */
  private async autoCreateMissingProducts(lines: LineDraft[], tx?: PrismaTransaction): Promise<LineDraft[]> {
    const result: LineDraft[] = [];

    for (const line of lines) {
      const name = line.productName?.trim();
      if (line.productId || !name) {
        result.push(line);
        continue;
      }

      const existing = await this.productRepository.findByName(name, tx);
      if (existing) {
        result.push({ ...line, productId: existing.id });
        continue;
      }

      const unitId = await this.resolveOrCreateUnit(line.unit?.trim() || "Nos");
      const priceGiven = line.unitPrice !== undefined && line.unitPrice !== null && line.unitPrice !== "";
      const gstGiven = line.gstRate !== undefined && line.gstRate !== null && line.gstRate !== "";

      const created = await this.productService.create({
        name,
        unitId,
        hsnCode: line.hsnCode?.trim() || null,
        defaultPrice: priceGiven ? Number(line.unitPrice) : 0,
        defaultGstRate: gstGiven ? Number(line.gstRate) : 18,
        showOnWebsite: false,
      });
      result.push({ ...line, productId: created.id });
    }

    return result;
  }

  /** Case-insensitive match on the unit's short or full name; a genuinely new
   * unit (e.g. a one-off pack size) is created rather than rejected. */
  private async resolveOrCreateUnit(unitText: string): Promise<string> {
    const units = await this.masterDataRepository.listUnits(true);
    const needle = unitText.toLowerCase();
    const match = units.find((u) => u.shortName.toLowerCase() === needle || u.name.toLowerCase() === needle);
    if (match) return match.id;

    const created = await this.masterDataRepository.createUnit({ name: unitText, shortName: unitText });
    return created.id;
  }

  private async loadProducts(
    lines: LineDraft[],
    tx?: PrismaTransaction,
  ): Promise<Map<string, ProductWithRelations>> {
    const ids = [...new Set(lines.map((l) => l.productId).filter((id): id is string => Boolean(id)))];
    const products = await this.productRepository.findManyByIds(ids, tx);
    const map = new Map(products.map((p) => [p.id, p]));

    const missing = ids.filter((id) => !map.has(id));
    if (missing.length > 0) {
      throw new ValidationError(`Unknown product on the document: ${missing.join(", ")}`);
    }
    return map;
  }

  private resolveLine(line: LineDraft, index: number, products: Map<string, ProductWithRelations>): ResolvedLine {
    const product = line.productId ? products.get(line.productId) ?? null : null;

    const productName = line.productName?.trim() || product?.name;
    if (!productName) {
      throw new ValidationError(`Line ${index + 1} needs either a product or a description`);
    }

    const unit = line.unit?.trim() || product?.unit.shortName;
    if (!unit) {
      throw new ValidationError(`Line ${index + 1} ("${productName}") needs a unit`);
    }

    // The entered price wins outright; the master price is only a fallback.
    const priceWasEntered = line.unitPrice !== undefined && line.unitPrice !== null && line.unitPrice !== "";
    const unitPrice = priceWasEntered ? line.unitPrice! : product?.defaultPrice.toString();
    if (unitPrice === undefined) {
      throw new ValidationError(`Line ${index + 1} ("${productName}") needs a unit price`);
    }

    const gstRate =
      line.gstRate !== undefined && line.gstRate !== null && line.gstRate !== ""
        ? line.gstRate
        : product?.defaultGstRate.toString();
    if (gstRate === undefined) {
      throw new ValidationError(`Line ${index + 1} ("${productName}") needs a GST rate`);
    }

    if (parseScaled(line.quantity, 3) <= 0n) {
      throw new ValidationError(`Line ${index + 1} ("${productName}") needs a quantity greater than zero`);
    }

    return {
      productId: product?.id ?? null,
      productName,
      productCode: line.productCode?.trim() || product?.productCode || null,
      hsnCode: line.hsnCode?.trim() || product?.hsnCode || null,
      unit,
      masterPrice: product ? product.defaultPrice.toString() : null,
      priceWasEntered,
      lineNumber: index + 1,
      engineInput: {
        quantity: line.quantity,
        unitPrice,
        discountType: line.discountType ?? "NONE",
        discountValue: line.discountValue ?? 0,
        gstRate,
      },
    };
  }
}

interface ResolvedLine {
  productId: string | null;
  productName: string;
  productCode: string | null;
  hsnCode: string | null;
  unit: string;
  masterPrice: string | null;
  priceWasEntered: boolean;
  lineNumber: number;
  engineInput: LineInput;
}

function collectOverrides(resolved: ResolvedLine[]): PriceOverride[] {
  const overrides: PriceOverride[] = [];
  for (const line of resolved) {
    if (!line.priceWasEntered || line.masterPrice === null) continue;
    const entered = parseScaled(line.engineInput.unitPrice, 4);
    const master = parseScaled(line.masterPrice, 4);
    if (entered === master) continue;
    overrides.push({
      lineNumber: line.lineNumber,
      productId: line.productId,
      productName: line.productName,
      masterPrice: formatScaled(master, 4),
      enteredPrice: formatScaled(entered, 4),
      direction: entered > master ? "ABOVE_MASTER" : "BELOW_MASTER",
    });
  }
  return overrides;
}

function dec(paise: bigint): Prisma.Decimal {
  return new Prisma.Decimal(paiseToDecimalString(paise));
}
