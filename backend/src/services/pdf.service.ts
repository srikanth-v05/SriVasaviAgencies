import PDFDocument from "pdfkit";
import { CompanySettings, Prisma } from "@prisma/client";
import type { InvoiceFull } from "../repositories/invoice.repository";
import type { QuotationFull } from "../repositories/quotation.repository";
import { amountInWords, formatIndianCurrency, rupeesToPaise } from "../utils/money";

type Doc = PDFKit.PDFDocument;

const PAGE_MARGIN = 40;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;

const INK = "#101A1F";
const MUTED = "#5C6B72";
const RULE = "#C8D3D6";
const BRAND = "#0F6E63";

interface Column {
  key: string;
  label: string;
  width: number;
  align: "left" | "right" | "center";
}

/**
 * Server-side PDF generation (architecture.md §18).
 *
 * Every figure printed comes from the document's own stored snapshot, never from
 * the product master, so reprinting an old invoice years later reproduces it
 * exactly as issued.
 */
export class PdfService {
  async renderInvoice(invoice: InvoiceFull, company: CompanySettings): Promise<Buffer> {
    const isIgst = invoice.igstTotal.greaterThan(0);
    const title = invoice.status === "CANCELLED" ? "TAX INVOICE (CANCELLED)" : "TAX INVOICE";

    return this.render((doc) => {
      this.header(doc, company, title, invoice.status === "DRAFT" ? "DRAFT — NOT A VALID TAX INVOICE" : null);

      this.metaAndParty(doc, {
        left: [
          ["Invoice No.", invoice.invoiceNumber ?? "(not yet issued)"],
          ["Invoice Date", formatDate(invoice.invoiceDate)],
          ["Due Date", invoice.dueDate ? formatDate(invoice.dueDate) : "—"],
          ["Place of Supply", `${invoice.placeOfSupply} (${invoice.placeOfSupplyStateCode})`],
          ["Payment Terms", invoice.paymentTerms ?? "—"],
        ],
        partyTitle: "Bill To",
        partyLines: this.partyLines(invoice),
      });

      this.itemsTable(doc, invoice.items, isIgst);
      this.totals(doc, invoice, isIgst);
      this.wordsAndBank(doc, invoice.grandTotal, company, invoice.termsAndConditions, invoice.notes);
    });
  }

  async renderQuotation(quotation: QuotationFull, company: CompanySettings): Promise<Buffer> {
    const isIgst = quotation.igstTotal.greaterThan(0);

    return this.render((doc) => {
      this.header(doc, company, "QUOTATION", quotation.status === "DRAFT" ? "DRAFT" : null);

      this.metaAndParty(doc, {
        left: [
          ["Quotation No.", quotation.quotationNumber ?? "(draft)"],
          ["Date", formatDate(quotation.quotationDate)],
          ["Valid Until", quotation.validUntil ? formatDate(quotation.validUntil) : "—"],
          ["Place of Supply", `${quotation.placeOfSupply} (${quotation.placeOfSupplyStateCode})`],
          ["Status", quotation.status],
        ],
        partyTitle: "Quotation For",
        partyLines: [
          quotation.customer.companyName ?? quotation.customer.name,
          ...(quotation.customer.contactPerson ? [`Attn: ${quotation.customer.contactPerson}`] : []),
          ...(quotation.customer.gstin ? [`GSTIN: ${quotation.customer.gstin}`] : []),
          `Phone: ${quotation.customer.phone}`,
          `${quotation.customer.state} (${quotation.customer.stateCode})`,
        ],
      });

      this.itemsTable(doc, quotation.items, isIgst);
      this.totals(doc, quotation, isIgst);
      this.wordsAndBank(doc, quotation.grandTotal, company, quotation.termsAndConditions, quotation.notes);
    });
  }

  // -------------------------------------------------------------------------

  private render(draw: (doc: Doc) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      try {
        draw(doc);
        this.pageNumbers(doc);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private header(doc: Doc, company: CompanySettings, title: string, watermark: string | null): void {
    doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(17).text(company.tradeName ?? company.name, PAGE_MARGIN, PAGE_MARGIN);

    const addressLines = [
      company.addressLine1,
      company.addressLine2,
      `${company.city} ${company.pincode}, ${company.state}`,
      `Phone: ${company.phone}  |  Email: ${company.email}`,
      company.gstin ? `GSTIN: ${company.gstin}` : null,
    ].filter(Boolean) as string[];

    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
    for (const line of addressLines) doc.text(line, PAGE_MARGIN, doc.y, { width: 320 });

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(15)
      .text(title, PAGE_MARGIN + CONTENT_WIDTH - 220, PAGE_MARGIN + 2, { width: 220, align: "right" });

    if (watermark) {
      doc
        .fillColor("#B23B3B")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(watermark, PAGE_MARGIN + CONTENT_WIDTH - 220, PAGE_MARGIN + 22, { width: 220, align: "right" });
    }

    const y = Math.max(doc.y, PAGE_MARGIN + 70) + 6;
    doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y).lineWidth(1).strokeColor(BRAND).stroke();
    doc.y = y + 12;
  }

  private metaAndParty(
    doc: Doc,
    args: { left: [string, string][]; partyTitle: string; partyLines: string[] },
  ): void {
    const top = doc.y;
    const columnWidth = CONTENT_WIDTH / 2 - 10;

    doc.font("Helvetica").fontSize(8.5);
    let y = top;
    for (const [label, value] of args.left) {
      doc.fillColor(MUTED).text(label, PAGE_MARGIN, y, { width: 90, continued: false });
      doc.fillColor(INK).font("Helvetica-Bold").text(value, PAGE_MARGIN + 92, y, { width: columnWidth - 92 });
      doc.font("Helvetica");
      y += 13;
    }

    const partyX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 10;
    doc.fillColor(MUTED).fontSize(8).text(args.partyTitle.toUpperCase(), partyX, top);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(args.partyLines[0] ?? "", partyX, top + 12, { width: columnWidth });
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
    for (const line of args.partyLines.slice(1)) {
      doc.text(line, partyX, doc.y, { width: columnWidth });
    }

    doc.y = Math.max(y, doc.y) + 14;
  }

  private itemsTable(doc: Doc, items: LineLike[], isIgst: boolean): void {
    const columns: Column[] = [
      { key: "sn", label: "#", width: 18, align: "left" },
      { key: "description", label: "Description", width: 140, align: "left" },
      { key: "hsn", label: "HSN", width: 45, align: "left" },
      { key: "qty", label: "Qty", width: 35, align: "right" },
      { key: "unit", label: "Unit", width: 28, align: "left" },
      { key: "rate", label: "Rate", width: 50, align: "right" },
      { key: "taxable", label: "Taxable", width: 58, align: "right" },
      { key: "gst", label: "GST%", width: 32, align: "right" },
      { key: "tax", label: isIgst ? "IGST" : "CGST+SGST", width: 55, align: "right" },
      { key: "total", label: "Amount", width: 54, align: "right" },
    ];

    this.tableHeader(doc, columns);

    doc.font("Helvetica").fontSize(8).fillColor(INK);
    items.forEach((item, index) => {
      const tax = isIgst ? item.igstAmount : item.cgstAmount.plus(item.sgstAmount);
      const values: Record<string, string> = {
        sn: String(index + 1),
        description: item.productNameSnapshot + (item.lineDiscount.greaterThan(0) ? `\nLess discount ${money(item.lineDiscount)}` : ""),
        hsn: item.hsnCodeSnapshot ?? "—",
        qty: trimNumber(item.quantity),
        unit: item.unitSnapshot,
        rate: money(item.unitPrice),
        taxable: money(item.lineTaxableValue),
        gst: `${trimNumber(item.gstRate)}%`,
        tax: money(tax),
        total: money(item.lineTotal),
      };

      const rowHeight = values.description.includes("\n") ? 22 : 14;
      if (doc.y + rowHeight > 760) {
        doc.addPage();
        this.tableHeader(doc, columns);
        doc.font("Helvetica").fontSize(8).fillColor(INK);
      }

      const y = doc.y;
      let x = PAGE_MARGIN;
      for (const column of columns) {
        doc.text(values[column.key] ?? "", x + 3, y + 3, { width: column.width - 6, align: column.align });
        x += column.width;
      }

      doc.y = y + rowHeight;
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
        .lineWidth(0.4)
        .strokeColor(RULE)
        .stroke();
    });

    doc.y += 8;
  }

  private tableHeader(doc: Doc, columns: Column[]): void {
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 16).fill("#EDF2F1");
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(7.5);

    let x = PAGE_MARGIN;
    for (const column of columns) {
      doc.text(column.label.toUpperCase(), x + 3, y + 5, { width: column.width - 6, align: column.align });
      x += column.width;
    }
    doc.y = y + 16;
  }

  private totals(doc: Doc, document: TotalsLike, isIgst: boolean): void {
    const boxX = PAGE_MARGIN + CONTENT_WIDTH - 220;
    const rows: [string, Prisma.Decimal, boolean?][] = [
      ["Subtotal", document.subtotal],
      ...(document.discountTotal.greaterThan(0) ? ([["Discount", document.discountTotal.negated()]] as [string, Prisma.Decimal][]) : []),
      ["Taxable Value", document.taxableTotal],
      ...(isIgst
        ? ([["IGST", document.igstTotal]] as [string, Prisma.Decimal][])
        : ([
            ["CGST", document.cgstTotal],
            ["SGST", document.sgstTotal],
          ] as [string, Prisma.Decimal][])),
      ...(document.roundOff.isZero() ? [] : ([["Round Off", document.roundOff]] as [string, Prisma.Decimal][])),
      ["Grand Total", document.grandTotal, true],
    ];

    doc.fontSize(9);
    for (const [label, value, emphasise] of rows) {
      const y = doc.y;
      if (emphasise) {
        doc.rect(boxX, y, 220, 18).fill(BRAND);
        doc.fillColor("#FFFFFF").font("Helvetica-Bold");
        doc.text(label, boxX + 8, y + 5, { width: 100 });
        doc.text(money(value), boxX + 108, y + 5, { width: 104, align: "right" });
        doc.y = y + 18;
      } else {
        doc.fillColor(MUTED).font("Helvetica").text(label, boxX + 8, y, { width: 100 });
        doc.fillColor(INK).text(money(value), boxX + 108, y, { width: 104, align: "right" });
        doc.y = y + 13;
      }
    }
    doc.y += 6;
  }

  private wordsAndBank(
    doc: Doc,
    grandTotal: Prisma.Decimal,
    company: CompanySettings,
    terms: string | null,
    notes: string | null,
  ): void {
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Amount in words", PAGE_MARGIN, doc.y);
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(amountInWords(rupeesToPaise(grandTotal.toString())), PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH - 230 });

    doc.y += 10;
    const bankTop = doc.y;

    if (company.bankName) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Payment details", PAGE_MARGIN, bankTop);
      const bank = [
        `${company.bankName}${company.bankBranch ? ` — ${company.bankBranch}` : ""}`,
        company.bankAccountName ? `A/c Name: ${company.bankAccountName}` : null,
        company.bankAccountNumber ? `A/c No: ${company.bankAccountNumber}` : null,
        company.bankIfsc ? `IFSC: ${company.bankIfsc}` : null,
        company.upiId ? `UPI: ${company.upiId}` : null,
      ].filter(Boolean) as string[];

      doc.fillColor(INK).fontSize(8.5);
      for (const line of bank) doc.text(line, PAGE_MARGIN, doc.y, { width: 240 });
    }

    if (terms || notes) {
      const rightX = PAGE_MARGIN + CONTENT_WIDTH - 250;
      doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Terms and conditions", rightX, bankTop, { width: 250 });
      doc.fillColor(INK).fontSize(7.5).text([notes, terms].filter(Boolean).join("\n"), rightX, doc.y, { width: 250 });
    }

    doc.y += 24;
    doc
      .fillColor(MUTED)
      .fontSize(7.5)
      .text(`For ${company.tradeName ?? company.name}`, PAGE_MARGIN + CONTENT_WIDTH - 200, doc.y, {
        width: 200,
        align: "right",
      });
    doc.text("Authorised Signatory", PAGE_MARGIN + CONTENT_WIDTH - 200, doc.y + 28, { width: 200, align: "right" });
  }

  private pageNumbers(doc: Doc): void {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(7)
        .text(`Page ${i - range.start + 1} of ${range.count}`, PAGE_MARGIN, 806, {
          width: CONTENT_WIDTH,
          align: "center",
        });
    }
  }

  private partyLines(invoice: InvoiceFull): string[] {
    const customer = invoice.customer;
    const address =
      invoice.customerAddressSnapshot ??
      (() => {
        const billing =
          customer.addresses.find((a) => a.addressType === "BILLING" && a.isDefault) ??
          customer.addresses.find((a) => a.addressType === "BILLING") ??
          customer.addresses[0];
        return billing
          ? [billing.line1, billing.line2, `${billing.city} ${billing.pincode}`, billing.state].filter(Boolean).join(", ")
          : null;
      })();

    return [
      invoice.customerNameSnapshot ?? customer.companyName ?? customer.name,
      ...(customer.contactPerson ? [`Attn: ${customer.contactPerson}`] : []),
      ...(address ? [address] : []),
      ...(invoice.customerGstinSnapshot ?? customer.gstin ? [`GSTIN: ${invoice.customerGstinSnapshot ?? customer.gstin}`] : []),
      `Phone: ${customer.phone}`,
    ];
  }
}

interface LineLike {
  productNameSnapshot: string;
  hsnCodeSnapshot: string | null;
  unitSnapshot: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineDiscount: Prisma.Decimal;
  lineTaxableValue: Prisma.Decimal;
  gstRate: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

interface TotalsLike {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxableTotal: Prisma.Decimal;
  cgstTotal: Prisma.Decimal;
  sgstTotal: Prisma.Decimal;
  igstTotal: Prisma.Decimal;
  roundOff: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

function money(value: Prisma.Decimal): string {
  return formatIndianCurrency(rupeesToPaise(value.toString()));
}

function trimNumber(value: Prisma.Decimal): string {
  return value.toDecimalPlaces(3).toString();
}

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}
