import { Request, Response } from "express";
import { CompanyService } from "../services/company.service";
import { ApiResponse } from "../utils/response";
import { ValidationError } from "../utils/errors";
import { brandingUrl } from "../middleware/upload.middleware";
import { serialize } from "../utils/serialize";

/** URL segment -> the settings column it writes to. */
const ASSET_FIELDS: Record<string, "logoUrl" | "sealUrl" | "signatureUrl" | undefined> = {
  logo: "logoUrl",
  seal: "sealUrl",
  signature: "signatureUrl",
};

const LABELS: Record<string, string> = { logo: "Logo", seal: "Seal", signature: "Signature" };

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

  /**
   * Upload a branding image. `:asset` selects which slot it fills — the letterhead
   * logo, the rubber stamp, or the authorised signature.
   */
  uploadBranding = async (req: Request, res: Response) => {
    const field = ASSET_FIELDS[req.params.asset];
    if (!field) throw new ValidationError("Unknown branding asset");
    if (!req.file) throw new ValidationError("Choose an image to upload");

    const settings = await this.companyService.setBrandingAsset(field, brandingUrl(req.file.filename));
    return ApiResponse.success(res, serialize(settings), `${LABELS[req.params.asset]} uploaded`);
  };

  removeBranding = async (req: Request, res: Response) => {
    const field = ASSET_FIELDS[req.params.asset];
    if (!field) throw new ValidationError("Unknown branding asset");

    const settings = await this.companyService.setBrandingAsset(field, null);
    return ApiResponse.success(res, serialize(settings), `${LABELS[req.params.asset]} removed`);
  };
}
