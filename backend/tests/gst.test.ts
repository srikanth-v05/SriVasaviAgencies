import { describe, it, expect } from "vitest";
import { calculateDocument, calculateLine, resolveSupplyType, totalDocument } from "../src/domain/gst";
import { paiseToDecimalString } from "../src/utils/money";

const rupees = (paise: bigint) => paiseToDecimalString(paise);

const COMPANY_STATE = "33"; // Tamil Nadu

describe("resolveSupplyType", () => {
  it("treats a supply within the company's own state as intra-state", () => {
    expect(resolveSupplyType("33", "33")).toBe("INTRA_STATE");
  });

  it("treats a supply to another state as inter-state", () => {
    expect(resolveSupplyType("33", "29")).toBe("INTER_STATE");
  });

  it("ignores leading zeros and whitespace in state codes", () => {
    expect(resolveSupplyType("07", " 7 ")).toBe("INTRA_STATE");
  });

  it("refuses to guess when a state code is missing", () => {
    expect(() => resolveSupplyType("33", "")).toThrow(/required/i);
  });
});

describe("intra-state GST (CGST + SGST)", () => {
  // architecture.md §12: taxable 10,000 at 18% -> CGST 900 + SGST 900, total 11,800
  it("splits 18% into two halves of 9%", () => {
    const line = calculateLine({ quantity: 100, unitPrice: 100, gstRate: 18 }, "INTRA_STATE");

    expect(rupees(line.lineTaxableValue)).toBe("10000.00");
    expect(rupees(line.cgstAmount)).toBe("900.00");
    expect(rupees(line.sgstAmount)).toBe("900.00");
    expect(rupees(line.igstAmount)).toBe("0.00");
    expect(rupees(line.lineTotal)).toBe("11800.00");
    expect(line.cgstRate).toBe(9);
    expect(line.sgstRate).toBe(9);
  });
});

describe("inter-state GST (IGST)", () => {
  // architecture.md §12: taxable 10,000 at 18% -> IGST 1,800, total 11,800
  it("charges the full rate as IGST", () => {
    const line = calculateLine({ quantity: 100, unitPrice: 100, gstRate: 18 }, "INTER_STATE");

    expect(rupees(line.lineTaxableValue)).toBe("10000.00");
    expect(rupees(line.cgstAmount)).toBe("0.00");
    expect(rupees(line.sgstAmount)).toBe("0.00");
    expect(rupees(line.igstAmount)).toBe("1800.00");
    expect(rupees(line.lineTotal)).toBe("11800.00");
    expect(line.igstRate).toBe(18);
  });

  it("reaches the same grand total either way", () => {
    const intra = calculateLine({ quantity: 100, unitPrice: 100, gstRate: 18 }, "INTRA_STATE");
    const inter = calculateLine({ quantity: 100, unitPrice: 100, gstRate: 18 }, "INTER_STATE");
    expect(intra.lineTotal).toBe(inter.lineTotal);
  });
});

describe("discounts", () => {
  it("applies a percentage discount before tax", () => {
    const line = calculateLine(
      { quantity: 10, unitPrice: 100, discountType: "PERCENTAGE", discountValue: 10, gstRate: 18 },
      "INTRA_STATE",
    );

    expect(rupees(line.grossValue)).toBe("1000.00");
    expect(rupees(line.lineDiscount)).toBe("100.00");
    expect(rupees(line.lineTaxableValue)).toBe("900.00");
    expect(rupees(line.lineTotal)).toBe("1062.00"); // 900 + 81 + 81
  });

  it("applies a fixed discount before tax", () => {
    const line = calculateLine(
      { quantity: 10, unitPrice: 100, discountType: "FIXED", discountValue: 250, gstRate: 18 },
      "INTER_STATE",
    );

    expect(rupees(line.lineDiscount)).toBe("250.00");
    expect(rupees(line.lineTaxableValue)).toBe("750.00");
    expect(rupees(line.igstAmount)).toBe("135.00");
  });

  it("rejects a discount larger than the line itself", () => {
    expect(() =>
      calculateLine({ quantity: 1, unitPrice: 100, discountType: "FIXED", discountValue: 500, gstRate: 18 }, "INTRA_STATE"),
    ).toThrow(/exceed/i);
  });

  it("rejects a percentage above 100", () => {
    expect(() =>
      calculateLine({ quantity: 1, unitPrice: 100, discountType: "PERCENTAGE", discountValue: 120, gstRate: 18 }, "INTRA_STATE"),
    ).toThrow(/100%/);
  });
});

describe("price override (architecture.md §13, §34)", () => {
  // The engine is handed whatever price the admin entered. There is no master
  // price in scope here at all — which is exactly the guarantee being tested.
  const cases = [
    { label: "entered price equals the master price", price: 100, expectedTaxable: "5000.00" },
    { label: "entered price below the master price", price: 80, expectedTaxable: "4000.00" },
    { label: "entered price above the master price", price: 120, expectedTaxable: "6000.00" },
    { label: "zero-value line", price: 0, expectedTaxable: "0.00" },
  ];

  for (const { label, price, expectedTaxable } of cases) {
    it(`accepts a line where the ${label}`, () => {
      const line = calculateLine({ quantity: 50, unitPrice: price, gstRate: 18 }, "INTRA_STATE");
      expect(rupees(line.lineTaxableValue)).toBe(expectedTaxable);
    });
  }

  // architecture.md §13 worked example: 50 x ₹85 = ₹4,250
  it("uses the overridden price for the gross value", () => {
    const line = calculateLine({ quantity: 50, unitPrice: 85, gstRate: 18 }, "INTRA_STATE");
    expect(rupees(line.grossValue)).toBe("4250.00");
  });

  it("prices multiple items at different overridden prices independently", () => {
    const result = calculateDocument({
      companyStateCode: COMPANY_STATE,
      placeOfSupplyStateCode: "33",
      lines: [
        { quantity: 10, unitPrice: 95, gstRate: 18 },
        { quantity: 10, unitPrice: 110, gstRate: 18 },
        { quantity: 10, unitPrice: 80, gstRate: 12 },
      ],
    });

    expect(rupees(result.lines[0]!.lineTaxableValue)).toBe("950.00");
    expect(rupees(result.lines[1]!.lineTaxableValue)).toBe("1100.00");
    expect(rupees(result.lines[2]!.lineTaxableValue)).toBe("800.00");
    expect(rupees(result.taxableTotal)).toBe("2850.00");
  });

  it("rejects a negative price outright", () => {
    expect(() => calculateLine({ quantity: 1, unitPrice: -5, gstRate: 18 }, "INTRA_STATE")).toThrow(/negative/i);
  });
});

describe("rounding (architecture.md §14)", () => {
  it("rounds the grand total to the nearest rupee and records the adjustment", () => {
    const result = calculateDocument({
      companyStateCode: COMPANY_STATE,
      placeOfSupplyStateCode: "33",
      roundingMode: "NEAREST_RUPEE",
      lines: [{ quantity: 3, unitPrice: 33.33, gstRate: 18 }],
    });

    // 99.99 taxable + 9.00 + 9.00 = 117.99 -> rounds to 118.00
    expect(rupees(result.netTotal)).toBe("117.99");
    expect(rupees(result.roundOff)).toBe("0.01");
    expect(rupees(result.grandTotal)).toBe("118.00");
  });

  it("rounds down when the paise are below fifty", () => {
    const lines = [calculateLine({ quantity: 1, unitPrice: 100.2, gstRate: 0 }, "INTRA_STATE")];
    const totals = totalDocument(lines, "NEAREST_RUPEE");

    expect(rupees(totals.roundOff)).toBe("-0.20");
    expect(rupees(totals.grandTotal)).toBe("100.00");
  });

  it("leaves the total untouched when rounding is off", () => {
    const lines = [calculateLine({ quantity: 3, unitPrice: 33.33, gstRate: 18 }, "INTRA_STATE")];
    const totals = totalDocument(lines, "NONE");

    expect(rupees(totals.roundOff)).toBe("0.00");
    expect(rupees(totals.grandTotal)).toBe("117.99");
  });
});

describe("document totals", () => {
  it("adds up lines that carry different GST rates", () => {
    const result = calculateDocument({
      companyStateCode: COMPANY_STATE,
      placeOfSupplyStateCode: "33",
      lines: [
        { quantity: 10, unitPrice: 100, gstRate: 18 }, // 1000 + 90 + 90
        { quantity: 5, unitPrice: 200, gstRate: 12 }, // 1000 + 60 + 60
        { quantity: 2, unitPrice: 50, gstRate: 0 }, //   100 +  0 +  0
      ],
    });

    expect(rupees(result.taxableTotal)).toBe("2100.00");
    expect(rupees(result.cgstTotal)).toBe("150.00");
    expect(rupees(result.sgstTotal)).toBe("150.00");
    expect(rupees(result.igstTotal)).toBe("0.00");
    expect(rupees(result.grandTotal)).toBe("2400.00");
  });

  it("keeps exact paise on quantities and prices with decimals", () => {
    // 12.5 x 33.3333 = 416.66625 -> 416.67 taxable
    const line = calculateLine({ quantity: 12.5, unitPrice: 33.3333, gstRate: 5 }, "INTER_STATE");

    expect(rupees(line.grossValue)).toBe("416.67");
    expect(rupees(line.igstAmount)).toBe("20.83");
    expect(rupees(line.lineTotal)).toBe("437.50");
  });

  it("does not drift over a long document", () => {
    const lines = Array.from({ length: 200 }, () => ({ quantity: 1, unitPrice: 0.05, gstRate: 18 }));
    const result = calculateDocument({
      companyStateCode: COMPANY_STATE,
      placeOfSupplyStateCode: "29",
      lines,
      roundingMode: "NONE",
    });

    // 200 x 0.05 = 10.00 taxable exactly; float arithmetic would leave 9.999...
    expect(rupees(result.taxableTotal)).toBe("10.00");
  });
});
