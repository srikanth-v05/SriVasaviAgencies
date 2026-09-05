/**
 * Seed for Sri Vasavi Agencies.
 *
 * Sets up only what the system needs before anyone can trade: the company
 * details, an administrator, and the structural masters (units, categories and
 * GST rates). No sample products or customers — those are real business records
 * and belong to the office, not to a script.
 *
 * Idempotent: every record is upserted on a natural key, and re-running never
 * overwrites an uploaded seal or signature.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "vijaychemicals05@gmail.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeThisPassword123";

/** Housekeeping colour-zone coding — the vocabulary the trade actually uses. */
const CATEGORIES = [
  { name: "Washroom & Sanitary", zoneCode: "red", sortOrder: 1, description: "Toilets, urinals, washroom floors and fittings." },
  { name: "General & Glass", zoneCode: "blue", sortOrder: 2, description: "Offices, corridors, glass, low-risk general surfaces." },
  { name: "Kitchen & Canteen", zoneCode: "green", sortOrder: 3, description: "Food preparation areas, canteens, dishwash." },
  { name: "Clinical & Infectious", zoneCode: "yellow", sortOrder: 4, description: "Sick bays, clinics, isolation and spill response." },
  { name: "Housekeeping Materials", zoneCode: null, sortOrder: 5, description: "Mops, brooms, wipers, gloves, dusters and tools." },
];

const UNITS = [
  { name: "Litre", shortName: "Ltr" },
  { name: "Millilitre", shortName: "ml" },
  { name: "Kilogram", shortName: "Kg" },
  { name: "Gram", shortName: "g" },
  { name: "Numbers", shortName: "Nos" },
  { name: "Piece", shortName: "Pc" },
  { name: "Packet", shortName: "Pkt" },
  { name: "Box", shortName: "Box" },
  { name: "Bottle", shortName: "Btl" },
  { name: "Can", shortName: "Can" },
  { name: "Set", shortName: "Set" },
];

const GST_RATES = [
  { rate: 0, label: "Exempt / Nil" },
  { rate: 5, label: "5%" },
  { rate: 12, label: "12%" },
  { rate: 18, label: "18%" },
  { rate: 28, label: "28%" },
];

async function main(): Promise<void> {
  console.log("Seeding Sri Vasavi Agencies…");

  // ---------------------------------------------------------------- company
  const existingCompany = await prisma.companySettings.findFirst();
  const companyData = {
    name: "Sri Vasavi Agencies",
    tradeName: "Sri Vasavi Agencies",
    legalName: "Sri Vasavi Agencies",
    // From the business's own tax invoice. State code 34 = Puducherry, which is
    // what decides CGST+SGST vs IGST on every document.
    gstin: "34AGLPV5711E1ZC",
    // The PAN sits inside the GSTIN at characters 3-12.
    pan: "AGLPV5711E",
    // As printed on the business's own tax invoice.
    addressLine1: "No. 54, West Car Street",
    addressLine2: "Villianur",
    city: "Puducherry",
    // Puducherry is GST state code 34. This decides CGST+SGST vs IGST on every
    // invoice, so it must match the GST registration certificate.
    state: "Puducherry",
    stateCode: "34",
    pincode: "605110",
    phone: "+91 99436 77409",
    alternatePhone: "+91 90928 97386",
    email: "vijaychemicals05@gmail.com",
    website: null,
    logoUrl: "/logo.jpg",
    googleMapsUrl: null,
    justdialUrl: null,
    googlePlaceId: null,
    bankName: "Karur Vysya Bank",
    bankAccountName: "SRI VASAVI AGENCIES",
    bankAccountNumber: "1710135000000481",
    bankIfsc: "KVBL0001710",
    bankBranch: null,
    upiId: null,
    quotationPrefix: "SVA/QT",
    invoicePrefix: "SVA",
    defaultPaymentTerms: "Net 15 days from date of invoice",
    defaultQuotationValidityDays: 15,
    defaultInvoiceNotes: "Goods once sold will not be taken back unless damaged in transit.",
    termsAndConditions: [
      "1. Payment due within the agreed credit period.",
      "2. Interest at 18% p.a. on overdue amounts.",
      "3. Disputes subject to Puducherry jurisdiction.",
    ].join("\n"),
    // Printed above the signature block, as on the paper invoice.
    declaration:
      "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
    // Uploaded from Settings -> Seal & signature; blank leaves room to sign by hand.
    sealUrl: null,
    signatureUrl: null,
    roundingMode: "NEAREST_RUPEE" as const,
    allowZeroValueBilling: false,
  };

  // Re-seeding refreshes the business details but must not destroy anything the
  // office uploaded. The seal and signature are scans that only exist on this
  // server, so on an update they are left exactly as they are.
  const { sealUrl, signatureUrl, ...refreshable } = companyData;

  const company = existingCompany
    ? await prisma.companySettings.update({ where: { id: existingCompany.id }, data: refreshable })
    : await prisma.companySettings.create({ data: { ...refreshable, sealUrl, signatureUrl } });
  console.log(`  company settings: ${company.name} (state code ${company.stateCode})`);

  // ---------------------------------------------------------------- admin user
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: "Administrator",
      role: "SUPER_ADMIN",
      passwordHash: await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    },
  });
  console.log(`  admin user: ${admin.email}`);

  // ---------------------------------------------------------------- masters
  for (const unit of UNITS) {
    await prisma.unit.upsert({ where: { shortName: unit.shortName }, update: {}, create: unit });
  }
  for (const rate of GST_RATES) {
    await prisma.gstRate.upsert({
      where: { rate: new Prisma.Decimal(rate.rate) },
      update: { label: rate.label },
      create: { rate: new Prisma.Decimal(rate.rate), label: rate.label },
    });
  }
  for (const category of CATEGORIES) {
    const slug = category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await prisma.category.upsert({
      where: { slug },
      update: { zoneCode: category.zoneCode, sortOrder: category.sortOrder, description: category.description },
      create: { ...category, slug },
    });
  }
  console.log(`  masters: ${UNITS.length} units, ${GST_RATES.length} GST rates, ${CATEGORIES.length} categories`);

  console.log("\nDone. Sign in with:");
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);
  console.log("Change this password after the first sign-in.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
