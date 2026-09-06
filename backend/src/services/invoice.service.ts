import { InvoiceStatus, Prisma } from "@prisma/client";
import { InvoiceRepository, type InvoiceQuery, type InvoiceFull } from "../repositories/invoice.repository";
import { QuotationRepository } from "../repositories/quotation.repository";
import { CustomerRepository } from "../repositories/customer.repository";
import { PaymentRepository } from "../repositories/payment.repository";
import { DocumentPricingService, type LineDraft } from "./document-pricing.service";
import { NumberingService } from "./numbering.service";
import { CompanyService } from "./company.service";
import { AuditService, AuditAction } from "./audit.service";
import { NotFoundError, ValidationError, ConflictError, DocumentStateError } from "../utils/errors";
import { prisma, type PrismaTransaction } from "../db/prisma";
import { withRetry } from "../db/retry";
import { toDate, stateCodeFromGstin } from "./quotation.service";

export interface InvoiceInput {
  customerId: string;
  invoiceDate?: string | Date;
  dueDate?: string | Date | null;
  placeOfSupply?: string;
  paymentTerms?: string | null;
  notes?: string | null;
  termsAndConditions?: string | null;
  poNumber?: string | null;
  vehicleNumber?: string | null;
  items: LineDraft[];
}

/** Only unissued invoices may be edited (architecture.md §16, §35). */
const EDITABLE: InvoiceStatus[] = ["DRAFT", "READY_TO_ISSUE"];
/** Once issued, an invoice can only be cancelled — never silently rewritten. */
const CANCELLABLE: InvoiceStatus[] = ["ISSUED", "PARTIALLY_PAID", "OVERDUE", "READY_TO_ISSUE", "DRAFT"];

/**
 * Above this value a tax invoice must carry the recipient's address even for an
 * unregistered buyer. Below it, a B2C invoice may omit it.
 */
const B2C_ADDRESS_THRESHOLD = new Prisma.Decimal(50000);

export class InvoiceService {
  constructor(
    private invoiceRepository: InvoiceRepository,
    private quotationRepository: QuotationRepository,
    private customerRepository: CustomerRepository,
    private paymentRepository: PaymentRepository,
    private pricingService: DocumentPricingService,
    private numberingService: NumberingService,
    private companyService: CompanyService,
    private auditService: AuditService,
  ) {}

  list(query: InvoiceQuery) {
    return this.invoiceRepository.list(query);
  }

  async getById(id: string): Promise<InvoiceFull> {
    const invoice = await this.invoiceRepository.findById(id);
    if (!invoice) throw new NotFoundError("Invoice not found");
    return invoice;
  }

  /**
   * Method A — direct invoice (architecture.md §11). Created as a DRAFT with no
   * number: a number is only consumed at finalisation, so abandoned drafts never
   * leave gaps in the issued sequence.
   */
  async create(input: InvoiceInput, userId: string): Promise<InvoiceFull> {
    const company = await this.companyService.get();
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) throw new ValidationError("The selected customer does not exist");

    const invoiceDate = toDate(input.invoiceDate) ?? new Date();
    const placeOfSupplyStateCode = stateCodeFromGstin(customer.gstin) ?? customer.stateCode;

    const priced = await this.pricingService.price({
      lines: input.items,
      companyStateCode: company.stateCode,
      placeOfSupplyStateCode,
      roundingMode: company.roundingMode,
      allowZeroValueBilling: company.allowZeroValueBilling,
    });

    const invoice = await this.invoiceRepository.create({
      customer: { connect: { id: customer.id } },
      createdBy: { connect: { id: userId } },
      invoiceDate,
      dueDate: toDate(input.dueDate) ?? null,
      placeOfSupply: input.placeOfSupply ?? customer.state,
      placeOfSupplyStateCode,
      paymentTerms: input.paymentTerms ?? null,
      notes: input.notes ?? company.defaultInvoiceNotes ?? null,
      termsAndConditions: input.termsAndConditions ?? company.termsAndConditions ?? null,
      poNumber: input.poNumber ?? null,
      vehicleNumber: input.vehicleNumber ?? null,
      ...priced.totals,
      balanceDue: priced.totals.grandTotal,
      status: "DRAFT",
      items: { create: priced.lines },
    });

    await this.auditService.record(AuditAction.CREATE_INVOICE, {
      entityType: "Invoice",
      entityId: invoice.id,
      newValues: {
        grandTotal: invoice.grandTotal,
        itemCount: priced.lines.length,
        source: "DIRECT",
      },
    });
    await this.recordPriceOverrides(invoice.id, priced.priceOverrides);

    return invoice;
  }

  async update(id: string, input: InvoiceInput): Promise<InvoiceFull> {
    const before = await this.getById(id);
    this.assertEditable(before);

    const company = await this.companyService.get();
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) throw new ValidationError("The selected customer does not exist");

    const placeOfSupplyStateCode = stateCodeFromGstin(customer.gstin) ?? customer.stateCode;
    const priced = await this.pricingService.price({
      lines: input.items,
      companyStateCode: company.stateCode,
      placeOfSupplyStateCode,
      roundingMode: company.roundingMode,
      allowZeroValueBilling: company.allowZeroValueBilling,
    });

    const invoice = await this.invoiceRepository.replace(
      id,
      {
        customer: { connect: { id: customer.id } },
        invoiceDate: toDate(input.invoiceDate) ?? before.invoiceDate,
        dueDate: toDate(input.dueDate) ?? before.dueDate,
        placeOfSupply: input.placeOfSupply ?? customer.state,
        placeOfSupplyStateCode,
        paymentTerms: input.paymentTerms ?? before.paymentTerms,
        notes: input.notes ?? before.notes,
        termsAndConditions: input.termsAndConditions ?? before.termsAndConditions,
        poNumber: input.poNumber ?? before.poNumber,
        vehicleNumber: input.vehicleNumber ?? before.vehicleNumber,
        ...priced.totals,
        balanceDue: priced.totals.grandTotal.minus(before.amountPaid),
      },
      priced.lines,
    );

    await this.auditService.record(AuditAction.UPDATE_INVOICE, {
      entityType: "Invoice",
      entityId: id,
      oldValues: { grandTotal: before.grandTotal, items: before.items.length },
      newValues: { grandTotal: invoice.grandTotal, items: priced.lines.length },
    });
    await this.recordPriceOverrides(id, priced.priceOverrides);

    return invoice;
  }

  /**
   * Method B — quotation conversion (architecture.md §11, §28).
   *
   * The quotation's own saved unit prices are copied across verbatim. The
   * product master is never re-consulted, so a master price change between
   * quoting and invoicing cannot alter what the customer was promised. The
   * resulting invoice is a draft and remains fully editable until finalised.
   */
  async convertFromQuotation(quotationId: string, userId: string): Promise<InvoiceFull> {
    const company = await this.companyService.get();

    const result = await withRetry(
      () =>
        prisma.$transaction(async (tx) => {
          const quotation = await this.quotationRepository.findById(quotationId, tx);
          if (!quotation) throw new NotFoundError("Quotation not found");

          if (quotation.status !== "ACCEPTED") {
            throw new DocumentStateError(
              `Only an accepted quotation can be converted. This one is ${quotation.status.toLowerCase()}.`,
            );
          }
          if (quotation.invoice) {
            throw new DocumentStateError(
              `This quotation was already converted to invoice ${quotation.invoice.invoiceNumber ?? "(draft)"}`,
            );
          }

          const invoiceDate = new Date();
          const dueDate = new Date(invoiceDate.getTime() + 15 * 24 * 60 * 60 * 1000);

          const invoice = await this.invoiceRepository.create(
            {
              customer: { connect: { id: quotation.customerId } },
              quotation: { connect: { id: quotation.id } },
              createdBy: { connect: { id: userId } },
              invoiceDate,
              dueDate,
              placeOfSupply: quotation.placeOfSupply,
              placeOfSupplyStateCode: quotation.placeOfSupplyStateCode,
              paymentTerms: company.defaultPaymentTerms,
              notes: company.defaultInvoiceNotes ?? null,
              termsAndConditions: quotation.termsAndConditions ?? company.termsAndConditions ?? null,
              subtotal: quotation.subtotal,
              discountTotal: quotation.discountTotal,
              taxableTotal: quotation.taxableTotal,
              cgstTotal: quotation.cgstTotal,
              sgstTotal: quotation.sgstTotal,
              igstTotal: quotation.igstTotal,
              roundOff: quotation.roundOff,
              grandTotal: quotation.grandTotal,
              balanceDue: quotation.grandTotal,
              status: "DRAFT",
              items: {
                create: quotation.items.map((item) => ({
                  productId: item.productId,
                  lineNumber: item.lineNumber,
                  productNameSnapshot: item.productNameSnapshot,
                  productCodeSnapshot: item.productCodeSnapshot,
                  hsnCodeSnapshot: item.hsnCodeSnapshot,
                  unitSnapshot: item.unitSnapshot,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  masterPriceSnapshot: item.masterPriceSnapshot,
                  discountType: item.discountType,
                  discountValue: item.discountValue,
                  lineDiscount: item.lineDiscount,
                  grossValue: item.grossValue,
                  lineTaxableValue: item.lineTaxableValue,
                  gstRate: item.gstRate,
                  cgstRate: item.cgstRate,
                  cgstAmount: item.cgstAmount,
                  sgstRate: item.sgstRate,
                  sgstAmount: item.sgstAmount,
                  igstRate: item.igstRate,
                  igstAmount: item.igstAmount,
                  lineTotal: item.lineTotal,
                })),
              },
            },
            tx,
          );

          await this.quotationRepository.updateStatus(quotation.id, "CONVERTED", {}, tx);

          await this.auditService.record(AuditAction.CONVERT_QUOTATION, {
            entityType: "Quotation",
            entityId: quotation.id,
            oldValues: { status: quotation.status },
            newValues: {
              status: "CONVERTED",
              invoiceId: invoice.id,
              grandTotal: quotation.grandTotal,
            },
            tx,
          });

          return invoice;
        }),
      { label: "invoice.convertFromQuotation" },
    );

    return result;
  }

  /**
   * Finalisation (architecture.md §28). Everything happens in one transaction:
   * validate, recompute totals from the stored snapshots, consume an invoice
   * number, freeze the buyer details, and write the audit event. Any failure
   * rolls the whole thing back, including the number.
   */
  async finalize(id: string, options?: { startSequence?: number }): Promise<InvoiceFull> {
    // Wrapped in withRetry because this transaction consumes an invoice number:
    // two staff issuing at the same instant contend on the counter row, and TiDB
    // may abort the loser. That abort is safe to replay.
    return withRetry(
      () =>
        prisma.$transaction(async (tx) => {
          const invoice = await this.invoiceRepository.findById(id, tx);
          if (!invoice) throw new NotFoundError("Invoice not found");

          if (invoice.status === "CANCELLED") throw new DocumentStateError("A cancelled invoice cannot be issued");
          if (invoice.invoiceNumber) {
            throw new DocumentStateError(`This invoice was already issued as ${invoice.invoiceNumber}`);
          }

          const company = await this.companyService.getIn(tx);
          this.assertReadyToIssue(invoice);

          const { number } = options?.startSequence
            ? await this.allocateFromChecked(tx, company.invoicePrefix, invoice.invoiceDate, options.startSequence)
            : await this.numberingService.allocate(tx, "INVOICE", company.invoicePrefix, invoice.invoiceDate);

          const customer = invoice.customer;
          const billing =
            customer.addresses.find((a) => a.addressType === "BILLING" && a.isDefault) ??
            customer.addresses.find((a) => a.addressType === "BILLING") ??
            customer.addresses[0];

          const issued = await this.invoiceRepository.update(
            id,
            {
              invoiceNumber: number,
              status: "ISSUED",
              issuedAt: new Date(),
              dueDate: invoice.dueDate,
              customerNameSnapshot: customer.companyName ?? customer.name,
              customerGstinSnapshot: customer.gstin,
              customerAddressSnapshot: billing
                ? [billing.line1, billing.line2, [billing.city, billing.pincode].filter(Boolean).join(" "), billing.state]
                    .filter(Boolean)
                    .join(", ")
                : null,
            },
            tx,
          );

          await this.auditService.record(AuditAction.FINALIZE_INVOICE, {
            entityType: "Invoice",
            entityId: id,
            oldValues: { status: invoice.status, invoiceNumber: null },
            newValues: {
              status: "ISSUED",
              invoiceNumber: number,
              grandTotal: issued.grandTotal,
            },
            tx,
          });

          return issued;
        }),
      { label: "invoice.finalize" },
    );
  }

  /**
   * Cancellation keeps the invoice, its number, and its figures intact
   * (architecture.md §16, §35). Nothing is deleted and no number is released
   * for reuse.
   */
  async cancel(id: string, reason: string): Promise<InvoiceFull> {
    const invoice = await this.getById(id);
    if (!CANCELLABLE.includes(invoice.status)) {
      throw new DocumentStateError(`A ${invoice.status.toLowerCase()} invoice cannot be cancelled`);
    }
    if (invoice.payments.length > 0) {
      throw new DocumentStateError(
        "This invoice has payments recorded against it. Reverse the payments before cancelling.",
      );
    }

    const cancelled = await this.invoiceRepository.update(id, {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: reason,
    });

    await this.auditService.record(AuditAction.CANCEL_INVOICE, {
      entityType: "Invoice",
      entityId: id,
      oldValues: { status: invoice.status },
      newValues: { status: "CANCELLED", reason },
    });
    return cancelled;
  }

  async remove(id: string): Promise<void> {
    const invoice = await this.getById(id);
    if (invoice.invoiceNumber || !EDITABLE.includes(invoice.status)) {
      throw new DocumentStateError("An issued invoice cannot be deleted. Cancel it instead.");
    }
    await this.invoiceRepository.delete(id);
    await this.auditService.record(AuditAction.UPDATE_INVOICE, {
      entityType: "Invoice",
      entityId: id,
      oldValues: invoice,
      newValues: { deleted: true },
    });
  }

  /**
   * Recompute amountPaid / balanceDue / status from the payment rows
   * (architecture.md §15). Called after any payment change so the invoice never
   * drifts from its ledger.
   */
  async refreshPaymentState(invoiceId: string, tx?: PrismaTransaction): Promise<InvoiceFull> {
    const client = tx;
    const invoice = await this.invoiceRepository.findById(invoiceId, client);
    if (!invoice) throw new NotFoundError("Invoice not found");

    const amountPaid = await this.paymentRepository.sumForInvoice(invoiceId, client);
    const balanceDue = invoice.grandTotal.minus(amountPaid);

    let status: InvoiceStatus = invoice.status;
    if (invoice.status !== "CANCELLED" && invoice.status !== "DRAFT" && invoice.status !== "READY_TO_ISSUE") {
      if (amountPaid.greaterThanOrEqualTo(invoice.grandTotal)) status = "PAID";
      else if (amountPaid.greaterThan(0)) status = "PARTIALLY_PAID";
      else status = isOverdue(invoice.dueDate) ? "OVERDUE" : "ISSUED";
    }

    return this.invoiceRepository.update(invoiceId, { amountPaid, balanceDue, status }, client);
  }

  markOverdue() {
    return this.invoiceRepository.markOverdue();
  }

  private assertEditable(invoice: InvoiceFull): void {
    if (invoice.invoiceNumber || !EDITABLE.includes(invoice.status)) {
      throw new DocumentStateError(
        "An issued invoice is locked. Cancel it and raise a fresh invoice if the figures must change.",
      );
    }
  }

  /**
   * A manual starting sequence can collide with a number already issued —
   * checked explicitly here for a clear message, rather than surfacing the
   * DB's own unique-constraint error. Runs inside the caller's transaction,
   * so a collision rolls back the sequence-counter update too.
   */
  private async allocateFromChecked(
    tx: PrismaTransaction,
    prefix: string,
    documentDate: Date,
    startSequence: number,
  ) {
    const allocated = await this.numberingService.allocateFrom(tx, "INVOICE", prefix, documentDate, startSequence);
    const existing = await this.invoiceRepository.findByInvoiceNumber(allocated.number, tx);
    if (existing) throw new ConflictError(`Invoice number ${allocated.number} is already in use`);
    return allocated;
  }

  /**
   * Mandatory-field gate between a draft and an official tax invoice
   * (architecture.md §16, §18). Drafts may be incomplete; issued invoices may not.
   */
  private assertReadyToIssue(invoice: InvoiceFull): void {
    const problems: string[] = [];
    const customer = invoice.customer;

    if (invoice.items.length === 0) problems.push("the invoice has no line items");
    if (!customer.name?.trim()) problems.push("the customer has no name");
    if (!customer.stateCode?.trim()) problems.push("the customer has no state code");
    if (!invoice.placeOfSupplyStateCode?.trim()) problems.push("the place of supply is not set");

    const needsAddress = Boolean(customer.gstin) || invoice.grandTotal.greaterThanOrEqualTo(B2C_ADDRESS_THRESHOLD);
    const hasAddress = customer.addresses.length > 0;
    if (needsAddress && !hasAddress) {
      problems.push(
        customer.gstin
          ? "a registered (GSTIN) customer needs a billing address"
          : `invoices of ${B2C_ADDRESS_THRESHOLD.toString()} or more need a billing address`,
      );
    }

    if (invoice.items.some((i) => !i.hsnCodeSnapshot)) {
      problems.push("every line needs an HSN code");
    }

    if (problems.length > 0) {
      throw new ValidationError(`This invoice is not ready to issue: ${problems.join("; ")}.`);
    }
  }

  private async recordPriceOverrides(invoiceId: string, overrides: { lineNumber: number }[]): Promise<void> {
    if (overrides.length === 0) return;
    await this.auditService.record(AuditAction.PRICE_OVERRIDE, {
      entityType: "Invoice",
      entityId: invoiceId,
      newValues: { overrides },
    });
  }
}

function isOverdue(dueDate: Date | null): boolean {
  return dueDate !== null && dueDate.getTime() < Date.now();
}
