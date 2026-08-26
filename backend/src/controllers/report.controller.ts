import { Request, Response } from "express";
import { ReportService } from "../services/report.service";
import { DashboardService } from "../services/dashboard.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";
import type { ReportFilters, PeriodGrain } from "../repositories/report.repository";

function filtersFrom(req: Request): ReportFilters {
  return {
    dateFrom: req.query.dateFrom as Date | undefined,
    dateTo: req.query.dateTo as Date | undefined,
    customerId: req.query.customerId as string | undefined,
    productId: req.query.productId as string | undefined,
    gstRate: req.query.gstRate as number | undefined,
  };
}

export class ReportController {
  constructor(
    private reportService: ReportService,
    private dashboardService: DashboardService,
  ) {}

  dashboard = async (_req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.dashboardService.summary()));
  };

  sales = async (req: Request, res: Response) => {
    const grain = (req.query.grain as PeriodGrain | undefined) ?? "month";
    return ApiResponse.success(res, serialize(await this.reportService.sales(filtersFrom(req), grain)));
  };

  quotations = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.reportService.quotations(filtersFrom(req))));
  };

  customers = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.reportService.customers(filtersFrom(req))));
  };

  payments = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.reportService.payments(filtersFrom(req))));
  };

  outstanding = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.reportService.outstanding(filtersFrom(req))));
  };

  gst = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.reportService.gst(filtersFrom(req))));
  };

  hsn = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.reportService.hsn(filtersFrom(req))));
  };
}

export { filtersFrom };
