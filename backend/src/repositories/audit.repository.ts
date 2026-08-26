import { Prisma, PrismaClient } from "@prisma/client";
import type { PrismaTransaction } from "../db/prisma";

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Prisma.InputJsonValue | null;
  newValues?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditQuery {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  skip: number;
  take: number;
}

export class AuditRepository {
  constructor(private db: PrismaClient) {}

  /**
   * Accepts an optional transaction client so an audit row can be written inside
   * the same transaction as the change it records — if the change rolls back,
   * so does its audit entry.
   */
  async record(entry: AuditEntry, tx?: PrismaTransaction): Promise<void> {
    const client = tx ?? this.db;
    await client.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        oldValues: entry.oldValues ?? Prisma.DbNull,
        newValues: entry.newValues ?? Prisma.DbNull,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }

  async list(query: AuditQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.dateFrom || query.dateTo
        ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.db.auditLog.count({ where }),
    ]);

    return { rows, total };
  }
}
