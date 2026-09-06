export type Role = "SUPER_ADMIN" | "ADMIN" | "BILLING_USER" | "REPORT_USER";

export type Permission =
  | "dashboard:read"
  | "products:read"
  | "products:write"
  | "customers:read"
  | "customers:write"
  | "quotations:read"
  | "quotations:write"
  | "invoices:read"
  | "invoices:write"
  | "payments:read"
  | "payments:write"
  | "reports:read"
  | "exports:read"
  | "users:manage"
  | "company:manage"
  | "audit:read";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  permissions?: Permission[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  zoneCode: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Unit {
  id: string;
  name: string;
  shortName: string;
  isActive: boolean;
}

export interface GstRate {
  id: string;
  rate: number;
  label: string;
}

export interface Product {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  description: string | null;
  dilutionRatio: string | null;
  packSize: string | null;
  imageUrl: string | null;
  hsnCode: string | null;
  defaultPrice: number;
  defaultGstRate: number;
  categoryId: string | null;
  unitId: string;
  isActive: boolean;
  showOnWebsite: boolean;
  category: Pick<Category, "id" | "name" | "slug" | "zoneCode"> | null;
  unit: Pick<Unit, "id" | "name" | "shortName">;
}

/** The public catalogue shape — list price is indicative only. */
export interface PublicProduct extends Omit<Product, "defaultPrice" | "defaultGstRate" | "isActive" | "showOnWebsite" | "categoryId" | "unitId"> {
  indicativePrice: number;
  gstRate: number;
}

export type CustomerType =
  | "INDIVIDUAL"
  | "COMPANY"
  | "SCHOOL"
  | "COLLEGE"
  | "GOVERNMENT"
  | "INSTITUTION"
  | "OTHER";

export interface Address {
  id?: string;
  addressType: "BILLING" | "SHIPPING";
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string | null;
  isDefault?: boolean;
}

export interface Customer {
  id: string;
  customerType: CustomerType;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  phone: string | null;
  alternatePhone: string | null;
  email: string | null;
  gstin: string | null;
  pan: string | null;
  state: string;
  stateCode: string;
  notes: string | null;
  isActive: boolean;
  addresses: Address[];
}

export type DiscountType = "NONE" | "PERCENTAGE" | "FIXED";

export interface DocumentLine {
  id?: string;
  productId: string | null;
  lineNumber: number;
  productNameSnapshot: string;
  productCodeSnapshot: string | null;
  hsnCodeSnapshot: string | null;
  unitSnapshot: string;
  quantity: number;
  unitPrice: number;
  masterPriceSnapshot: number | null;
  discountType: DiscountType;
  discountValue: number;
  lineDiscount: number;
  grossValue: number;
  lineTaxableValue: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  lineTotal: number;
}

export interface DocumentTotals {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
}

export type QuotationStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CONVERTED"
  | "CANCELLED";

export interface Quotation extends DocumentTotals {
  id: string;
  quotationNumber: string | null;
  customerId: string;
  quotationDate: string;
  validUntil: string | null;
  placeOfSupply: string;
  placeOfSupplyStateCode: string;
  notes: string | null;
  termsAndConditions: string | null;
  status: QuotationStatus;
  customer: Customer;
  items: DocumentLine[];
  invoice?: { id: string; invoiceNumber: string | null; status: string } | null;
  createdBy?: { id: string; name: string };
}

export type InvoiceStatus =
  | "DRAFT"
  | "READY_TO_ISSUE"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface Invoice extends DocumentTotals {
  id: string;
  invoiceNumber: string | null;
  customerId: string;
  quotationId: string | null;
  invoiceDate: string;
  dueDate: string | null;
  placeOfSupply: string;
  placeOfSupplyStateCode: string;
  paymentTerms: string | null;
  notes: string | null;
  termsAndConditions: string | null;
  poNumber: string | null;
  vehicleNumber: string | null;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  cancellationReason: string | null;
  /** Buyer details frozen at the moment the invoice was issued. */
  customerNameSnapshot: string | null;
  customerGstinSnapshot: string | null;
  customerAddressSnapshot: string | null;
  customer: Customer;
  items: DocumentLine[];
  payments: Payment[];
  quotation?: { id: string; quotationNumber: string | null } | null;
}

export type PaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";

export interface Payment {
  id: string;
  invoiceId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  invoice?: {
    id: string;
    invoiceNumber: string | null;
    grandTotal: number;
    balanceDue: number;
    status: InvoiceStatus;
    customer: { id: string; name: string; companyName: string | null };
  };
}

export interface CompanySettings {
  id: string;
  name: string;
  tradeName: string | null;
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  phone: string;
  alternatePhone: string | null;
  email: string;
  website: string | null;
  logoUrl: string | null;
  googleMapsUrl: string | null;
  justdialUrl: string | null;
  googlePlaceId: string | null;
  /** Rubber stamp and authorised signature printed on documents. */
  sealUrl: string | null;
  signatureUrl: string | null;
  declaration: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  upiId: string | null;
  quotationPrefix: string;
  invoicePrefix: string;
  defaultPaymentTerms: string;
  defaultQuotationValidityDays: number;
  defaultInvoiceNotes: string | null;
  termsAndConditions: string | null;
  roundingMode: "NONE" | "NEAREST_RUPEE";
  allowZeroValueBilling: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export type ReviewSource = "GOOGLE" | "JUSTDIAL" | "DIRECT";

export interface Review {
  id: string;
  source: ReviewSource;
  authorName: string;
  authorRole: string | null;
  rating: number;
  text: string;
  reviewDate: string;
  sourceUrl: string | null;
  externalId: string | null;
  isPublished: boolean;
  sortOrder: number;
}

export interface PublicReviews {
  reviews: Review[];
  summary: { count: number; average: number };
  links: { google: string | null; justdial: string | null };
}
