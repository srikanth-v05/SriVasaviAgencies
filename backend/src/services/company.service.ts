import { CompanySettings, Prisma } from "@prisma/client";
import { CompanyRepository } from "../repositories/company.repository";
import { AuditService, AuditAction } from "./audit.service";
import { NotFoundError } from "../utils/errors";
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
    if (this.cache) return this.cache;
    const settings = await this.companyRepository.get();
    if (!settings) {
      throw new NotFoundError("Company settings have not been configured yet. Run the seed or save them from Settings.");
    }
    this.cache = settings;
    return settings;
  }

  /** Same as get(), but participating in an open transaction. */
  async getIn(tx: PrismaTransaction): Promise<CompanySettings> {
    const settings = await this.companyRepository.get(tx);
    if (!settings) throw new NotFoundError("Company settings have not been configured yet");
    return settings;
  }

  async getOrNull(): Promise<CompanySettings | null> {
    return this.companyRepository.get();
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

  async setLogo(logoUrl: string): Promise<CompanySettings> {
    const updated = await this.companyRepository.update({ logoUrl });
    if (!updated) throw new NotFoundError("Company settings have not been configured yet");
    this.cache = updated;
    return updated;
  }

  /** Public-website subset — never expose banking details or document counters. */
  async publicProfile() {
    const settings = await this.companyRepository.get();
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
