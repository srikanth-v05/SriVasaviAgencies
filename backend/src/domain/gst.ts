/**
 * GST calculation engine (architecture.md §12, §13, §14).
 *
 * Pure: no database, no clock, no config lookups. Everything it needs arrives as
 * arguments, so the whole tax surface of the product can be tested directly.
 *
 * Two rules drive the whole module:
 *   1. The unit price on a document line is authoritative. The product master
 *      price is a default only and is never re-applied here (§2.1, §13).
 *   2. Intra-state supply splits into CGST + SGST; inter-state supply is IGST.
 *      "Intra-state" means the place of supply is the supplier's own state (§12).
 */

import { parseScaled, roundDiv, type Paise } from "../utils/money";

export type DiscountType = "NONE" | "PERCENTAGE" | "FIXED";
export type RoundingMode = "NONE" | "NEAREST_RUPEE";
export type SupplyType = "INTRA_STATE" | "INTER_STATE";

export interface LineInput {
  /** Quantity, up to 3 decimal places. */
  quantity: string | number;
  /** Unit price entered on THIS document, up to 4 dp. Never the master price. */
  unitPrice: string | number;
  discountType?: DiscountType;
  /** Percent (0-100) when PERCENTAGE, rupees when FIXED. */
  discountValue?: string | number;
  /** Total GST rate for the line, e.g. 18 for 18%. */
  gstRate: string | number;
}

export interface LineTax {
  grossValue: Paise;
  lineDiscount: Paise;
  lineTaxableValue: Paise;
  gstRate: number;
  cgstRate: number;
  cgstAmount: Paise;
  sgstRate: number;
  sgstAmount: Paise;
  igstRate: number;
  igstAmount: Paise;
  lineTotal: Paise;
}

export interface DocumentTotals {
  subtotal: Paise;
  discountTotal: Paise;
  taxableTotal: Paise;
  cgstTotal: Paise;
  sgstTotal: Paise;
  igstTotal: Paise;
  /** Sum of line totals before rounding. */
  netTotal: Paise;
  roundOff: Paise;
  /** netTotal + roundOff — the amount actually payable. */
  grandTotal: Paise;
}

export interface DocumentTax extends DocumentTotals {
  supplyType: SupplyType;
  lines: LineTax[];
}

const QTY_DP = 3;
const PRICE_DP = 4;
const RATE_DP = 2;

/**
 * Decide the supply type. Comparison is on numeric state code so that "33" and
 * "3" cannot be confused, and stray whitespace does not flip a tax treatment.
 */
export function resolveSupplyType(companyStateCode: string, placeOfSupplyStateCode: string): SupplyType {
  const normalise = (code: string) => String(code ?? "").trim().replace(/^0+/, "");
  const company = normalise(companyStateCode);
  const supply = normalise(placeOfSupplyStateCode);
  if (!company || !supply) {
    throw new Error("Both the company state code and the place-of-supply state code are required to compute GST");
  }
  return company === supply ? "INTRA_STATE" : "INTER_STATE";
}

/** Tax for a single document line. */
export function calculateLine(input: LineInput, supplyType: SupplyType): LineTax {
  const quantity = parseScaled(input.quantity, QTY_DP);
  const unitPrice = parseScaled(input.unitPrice, PRICE_DP);

  if (quantity < 0n) throw new Error("Quantity cannot be negative");
  if (unitPrice < 0n) throw new Error("Unit price cannot be negative");

  // quantity(1e3) * unitPrice(1e4) = value * 1e7; paise = value * 1e2, so divide by 1e5.
  const grossValue = roundDiv(quantity * unitPrice, 100000n);

  const lineDiscount = calculateDiscount(grossValue, input.discountType ?? "NONE", input.discountValue ?? 0);
  if (lineDiscount > grossValue) {
    throw new Error("Line discount cannot exceed the line value");
  }
  const lineTaxableValue = grossValue - lineDiscount;

  const rateScaled = parseScaled(input.gstRate, RATE_DP);
  if (rateScaled < 0n) throw new Error("GST rate cannot be negative");
  const gstRate = Number(rateScaled) / 100;

  let cgstAmount = 0n;
  let sgstAmount = 0n;
  let igstAmount = 0n;

  if (supplyType === "INTRA_STATE") {
    // Half the rate each. Computed from the full rate at double denominator so a
    // rate with an odd number of paise (e.g. 0.25%) does not lose precision.
    cgstAmount = roundDiv(lineTaxableValue * rateScaled, 20000n);
    sgstAmount = cgstAmount;
  } else {
    igstAmount = roundDiv(lineTaxableValue * rateScaled, 10000n);
  }

  const halfRate = gstRate / 2;
  return {
    grossValue,
    lineDiscount,
    lineTaxableValue,
    gstRate,
    cgstRate: supplyType === "INTRA_STATE" ? halfRate : 0,
    cgstAmount,
    sgstRate: supplyType === "INTRA_STATE" ? halfRate : 0,
    sgstAmount,
    igstRate: supplyType === "INTER_STATE" ? gstRate : 0,
    igstAmount,
    lineTotal: lineTaxableValue + cgstAmount + sgstAmount + igstAmount,
  };
}

function calculateDiscount(grossValue: Paise, type: DiscountType, value: string | number): Paise {
  switch (type) {
    case "NONE":
      return 0n;
    case "PERCENTAGE": {
      const pct = parseScaled(value, PRICE_DP);
      if (pct < 0n) throw new Error("Discount percentage cannot be negative");
      if (pct > 1000000n) throw new Error("Discount percentage cannot exceed 100%");
      // gross * (pct / 1e4) / 100
      return roundDiv(grossValue * pct, 1000000n);
    }
    case "FIXED": {
      const amount = parseScaled(value, 2);
      if (amount < 0n) throw new Error("Discount amount cannot be negative");
      return amount;
    }
    default:
      throw new Error(`Unknown discount type: ${String(type)}`);
  }
}

/** Roll a set of calculated lines up into document totals, applying the rounding policy. */
export function totalDocument(lines: LineTax[], roundingMode: RoundingMode = "NEAREST_RUPEE"): DocumentTotals {
  const sum = (pick: (l: LineTax) => Paise) => lines.reduce((acc, l) => acc + pick(l), 0n);

  const subtotal = sum((l) => l.grossValue);
  const discountTotal = sum((l) => l.lineDiscount);
  const taxableTotal = sum((l) => l.lineTaxableValue);
  const cgstTotal = sum((l) => l.cgstAmount);
  const sgstTotal = sum((l) => l.sgstAmount);
  const igstTotal = sum((l) => l.igstAmount);
  const netTotal = taxableTotal + cgstTotal + sgstTotal + igstTotal;

  const roundOff = roundingMode === "NEAREST_RUPEE" ? roundDiv(netTotal, 100n) * 100n - netTotal : 0n;

  return {
    subtotal,
    discountTotal,
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    netTotal,
    roundOff,
    grandTotal: netTotal + roundOff,
  };
}

export interface CalculateDocumentInput {
  lines: LineInput[];
  companyStateCode: string;
  placeOfSupplyStateCode: string;
  roundingMode?: RoundingMode;
}

/** The one entry point services use: lines in, fully taxed document out. */
export function calculateDocument(input: CalculateDocumentInput): DocumentTax {
  const supplyType = resolveSupplyType(input.companyStateCode, input.placeOfSupplyStateCode);
  const lines = input.lines.map((line) => calculateLine(line, supplyType));
  return { supplyType, lines, ...totalDocument(lines, input.roundingMode ?? "NEAREST_RUPEE") };
}
