import { CompanySettings, Prisma } from "@prisma/client";
import { CompanyRepository } from "../repositories/company.repository";
import { AuditService, AuditAction } from "./audit.service";
import { NotFoundError } from "../utils/errors";
import { BRANDING_FIELDS, brandingUrl, type BrandingAsset } from "../middleware/upload.middleware";
import type { PrismaTransaction } from "../db/prisma";

/**
 * Company settings drive tax treatment (the supplier state code) and document
 * numbering (the prefixes), so several services read them. They change rarely,
 * which makes them worth caching for the life of the process.
 */
export class CompanyService {
  private cache: CompanySettings | null = null;

  constructor(
    private companyRepository: CompanyRepository,
    private auditService: AuditService,
  ) {}

  async get(): Promise<CompanySettings> {
    const settings = await this.cached();
    if (!settings) {
      throw new NotFoundError("Company settings have not been configured yet. Run the seed or save them from Settings.");
    }
    return settings;
  }

  /** Reads through the in-process cache — populates it on the first call only. */
  private async cached(): Promise<CompanySettings | null> {
    if (this.cache) return this.cache;
    const settings = await this.companyRepository.get();
    if (settings) this.cache = settings;
    return settings;
  }

  /** Same as get(), but participating in an open transaction. */
  async getIn(tx: PrismaTransaction): Promise<CompanySettings> {
    const settings = await this.companyRepository.get(tx);
    if (!settings) throw new NotFoundError("Company settings have not been configured yet");
    return settings;
  }

  async getOrNull(): Promise<CompanySettings | null> {
    return this.cached();
  }

  async save(data: Prisma.CompanySettingsCreateInput): Promise<CompanySettings> {
    const before = await this.companyRepository.get();
    const saved = await this.companyRepository.upsert(data);
    this.cache = saved;

    await this.auditService.record(AuditAction.UPDATE_COMPANY_SETTINGS, {
      entityType: "CompanySettings",
      entityId: saved.id,
      oldValues: before,
      newValues: saved,
    });
    return saved;
  }

  /** Point the logo at an external URL instead of an uploaded image. */
  async setLogo(logoUrl: string): Promise<CompanySettings> {
    const updated = await this.companyRepository.update({ logoUrl });
    if (!updated) throw new NotFoundError("Company settings have not been configured yet");
    this.cache = updated;
    return updated;
  }

  /**
   * Store an uploaded branding image — logo, rubber stamp or signature —
   * directly in the database (Render's free plan has no persistent disk, so a
   * file written to disk at upload time would not survive the next deploy).
   */
  async setBrandingAsset(asset: BrandingAsset, file: { buffer: Buffer; mimeType: string }): Promise<CompanySettings> {
    const current = await this.companyRepository.get();
    if (!current) throw new NotFoundError("Company settings have not been configured yet");

    const fields = BRANDING_FIELDS[asset];
    const updated = await this.companyRepository.update({
      [fields.url]: brandingUrl(asset),
      [fields.image]: file.buffer,
      [fields.mimeType]: file.mimeType,
    });
    if (!updated) throw new NotFoundError("Company settings have not been configured yet");

    this.cache = updated;
    await this.auditService.record(AuditAction.UPDATE_COMPANY_SETTINGS, {
      entityType: "CompanySettings",
      entityId: updated.id,
      oldValues: { [fields.url]: current[fields.url] },
      newValues: { [fields.url]: updated[fields.url] },
    });

    return updated;
  }

  /** Clear a branding image (logo, rubber stamp or signature). */
  async clearBrandingAsset(asset: BrandingAsset): Promise<CompanySettings> {
    const current = await this.companyRepository.get();
    if (!current) throw new NotFoundError("Company settings have not been configured yet");

    const fields = BRANDING_FIELDS[asset];
    const updated = await this.companyRepository.update({
      [fields.url]: null,
      [fields.image]: null,
      [fields.mimeType]: null,
    });
    if (!updated) throw new NotFoundError("Company settings have not been configured yet");

    this.cache = updated;
    await this.auditService.record(AuditAction.UPDATE_COMPANY_SETTINGS, {
      entityType: "CompanySettings",
      entityId: updated.id,
      oldValues: { [fields.url]: current[fields.url] },
      newValues: { [fields.url]: null },
    });

    return updated;
  }

  /** The raw image bytes for a branding asset, for the public streaming route. */
  async getBrandingImage(asset: BrandingAsset): Promise<{ buffer: Buffer; mimeType: string; updatedAt: Date } | null> {
    const current = await this.cached();
    if (!current) return null;

    const fields = BRANDING_FIELDS[asset];
    const buffer = current[fields.image] as Buffer | null;
    const mimeType = current[fields.mimeType] as string | null;
    if (!buffer || !mimeType) return null;

    return { buffer, mimeType, updatedAt: current.updatedAt };
  }

  /** Public-website subset — never expose banking details or document counters. */
  async publicProfile() {
    const settings = await this.cached();
    if (!settings) return null;
    return {
      name: settings.name,
      tradeName: settings.tradeName,
      gstin: settings.gstin,
      addressLine1: settings.addressLine1,
      addressLine2: settings.addressLine2,
      city: settings.city,
      state: settings.state,
      pincode: settings.pincode,
      phone: settings.phone,
      alternatePhone: settings.alternatePhone,
      email: settings.email,
      website: settings.website,
      logoUrl: settings.logoUrl,
      googleMapsUrl: settings.googleMapsUrl,
      justdialUrl: settings.justdialUrl,
    };
  }

  invalidate(): void {
    this.cache = null;
  }
}
