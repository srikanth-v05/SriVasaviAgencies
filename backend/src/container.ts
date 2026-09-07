/**
 * Dependency-injection container (nodejs-backend-patterns: "DI Container").
 *
 * Construction is centralised here so every class stays free of `new` calls for
 * its own collaborators, which is what makes them substitutable in tests.
 */

import { prisma } from "./db/prisma";

import { UserRepository } from "./repositories/user.repository";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { CompanyRepository } from "./repositories/company.repository";
import { MasterDataRepository } from "./repositories/master-data.repository";
import { ProductRepository } from "./repositories/product.repository";
import { CustomerRepository } from "./repositories/customer.repository";
import { QuotationRepository } from "./repositories/quotation.repository";
import { InvoiceRepository } from "./repositories/invoice.repository";
import { PaymentRepository } from "./repositories/payment.repository";
import { AuditRepository } from "./repositories/audit.repository";
import { ReportRepository } from "./repositories/report.repository";
import { EnquiryRepository } from "./repositories/enquiry.repository";
import { ReviewRepository } from "./repositories/review.repository";

import { AuditService } from "./services/audit.service";
import { AuthService } from "./services/auth.service";
import { UserService } from "./services/user.service";
import { CompanyService } from "./services/company.service";
import { MasterDataService } from "./services/master-data.service";
import { ProductService } from "./services/product.service";
import { CatalogCacheService } from "./services/catalog-cache.service";
import { CustomerService } from "./services/customer.service";
import { DocumentPricingService } from "./services/document-pricing.service";
import { NumberingService } from "./services/numbering.service";
import { QuotationService } from "./services/quotation.service";
import { InvoiceService } from "./services/invoice.service";
import { PaymentService } from "./services/payment.service";
import { ReportService } from "./services/report.service";
import { DashboardService } from "./services/dashboard.service";
import { PdfService } from "./services/pdf.service";
import { ExcelService } from "./services/excel.service";
import { EnquiryService } from "./services/enquiry.service";
import { ReviewService } from "./services/review.service";

import { AuthController } from "./controllers/auth.controller";
import { UserController } from "./controllers/user.controller";
import { CompanyController } from "./controllers/company.controller";
import { MasterDataController } from "./controllers/master-data.controller";
import { ProductController } from "./controllers/product.controller";
import { CustomerController } from "./controllers/customer.controller";
import { QuotationController } from "./controllers/quotation.controller";
import { InvoiceController } from "./controllers/invoice.controller";
import { PaymentController } from "./controllers/payment.controller";
import { ReportController } from "./controllers/report.controller";
import { ExportController } from "./controllers/export.controller";
import { AuditController } from "./controllers/audit.controller";
import { PublicController } from "./controllers/public.controller";
import { ReviewController } from "./controllers/review.controller";

class Container {
  private factories = new Map<string, () => unknown>();

  register<T>(key: string, factory: () => T): void {
    this.factories.set(key, factory);
  }

  singleton<T>(key: string, factory: () => T): void {
    let instance: T | undefined;
    this.factories.set(key, () => {
      if (instance === undefined) instance = factory();
      return instance;
    });
  }

  resolve<T>(key: string): T {
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`No factory registered for ${key}`);
    return factory() as T;
  }
}

export const container = new Container();

// --------------------------------------------------------------------------- data

container.singleton("db", () => prisma);

// --------------------------------------------------------------------------- repositories

container.singleton("userRepository", () => new UserRepository(prisma));
container.singleton("refreshTokenRepository", () => new RefreshTokenRepository(prisma));
container.singleton("companyRepository", () => new CompanyRepository(prisma));
container.singleton("masterDataRepository", () => new MasterDataRepository(prisma));
container.singleton("productRepository", () => new ProductRepository(prisma));
container.singleton("customerRepository", () => new CustomerRepository(prisma));
container.singleton("quotationRepository", () => new QuotationRepository(prisma));
container.singleton("invoiceRepository", () => new InvoiceRepository(prisma));
container.singleton("paymentRepository", () => new PaymentRepository(prisma));
container.singleton("auditRepository", () => new AuditRepository(prisma));
container.singleton("reportRepository", () => new ReportRepository(prisma));
container.singleton("enquiryRepository", () => new EnquiryRepository(prisma));
container.singleton("reviewRepository", () => new ReviewRepository(prisma));

// --------------------------------------------------------------------------- services

container.singleton("auditService", () => new AuditService(container.resolve("auditRepository")));

container.singleton(
  "authService",
  () =>
    new AuthService(
      container.resolve("userRepository"),
      container.resolve("refreshTokenRepository"),
      container.resolve("auditService"),
    ),
);

container.singleton(
  "userService",
  () =>
    new UserService(
      container.resolve("userRepository"),
      container.resolve("refreshTokenRepository"),
      container.resolve("auditService"),
    ),
);

container.singleton(
  "companyService",
  () => new CompanyService(container.resolve("companyRepository"), container.resolve("auditService")),
);

container.singleton(
  "catalogCacheService",
  () => new CatalogCacheService(container.resolve("productRepository"), container.resolve("masterDataRepository")),
);

container.singleton(
  "masterDataService",
  () => new MasterDataService(container.resolve("masterDataRepository"), container.resolve("catalogCacheService")),
);

container.singleton(
  "productService",
  () =>
    new ProductService(
      container.resolve("productRepository"),
      container.resolve("masterDataRepository"),
      container.resolve("auditService"),
      container.resolve("catalogCacheService"),
    ),
);

container.singleton(
  "customerService",
  () =>
    new CustomerService(
      container.resolve("customerRepository"),
      container.resolve("quotationRepository"),
      container.resolve("invoiceRepository"),
      container.resolve("paymentRepository"),
      container.resolve("auditService"),
    ),
);

container.singleton("numberingService", () => new NumberingService());
container.singleton(
  "documentPricingService",
  () =>
    new DocumentPricingService(
      container.resolve("productRepository"),
      container.resolve("productService"),
      container.resolve("masterDataRepository"),
    ),
);

container.singleton(
  "quotationService",
  () =>
    new QuotationService(
      container.resolve("quotationRepository"),
      container.resolve("customerRepository"),
      container.resolve("documentPricingService"),
      container.resolve("numberingService"),
      container.resolve("companyService"),
      container.resolve("auditService"),
    ),
);

container.singleton(
  "invoiceService",
  () =>
    new InvoiceService(
      container.resolve("invoiceRepository"),
      container.resolve("quotationRepository"),
      container.resolve("customerRepository"),
      container.resolve("paymentRepository"),
      container.resolve("documentPricingService"),
      container.resolve("numberingService"),
      container.resolve("companyService"),
      container.resolve("auditService"),
    ),
);

container.singleton(
  "paymentService",
  () =>
    new PaymentService(
      container.resolve("paymentRepository"),
      container.resolve("invoiceRepository"),
      container.resolve("invoiceService"),
      container.resolve("auditService"),
    ),
);

container.singleton(
  "reportService",
  () => new ReportService(container.resolve("reportRepository"), container.resolve("customerRepository")),
);

container.singleton(
  "dashboardService",
  () =>
    new DashboardService(
      container.resolve("invoiceRepository"),
      container.resolve("quotationRepository"),
      container.resolve("paymentRepository"),
      container.resolve("customerRepository"),
      container.resolve("reportRepository"),
    ),
);

container.singleton("pdfService", () => new PdfService());

container.singleton(
  "excelService",
  () =>
    new ExcelService(
      container.resolve("reportRepository"),
      container.resolve("reportService"),
      container.resolve("customerService"),
      container.resolve("auditService"),
    ),
);

container.singleton("enquiryService", () => new EnquiryService(container.resolve("enquiryRepository")));

container.singleton(
  "reviewService",
  () =>
    new ReviewService(
      container.resolve("reviewRepository"),
      container.resolve("companyService"),
      container.resolve("auditService"),
    ),
);

// --------------------------------------------------------------------------- controllers

container.singleton("authController", () => new AuthController(container.resolve("authService")));
container.singleton("userController", () => new UserController(container.resolve("userService")));
container.singleton("companyController", () => new CompanyController(container.resolve("companyService")));
container.singleton("masterDataController", () => new MasterDataController(container.resolve("masterDataService")));
container.singleton("productController", () => new ProductController(container.resolve("productService")));
container.singleton("customerController", () => new CustomerController(container.resolve("customerService")));

container.singleton(
  "quotationController",
  () =>
    new QuotationController(
      container.resolve("quotationService"),
      container.resolve("invoiceService"),
      container.resolve("pdfService"),
      container.resolve("companyService"),
    ),
);

container.singleton(
  "invoiceController",
  () =>
    new InvoiceController(
      container.resolve("invoiceService"),
      container.resolve("pdfService"),
      container.resolve("companyService"),
    ),
);

container.singleton("paymentController", () => new PaymentController(container.resolve("paymentService")));

container.singleton(
  "reportController",
  () => new ReportController(container.resolve("reportService"), container.resolve("dashboardService")),
);

container.singleton("exportController", () => new ExportController(container.resolve("excelService")));
container.singleton("auditController", () => new AuditController(container.resolve("auditService")));
container.singleton("reviewController", () => new ReviewController(container.resolve("reviewService")));

container.singleton(
  "publicController",
  () =>
    new PublicController(
      container.resolve("catalogCacheService"),
      container.resolve("companyService"),
      container.resolve("enquiryService"),
    ),
);
