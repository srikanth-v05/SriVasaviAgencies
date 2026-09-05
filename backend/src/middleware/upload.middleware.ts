import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ValidationError } from "../utils/errors";

/**
 * Image uploads for company branding — logo, rubber stamp and signature.
 *
 * Files land on disk under STORAGE_DIR and are served back as static assets.
 * Only raster/vector images are accepted, and the filename is generated rather
 * than taken from the client, so an uploaded name can never escape the
 * directory or overwrite an unrelated file.
 */

const BRANDING_DIR = path.resolve(env.STORAGE_DIR, "branding");

/** Transparent PNG is what a scanned seal or signature should be. */
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

const EXTENSION: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

/** URL segment -> the company-settings column the image fills. */
export const BRANDING_FIELDS = {
  logo: "logoUrl",
  seal: "sealUrl",
  signature: "signatureUrl",
} as const;

export type BrandingAsset = keyof typeof BRANDING_FIELDS;

/**
 * Reject an unknown `:asset` before multer touches the request.
 *
 * Multer streams the upload to disk as it parses the body, so a controller that
 * rejects afterwards has already left a file behind with nothing referencing it.
 * Checking the slot first means no file is ever written for a bad request.
 */
export function requireBrandingAsset(req: Request, _res: Response, next: NextFunction): void {
  if (!(req.params.asset in BRANDING_FIELDS)) {
    next(new ValidationError("Unknown branding asset. Expected logo, seal or signature."));
    return;
  }
  next();
}

export function ensureStorageDirs(): void {
  fs.mkdirSync(BRANDING_DIR, { recursive: true });
}

export const brandingStorageDir = BRANDING_DIR;

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    ensureStorageDirs();
    callback(null, BRANDING_DIR);
  },
  filename(_req, file, callback) {
    // Never trust the client's filename: generate one and pick the extension
    // from the validated mime type.
    const name = `${crypto.randomUUID()}${EXTENSION[file.mimetype] ?? ".bin"}`;
    callback(null, name);
  },
});

export const uploadBrandingImage = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      callback(new ValidationError("Upload a PNG, JPG, WEBP or SVG image"));
      return;
    }
    callback(null, true);
  },
}).single("file");

/** Number of files currently in the branding directory. */
export function brandingFileCount(): number {
  try {
    return fs.readdirSync(BRANDING_DIR).length;
  } catch {
    return 0;
  }
}

/** Public URL for a stored branding file. */
export function brandingUrl(filename: string): string {
  return `/uploads/branding/${filename}`;
}

/**
 * Delete a previously stored branding file when it is replaced or cleared.
 * Only paths inside the branding directory are touched, and a missing file is
 * not an error — the record is what matters, not the orphan.
 */
export function removeBrandingFile(url: string | null | undefined): void {
  if (!url || !url.startsWith("/uploads/branding/")) return;

  const filename = path.basename(url);
  const target = path.resolve(BRANDING_DIR, filename);
  if (path.dirname(target) !== BRANDING_DIR) return;

  fs.rm(target, { force: true }, () => undefined);
}
