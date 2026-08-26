import { describe, it, expect } from "vitest";
import {
  parseScaled,
  formatScaled,
  roundDiv,
  amountInWords,
  formatIndianCurrency,
  rupeesToPaise,
} from "../src/utils/money";
import { financialYearOf, financialYearRange } from "../src/utils/fiscal-year";

describe("parseScaled", () => {
  it("parses decimals exactly, without float error", () => {
    // 1.005 * 100 is 100.49999999999999 in floating point; the string path is exact.
    expect(parseScaled("1.005", 2)).toBe(101n);
    expect(parseScaled("0.1", 2)).toBe(10n);
    expect(parseScaled("1234.5678", 4)).toBe(12345678n);
  });

  it("rounds half away from zero when digits are dropped", () => {
    expect(parseScaled("1.005", 2)).toBe(101n);
    expect(parseScaled("1.004", 2)).toBe(100n);
    expect(parseScaled("-1.005", 2)).toBe(-101n);
  });

  it("accepts numbers as well as strings", () => {
    expect(parseScaled(85, 4)).toBe(850000n);
    expect(parseScaled(0.05, 2)).toBe(5n);
  });

  it("treats empty input as zero", () => {
    expect(parseScaled(null, 2)).toBe(0n);
    expect(parseScaled("", 2)).toBe(0n);
  });

  it("rejects values that are not decimals", () => {
    expect(() => parseScaled("12,000", 2)).toThrow(/valid decimal/i);
  });
});

describe("roundDiv", () => {
  it("rounds halves away from zero in both directions", () => {
    expect(roundDiv(5n, 2n)).toBe(3n);
    expect(roundDiv(-5n, 2n)).toBe(-3n);
    expect(roundDiv(4n, 2n)).toBe(2n);
    expect(roundDiv(1n, 3n)).toBe(0n);
  });
});

describe("formatScaled", () => {
  it("renders a fixed-point string with the right number of places", () => {
    expect(formatScaled(118000n, 2)).toBe("1180.00");
    expect(formatScaled(5n, 2)).toBe("0.05");
    expect(formatScaled(-20n, 2)).toBe("-0.20");
  });
});

describe("formatIndianCurrency", () => {
  it("groups in lakhs and crores", () => {
    expect(formatIndianCurrency(rupeesToPaise("1234567.5"))).toBe("12,34,567.50");
    expect(formatIndianCurrency(rupeesToPaise("999"))).toBe("999.00");
    expect(formatIndianCurrency(rupeesToPaise("100000"))).toBe("1,00,000.00");
  });
});

describe("amountInWords", () => {
  it("spells amounts in the Indian numbering system", () => {
    expect(amountInWords(rupeesToPaise("1180"))).toBe("Rupees One Thousand One Hundred Eighty Only");
    expect(amountInWords(rupeesToPaise("100000"))).toBe("Rupees One Lakh Only");
    expect(amountInWords(rupeesToPaise("12345678"))).toBe(
      "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only",
    );
  });

  it("includes paise when there are any", () => {
    expect(amountInWords(rupeesToPaise("1180.50"))).toBe("Rupees One Thousand One Hundred Eighty and Fifty Paise Only");
  });

  it("handles zero", () => {
    expect(amountInWords(0n)).toBe("Rupees Zero Only");
  });
});

describe("financial year", () => {
  it("starts the year on 1 April", () => {
    expect(financialYearOf(new Date("2026-08-25"))).toBe("2026-27");
    expect(financialYearOf(new Date("2026-04-01"))).toBe("2026-27");
    expect(financialYearOf(new Date("2026-03-31"))).toBe("2025-26");
    expect(financialYearOf(new Date("2026-01-15"))).toBe("2025-26");
  });

  it("resolves a label back to its date range", () => {
    const { start, end } = financialYearRange("2026-27");
    expect(start.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(end.toISOString().slice(0, 10)).toBe("2027-04-01");
  });

  it("rejects a malformed label", () => {
    expect(() => financialYearRange("2026")).toThrow(/invalid/i);
  });
});
