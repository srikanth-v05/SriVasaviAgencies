import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { ReportRepository, type ReportFilters } from "../repositories/report.repository";
import { ReportService } from "./report.service";
import { CustomerService } from "./customer.service";
import { AuditService, AuditAction } from "./audit.service";

const HEADER_FILL = "FF0F6E63";
const MONEY = "#,##0.00";
const QTY = "#,##0.000";

/**
 * GST-oriented Excel exports (architecture.md §20).
 *
 * The worksheets follow the structure of a GST sales register. The exact column
 * set required by the filing portal changes from time to time, so treat these as
 * a working register to reconcile against, and map them to the current official
 * template at filing time.
 */
export class ExcelService {
  constructor(
    private reportRepository: ReportRepository,
    private reportService: ReportService,
    private customerService: CustomerService,
    private auditService: AuditService,
  ) {}

  async gstWorkbook(filters: ReportFilters): Promise<Buffer> {
    const workbook = this.newWorkbook();
    const [invoices, gst] = await Promise.all([
      this.reportRepository.invoicesForGstReturn(filters, "ALL"),
      this.reportService.gst(filters),
    ]);

    this.salesRegisterSheet(workbook.addWorksheet("Sales Register"), invoices);
    this.segmentSheet(workbook.addWorksheet("B2B Invoices"), invoices.filter((i) => i.customer.gstin));
    this.segmentSheet(workbook.addWorksheet("B2C Invoices"), invoices.filter((i) => !i.customer.gstin));
    this.hsnSheet(workbook.addWorksheet("HSN Summary"), gst.hsn);
    this.rateSheet(workbook.addWorksheet("GST Rate Summary"), gst.byRate);
    this.taxHeadSheet(workbook.addWorksheet("CGST Summary"), gst.byRate, "cgst");
    this.taxHeadSheet(workbook.addWorksheet("SGST Summary"), gst.byRate, "sgst");
    this.taxHeadSheet(workbook.addWorksheet("IGST Summary"), gst.byRate, "igst");

    await this.auditService.record(AuditAction.EXPORT_REPORT, {
      entityType: "Report",
      newValues: { report: "GST", filters: serialiseFilters(filters), invoices: invoices.length },
    });

    return this.toBuffer(workbook);
  }

  async salesWorkbook(filters: ReportFilters): Promise<Buffer> {
    const workbook = this.newWorkbook();
    const report = await this.reportService.sales(filters, "month");

    const summary = workbook.addWorksheet("Summary");
    this.setColumns(summary, [
      { header: "Measure", key: "measure", width: 28 },
      { header: "Value", key: "value", width: 18, style: { numFmt: MONEY } },
    ]);
    for (const [measure, value] of Object.entries(report.summary)) {
      summary.addRow({ measure: humanise(measure), value: toNumber(value) });
    }

    const byPeriod = workbook.addWorksheet("By Period");
    this.setColumns(byPeriod, [
      { header: "Period", key: "period", width: 14 },
      { header: "Invoices", key: "invoiceCount", width: 10 },
      { header: "Taxable", key: "taxable", width: 14, style: { numFmt: MONEY } },
      { header: "CGST", key: "cgst", width: 12, style: { numFmt: MONEY } },
      { header: "SGST", key: "sgst", width: 12, style: { numFmt: MONEY } },
      { header: "IGST", key: "igst", width: 12, style: { numFmt: MONEY } },
      { header: "Total", key: "total", width: 14, style: { numFmt: MONEY } },
    ]);
    for (const row of report.byPeriod) {
      byPeriod.addRow({
        period: new Date(row.period).toISOString().slice(0, 10),
        invoiceCount: row.invoiceCount,
        taxable: toNumber(row.taxable),
        cgst: toNumber(row.cgst),
        sgst: toNumber(row.sgst),
        igst: toNumber(row.igst),
        total: toNumber(row.total),
      });
    }

    const byCustomer = workbook.addWorksheet("By Customer");
    this.setColumns(byCustomer, [
      { header: "Customer", key: "customer", width: 34 },
      { header: "GSTIN", key: "gstin", width: 18 },
      { header: "Invoices", key: "invoiceCount", width: 10 },
      { header: "Taxable", key: "taxable", width: 14, style: { numFmt: MONEY } },
      { header: "Total", key: "total", width: 14, style: { numFmt: MONEY } },
      { header: "Paid", key: "paid", width: 14, style: { numFmt: MONEY } },
      { header: "Outstanding", key: "outstanding", width: 14, style: { numFmt: MONEY } },
    ]);
    for (const row of report.byCustomer) {
      byCustomer.addRow({
        customer: row.customer?.companyName ?? row.customer?.name ?? "(deleted)",
        gstin: row.customer?.gstin ?? "",
        invoiceCount: row.invoiceCount,
        taxable: toNumber(row.taxable),
        total: toNumber(row.total),
        paid: toNumber(row.paid),
        outstanding: toNumber(row.outstanding),
      });
    }

    const byProduct = workbook.addWorksheet("By Product");
    this.setColumns(byProduct, [
      { header: "Product", key: "product", width: 34 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Quantity", key: "quantity", width: 12, style: { numFmt: QTY } },
      { header: "Taxable", key: "taxable", width: 14, style: { numFmt: MONEY } },
      { header: "GST", key: "gst", width: 14, style: { numFmt: MONEY } },
      { header: "Total", key: "total", width: 14, style: { numFmt: MONEY } },
    ]);
    for (const row of report.byProduct) {
      byProduct.addRow({
        product: row.product,
        unit: row.unit,
        quantity: toNumber(row.quantity),
        taxable: toNumber(row.taxable),
        gst: toNumber(row.gst),
        total: toNumber(row.total),
      });
    }

    await this.auditService.record(AuditAction.EXPORT_REPORT, {
      entityType: "Report",
      newValues: { report: "SALES", filters: serialiseFilters(filters) },
    });

    return this.toBuffer(workbook);
  }

  async hsnWorkbook(filters: ReportFilters): Promise<Buffer> {
    const workbook = this.newWorkbook();
    this.hsnSheet(workbook.addWorksheet("HSN Summary"), await this.reportService.hsn(filters));

    await this.auditService.record(AuditAction.EXPORT_REPORT, {
      entityType: "Report",
      newValues: { report: "HSN", filters: serialiseFilters(filters) },
    });
    return this.toBuffer(workbook);
  }

  async customerLedgerWorkbook(customerId: string): Promise<Buffer> {
    const workbook = this.newWorkbook();
    const ledger = await this.customerService.ledger(customerId);

    const sheet = workbook.addWorksheet("Ledger");
    sheet.addRow([ledger.customer.companyName ?? ledger.customer.name]).font = { bold: true, size: 13 };
    sheet.addRow([`GSTIN: ${ledger.customer.gstin ?? "—"}    Phone: ${ledger.customer.phone}`]);
    sheet.addRow([]);

    const headerRowIndex = sheet.rowCount + 1;
    sheet.addRow(["Date", "Type", "Reference", "Debit", "Credit", "Balance"]);
    this.styleHeaderRow(sheet.getRow(headerRowIndex));

    for (const entry of ledger.entries) {
      sheet.addRow([
        entry.date.toISOString().slice(0, 10),
        entry.type,
        entry.reference,
        toNumber(entry.debit),
        toNumber(entry.credit),
        toNumber(entry.balance),
      ]);
    }

    sheet.addRow([]);
    const closing = sheet.addRow(["", "", "Closing balance", "", "", toNumber(ledger.closingBalance)]);
    closing.font = { bold: true };

    sheet.columns.forEach((column, index) => {
      column.width = index === 2 ? 28 : 16;
      if (index >= 3) column.numFmt = MONEY;
    });

    await this.auditService.record(AuditAction.EXPORT_REPORT, {
      entityType: "Report",
      entityId: customerId,
      newValues: { report: "CUSTOMER_LEDGER" },
    });
    return this.toBuffer(workbook);
  }

  // -------------------------------------------------------------------------

  private newWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sri Vasavi Agencies ERP";
    workbook.created = new Date();
    return workbook;
  }

  private async toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private setColumns(sheet: ExcelJS.Worksheet, columns: Partial<ExcelJS.Column>[]): void {
    sheet.columns = columns as ExcelJS.Column[];
    this.styleHeaderRow(sheet.getRow(1));
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  private styleHeaderRow(row: ExcelJS.Row): void {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    row.alignment = { vertical: "middle" };
    row.height = 20;
  }

  private salesRegisterSheet(sheet: ExcelJS.Worksheet, invoices: InvoiceForExport[]): void {
    this.setColumns(sheet, [
      { header: "Invoice No", key: "invoiceNumber", width: 20 },
      { header: "Invoice Date", key: "invoiceDate", width: 13 },
      { header: "Customer", key: "customer", width: 30 },
      { header: "Customer GSTIN", key: "gstin", width: 18 },
      { header: "Customer State", key: "state", width: 16 },
      { header: "Place of Supply", key: "placeOfSupply", width: 18 },
      { header: "HSN", key: "hsn", width: 12 },
      { header: "Description", key: "description", width: 30 },
      { header: "Qty", key: "quantity", width: 10, style: { numFmt: QTY } },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Unit Price", key: "unitPrice", width: 12, style: { numFmt: MONEY } },
      { header: "Taxable Value", key: "taxable", width: 14, style: { numFmt: MONEY } },
      { header: "GST Rate", key: "gstRate", width: 10 },
      { header: "CGST", key: "cgst", width: 12, style: { numFmt: MONEY } },
      { header: "SGST", key: "sgst", width: 12, style: { numFmt: MONEY } },
      { header: "IGST", key: "igst", width: 12, style: { numFmt: MONEY } },
      { header: "Line Total", key: "lineTotal", width: 14, style: { numFmt: MONEY } },
      { header: "Invoice Total", key: "invoiceTotal", width: 14, style: { numFmt: MONEY } },
    ]);

    for (const invoice of invoices) {
      for (const [index, item] of invoice.items.entries()) {
        sheet.addRow({
          invoiceNumber: invoice.invoiceNumber ?? "",
          invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
          customer: invoice.customer.companyName ?? invoice.customer.name,
          gstin: invoice.customer.gstin ?? "",
          state: `${invoice.customer.state} (${invoice.customer.stateCode})`,
          placeOfSupply: `${invoice.placeOfSupply} (${invoice.placeOfSupplyStateCode})`,
          hsn: item.hsnCodeSnapshot ?? "",
          description: item.productNameSnapshot,
          quantity: toNumber(item.quantity),
          unit: item.unitSnapshot,
          unitPrice: toNumber(item.unitPrice),
          taxable: toNumber(item.lineTaxableValue),
          gstRate: `${toNumber(item.gstRate)}%`,
          cgst: toNumber(item.cgstAmount),
          sgst: toNumber(item.sgstAmount),
          igst: toNumber(item.igstAmount),
          lineTotal: toNumber(item.lineTotal),
          // Only the first line of an invoice carries the invoice-level total,
          // so summing the column does not multiply-count a multi-line invoice.
          invoiceTotal: index === 0 ? toNumber(invoice.grandTotal) : null,
        });
      }
    }
  }

  private segmentSheet(sheet: ExcelJS.Worksheet, invoices: InvoiceForExport[]): void {
    this.setColumns(sheet, [
      { header: "Invoice No", key: "invoiceNumber", width: 20 },
      { header: "Invoice Date", key: "invoiceDate", width: 13 },
      { header: "Customer", key: "customer", width: 30 },
      { header: "GSTIN", key: "gstin", width: 18 },
      { header: "Place of Supply", key: "placeOfSupply", width: 18 },
      { header: "Taxable Value", key: "taxable", width: 14, style: { numFmt: MONEY } },
      { header: "CGST", key: "cgst", width: 12, style: { numFmt: MONEY } },
      { header: "SGST", key: "sgst", width: 12, style: { numFmt: MONEY } },
      { header: "IGST", key: "igst", width: 12, style: { numFmt: MONEY } },
      { header: "Invoice Total", key: "total", width: 14, style: { numFmt: MONEY } },
    ]);

    for (const invoice of invoices) {
      sheet.addRow({
        invoiceNumber: invoice.invoiceNumber ?? "",
        invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
        customer: invoice.customer.companyName ?? invoice.customer.name,
        gstin: invoice.customer.gstin ?? "",
        placeOfSupply: `${invoice.placeOfSupply} (${invoice.placeOfSupplyStateCode})`,
        taxable: toNumber(invoice.taxableTotal),
        cgst: toNumber(invoice.cgstTotal),
        sgst: toNumber(invoice.sgstTotal),
        igst: toNumber(invoice.igstTotal),
        total: toNumber(invoice.grandTotal),
      });
    }
  }

  private hsnSheet(sheet: ExcelJS.Worksheet, rows: HsnRow[]): void {
    this.setColumns(sheet, [
      { header: "HSN", key: "hsnCode", width: 14 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "GST Rate", key: "gstRate", width: 10 },
      { header: "Quantity", key: "quantity", width: 12, style: { numFmt: QTY } },
      { header: "Taxable Value", key: "taxable", width: 15, style: { numFmt: MONEY } },
      { header: "CGST", key: "cgst", width: 12, style: { numFmt: MONEY } },
      { header: "SGST", key: "sgst", width: 12, style: { numFmt: MONEY } },
      { header: "IGST", key: "igst", width: 12, style: { numFmt: MONEY } },
      { header: "Total", key: "total", width: 15, style: { numFmt: MONEY } },
    ]);

    for (const row of rows) {
      sheet.addRow({
        hsnCode: row.hsnCode,
        unit: row.unit,
        gstRate: `${toNumber(row.gstRate)}%`,
        quantity: toNumber(row.quantity),
        taxable: toNumber(row.taxable),
        cgst: toNumber(row.cgst),
        sgst: toNumber(row.sgst),
        igst: toNumber(row.igst),
        total: toNumber(row.total),
      });
    }
  }

  private rateSheet(sheet: ExcelJS.Worksheet, rows: RateRow[]): void {
    this.setColumns(sheet, [
      { header: "GST Rate", key: "gstRate", width: 12 },
      { header: "Taxable Value", key: "taxable", width: 16, style: { numFmt: MONEY } },
      { header: "CGST", key: "cgst", width: 14, style: { numFmt: MONEY } },
      { header: "SGST", key: "sgst", width: 14, style: { numFmt: MONEY } },
      { header: "IGST", key: "igst", width: 14, style: { numFmt: MONEY } },
      { header: "Total", key: "total", width: 16, style: { numFmt: MONEY } },
    ]);

    for (const row of rows) {
      sheet.addRow({
        gstRate: `${toNumber(row.gstRate)}%`,
        taxable: toNumber(row.taxable),
        cgst: toNumber(row.cgst),
        sgst: toNumber(row.sgst),
        igst: toNumber(row.igst),
        total: toNumber(row.total),
      });
    }
  }

  private taxHeadSheet(sheet: ExcelJS.Worksheet, rows: RateRow[], head: "cgst" | "sgst" | "igst"): void {
    this.setColumns(sheet, [
      { header: "GST Rate", key: "gstRate", width: 12 },
      { header: "Taxable Value", key: "taxable", width: 16, style: { numFmt: MONEY } },
      { header: head.toUpperCase(), key: "amount", width: 16, style: { numFmt: MONEY } },
    ]);

    let total = 0;
    for (const row of rows) {
      const amount = toNumber(row[head]);
      total += amount;
      sheet.addRow({ gstRate: `${toNumber(row.gstRate)}%`, taxable: toNumber(row.taxable), amount });
    }

    const totalRow = sheet.addRow({ gstRate: "Total", taxable: null, amount: total });
    totalRow.font = { bold: true };
  }
}

interface InvoiceForExport {
  invoiceNumber: string | null;
  invoiceDate: Date;
  placeOfSupply: string;
  placeOfSupplyStateCode: string;
  taxableTotal: Prisma.Decimal;
  cgstTotal: Prisma.Decimal;
  sgstTotal: Prisma.Decimal;
  igstTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  customer: { name: string; companyName: string | null; gstin: string | null; state: string; stateCode: string };
  items: {
    hsnCodeSnapshot: string | null;
    productNameSnapshot: string;
    quantity: Prisma.Decimal;
    unitSnapshot: string;
    unitPrice: Prisma.Decimal;
    lineTaxableValue: Prisma.Decimal;
    gstRate: Prisma.Decimal;
    cgstAmount: Prisma.Decimal;
    sgstAmount: Prisma.Decimal;
    igstAmount: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }[];
}

interface HsnRow {
  hsnCode: string;
  unit: string;
  gstRate: Prisma.Decimal;
  quantity: Prisma.Decimal;
  taxable: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  total: Prisma.Decimal;
}

interface RateRow {
  gstRate: Prisma.Decimal;
  taxable: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  total: Prisma.Decimal;
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function humanise(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function serialiseFilters(filters: ReportFilters) {
  return {
    dateFrom: filters.dateFrom?.toISOString() ?? null,
    dateTo: filters.dateTo?.toISOString() ?? null,
    customerId: filters.customerId ?? null,
  };
}
