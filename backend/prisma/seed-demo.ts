/**
 * Optional sample data, for trying the system out and for the smoke tests.
 *
 * This is invented: the product names are plausible for the trade but every
 * price is made up, and the customers are fictional. It is deliberately kept out
 * of the main seed so a real deployment never starts holding invented prices
 * that somebody could bill by accident.
 *
 *   npm run seed          real setup: company, admin, units, categories, GST rates
 *   npm run seed:demo     adds this sample catalogue on top
 *   npm run db:clean-demo strips all trading data back out again
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

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
  console.log("Seeding sample data…");

  const company = await prisma.companySettings.findFirst();
  if (!company) {
    console.error("Run `npm run seed` first — the company settings must exist.");
    process.exit(1);
  }

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

  console.log("Sample data ready. Remove it later with: npm run db:clean-demo");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
