/**
 * Remove the sample and test data, leaving a system ready for real trading.
 *
 * What goes:
 *   - every quotation, invoice and payment, with their line items
 *   - every customer and address
 *   - every product (the seeded ones had invented prices)
 *   - enquiries, reviews and the audit trail of all that activity
 *   - the document counters, so the first real invoice is number 0001
 *
 * What stays:
 *   - company settings, including the GSTIN, bank details and any uploaded
 *     seal or signature
 *   - units, categories and GST rates — structural masters, not sample data
 *   - user accounts
 *
 * Safe to run more than once. Refuses to run against a non-empty production
 * database unless CONFIRM_CLEAN_DEMO=yes is set, because it is destructive.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [invoices, quotations, customers, products] = await Promise.all([
    prisma.invoice.count(),
    prisma.quotation.count(),
    prisma.customer.count(),
    prisma.product.count(),
  ]);

  console.log("About to delete:");
  console.log(`  invoices    ${invoices}`);
  console.log(`  quotations  ${quotations}`);
  console.log(`  customers   ${customers}`);
  console.log(`  products    ${products}`);

  // An issued invoice is a tax record. Deleting one is not something to do by
  // accident, so anything that looks like real trading needs an explicit nod.
  const issued = await prisma.invoice.count({ where: { invoiceNumber: { not: null } } });
  if (issued > 0 && process.env.CONFIRM_CLEAN_DEMO !== "yes") {
    console.error(
      `\nRefusing to run: ${issued} issued invoice(s) carry a number and are tax records.\n` +
        "If they really are test data, re-run with CONFIRM_CLEAN_DEMO=yes",
    );
    process.exitCode = 1;
    return;
  }

  // Children before parents — relationMode is "prisma", so the database does not
  // cascade for us.
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.enquiry.deleteMany();
  await prisma.review.deleteMany();

  // The audit trail only recorded the sample activity being created.
  await prisma.auditLog.deleteMany();

  // Reset numbering so the first real document is 0001.
  await prisma.documentSequence.deleteMany();

  const company = await prisma.companySettings.findFirst();
  const users = await prisma.user.count();
  const [units, categories, rates] = await Promise.all([
    prisma.unit.count(),
    prisma.category.count(),
    prisma.gstRate.count(),
  ]);

  console.log("\nDone. Kept:");
  console.log(`  company     ${company?.name ?? "(not configured)"} — GSTIN ${company?.gstin ?? "not set"}`);
  console.log(`  seal        ${company?.sealUrl ?? "none uploaded"}`);
  console.log(`  signature   ${company?.signatureUrl ?? "none uploaded"}`);
  console.log(`  users       ${users}`);
  console.log(`  units       ${units}`);
  console.log(`  categories  ${categories}`);
  console.log(`  GST rates   ${rates}`);
  console.log("\nNumbering reset — the next invoice will be 0001.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
