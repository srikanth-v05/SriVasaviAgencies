import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../utils/errors";

/**
 * Image uploads for company branding — logo, rubber stamp and signature.
 *
 * Held in memory only long enough to be read into the database (see
 * CompanyService.setBrandingAsset) — nothing is written to local disk. Render's
 * free plan has no persistent disk, so a file saved at upload time would not
 * survive the next deploy; the database row is the only thing that does.
 */

/** Transparent PNG is what a scanned seal or signature should be. SVG is fine
 * for the logo (browser-rendered only) but PDFKit cannot rasterise it, so a
 * seal/signature upload rejects it at the controller instead of failing silently. */
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/** URL segment -> the company-settings column pair (URL + bytes) the image fills. */
export const BRANDING_FIELDS = {
  logo: { url: "logoUrl", image: "logoImage", mimeType: "logoImageType" },
  seal: { url: "sealUrl", image: "sealImage", mimeType: "sealImageType" },
  signature: { url: "signatureUrl", image: "signatureImage", mimeType: "signatureImageType" },
} as const;

export type BrandingAsset = keyof typeof BRANDING_FIELDS;

/**
 * Reject an unknown `:asset` before multer touches the request.
 */
export function requireBrandingAsset(req: Request, _res: Response, next: NextFunction): void {
  if (!(req.params.asset in BRANDING_FIELDS)) {
    next(new ValidationError("Unknown branding asset. Expected logo, seal or signature."));
    return;
  }
  next();
}

export const uploadBrandingImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      callback(new ValidationError("Upload a PNG, JPG or WEBP image"));
      return;
    }
    callback(null, true);
  },
}).single("file");

/** Public URL that streams a stored branding image back out of the database. */
export function brandingUrl(asset: BrandingAsset): string {
  return `/api/v1/public/branding/${asset}`;
}
