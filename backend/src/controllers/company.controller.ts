import { Request, Response } from "express";
import { CompanyService } from "../services/company.service";
import { ApiResponse } from "../utils/response";
import { ValidationError, NotFoundError } from "../utils/errors";
import { BRANDING_FIELDS, type BrandingAsset } from "../middleware/upload.middleware";
import { serialize } from "../utils/serialize";

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
   * logo, the rubber stamp, or the authorised signature. Stored straight into the
   * database (see CompanyService.setBrandingAsset) rather than on disk.
   */
  uploadBranding = async (req: Request, res: Response) => {
    // The route guard has already checked the slot.
    const asset = req.params.asset as BrandingAsset;
    if (!req.file) throw new ValidationError("Choose an image to upload");

    // PDFKit cannot rasterise SVG, so a seal/signature upload — printed into a
    // PDF — rejects it here rather than silently leaving the signature block blank.
    if (req.file.mimetype === "image/svg+xml" && asset !== "logo") {
      throw new ValidationError("Upload a PNG, JPG or WEBP image");
    }

    const settings = await this.companyService.setBrandingAsset(asset, {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    return ApiResponse.success(res, serialize(settings), `${LABELS[asset]} uploaded`);
  };

  removeBranding = async (req: Request, res: Response) => {
    const asset = req.params.asset as BrandingAsset;
    const settings = await this.companyService.clearBrandingAsset(asset);
    return ApiResponse.success(res, serialize(settings), `${LABELS[asset]} removed`);
  };

  /** Streams a branding image straight out of the database. Public, unauthenticated. */
  brandingImage = async (req: Request, res: Response) => {
    const asset = req.params.asset as BrandingAsset;
    if (!(asset in BRANDING_FIELDS)) throw new NotFoundError("Unknown branding asset");

    const image = await this.companyService.getBrandingImage(asset);
    if (!image) throw new NotFoundError("Not set");

    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    res.setHeader("ETag", `"${asset}-${image.updatedAt.getTime()}"`);
    return res.send(image.buffer);
  };
}
