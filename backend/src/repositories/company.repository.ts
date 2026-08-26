import { CompanySettings, Prisma, PrismaClient } from "@prisma/client";
import type { PrismaTransaction } from "../db/prisma";

/**
 * Company settings are a singleton row. The repository hides that fact so
 * callers never have to know an id.
 */
export class CompanyRepository {
  constructor(private db: PrismaClient) {}

  get(tx?: PrismaTransaction): Promise<CompanySettings | null> {
    return (tx ?? this.db).companySettings.findFirst({ orderBy: { createdAt: "asc" } });
  }

  async upsert(data: Prisma.CompanySettingsCreateInput): Promise<CompanySettings> {
    const existing = await this.get();
    if (!existing) return this.db.companySettings.create({ data });
    return this.db.companySettings.update({ where: { id: existing.id }, data });
  }

  async update(data: Prisma.CompanySettingsUpdateInput): Promise<CompanySettings | null> {
    const existing = await this.get();
    if (!existing) return null;
    return this.db.companySettings.update({ where: { id: existing.id }, data });
  }
}
