-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'BILLING_USER', 'REPORT_USER') NOT NULL DEFAULT 'BILLING_USER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_tokenHash_key`(`tokenHash`),
    INDEX `refresh_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_settings` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `tradeName` VARCHAR(191) NULL,
    `legalName` VARCHAR(191) NULL,
    `gstin` VARCHAR(191) NULL,
    `pan` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `stateCode` VARCHAR(191) NOT NULL,
    `pincode` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `alternatePhone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `website` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `googleMapsUrl` VARCHAR(191) NULL,
    `justdialUrl` VARCHAR(191) NULL,
    `googlePlaceId` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `bankAccountName` VARCHAR(191) NULL,
    `bankAccountNumber` VARCHAR(191) NULL,
    `bankIfsc` VARCHAR(191) NULL,
    `bankBranch` VARCHAR(191) NULL,
    `upiId` VARCHAR(191) NULL,
    `quotationPrefix` VARCHAR(191) NOT NULL DEFAULT 'SVA/QT',
    `invoicePrefix` VARCHAR(191) NOT NULL DEFAULT 'SVA',
    `financialYearFormat` VARCHAR(191) NOT NULL DEFAULT 'YYYY-YY',
    `defaultPaymentTerms` VARCHAR(191) NOT NULL DEFAULT 'Net 15 days',
    `defaultQuotationValidityDays` INTEGER NOT NULL DEFAULT 15,
    `defaultInvoiceNotes` TEXT NULL,
    `termsAndConditions` TEXT NULL,
    `roundingMode` ENUM('NONE', 'NEAREST_RUPEE') NOT NULL DEFAULT 'NEAREST_RUPEE',
    `allowZeroValueBilling` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `zoneCode` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_name_key`(`name`),
    UNIQUE INDEX `categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `units_name_key`(`name`),
    UNIQUE INDEX `units_shortName_key`(`shortName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gst_rates` (
    `id` VARCHAR(191) NOT NULL,
    `rate` DECIMAL(5, 2) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `gst_rates_rate_key`(`rate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(191) NOT NULL,
    `productCode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `dilutionRatio` VARCHAR(191) NULL,
    `packSize` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `hsnCode` VARCHAR(191) NULL,
    `defaultPrice` DECIMAL(14, 4) NOT NULL,
    `defaultGstRate` DECIMAL(5, 2) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `showOnWebsite` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_productCode_key`(`productCode`),
    UNIQUE INDEX `products_slug_key`(`slug`),
    INDEX `products_categoryId_idx`(`categoryId`),
    INDEX `products_unitId_idx`(`unitId`),
    INDEX `products_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `customerType` ENUM('INDIVIDUAL', 'COMPANY', 'SCHOOL', 'COLLEGE', 'GOVERNMENT', 'INSTITUTION', 'OTHER') NOT NULL DEFAULT 'INDIVIDUAL',
    `name` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `alternatePhone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `gstin` VARCHAR(191) NULL,
    `pan` VARCHAR(191) NULL,
    `state` VARCHAR(191) NOT NULL,
    `stateCode` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customers_name_idx`(`name`),
    INDEX `customers_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_addresses` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `addressType` ENUM('BILLING', 'SHIPPING') NOT NULL,
    `line1` VARCHAR(191) NOT NULL,
    `line2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `stateCode` VARCHAR(191) NOT NULL,
    `pincode` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customer_addresses_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotations` (
    `id` VARCHAR(191) NOT NULL,
    `quotationNumber` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `quotationDate` DATETIME(3) NOT NULL,
    `validUntil` DATETIME(3) NULL,
    `placeOfSupply` VARCHAR(191) NOT NULL,
    `placeOfSupplyStateCode` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `termsAndConditions` TEXT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `discountTotal` DECIMAL(14, 2) NOT NULL,
    `taxableTotal` DECIMAL(14, 2) NOT NULL,
    `cgstTotal` DECIMAL(14, 2) NOT NULL,
    `sgstTotal` DECIMAL(14, 2) NOT NULL,
    `igstTotal` DECIMAL(14, 2) NOT NULL,
    `roundOff` DECIMAL(14, 2) NOT NULL,
    `grandTotal` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `sentAt` DATETIME(3) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quotations_quotationNumber_key`(`quotationNumber`),
    INDEX `quotations_customerId_idx`(`customerId`),
    INDEX `quotations_createdById_idx`(`createdById`),
    INDEX `quotations_status_idx`(`status`),
    INDEX `quotations_quotationDate_idx`(`quotationDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_items` (
    `id` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `lineNumber` INTEGER NOT NULL,
    `productNameSnapshot` VARCHAR(191) NOT NULL,
    `productCodeSnapshot` VARCHAR(191) NULL,
    `hsnCodeSnapshot` VARCHAR(191) NULL,
    `unitSnapshot` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `unitPrice` DECIMAL(14, 4) NOT NULL,
    `masterPriceSnapshot` DECIMAL(14, 4) NULL,
    `discountType` ENUM('NONE', 'PERCENTAGE', 'FIXED') NOT NULL DEFAULT 'NONE',
    `discountValue` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `lineDiscount` DECIMAL(14, 2) NOT NULL,
    `grossValue` DECIMAL(14, 2) NOT NULL,
    `lineTaxableValue` DECIMAL(14, 2) NOT NULL,
    `gstRate` DECIMAL(5, 2) NOT NULL,
    `cgstRate` DECIMAL(5, 2) NOT NULL,
    `cgstAmount` DECIMAL(14, 2) NOT NULL,
    `sgstRate` DECIMAL(5, 2) NOT NULL,
    `sgstAmount` DECIMAL(14, 2) NOT NULL,
    `igstRate` DECIMAL(5, 2) NOT NULL,
    `igstAmount` DECIMAL(14, 2) NOT NULL,
    `lineTotal` DECIMAL(14, 2) NOT NULL,

    INDEX `quotation_items_quotationId_idx`(`quotationId`),
    INDEX `quotation_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NULL,
    `invoiceDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `placeOfSupply` VARCHAR(191) NOT NULL,
    `placeOfSupplyStateCode` VARCHAR(191) NOT NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `termsAndConditions` TEXT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `discountTotal` DECIMAL(14, 2) NOT NULL,
    `taxableTotal` DECIMAL(14, 2) NOT NULL,
    `cgstTotal` DECIMAL(14, 2) NOT NULL,
    `sgstTotal` DECIMAL(14, 2) NOT NULL,
    `igstTotal` DECIMAL(14, 2) NOT NULL,
    `roundOff` DECIMAL(14, 2) NOT NULL,
    `grandTotal` DECIMAL(14, 2) NOT NULL,
    `amountPaid` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `balanceDue` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('DRAFT', 'READY_TO_ISSUE', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `issuedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancellationReason` TEXT NULL,
    `customerNameSnapshot` VARCHAR(191) NULL,
    `customerGstinSnapshot` VARCHAR(191) NULL,
    `customerAddressSnapshot` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_invoiceNumber_key`(`invoiceNumber`),
    UNIQUE INDEX `invoices_quotationId_key`(`quotationId`),
    INDEX `invoices_customerId_idx`(`customerId`),
    INDEX `invoices_createdById_idx`(`createdById`),
    INDEX `invoices_status_idx`(`status`),
    INDEX `invoices_invoiceDate_idx`(`invoiceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `lineNumber` INTEGER NOT NULL,
    `productNameSnapshot` VARCHAR(191) NOT NULL,
    `productCodeSnapshot` VARCHAR(191) NULL,
    `hsnCodeSnapshot` VARCHAR(191) NULL,
    `unitSnapshot` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `unitPrice` DECIMAL(14, 4) NOT NULL,
    `masterPriceSnapshot` DECIMAL(14, 4) NULL,
    `discountType` ENUM('NONE', 'PERCENTAGE', 'FIXED') NOT NULL DEFAULT 'NONE',
    `discountValue` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `lineDiscount` DECIMAL(14, 2) NOT NULL,
    `grossValue` DECIMAL(14, 2) NOT NULL,
    `lineTaxableValue` DECIMAL(14, 2) NOT NULL,
    `gstRate` DECIMAL(5, 2) NOT NULL,
    `cgstRate` DECIMAL(5, 2) NOT NULL,
    `cgstAmount` DECIMAL(14, 2) NOT NULL,
    `sgstRate` DECIMAL(5, 2) NOT NULL,
    `sgstAmount` DECIMAL(14, 2) NOT NULL,
    `igstRate` DECIMAL(5, 2) NOT NULL,
    `igstAmount` DECIMAL(14, 2) NOT NULL,
    `lineTotal` DECIMAL(14, 2) NOT NULL,

    INDEX `invoice_items_invoiceId_idx`(`invoiceId`),
    INDEX `invoice_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `paymentMethod` ENUM('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER') NOT NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payments_invoiceId_idx`(`invoiceId`),
    INDEX `payments_createdById_idx`(`createdById`),
    INDEX `payments_paymentDate_idx`(`paymentDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_sequences` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('QUOTATION', 'INVOICE') NOT NULL,
    `financialYear` VARCHAR(16) NOT NULL,
    `prefix` VARCHAR(32) NOT NULL,
    `nextNumber` INTEGER NOT NULL DEFAULT 1,
    `padding` INTEGER NOT NULL DEFAULT 4,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `document_sequences_kind_financialYear_key`(`kind`, `financialYear`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `oldValues` JSON NULL,
    `newValues` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `audit_logs_userId_idx`(`userId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    INDEX `audit_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enquiries` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `organisation` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `message` TEXT NOT NULL,
    `productIds` JSON NULL,
    `isHandled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `enquiries_isHandled_idx`(`isHandled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` VARCHAR(191) NOT NULL,
    `source` ENUM('GOOGLE', 'JUSTDIAL', 'DIRECT') NOT NULL DEFAULT 'DIRECT',
    `authorName` VARCHAR(191) NOT NULL,
    `authorRole` VARCHAR(191) NULL,
    `rating` INTEGER NOT NULL,
    `text` TEXT NOT NULL,
    `reviewDate` DATETIME(3) NOT NULL,
    `sourceUrl` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reviews_externalId_key`(`externalId`),
    INDEX `reviews_isPublished_idx`(`isPublished`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
