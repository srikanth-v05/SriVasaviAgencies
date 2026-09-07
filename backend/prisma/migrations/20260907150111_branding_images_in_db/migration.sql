-- AlterTable
ALTER TABLE `company_settings` ADD COLUMN `logoImage` LONGBLOB NULL,
    ADD COLUMN `logoImageType` VARCHAR(191) NULL,
    ADD COLUMN `sealImage` LONGBLOB NULL,
    ADD COLUMN `sealImageType` VARCHAR(191) NULL,
    ADD COLUMN `signatureImage` LONGBLOB NULL,
    ADD COLUMN `signatureImageType` VARCHAR(191) NULL;
