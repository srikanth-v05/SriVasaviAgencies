import { z } from "zod";

/** Shared request schemas. Controllers stay thin because parsing lives here. */

export const idParam = z.object({ id: z.string().uuid("Not a valid id") });
export const slugParam = z.object({ slug: z.string().min(1) });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().min(1).optional(),
});

const optionalDate = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((v) => (v ? new Date(v) : undefined))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Not a valid date");

export const dateRangeQuery = z.object({
  dateFrom: optionalDate,
  dateTo: optionalDate,
});

// --------------------------------------------------------------------------- auth

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(1).optional() });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(10, "Use at least 10 characters"),
});

export const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "BILLING_USER", "REPORT_USER"]);

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2),
  password: z.string().min(10, "Use at least 10 characters"),
  role: roleSchema,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({ newPassword: z.string().min(10, "Use at least 10 characters") });

// --------------------------------------------------------------------------- company

export const companySchema = z.object({
  name: z.string().trim().min(2),
  tradeName: z.string().trim().nullish(),
  legalName: z.string().trim().nullish(),
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, "Not a valid GSTIN")
    .nullish(),
  pan: z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Not a valid PAN").nullish(),
  addressLine1: z.string().trim().min(3),
  addressLine2: z.string().trim().nullish(),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  stateCode: z.string().trim().regex(/^\d{1,2}$/, "State code is a 1-2 digit number"),
  pincode: z.string().trim().regex(/^\d{6}$/, "PIN code is 6 digits"),
  phone: z.string().trim().min(6),
  email: z.string().email(),
  alternatePhone: z.string().trim().nullish(),
  website: z.string().trim().nullish(),
  logoUrl: z.string().trim().nullish(),
  googleMapsUrl: z.string().trim().nullish(),
  justdialUrl: z.string().trim().nullish(),
  googlePlaceId: z.string().trim().nullish(),
  sealUrl: z.string().trim().nullish(),
  signatureUrl: z.string().trim().nullish(),
  declaration: z.string().nullish(),
  bankName: z.string().trim().nullish(),
  bankAccountName: z.string().trim().nullish(),
  bankAccountNumber: z.string().trim().nullish(),
  bankIfsc: z.string().trim().nullish(),
  bankBranch: z.string().trim().nullish(),
  upiId: z.string().trim().nullish(),
  quotationPrefix: z.string().trim().min(1).optional(),
  invoicePrefix: z.string().trim().min(1).optional(),
  defaultPaymentTerms: z.string().trim().optional(),
  defaultQuotationValidityDays: z.coerce.number().int().min(1).max(365).optional(),
  defaultInvoiceNotes: z.string().nullish(),
  termsAndConditions: z.string().nullish(),
  roundingMode: z.enum(["NONE", "NEAREST_RUPEE"]).optional(),
  allowZeroValueBilling: z.boolean().optional(),
});

// --------------------------------------------------------------------------- masters

export const categorySchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().nullish(),
  zoneCode: z.string().trim().nullish(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const unitSchema = z.object({
  name: z.string().trim().min(1),
  shortName: z.string().trim().min(1).max(12),
  isActive: z.boolean().optional(),
});

export const gstRateSchema = z.object({
  rate: z.coerce.number().min(0).max(100),
  label: z.string().trim().min(1),
});

export const productSchema = z.object({
  /** Left blank to have the system assign one automatically. */
  productCode: z.string().trim().min(1).nullish(),
  name: z.string().trim().min(2),
  categoryId: z.string().uuid().nullish(),
  description: z.string().nullish(),
  dilutionRatio: z.string().trim().nullish(),
  packSize: z.string().trim().nullish(),
  imageUrl: z.string().trim().nullish(),
  hsnCode: z.string().trim().nullish(),
  defaultPrice: z.coerce.number().min(0),
  defaultGstRate: z.coerce.number().min(0).max(100),
  unitId: z.string().uuid(),
  isActive: z.boolean().optional(),
  showOnWebsite: z.boolean().optional(),
});

export const productQuery = paginationQuery.extend({
  categoryId: z.string().uuid().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const statusSchema = z.object({ isActive: z.boolean() });

// --------------------------------------------------------------------------- customers

export const customerTypeSchema = z.enum([
  "INDIVIDUAL",
  "COMPANY",
  "SCHOOL",
  "COLLEGE",
  "GOVERNMENT",
  "INSTITUTION",
  "OTHER",
]);

export const addressSchema = z.object({
  addressType: z.enum(["BILLING", "SHIPPING"]),
  line1: z.string().trim().min(3),
  line2: z.string().trim().nullish(),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  stateCode: z.string().trim().regex(/^\d{1,2}$/),
  pincode: z.string().trim().regex(/^\d{6}$/, "PIN code is 6 digits").nullish().or(z.literal("")),
  isDefault: z.boolean().optional(),
});

export const customerSchema = z.object({
  customerType: customerTypeSchema,
  name: z.string().trim().min(2),
  companyName: z.string().trim().nullish(),
  contactPerson: z.string().trim().nullish(),
  phone: z.string().trim().min(6, "Enter at least 6 digits, or leave it blank").nullish().or(z.literal("")),
  alternatePhone: z.string().trim().nullish(),
  email: z.string().email().nullish().or(z.literal("")),
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, "Not a valid GSTIN")
    .nullish()
    .or(z.literal("")),
  pan: z.string().trim().nullish().or(z.literal("")),
  state: z.string().trim().min(2),
  stateCode: z.string().trim().regex(/^\d{1,2}$/, "State code is a 1-2 digit number"),
  notes: z.string().nullish(),
  isActive: z.boolean().optional(),
  addresses: z.array(addressSchema).optional(),
});

export const customerQuery = paginationQuery.extend({
  customerType: customerTypeSchema.optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

// --------------------------------------------------------------------------- documents

/**
 * A document line. `unitPrice` is deliberately unconstrained relative to the
 * product master: any non-negative value is accepted (architecture.md §2.1, §30).
 */
export const lineItemSchema = z.object({
  productId: z.string().uuid().nullish(),
  productName: z.string().trim().min(1).optional(),
  productCode: z.string().trim().nullish(),
  hsnCode: z.string().trim().nullish(),
  unit: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unitPrice: z.coerce.number().min(0).nullish(),
  discountType: z.enum(["NONE", "PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.coerce.number().min(0).nullish(),
  gstRate: z.coerce.number().min(0).max(100).nullish(),
});

export const quotationSchema = z.object({
  customerId: z.string().uuid(),
  quotationDate: z.string().optional(),
  validUntil: z.string().nullish(),
  placeOfSupply: z.string().trim().optional(),
  placeOfSupplyStateCode: z.string().trim().regex(/^\d{1,2}$/).optional(),
  notes: z.string().nullish(),
  termsAndConditions: z.string().nullish(),
  items: z.array(lineItemSchema).min(1, "Add at least one item"),
});

export const quotationQuery = paginationQuery.extend({
  customerId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED", "CANCELLED"]).optional(),
  dateFrom: optionalDate,
  dateTo: optionalDate,
});

export const invoiceSchema = z.object({
  customerId: z.string().uuid(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().nullish(),
  placeOfSupply: z.string().trim().optional(),
  placeOfSupplyStateCode: z.string().trim().regex(/^\d{1,2}$/).optional(),
  paymentTerms: z.string().nullish(),
  notes: z.string().nullish(),
  termsAndConditions: z.string().nullish(),
  poNumber: z.string().trim().nullish(),
  vehicleNumber: z.string().trim().nullish(),
  items: z.array(lineItemSchema).min(1, "Add at least one item"),
});

export const invoiceQuery = paginationQuery.extend({
  customerId: z.string().uuid().optional(),
  status: z
    .enum(["DRAFT", "READY_TO_ISSUE", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"])
    .optional(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL", "OVERDUE"]).optional(),
  dateFrom: optionalDate,
  dateTo: optionalDate,
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason for the cancellation"),
});

export const paymentMethodSchema = z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]);

export const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  paymentDate: z.string().optional(),
  amount: z.coerce.number().positive("Enter an amount greater than zero"),
  paymentMethod: paymentMethodSchema,
  referenceNumber: z.string().trim().nullish(),
  notes: z.string().nullish(),
});

export const updatePaymentSchema = paymentSchema.partial().omit({ invoiceId: true });

export const paymentQuery = paginationQuery.extend({
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  dateFrom: optionalDate,
  dateTo: optionalDate,
});

// --------------------------------------------------------------------------- reports

export const reportQuery = z.object({
  dateFrom: optionalDate,
  dateTo: optionalDate,
  customerId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  grain: z.enum(["day", "week", "month", "year"]).optional(),
});

export const auditQuery = paginationQuery.extend({
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  userId: z.string().uuid().optional(),
  dateFrom: optionalDate,
  dateTo: optionalDate,
});

// --------------------------------------------------------------------------- public

export const enquirySchema = z.object({
  name: z.string().trim().min(2, "Tell us your name"),
  organisation: z.string().trim().nullish(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{6,20}$/, "Enter a phone number we can reach you on"),
  email: z.string().email().nullish().or(z.literal("")),
  message: z.string().trim().min(10, "Tell us what you need, in a sentence or two"),
  productIds: z.array(z.string().uuid()).optional(),
});

export const publicProductQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  search: z.string().trim().min(1).optional(),
  categoryId: z.string().uuid().optional(),
});

// --------------------------------------------------------------------------- reviews

export const reviewSourceSchema = z.enum(["GOOGLE", "JUSTDIAL", "DIRECT"]);

export const reviewSchema = z.object({
  source: reviewSourceSchema,
  authorName: z.string().trim().min(2, "Who wrote it?"),
  authorRole: z.string().trim().nullish(),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(5, "Paste the review text"),
  reviewDate: z.string().optional(),
  sourceUrl: z.string().trim().url("Link back to the original listing").nullish().or(z.literal("")),
  isPublished: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const reviewQuery = z.object({
  source: reviewSourceSchema.optional(),
  isPublished: z.enum(["true", "false"]).optional(),
});
