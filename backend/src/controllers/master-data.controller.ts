import { Request, Response } from "express";
import { MasterDataService } from "../services/master-data.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";

export class MasterDataController {
  constructor(private masterDataService: MasterDataService) {}

  listCategories = async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === "true";
    return ApiResponse.success(res, serialize(await this.masterDataService.listCategories(includeInactive)));
  };

  createCategory = async (req: Request, res: Response) => {
    return ApiResponse.created(res, serialize(await this.masterDataService.createCategory(req.body)), "Category created");
  };

  updateCategory = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.masterDataService.updateCategory(req.params.id, req.body)), "Category updated");
  };

  deleteCategory = async (req: Request, res: Response) => {
    await this.masterDataService.deleteCategory(req.params.id);
    return ApiResponse.noContent(res);
  };

  listUnits = async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === "true";
    return ApiResponse.success(res, serialize(await this.masterDataService.listUnits(includeInactive)));
  };

  createUnit = async (req: Request, res: Response) => {
    return ApiResponse.created(res, serialize(await this.masterDataService.createUnit(req.body)), "Unit created");
  };

  updateUnit = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.masterDataService.updateUnit(req.params.id, req.body)), "Unit updated");
  };

  listGstRates = async (_req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.masterDataService.listGstRates()));
  };

  createGstRate = async (req: Request, res: Response) => {
    return ApiResponse.created(res, serialize(await this.masterDataService.createGstRate(req.body)), "GST rate added");
  };
}
