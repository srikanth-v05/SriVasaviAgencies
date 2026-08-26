import { Request, Response } from "express";
import { CompanyService } from "../services/company.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";

export class CompanyController {
  constructor(private companyService: CompanyService) {}

  get = async (_req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.companyService.getOrNull()));
  };

  save = async (req: Request, res: Response) => {
    const settings = await this.companyService.save(req.body);
    return ApiResponse.success(res, serialize(settings), "Company settings saved");
  };

  setLogo = async (req: Request, res: Response) => {
    const settings = await this.companyService.setLogo(req.body.logoUrl);
    return ApiResponse.success(res, serialize(settings), "Logo updated");
  };
}
