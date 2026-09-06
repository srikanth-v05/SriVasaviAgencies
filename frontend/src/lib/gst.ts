import type { DiscountType } from "@/types";

/**
 * Client-side preview of the tax on a document being edited.
 *
 * This mirrors the server engine so the totals move as the user types, but it is
 * never authoritative: the figures actually stored come back from the API, which
 * recomputes everything in exact integer paise. Treat this as a display aid.
 */

export interface DraftLine {
  quantity: number;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;
  gstRate: number;
}

export interface PreviewLine {
  grossValue: number;
  lineDiscount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * The first two digits of a GSTIN are the state code it was issued under —
 * mirrors the server's own rule (invoice/quotation service) so the live
 * preview agrees with what actually gets saved. A customer's stored state is
 * only a fallback for one with no GSTIN on file.
 */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const prefix = gstin.trim().slice(0, 2);
  return /^\d{2}$/.test(prefix) ? prefix : null;
}

export function previewLine(line: DraftLine, isInterState: boolean): PreviewLine {
  const grossValue = round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));

  const lineDiscount =
    line.discountType === "PERCENTAGE"
      ? round2((grossValue * (Number(line.discountValue) || 0)) / 100)
      : line.discountType === "FIXED"
        ? round2(Number(line.discountValue) || 0)
        : 0;

  const taxable = round2(Math.max(0, grossValue - lineDiscount));
  const rate = Number(line.gstRate) || 0;

  const cgst = isInterState ? 0 : round2((taxable * rate) / 200);
  const sgst = cgst;
  const igst = isInterState ? round2((taxable * rate) / 100) : 0;

  return { grossValue, lineDiscount, taxable, cgst, sgst, igst, lineTotal: round2(taxable + cgst + sgst + igst) };
}

export interface PreviewTotals {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  netTotal: number;
  roundOff: number;
  grandTotal: number;
  lines: PreviewLine[];
}

export function previewDocument(
  lines: DraftLine[],
  isInterState: boolean,
  roundingMode: "NONE" | "NEAREST_RUPEE" = "NEAREST_RUPEE",
): PreviewTotals {
  const priced = lines.map((line) => previewLine(line, isInterState));
  const sum = (pick: (l: PreviewLine) => number) => round2(priced.reduce((acc, l) => acc + pick(l), 0));

  const taxableTotal = sum((l) => l.taxable);
  const cgstTotal = sum((l) => l.cgst);
  const sgstTotal = sum((l) => l.sgst);
  const igstTotal = sum((l) => l.igst);
  const netTotal = round2(taxableTotal + cgstTotal + sgstTotal + igstTotal);
  const roundOff = roundingMode === "NEAREST_RUPEE" ? round2(Math.round(netTotal) - netTotal) : 0;

  return {
    subtotal: sum((l) => l.grossValue),
    discountTotal: sum((l) => l.lineDiscount),
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    netTotal,
    roundOff,
    grandTotal: round2(netTotal + roundOff),
    lines: priced,
  };
}
