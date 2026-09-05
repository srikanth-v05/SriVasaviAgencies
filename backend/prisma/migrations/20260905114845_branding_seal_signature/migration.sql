-- AlterTable
ALTER TABLE `company_settings` ADD COLUMN `declaration` TEXT NULL,
    ADD COLUMN `sealUrl` VARCHAR(191) NULL,
    ADD COLUMN `signatureUrl` VARCHAR(191) NULL;
