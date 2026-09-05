/**
 * Seed data for Sri Vasavi Agencies.
 *
 * Idempotent: every record is upserted on a natural key, so running the seed
 * again after a schema change refreshes the data without duplicating it.
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

interface SeedProduct {
  productCode: string;
  name: string;
  category: string;
  unit: string;
  hsnCode: string;
  defaultPrice: number;
  defaultGstRate: number;
  dilutionRatio?: string;
  packSize?: string;
  description: string;
}

const PRODUCTS: SeedProduct[] = [
  {
    productCode: "SVA-WP-05",
    name: "White Phenyl Concentrate",
    category: "General & Glass",
    unit: "Ltr",
    hsnCode: "3808",
    defaultPrice: 100,
    defaultGstRate: 18,
    dilutionRatio: "1:20",
    packSize: "5 Ltr can",
    description: "Milky white pine-fragrance floor cleaner concentrate for daily corridor and hall mopping.",
  },
  {
    productCode: "SVA-BP-05",
    name: "Black Phenyl",
    category: "Washroom & Sanitary",
    unit: "Ltr",
    hsnCode: "3808",
    defaultPrice: 72,
    defaultGstRate: 18,
    dilutionRatio: "1:15",
    packSize: "5 Ltr can",
    description: "Heavy-duty coal-tar phenyl for drains, outdoor washrooms and waste areas.",
  },
  {
    productCode: "SVA-TBC-05",
    name: "Toilet Bowl Cleaner (HCl 10%)",
    category: "Washroom & Sanitary",
    unit: "Ltr",
    hsnCode: "3402",
    defaultPrice: 62,
    defaultGstRate: 18,
    dilutionRatio: "Use neat",
    packSize: "5 Ltr can",
    description: "Acidic descaler for hard-water stains, scale and rust in WC pans and urinals.",
  },
  {
    productCode: "SVA-GC-05",
    name: "Glass Cleaner",
    category: "General & Glass",
    unit: "Ltr",
    hsnCode: "3402",
    defaultPrice: 85,
    defaultGstRate: 18,
    dilutionRatio: "1:10",
    packSize: "5 Ltr can",
    description: "Ammonia-based streak-free cleaner for glass, mirrors and glazed partitions.",
  },
  {
    productCode: "SVA-DW-05",
    name: "Dishwash Liquid",
    category: "Kitchen & Canteen",
    unit: "Ltr",
    hsnCode: "3402",
    defaultPrice: 78,
    defaultGstRate: 18,
    dilutionRatio: "1:8",
    packSize: "5 Ltr can",
    description: "Lemon dishwash concentrate for canteen and hostel mess utensil washing.",
  },
  {
    productCode: "SVA-HS-05",
    name: "Hand Wash Liquid",
    category: "Kitchen & Canteen",
    unit: "Ltr",
    hsnCode: "3401",
    defaultPrice: 95,
    defaultGstRate: 18,
    dilutionRatio: "Use neat",
    packSize: "5 Ltr can",
    description: "pH-balanced hand wash for washroom dispensers in schools and offices.",
  },
  {
    productCode: "SVA-DIS-05",
    name: "Surface Disinfectant (Quat)",
    category: "Clinical & Infectious",
    unit: "Ltr",
    hsnCode: "3808",
    defaultPrice: 145,
    defaultGstRate: 18,
    dilutionRatio: "1:40",
    packSize: "5 Ltr can",
    description: "Quaternary ammonium disinfectant for sick bays, clinics and high-touch surfaces.",
  },
  {
    productCode: "SVA-BLE-05",
    name: "Sodium Hypochlorite 4%",
    category: "Clinical & Infectious",
    unit: "Ltr",
    hsnCode: "2828",
    defaultPrice: 48,
    defaultGstRate: 18,
    dilutionRatio: "1:10",
    packSize: "5 Ltr can",
    description: "Bleach solution for spill response, drain sanitising and water-tank cleaning.",
  },
  {
    productCode: "SVA-MOP-KIT",
    name: "Kentucky Mop with Handle",
    category: "Housekeeping Materials",
    unit: "Set",
    hsnCode: "9603",
    defaultPrice: 320,
    defaultGstRate: 18,
    packSize: "1 mop + 1 handle",
    description: "400 g cotton Kentucky mop head with aluminium handle and clamp.",
  },
  {
    productCode: "SVA-BRM-SF",
    name: "Soft Broom (Phool Jhadu)",
    category: "Housekeeping Materials",
    unit: "Nos",
    hsnCode: "9603",
    defaultPrice: 95,
    defaultGstRate: 12,
    description: "Long-bristle soft broom for indoor sweeping of classrooms and offices.",
  },
  {
    productCode: "SVA-WIP-45",
    name: "Floor Wiper 45 cm",
    category: "Housekeeping Materials",
    unit: "Nos",
    hsnCode: "9603",
    defaultPrice: 210,
    defaultGstRate: 18,
    description: "45 cm double-blade rubber wiper with steel handle for washroom floors.",
  },
  {
    productCode: "SVA-GLV-NIT",
    name: "Nitrile Hand Gloves",
    category: "Housekeeping Materials",
    unit: "Pkt",
    hsnCode: "4015",
    defaultPrice: 480,
    defaultGstRate: 18,
    packSize: "Box of 100",
    description: "Powder-free nitrile gloves for chemical handling and cleaning staff.",
  },
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

  // ---------------------------------------------------------------- products
  const units = new Map((await prisma.unit.findMany()).map((u) => [u.shortName, u.id]));
  const categories = new Map((await prisma.category.findMany()).map((c) => [c.name, c.id]));

  for (const product of PRODUCTS) {
    const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const data = {
      productCode: product.productCode,
      name: product.name,
      slug,
      description: product.description,
      dilutionRatio: product.dilutionRatio ?? null,
      packSize: product.packSize ?? null,
      hsnCode: product.hsnCode,
      defaultPrice: new Prisma.Decimal(product.defaultPrice),
      defaultGstRate: new Prisma.Decimal(product.defaultGstRate),
      unitId: units.get(product.unit)!,
      categoryId: categories.get(product.category)!,
    };
    await prisma.product.upsert({ where: { productCode: product.productCode }, update: data, create: data });
  }
  console.log(`  products: ${PRODUCTS.length}`);

  // ---------------------------------------------------------------- sample customers
  const sampleCustomers = [
    {
      customerType: "COLLEGE" as const,
      name: "Takshashila University",
      companyName: "Takshashila University",
      contactPerson: "Facilities Manager",
      phone: "+91 90000 11111",
      email: "facilities@takshashilauniv.ac.in",
      gstin: "33AAACT1234C1ZP",
      notes: "Tamil Nadu — inter-state from Puducherry, so IGST applies.",
      state: "Tamil Nadu",
      stateCode: "33",
      addresses: {
        create: [
          {
            addressType: "BILLING" as const,
            line1: "Takshashila University Campus",
            line2: "Ulundurpet Road",
            city: "Villupuram",
            state: "Tamil Nadu",
            stateCode: "33",
            pincode: "605401",
            isDefault: true,
          },
        ],
      },
    },
    {
      customerType: "COMPANY" as const,
      name: "Sundar Facility Services",
      companyName: "Sundar Facility Services Pvt Ltd",
      contactPerson: "R. Sundar",
      phone: "+91 90000 22222",
      gstin: "29AAGCS1234D1Z8",
      state: "Karnataka",
      stateCode: "29",
      notes: "Karnataka — inter-state, IGST applies.",
      addresses: {
        create: [
          {
            addressType: "BILLING" as const,
            line1: "48, Industrial Layout",
            city: "Bengaluru",
            state: "Karnataka",
            stateCode: "29",
            pincode: "560058",
            isDefault: true,
          },
        ],
      },
    },
    {
      customerType: "INDIVIDUAL" as const,
      name: "Meena Ravi",
      phone: "+91 90000 33333",
      state: "Puducherry",
      stateCode: "34",
    },
  ];

  for (const customer of sampleCustomers) {
    const existing = await prisma.customer.findFirst({ where: { name: customer.name } });
    if (!existing) await prisma.customer.create({ data: customer });
  }
  console.log(`  sample customers: ${sampleCustomers.length}`);

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
