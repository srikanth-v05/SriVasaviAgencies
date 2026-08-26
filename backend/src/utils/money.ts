/**
 * Money and decimal primitives.
 *
 * Every rupee amount in this system is computed as an exact integer of paise
 * using BigInt. Floating point is never used for arithmetic that reaches an
 * invoice, because a half-paise drift on a single line becomes a mismatch
 * between the printed tax invoice and the GST return.
 *
 * Scales used across the codebase:
 *   quantity    3 dp   (scale 1e3)
 *   unit price  4 dp   (scale 1e4)
 *   gst rate    2 dp   (scale 1e2)
 *   amounts     2 dp   (scale 1e2, i.e. paise)
 */

export type Paise = bigint;

const SCALES: Record<number, bigint> = {
  0: 1n,
  2: 100n,
  3: 1000n,
  4: 10000n,
};

function scaleOf(dp: number): bigint {
  const s = SCALES[dp];
  if (s === undefined) throw new Error(`Unsupported decimal precision: ${dp}`);
  return s;
}

/** Integer division rounded half away from zero — the convention Indian tax rounding expects. */
export function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("Division by zero");
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (2n * n + d) / (2n * d);
  return negative ? -q : q;
}

/**
 * Parse a decimal input into an exact scaled BigInt, without going through a
 * float. Accepts numbers or strings; extra fractional digits are rounded half
 * away from zero.
 */
export function parseScaled(value: string | number | null | undefined, dp: number): bigint {
  if (value === null || value === undefined || value === "") return 0n;

  let raw = typeof value === "number" ? numberToPlainString(value) : String(value).trim();
  if (raw === "") return 0n;

  let sign = 1n;
  if (raw.startsWith("-")) {
    sign = -1n;
    raw = raw.slice(1);
  } else if (raw.startsWith("+")) {
    raw = raw.slice(1);
  }

  if (!/^\d*(\.\d*)?$/.test(raw)) {
    throw new Error(`Not a valid decimal value: ${String(value)}`);
  }

  const [intPart = "0", fracPart = ""] = raw.split(".");
  const wanted = fracPart.slice(0, dp).padEnd(dp, "0");
  const base = BigInt(intPart === "" ? "0" : intPart) * scaleOf(dp) + BigInt(wanted === "" ? "0" : wanted);

  // Round based on the first discarded digit.
  const nextDigit = fracPart.charAt(dp);
  const roundUp = nextDigit !== "" && Number(nextDigit) >= 5;
  return sign * (roundUp ? base + 1n : base);
}

/** Render a scaled BigInt back to a fixed-point decimal string (safe for Prisma Decimal). */
export function formatScaled(value: bigint, dp: number): string {
  const scale = scaleOf(dp);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const int = abs / scale;
  const frac = abs % scale;
  const body = dp === 0 ? int.toString() : `${int}.${frac.toString().padStart(dp, "0")}`;
  return negative ? `-${body}` : body;
}

/** Paise -> a fixed 2 dp rupee string, e.g. 118000n -> "1180.00". */
export function paiseToDecimalString(paise: Paise): string {
  return formatScaled(paise, 2);
}

/** Paise -> a JS number. Use for display and JSON only, never for further arithmetic. */
export function paiseToNumber(paise: Paise): number {
  return Number(paise) / 100;
}

export function rupeesToPaise(value: string | number | null | undefined): Paise {
  return parseScaled(value, 2);
}

/** Indian-format currency string, e.g. 1234567.5 -> "12,34,567.50". */
export function formatIndianCurrency(paise: Paise): string {
  const s = paiseToDecimalString(paise);
  const negative = s.startsWith("-");
  const [int = "0", frac = "00"] = (negative ? s.slice(1) : s).split(".");
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return `${negative ? "-" : ""}${grouped}.${frac}`;
}

function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Not a finite number: ${n}`);
  // toFixed(10) keeps well beyond our deepest scale (4 dp) and avoids exponent notation.
  return n.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
}

// ---------------------------------------------------------------------------
// Amount in words (Indian numbering system) — required on the tax invoice.
// ---------------------------------------------------------------------------

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = ONES[n % 10];
  return ones ? `${tens} ${ones}` : tens;
}

function threeDigitWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitWords(rest));
  return parts.join(" ");
}

/** 118000n (paise) -> "Rupees One Thousand One Hundred Eighty Only". */
export function amountInWords(paise: Paise): string {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const rupees = Number(abs / 100n);
  const paisepart = Number(abs % 100n);

  const segments: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const remainder = rupees % 1000;

  if (crore) segments.push(`${threeDigitWords(crore)} Crore`);
  if (lakh) segments.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) segments.push(`${twoDigitWords(thousand)} Thousand`);
  if (remainder) segments.push(threeDigitWords(remainder));

  const rupeeWords = segments.length ? segments.join(" ") : "Zero";
  const head = `${negative ? "Minus " : ""}Rupees ${rupeeWords}`;
  return paisepartWords(head, paisepart);
}

function paisepartWords(head: string, paisePart: number): string {
  return paisePart > 0 ? `${head} and ${twoDigitWords(paisePart)} Paise Only` : `${head} Only`;
}
