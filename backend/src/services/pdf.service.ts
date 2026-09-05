import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { CompanySettings, Prisma } from "@prisma/client";
import type { InvoiceFull } from "../repositories/invoice.repository";
import type { QuotationFull } from "../repositories/quotation.repository";
import { amountInWords, formatIndianCurrency, rupeesToPaise } from "../utils/money";
import { env } from "../config/env";
import { logger } from "../config/logger";

type Doc = PDFKit.PDFDocument;

const PAGE_MARGIN = 40;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;

/**
 * Fonts are embedded rather than relying on the PDF base-14 set.
 *
 * Helvetica is not embedded by a standard PDF, so every reader substitutes
 * whatever it has — which reflowed the glyphs and left visible gaps mid-word in
 * readers without real Helvetica metrics. An invoice gets emailed and printed on
 * machines we do not control, so it has to carry its own type. IBM Plex Sans is
 * OFL-licensed and includes the rupee sign.
 */
const FONT_DIR = path.resolve(__dirname, "../../assets/fonts");
const FONT = { regular: "Plex", bold: "Plex-Bold" } as const;

const FONT_FILES: Record<string, string> = {
  [FONT.regular]: path.join(FONT_DIR, "IBMPlexSans-Regular.ttf"),
  [FONT.bold]: path.join(FONT_DIR, "IBMPlexSans-SemiBold.ttf"),
};

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

  /**
   * Register the embedded faces, falling back to the base-14 names if the font
   * files are missing so that a deployment without them still produces a
   * readable invoice rather than throwing.
   */
  private registerFonts(doc: Doc): void {
    for (const [name, file] of Object.entries(FONT_FILES)) {
      if (fs.existsSync(file)) {
        doc.registerFont(name, file);
      } else {
        doc.registerFont(name, name === FONT.bold ? "Helvetica-Bold" : "Helvetica");
        logger.warn({ file }, "PDF font missing — falling back to a non-embedded base font");
      }
    }
  }

  private render(draw: (doc: Doc) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
      this.registerFonts(doc);
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
    doc.fillColor(BRAND).font(FONT.bold).fontSize(17).text(company.tradeName ?? company.name, PAGE_MARGIN, PAGE_MARGIN);

    const addressLines = [
      company.addressLine1,
      company.addressLine2,
      // Puducherry is both a city and a union territory, so printing both would
      // repeat the word. Only add the state when it differs from the city.
      company.state.trim().toLowerCase() === company.city.trim().toLowerCase()
        ? `${company.city} ${company.pincode}`
        : `${company.city} ${company.pincode}, ${company.state}`,
      `Phone: ${company.phone}  |  Email: ${company.email}`,
      company.gstin ? `GSTIN: ${company.gstin}` : null,
    ].filter(Boolean) as string[];

    doc.fillColor(MUTED).font(FONT.regular).fontSize(8.5);
    for (const line of addressLines) doc.text(line, PAGE_MARGIN, doc.y, { width: 320 });

    doc
      .fillColor(INK)
      .font(FONT.bold)
      .fontSize(15)
      .text(title, PAGE_MARGIN + CONTENT_WIDTH - 220, PAGE_MARGIN + 2, { width: 220, align: "right" });

    if (watermark) {
      doc
        .fillColor("#B23B3B")
        .font(FONT.bold)
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

    doc.font(FONT.regular).fontSize(8.5);
    let y = top;
    for (const [label, value] of args.left) {
      doc.fillColor(MUTED).text(label, PAGE_MARGIN, y, { width: 90, continued: false });
      doc.fillColor(INK).font(FONT.bold).text(value, PAGE_MARGIN + 92, y, { width: columnWidth - 92 });
      doc.font(FONT.regular);
      y += 13;
    }

    const partyX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 10;
    doc.fillColor(MUTED).fontSize(8).text(args.partyTitle.toUpperCase(), partyX, top);
    doc.fillColor(INK).font(FONT.bold).fontSize(10).text(args.partyLines[0] ?? "", partyX, top + 12, { width: columnWidth });
    doc.font(FONT.regular).fontSize(8.5).fillColor(MUTED);
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

    doc.font(FONT.regular).fontSize(8).fillColor(INK);
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
        doc.font(FONT.regular).fontSize(8).fillColor(INK);
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
    doc.fillColor(INK).font(FONT.bold).fontSize(7.5);

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
        doc.fillColor("#FFFFFF").font(FONT.bold);
        doc.text(label, boxX + 8, y + 5, { width: 100 });
        doc.text(money(value), boxX + 108, y + 5, { width: 104, align: "right" });
        doc.y = y + 18;
      } else {
        doc.fillColor(MUTED).font(FONT.regular).text(label, boxX + 8, y, { width: 100 });
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
    doc.fillColor(MUTED).font(FONT.regular).fontSize(8).text("Amount in words", PAGE_MARGIN, doc.y);
    doc
      .fillColor(INK)
      .font(FONT.bold)
      .fontSize(9)
      .text(amountInWords(rupeesToPaise(grandTotal.toString())), PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH - 230 });

    doc.y += 10;
    const bankTop = doc.y;

    if (company.bankName) {
      doc.fillColor(MUTED).font(FONT.regular).fontSize(8).text("Payment details", PAGE_MARGIN, bankTop);
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
      doc.fillColor(MUTED).font(FONT.regular).fontSize(8).text("Terms and conditions", rightX, bankTop, { width: 250 });
      doc.fillColor(INK).fontSize(7.5).text([notes, terms].filter(Boolean).join("\n"), rightX, doc.y, { width: 250 });
    }

    // The declaration printed above the signature block, as on the paper invoice.
    if (company.declaration) {
      doc.y += 10;
      doc
        .fillColor(MUTED)
        .font(FONT.regular)
        .fontSize(7)
        .text(company.declaration, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH - 220 });
    }

    doc.y += 14;
    this.signatureBlock(doc, company);
  }

  /**
   * The signature block: "For <company>", the rubber stamp, the authorised
   * signature over the top of it, then the caption — the same arrangement as a
   * hand-signed invoice, where the stamp goes down first and the pen goes over it.
   *
   * Both images are optional. With neither uploaded the block leaves blank space
   * to sign by hand, exactly as it did before.
   */
  private signatureBlock(doc: Doc, company: CompanySettings): void {
    const blockWidth = 200;
    const blockX = PAGE_MARGIN + CONTENT_WIDTH - blockWidth;
    const top = doc.y;

    doc
      .fillColor(MUTED)
      .font(FONT.regular)
      .fontSize(7.5)
      .text(`For ${company.tradeName ?? company.name}`, blockX, top, { width: blockWidth, align: "right" });

    const artTop = top + 12;
    const artHeight = 56;

    const seal = this.resolveImage(company.sealUrl);
    const signature = this.resolveImage(company.signatureUrl);

    if (seal) {
      // Centred in the block, and slightly transparent so a signature laid over
      // it stays readable — a real stamp is ink on paper, not an opaque sticker.
      const sealSize = 54;
      doc.save();
      doc.opacity(0.85);
      this.drawImage(doc, seal, blockX + blockWidth / 2 - sealSize / 2, artTop, sealSize, sealSize);
      doc.restore();
    }

    if (signature) {
      // Drawn after the seal, so it sits on top of it.
      const sigWidth = 108;
      const sigHeight = 40;
      this.drawImage(
        doc,
        signature,
        blockX + blockWidth / 2 - sigWidth / 2 + 8,
        artTop + (seal ? 12 : 8),
        sigWidth,
        sigHeight,
      );
    }

    doc.y = artTop + artHeight;
    doc
      .fillColor(MUTED)
      .font(FONT.regular)
      .fontSize(7.5)
      .text("Authorised Signatory", blockX, doc.y, { width: blockWidth, align: "right" });
  }

  /**
   * Map a stored branding URL to a file on disk.
   *
   * Only paths under the storage directory are read, so a crafted settings value
   * cannot make the PDF renderer open an arbitrary file. SVG is skipped because
   * PDFKit cannot rasterise it.
   */
  private resolveImage(url: string | null | undefined): string | null {
    if (!url || !url.startsWith("/uploads/")) return null;
    if (url.toLowerCase().endsWith(".svg")) return null;

    const root = path.resolve(env.STORAGE_DIR);
    const target = path.resolve(root, url.replace(/^\/uploads\//, ""));
    if (!target.startsWith(root + path.sep)) return null;

    return fs.existsSync(target) ? target : null;
  }

  /** Draw an image, but never let a corrupt upload break the whole document. */
  private drawImage(doc: Doc, file: string, x: number, y: number, width: number, height: number): void {
    try {
      doc.image(file, x, y, { fit: [width, height], align: "center", valign: "center" });
    } catch (error) {
      logger.warn({ err: error, file }, "Could not render a branding image into the PDF");
    }
  }

  private pageNumbers(doc: Doc): void {
    const range = doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);

      // The footer sits in the bottom margin. PDFKit starts a fresh page when
      // text is written past the bottom margin, which previously appended a
      // blank page carrying nothing but "Page 1 of 1" — so drop the margin for
      // the duration of the write and restore it afterwards.
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      doc
        .fillColor(MUTED)
        .font(FONT.regular)
        .fontSize(7)
        .text(`Page ${i - range.start + 1} of ${range.count}`, PAGE_MARGIN, doc.page.height - 28, {
          width: CONTENT_WIDTH,
          align: "center",
          lineBreak: false,
        });

      doc.page.margins.bottom = bottomMargin;
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
