import { PaymentMethod, Prisma } from "@prisma/client";
import { PaymentRepository, type PaymentQuery } from "../repositories/payment.repository";
import { InvoiceRepository } from "../repositories/invoice.repository";
import { InvoiceService } from "./invoice.service";
import { AuditService, AuditAction } from "./audit.service";
import { NotFoundError, ValidationError, DocumentStateError } from "../utils/errors";
import { prisma } from "../db/prisma";
import { toDate } from "./quotation.service";

export interface PaymentInput {
  invoiceId: string;
  paymentDate?: string | Date;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
}

export class PaymentService {
  constructor(
    private paymentRepository: PaymentRepository,
    private invoiceRepository: InvoiceRepository,
    private invoiceService: InvoiceService,
    private auditService: AuditService,
  ) {}

  list(query: PaymentQuery) {
    return this.paymentRepository.list(query);
  }

  async getById(id: string) {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) throw new NotFoundError("Payment not found");
    return payment;
  }

  /**
   * Recording a payment and re-deriving the invoice's paid/balance/status happen
   * in one transaction, so an invoice can never show a balance that disagrees
   * with its payment rows (architecture.md §15).
   */
  async create(input: PaymentInput, userId: string) {
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw new ValidationError("A payment amount must be greater than zero");

    return prisma.$transaction(async (tx) => {
      const invoice = await this.invoiceRepository.findById(input.invoiceId, tx);
      if (!invoice) throw new NotFoundError("Invoice not found");

      if (invoice.status === "DRAFT" || invoice.status === "READY_TO_ISSUE") {
        throw new DocumentStateError("Issue the invoice before recording a payment against it");
      }
      if (invoice.status === "CANCELLED") {
        throw new DocumentStateError("A cancelled invoice cannot receive payments");
      }

      const alreadyPaid = await this.paymentRepository.sumForInvoice(invoice.id, tx);
      if (alreadyPaid.plus(amount).greaterThan(invoice.grandTotal)) {
        const remaining = invoice.grandTotal.minus(alreadyPaid);
        throw new ValidationError(
          `That is more than the outstanding balance. ${remaining.toFixed(2)} remains on this invoice.`,
        );
      }

      const payment = await this.paymentRepository.create(
        {
          invoice: { connect: { id: invoice.id } },
          createdBy: { connect: { id: userId } },
          paymentDate: toDate(input.paymentDate) ?? new Date(),
          amount,
          paymentMethod: input.paymentMethod,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
        },
        tx,
      );

      await this.invoiceService.refreshPaymentState(invoice.id, tx);

      await this.auditService.record(AuditAction.CREATE_PAYMENT, {
        entityType: "Payment",
        entityId: payment.id,
        newValues: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: amount.toString(),
          method: input.paymentMethod,
        },
        tx,
      });

      return payment;
    });
  }

  async update(id: string, input: Partial<PaymentInput>) {
    const before = await this.getById(id);

    return prisma.$transaction(async (tx) => {
      if (input.amount !== undefined) {
        const amount = new Prisma.Decimal(input.amount);
        if (amount.lessThanOrEqualTo(0)) throw new ValidationError("A payment amount must be greater than zero");

        const invoice = await this.invoiceRepository.findById(before.invoiceId, tx);
        if (!invoice) throw new NotFoundError("Invoice not found");

        const otherPayments = (await this.paymentRepository.sumForInvoice(invoice.id, tx)).minus(before.amount);
        if (otherPayments.plus(amount).greaterThan(invoice.grandTotal)) {
          throw new ValidationError("That would take the invoice past its total");
        }
      }

      const payment = await this.paymentRepository.update(
        id,
        {
          ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}),
          ...(input.paymentDate !== undefined ? { paymentDate: toDate(input.paymentDate) } : {}),
          ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
          ...(input.referenceNumber !== undefined ? { referenceNumber: input.referenceNumber } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        tx,
      );

      await this.invoiceService.refreshPaymentState(before.invoiceId, tx);

      await this.auditService.record(AuditAction.UPDATE_PAYMENT, {
        entityType: "Payment",
        entityId: id,
        oldValues: { amount: before.amount.toString(), method: before.paymentMethod },
        newValues: { amount: payment.amount.toString(), method: payment.paymentMethod },
        tx,
      });

      return payment;
    });
  }

  async remove(id: string): Promise<void> {
    const payment = await this.getById(id);

    await prisma.$transaction(async (tx) => {
      await this.paymentRepository.delete(id, tx);
      await this.invoiceService.refreshPaymentState(payment.invoiceId, tx);
      await this.auditService.record(AuditAction.DELETE_PAYMENT, {
        entityType: "Payment",
        entityId: id,
        oldValues: {
          invoiceId: payment.invoiceId,
          amount: payment.amount.toString(),
          method: payment.paymentMethod,
        },
        tx,
      });
    });
  }
}
