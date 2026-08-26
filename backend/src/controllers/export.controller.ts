import { Request, Response } from "express";
import { ExcelService } from "../services/excel.service";
import { filtersFrom } from "./report.controller";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function send(res: Response, buffer: Buffer, filename: string) {
  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(buffer);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export class ExportController {
  constructor(private excelService: ExcelService) {}

  sales = async (req: Request, res: Response) => {
    return send(res, await this.excelService.salesWorkbook(filtersFrom(req)), `sales-register-${stamp()}.xlsx`);
  };

  gst = async (req: Request, res: Response) => {
    return send(res, await this.excelService.gstWorkbook(filtersFrom(req)), `gst-register-${stamp()}.xlsx`);
  };

  hsn = async (req: Request, res: Response) => {
    return send(res, await this.excelService.hsnWorkbook(filtersFrom(req)), `hsn-summary-${stamp()}.xlsx`);
  };

  customerLedger = async (req: Request, res: Response) => {
    const customerId = req.query.customerId as string;
    return send(res, await this.excelService.customerLedgerWorkbook(customerId), `customer-ledger-${stamp()}.xlsx`);
  };
}
