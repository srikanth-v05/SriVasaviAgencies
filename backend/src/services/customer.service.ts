import { AddressType, CustomerType, Prisma } from "@prisma/client";
import { CustomerRepository, type CustomerQuery } from "../repositories/customer.repository";
import { QuotationRepository } from "../repositories/quotation.repository";
import { InvoiceRepository } from "../repositories/invoice.repository";
import { PaymentRepository } from "../repositories/payment.repository";
import { AuditService, AuditAction } from "./audit.service";
import { NotFoundError, ConflictError } from "../utils/errors";

export interface AddressInput {
  addressType: AddressType;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode?: string | null;
  isDefault?: boolean;
}

export interface CustomerInput {
  customerType: CustomerType;
  name: string;
  companyName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  state: string;
  stateCode: string;
  notes?: string | null;
  isActive?: boolean;
  addresses?: AddressInput[];
}

export class CustomerService {
  constructor(
    private customerRepository: CustomerRepository,
    private quotationRepository: QuotationRepository,
    private invoiceRepository: InvoiceRepository,
    private paymentRepository: PaymentRepository,
    private auditService: AuditService,
  ) {}

  list(query: CustomerQuery) {
    return this.customerRepository.list(query);
  }

  async getById(id: string) {
    const customer = await this.customerRepository.findById(id);
    if (!customer) throw new NotFoundError("Customer not found");
    return customer;
  }

  async create(input: CustomerInput) {
    const customer = await this.customerRepository.create({
      ...this.toPersistable(input),
      ...(input.addresses?.length
        ? { addresses: { create: input.addresses.map((a) => ({ ...a, line2: a.line2 ?? null })) } }
        : {}),
    });

    await this.auditService.record(AuditAction.CREATE_CUSTOMER, {
      entityType: "Customer",
      entityId: customer.id,
      newValues: customer,
    });
    return customer;
  }

  async update(id: string, input: Partial<CustomerInput>) {
    const before = await this.getById(id);

    const data: Prisma.CustomerUpdateInput = {
      ...(input.customerType !== undefined ? { customerType: input.customerType } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.alternatePhone !== undefined ? { alternatePhone: input.alternatePhone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.gstin !== undefined ? { gstin: input.gstin } : {}),
      ...(input.pan !== undefined ? { pan: input.pan } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.stateCode !== undefined ? { stateCode: input.stateCode } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };

    if (input.addresses) {
      await this.customerRepository.replaceAddresses(
        id,
        input.addresses.map((a) => ({ ...a, line2: a.line2 ?? null, isDefault: a.isDefault ?? false })),
      );
    }

    const customer = await this.customerRepository.update(id, data);
    await this.auditService.record(AuditAction.UPDATE_CUSTOMER, {
      entityType: "Customer",
      entityId: id,
      oldValues: before,
      newValues: customer,
    });
    return customer;
  }

  /** Customers with transaction history are deactivated, never deleted. */
  async remove(id: string) {
    const customer = await this.getById(id);
    const documents = await this.customerRepository.documentCount(id);

    if (documents > 0) {
      throw new ConflictError(
        `This customer has ${documents} document(s) on record and cannot be deleted. Deactivate them instead.`,
      );
    }

    await this.customerRepository.delete(id);
    await this.auditService.record(AuditAction.DELETE_CUSTOMER, {
      entityType: "Customer",
      entityId: id,
      oldValues: customer,
    });
  }

  quotations(customerId: string) {
    return this.quotationRepository.listByCustomer(customerId);
  }

  invoices(customerId: string) {
    return this.invoiceRepository.listByCustomer(customerId);
  }

  payments(customerId: string) {
    return this.paymentRepository.listByCustomer(customerId);
  }

  /**
   * A running customer ledger: invoices are debits, payments are credits, and the
   * closing balance is the outstanding amount (architecture.md §9, §19).
   */
  async ledger(customerId: string) {
    const customer = await this.getById(customerId);
    const [invoices, payments] = await Promise.all([
      this.invoiceRepository.listByCustomer(customerId, 500),
      this.paymentRepository.listByCustomer(customerId, 500),
    ]);

    const entries = [
      ...invoices
        .filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED")
        .map((i) => ({
          date: i.invoiceDate,
          type: "INVOICE" as const,
          reference: i.invoiceNumber ?? "(draft)",
          referenceId: i.id,
          debit: i.grandTotal,
          credit: new Prisma.Decimal(0),
        })),
      ...payments.map((p) => ({
        date: p.paymentDate,
        type: "PAYMENT" as const,
        reference: p.invoice.invoiceNumber ?? p.referenceNumber ?? "Payment",
        referenceId: p.id,
        debit: new Prisma.Decimal(0),
        credit: p.amount,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = new Prisma.Decimal(0);
    const rows = entries.map((e) => {
      running = running.plus(e.debit).minus(e.credit);
      return { ...e, balance: running };
    });

    return {
      customer,
      entries: rows,
      closingBalance: running,
      outstanding: await this.customerRepository.outstanding(customerId),
    };
  }

  private toPersistable(input: CustomerInput) {
    return {
      customerType: input.customerType,
      name: input.name,
      companyName: input.companyName ?? null,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      alternatePhone: input.alternatePhone ?? null,
      email: input.email ?? null,
      gstin: input.gstin ?? null,
      pan: input.pan ?? null,
      state: input.state,
      stateCode: input.stateCode,
      notes: input.notes ?? null,
      isActive: input.isActive ?? true,
    };
  }
}
