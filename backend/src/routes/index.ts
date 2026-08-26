import { Router } from "express";
import { container } from "../container";
import { authenticate, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../middleware/error-handler";
import { loginRateLimiter, enquiryRateLimiter, publicRateLimiter } from "../middleware/rate-limit.middleware";
import * as s from "../types/schemas";

import type { AuthController } from "../controllers/auth.controller";
import type { UserController } from "../controllers/user.controller";
import type { CompanyController } from "../controllers/company.controller";
import type { MasterDataController } from "../controllers/master-data.controller";
import type { ProductController } from "../controllers/product.controller";
import type { CustomerController } from "../controllers/customer.controller";
import type { QuotationController } from "../controllers/quotation.controller";
import type { InvoiceController } from "../controllers/invoice.controller";
import type { PaymentController } from "../controllers/payment.controller";
import type { ReportController } from "../controllers/report.controller";
import type { ExportController } from "../controllers/export.controller";
import type { AuditController } from "../controllers/audit.controller";
import type { PublicController } from "../controllers/public.controller";
import type { ReviewController } from "../controllers/review.controller";

/** REST API surface (architecture.md §24). Base path: /api/v1 */
export function buildRouter(): Router {
  const router = Router();

  const auth = container.resolve<AuthController>("authController");
  const users = container.resolve<UserController>("userController");
  const company = container.resolve<CompanyController>("companyController");
  const masters = container.resolve<MasterDataController>("masterDataController");
  const products = container.resolve<ProductController>("productController");
  const customers = container.resolve<CustomerController>("customerController");
  const quotations = container.resolve<QuotationController>("quotationController");
  const invoices = container.resolve<InvoiceController>("invoiceController");
  const payments = container.resolve<PaymentController>("paymentController");
  const reports = container.resolve<ReportController>("reportController");
  const exports_ = container.resolve<ExportController>("exportController");
  const audit = container.resolve<AuditController>("auditController");
  const publicApi = container.resolve<PublicController>("publicController");
  const reviews = container.resolve<ReviewController>("reviewController");

  router.get("/health", (_req, res) => res.json({ status: "success", data: { ok: true, time: new Date().toISOString() } }));

  // ------------------------------------------------------------------ public
  const pub = Router();
  pub.use(publicRateLimiter);
  pub.get("/products", validate({ query: s.publicProductQuery }), asyncHandler(publicApi.products));
  pub.get("/products/:slug", validate({ params: s.slugParam }), asyncHandler(publicApi.product));
  pub.get("/categories", asyncHandler(publicApi.categories));
  pub.get("/company", asyncHandler(publicApi.company));
  pub.get("/reviews", asyncHandler(reviews.publicList));
  pub.post("/enquiries", enquiryRateLimiter, validate(s.enquirySchema), asyncHandler(publicApi.enquiry));
  router.use("/public", pub);

  // ------------------------------------------------------------------ auth
  router.post("/auth/login", loginRateLimiter, validate(s.loginSchema), asyncHandler(auth.login));
  router.post("/auth/refresh", validate(s.refreshSchema), asyncHandler(auth.refresh));
  router.post("/auth/logout", asyncHandler(auth.logout));
  router.get("/auth/me", authenticate, asyncHandler(auth.me));
  router.post(
    "/auth/change-password",
    authenticate,
    validate(s.changePasswordSchema),
    asyncHandler(auth.changePassword),
  );

  // Everything below requires a signed-in user.
  router.use(authenticate);

  // ------------------------------------------------------------------ dashboard
  router.get("/dashboard", requirePermission("dashboard:read"), asyncHandler(reports.dashboard));

  // ------------------------------------------------------------------ company
  router.get("/company", requirePermission("dashboard:read"), asyncHandler(company.get));
  router.put("/company", requirePermission("company:manage"), validate(s.companySchema), asyncHandler(company.save));
  router.post("/company/logo", requirePermission("company:manage"), asyncHandler(company.setLogo));

  // ------------------------------------------------------------------ users
  router.get("/users", requirePermission("users:manage"), asyncHandler(users.list));
  router.post("/users", requirePermission("users:manage"), validate(s.createUserSchema), asyncHandler(users.create));
  router.get("/users/:id", requirePermission("users:manage"), validate({ params: s.idParam }), asyncHandler(users.get));
  router.put(
    "/users/:id",
    requirePermission("users:manage"),
    validate({ params: s.idParam, body: s.updateUserSchema }),
    asyncHandler(users.update),
  );
  router.post(
    "/users/:id/reset-password",
    requirePermission("users:manage"),
    validate({ params: s.idParam, body: s.resetPasswordSchema }),
    asyncHandler(users.resetPassword),
  );

  // ------------------------------------------------------------------ master data
  router.get("/categories", requirePermission("products:read"), asyncHandler(masters.listCategories));
  router.post("/categories", requirePermission("products:write"), validate(s.categorySchema), asyncHandler(masters.createCategory));
  router.put(
    "/categories/:id",
    requirePermission("products:write"),
    validate({ params: s.idParam, body: s.categorySchema.partial() }),
    asyncHandler(masters.updateCategory),
  );
  router.delete("/categories/:id", requirePermission("products:write"), validate({ params: s.idParam }), asyncHandler(masters.deleteCategory));

  router.get("/units", requirePermission("products:read"), asyncHandler(masters.listUnits));
  router.post("/units", requirePermission("products:write"), validate(s.unitSchema), asyncHandler(masters.createUnit));
  router.put(
    "/units/:id",
    requirePermission("products:write"),
    validate({ params: s.idParam, body: s.unitSchema.partial() }),
    asyncHandler(masters.updateUnit),
  );

  router.get("/gst-rates", requirePermission("products:read"), asyncHandler(masters.listGstRates));
  router.post("/gst-rates", requirePermission("products:write"), validate(s.gstRateSchema), asyncHandler(masters.createGstRate));

  // ------------------------------------------------------------------ products
  router.get("/products", requirePermission("products:read"), validate({ query: s.productQuery }), asyncHandler(products.list));
  router.post("/products", requirePermission("products:write"), validate(s.productSchema), asyncHandler(products.create));
  router.get("/products/:id", requirePermission("products:read"), validate({ params: s.idParam }), asyncHandler(products.get));
  router.put(
    "/products/:id",
    requirePermission("products:write"),
    validate({ params: s.idParam, body: s.productSchema.partial() }),
    asyncHandler(products.update),
  );
  router.patch(
    "/products/:id/status",
    requirePermission("products:write"),
    validate({ params: s.idParam, body: s.statusSchema }),
    asyncHandler(products.setStatus),
  );
  router.delete("/products/:id", requirePermission("products:write"), validate({ params: s.idParam }), asyncHandler(products.remove));

  // ------------------------------------------------------------------ customers
  router.get("/customers", requirePermission("customers:read"), validate({ query: s.customerQuery }), asyncHandler(customers.list));
  router.post("/customers", requirePermission("customers:write"), validate(s.customerSchema), asyncHandler(customers.create));
  router.get("/customers/:id", requirePermission("customers:read"), validate({ params: s.idParam }), asyncHandler(customers.get));
  router.put(
    "/customers/:id",
    requirePermission("customers:write"),
    validate({ params: s.idParam, body: s.customerSchema.partial() }),
    asyncHandler(customers.update),
  );
  router.delete("/customers/:id", requirePermission("customers:write"), validate({ params: s.idParam }), asyncHandler(customers.remove));
  router.get("/customers/:id/quotations", requirePermission("quotations:read"), validate({ params: s.idParam }), asyncHandler(customers.quotations));
  router.get("/customers/:id/invoices", requirePermission("invoices:read"), validate({ params: s.idParam }), asyncHandler(customers.invoices));
  router.get("/customers/:id/payments", requirePermission("payments:read"), validate({ params: s.idParam }), asyncHandler(customers.payments));
  router.get("/customers/:id/ledger", requirePermission("reports:read"), validate({ params: s.idParam }), asyncHandler(customers.ledger));

  // ------------------------------------------------------------------ quotations
  router.get("/quotations", requirePermission("quotations:read"), validate({ query: s.quotationQuery }), asyncHandler(quotations.list));
  router.post("/quotations", requirePermission("quotations:write"), validate(s.quotationSchema), asyncHandler(quotations.create));
  router.get("/quotations/:id", requirePermission("quotations:read"), validate({ params: s.idParam }), asyncHandler(quotations.get));
  router.put(
    "/quotations/:id",
    requirePermission("quotations:write"),
    validate({ params: s.idParam, body: s.quotationSchema }),
    asyncHandler(quotations.update),
  );
  router.delete("/quotations/:id", requirePermission("quotations:write"), validate({ params: s.idParam }), asyncHandler(quotations.remove));
  router.post("/quotations/:id/send", requirePermission("quotations:write"), validate({ params: s.idParam }), asyncHandler(quotations.send));
  router.post("/quotations/:id/accept", requirePermission("quotations:write"), validate({ params: s.idParam }), asyncHandler(quotations.accept));
  router.post("/quotations/:id/reject", requirePermission("quotations:write"), validate({ params: s.idParam }), asyncHandler(quotations.reject));
  router.post("/quotations/:id/cancel", requirePermission("quotations:write"), validate({ params: s.idParam }), asyncHandler(quotations.cancel));
  router.post("/quotations/:id/duplicate", requirePermission("quotations:write"), validate({ params: s.idParam }), asyncHandler(quotations.duplicate));
  router.post(
    "/quotations/:id/convert-to-invoice",
    requirePermission("invoices:write"),
    validate({ params: s.idParam }),
    asyncHandler(quotations.convertToInvoice),
  );
  router.get("/quotations/:id/pdf", requirePermission("quotations:read"), validate({ params: s.idParam }), asyncHandler(quotations.pdf));

  // ------------------------------------------------------------------ invoices
  router.get("/invoices", requirePermission("invoices:read"), validate({ query: s.invoiceQuery }), asyncHandler(invoices.list));
  router.post("/invoices", requirePermission("invoices:write"), validate(s.invoiceSchema), asyncHandler(invoices.create));
  router.get("/invoices/:id", requirePermission("invoices:read"), validate({ params: s.idParam }), asyncHandler(invoices.get));
  router.put(
    "/invoices/:id",
    requirePermission("invoices:write"),
    validate({ params: s.idParam, body: s.invoiceSchema }),
    asyncHandler(invoices.update),
  );
  router.delete("/invoices/:id", requirePermission("invoices:write"), validate({ params: s.idParam }), asyncHandler(invoices.remove));
  router.post("/invoices/:id/finalize", requirePermission("invoices:write"), validate({ params: s.idParam }), asyncHandler(invoices.finalize));
  router.post(
    "/invoices/:id/cancel",
    requirePermission("invoices:write"),
    validate({ params: s.idParam, body: s.cancelInvoiceSchema }),
    asyncHandler(invoices.cancel),
  );
  router.get("/invoices/:id/payments", requirePermission("payments:read"), validate({ params: s.idParam }), asyncHandler(invoices.payments));
  router.get("/invoices/:id/pdf", requirePermission("invoices:read"), validate({ params: s.idParam }), asyncHandler(invoices.pdf));

  // ------------------------------------------------------------------ payments
  router.get("/payments", requirePermission("payments:read"), validate({ query: s.paymentQuery }), asyncHandler(payments.list));
  router.post("/payments", requirePermission("payments:write"), validate(s.paymentSchema), asyncHandler(payments.create));
  router.get("/payments/:id", requirePermission("payments:read"), validate({ params: s.idParam }), asyncHandler(payments.get));
  router.put(
    "/payments/:id",
    requirePermission("payments:write"),
    validate({ params: s.idParam, body: s.updatePaymentSchema }),
    asyncHandler(payments.update),
  );
  router.delete("/payments/:id", requirePermission("payments:write"), validate({ params: s.idParam }), asyncHandler(payments.remove));

  // ------------------------------------------------------------------ reports
  const reportGuard = [requirePermission("reports:read"), validate({ query: s.reportQuery })];
  router.get("/reports/sales", reportGuard, asyncHandler(reports.sales));
  router.get("/reports/quotations", reportGuard, asyncHandler(reports.quotations));
  router.get("/reports/customers", reportGuard, asyncHandler(reports.customers));
  router.get("/reports/payments", reportGuard, asyncHandler(reports.payments));
  router.get("/reports/outstanding", reportGuard, asyncHandler(reports.outstanding));
  router.get("/reports/gst", reportGuard, asyncHandler(reports.gst));
  router.get("/reports/hsn", reportGuard, asyncHandler(reports.hsn));

  // ------------------------------------------------------------------ exports
  const exportGuard = [requirePermission("exports:read"), validate({ query: s.reportQuery })];
  router.get("/exports/sales.xlsx", exportGuard, asyncHandler(exports_.sales));
  router.get("/exports/gst.xlsx", exportGuard, asyncHandler(exports_.gst));
  router.get("/exports/hsn.xlsx", exportGuard, asyncHandler(exports_.hsn));
  router.get("/exports/customer-ledger.xlsx", exportGuard, asyncHandler(exports_.customerLedger));

  // ------------------------------------------------------------------ reviews
  router.get("/reviews", requirePermission("company:manage"), validate({ query: s.reviewQuery }), asyncHandler(reviews.list));
  router.post("/reviews", requirePermission("company:manage"), validate(s.reviewSchema), asyncHandler(reviews.create));
  router.put(
    "/reviews/:id",
    requirePermission("company:manage"),
    validate({ params: s.idParam, body: s.reviewSchema.partial() }),
    asyncHandler(reviews.update),
  );
  router.delete("/reviews/:id", requirePermission("company:manage"), validate({ params: s.idParam }), asyncHandler(reviews.remove));
  router.get("/reviews-sync/status", requirePermission("company:manage"), asyncHandler(reviews.syncStatus));
  router.post("/reviews-sync/google", requirePermission("company:manage"), asyncHandler(reviews.syncGoogle));

  // ------------------------------------------------------------------ audit
  router.get("/audit-logs", requirePermission("audit:read"), validate({ query: s.auditQuery }), asyncHandler(audit.list));

  return router;
}
