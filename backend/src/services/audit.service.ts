import { Prisma } from "@prisma/client";
import { AuditRepository, type AuditQuery } from "../repositories/audit.repository";
import { getContext } from "../utils/request-context";
import type { PrismaTransaction } from "../db/prisma";
import { logger } from "../config/logger";

/** Audit event names (architecture.md §29). */
export const AuditAction = {
  LOGIN: "LOGIN",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  CHANGE_PASSWORD: "CHANGE_PASSWORD",
  CREATE_USER: "CREATE_USER",
  UPDATE_USER: "UPDATE_USER",
  CREATE_CUSTOMER: "CREATE_CUSTOMER",
  UPDATE_CUSTOMER: "UPDATE_CUSTOMER",
  DELETE_CUSTOMER: "DELETE_CUSTOMER",
  CREATE_PRODUCT: "CREATE_PRODUCT",
  UPDATE_PRODUCT: "UPDATE_PRODUCT",
  DELETE_PRODUCT: "DELETE_PRODUCT",
  CREATE_QUOTATION: "CREATE_QUOTATION",
  UPDATE_QUOTATION: "UPDATE_QUOTATION",
  SEND_QUOTATION: "SEND_QUOTATION",
  ACCEPT_QUOTATION: "ACCEPT_QUOTATION",
  REJECT_QUOTATION: "REJECT_QUOTATION",
  CONVERT_QUOTATION: "CONVERT_QUOTATION",
  CREATE_INVOICE: "CREATE_INVOICE",
  UPDATE_INVOICE: "UPDATE_INVOICE",
  FINALIZE_INVOICE: "FINALIZE_INVOICE",
  CANCEL_INVOICE: "CANCEL_INVOICE",
  PRICE_OVERRIDE: "PRICE_OVERRIDE",
  CREATE_PAYMENT: "CREATE_PAYMENT",
  UPDATE_PAYMENT: "UPDATE_PAYMENT",
  DELETE_PAYMENT: "DELETE_PAYMENT",
  EXPORT_REPORT: "EXPORT_REPORT",
  UPDATE_COMPANY_SETTINGS: "UPDATE_COMPANY_SETTINGS",
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];

export interface RecordOptions {
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  /** Attribute to this user instead of the ambient request user (e.g. failed logins). */
  userId?: string | null;
  tx?: PrismaTransaction;
}

export class AuditService {
  constructor(private auditRepository: AuditRepository) {}

  /**
   * Writing the trail must never break the operation being audited. Inside a
   * transaction a failure propagates (the record and its audit rise or fall
   * together); outside one, it is logged and swallowed.
   */
  async record(action: AuditActionName, options: RecordOptions): Promise<void> {
    const ctx = getContext();
    const entry = {
      userId: options.userId !== undefined ? options.userId : ctx?.userId ?? null,
      action,
      entityType: options.entityType,
      entityId: options.entityId ?? null,
      oldValues: toJson(options.oldValues),
      newValues: toJson(options.newValues),
      ipAddress: ctx?.ipAddress ?? null,
      userAgent: ctx?.userAgent ?? null,
    };

    if (options.tx) {
      await this.auditRepository.record(entry, options.tx);
      return;
    }

    try {
      await this.auditRepository.record(entry);
    } catch (error) {
      logger.error({ err: error, action, entityType: options.entityType }, "Failed to write audit log");
    }
  }

  list(query: AuditQuery) {
    return this.auditRepository.list(query);
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null;
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))) as Prisma.InputJsonValue;
}
