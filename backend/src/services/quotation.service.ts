import { Prisma, QuotationStatus } from "@prisma/client";
import { QuotationRepository, type QuotationQuery, type QuotationFull } from "../repositories/quotation.repository";
import { CustomerRepository } from "../repositories/customer.repository";
import { DocumentPricingService, type LineDraft } from "./document-pricing.service";
import { NumberingService } from "./numbering.service";
import { CompanyService } from "./company.service";
import { AuditService, AuditAction } from "./audit.service";
import { NotFoundError, ValidationError, DocumentStateError } from "../utils/errors";
import { prisma } from "../db/prisma";
import { withRetry } from "../db/retry";

export interface QuotationInput {
  customerId: string;
  quotationDate?: string | Date;
  validUntil?: string | Date | null;
  placeOfSupply?: string;
  notes?: string | null;
  termsAndConditions?: string | null;
  items: LineDraft[];
}

/**
 * Legal transitions for a quotation (architecture.md §10). Any move not listed
 * here is rejected, so a quotation can never be, say, accepted after conversion.
 */
const TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ["SENT", "ACCEPTED", "CANCELLED"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"],
  ACCEPTED: ["CONVERTED", "CANCELLED"],
  REJECTED: ["CANCELLED"],
  EXPIRED: ["SENT", "CANCELLED"],
  CONVERTED: [],
  CANCELLED: [],
};

/** Only these states may have their contents edited. */
const EDITABLE: QuotationStatus[] = ["DRAFT", "SENT"];

export class QuotationService {
  constructor(
    private quotationRepository: QuotationRepository,
    private customerRepository: CustomerRepository,
    private pricingService: DocumentPricingService,
    private numberingService: NumberingService,
    private companyService: CompanyService,
    private auditService: AuditService,
  ) {}

  list(query: QuotationQuery) {
    return this.quotationRepository.list(query);
  }

  async getById(id: string): Promise<QuotationFull> {
    const quotation = await this.quotationRepository.findById(id);
    if (!quotation) throw new NotFoundError("Quotation not found");
    return quotation;
  }

  async create(input: QuotationInput, userId: string): Promise<QuotationFull> {
    const company = await this.companyService.get();
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) throw new ValidationError("The selected customer does not exist");

    const quotationDate = toDate(input.quotationDate) ?? new Date();
    const placeOfSupplyStateCode = stateCodeFromGstin(customer.gstin) ?? customer.stateCode;
    const placeOfSupply = input.placeOfSupply ?? customer.state;

    const priced = await this.pricingService.price({
      lines: input.items,
      companyStateCode: company.stateCode,
      placeOfSupplyStateCode,
      roundingMode: company.roundingMode,
      allowZeroValueBilling: company.allowZeroValueBilling,
    });

    const validUntil =
      toDate(input.validUntil) ??
      new Date(quotationDate.getTime() + company.defaultQuotationValidityDays * 24 * 60 * 60 * 1000);

    // Consumes a quotation number; see invoice.finalize for why this retries.
    const quotation = await withRetry(
      () =>
        prisma.$transaction(async (tx) => {
          const { number } = await this.numberingService.allocate(
            tx,
            "QUOTATION",
            company.quotationPrefix,
            quotationDate,
          );

          const created = await this.quotationRepository.create(
            {
              quotationNumber: number,
              customer: { connect: { id: customer.id } },
              createdBy: { connect: { id: userId } },
              quotationDate,
              validUntil,
              placeOfSupply,
              placeOfSupplyStateCode,
              notes: input.notes ?? null,
              termsAndConditions: input.termsAndConditions ?? company.termsAndConditions ?? null,
              ...priced.totals,
              status: "DRAFT",
              items: { create: priced.lines },
            },
            tx,
          );

          await this.auditService.record(AuditAction.CREATE_QUOTATION, {
            entityType: "Quotation",
            entityId: created.id,
            newValues: {
              quotationNumber: number,
              grandTotal: created.grandTotal,
              itemCount: priced.lines.length,
            },
            tx,
          });

          return created;
        }),
      { label: "quotation.create" },
    );

    await this.recordPriceOverrides(quotation.id, priced.priceOverrides);
    return quotation;
  }

  async update(id: string, input: QuotationInput): Promise<QuotationFull> {
    const before = await this.getById(id);
    if (!EDITABLE.includes(before.status)) {
      throw new DocumentStateError(`A ${before.status.toLowerCase()} quotation can no longer be edited`);
    }

    const company = await this.companyService.get();
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) throw new ValidationError("The selected customer does not exist");

    const quotationDate = toDate(input.quotationDate) ?? before.quotationDate;
    const placeOfSupplyStateCode = stateCodeFromGstin(customer.gstin) ?? customer.stateCode;

    const priced = await this.pricingService.price({
      lines: input.items,
      companyStateCode: company.stateCode,
      placeOfSupplyStateCode,
      roundingMode: company.roundingMode,
      allowZeroValueBilling: company.allowZeroValueBilling,
    });

    const quotation = await this.quotationRepository.replace(
      id,
      {
        customer: { connect: { id: customer.id } },
        quotationDate,
        validUntil: toDate(input.validUntil) ?? before.validUntil,
        placeOfSupply: input.placeOfSupply ?? customer.state,
        placeOfSupplyStateCode,
        notes: input.notes ?? null,
        termsAndConditions: input.termsAndConditions ?? before.termsAndConditions,
        ...priced.totals,
      },
      priced.lines,
    );

    await this.auditService.record(AuditAction.UPDATE_QUOTATION, {
      entityType: "Quotation",
      entityId: id,
      oldValues: { grandTotal: before.grandTotal, items: before.items.length },
      newValues: {
        grandTotal: quotation.grandTotal,
        items: priced.lines.length,
      },
    });
    await this.recordPriceOverrides(id, priced.priceOverrides);

    return quotation;
  }

  async transition(id: string, to: QuotationStatus): Promise<QuotationFull> {
    const quotation = await this.getById(id);
    this.assertTransition(quotation.status, to);

    const extra: Prisma.QuotationUpdateInput =
      to === "SENT" ? { sentAt: new Date() } : to === "ACCEPTED" || to === "REJECTED" ? { decidedAt: new Date() } : {};

    const updated = await this.quotationRepository.updateStatus(id, to, extra);

    const action =
      to === "SENT"
        ? AuditAction.SEND_QUOTATION
        : to === "ACCEPTED"
          ? AuditAction.ACCEPT_QUOTATION
          : to === "REJECTED"
            ? AuditAction.REJECT_QUOTATION
            : AuditAction.UPDATE_QUOTATION;

    await this.auditService.record(action, {
      entityType: "Quotation",
      entityId: id,
      oldValues: { status: quotation.status },
      newValues: { status: to },
    });
    return updated;
  }

  /** Copy an existing quotation into a fresh draft, prices and all. */
  async duplicate(id: string, userId: string): Promise<QuotationFull> {
    const source = await this.getById(id);
    return this.create(
      {
        customerId: source.customerId,
        placeOfSupply: source.placeOfSupply,
        notes: source.notes,
        termsAndConditions: source.termsAndConditions,
        items: source.items.map((item) => ({
          productId: item.productId,
          productName: item.productNameSnapshot,
          productCode: item.productCodeSnapshot,
          hsnCode: item.hsnCodeSnapshot,
          unit: item.unitSnapshot,
          quantity: item.quantity.toString(),
          // Carry the quoted price forward, not the current master price.
          unitPrice: item.unitPrice.toString(),
          discountType: item.discountType,
          discountValue: item.discountValue.toString(),
          gstRate: item.gstRate.toString(),
        })),
      },
      userId,
    );
  }

  async remove(id: string): Promise<void> {
    const quotation = await this.getById(id);
    if (quotation.status !== "DRAFT") {
      throw new DocumentStateError("Only draft quotations can be deleted. Cancel it instead to keep the audit trail.");
    }
    await this.quotationRepository.delete(id);
    await this.auditService.record(AuditAction.UPDATE_QUOTATION, {
      entityType: "Quotation",
      entityId: id,
      oldValues: quotation,
      newValues: { deleted: true },
    });
  }

  expireStale() {
    return this.quotationRepository.markExpired();
  }

  private assertTransition(from: QuotationStatus, to: QuotationStatus): void {
    if (!TRANSITIONS[from].includes(to)) {
      throw new DocumentStateError(`A quotation cannot move from ${from} to ${to}`);
    }
  }

  /**
   * Price overrides get their own audit event because the admin may bill any
   * amount and the difference from the master price is the thing a reviewer
   * later needs to see (architecture.md §30). It is a record, not a restriction.
   */
  private async recordPriceOverrides(quotationId: string, overrides: { lineNumber: number }[]): Promise<void> {
    if (overrides.length === 0) return;
    await this.auditService.record(AuditAction.PRICE_OVERRIDE, {
      entityType: "Quotation",
      entityId: quotationId,
      newValues: { overrides },
    });
  }
}

export function toDate(value: string | Date | null | undefined): Date | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`Invalid date: ${String(value)}`);
  return date;
}

/**
 * The first two digits of a GSTIN are the state code it was issued under —
 * the authoritative source for whether a supply is inter- or intra-state.
 * Preferred over the customer's own stored state, which is a free-typed
 * address field and can drift from what the customer is actually registered
 * under for GST.
 */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const prefix = gstin.trim().slice(0, 2);
  return /^\d{2}$/.test(prefix) ? prefix : null;
}
