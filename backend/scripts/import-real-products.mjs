/**
 * One-off import of the office's real product list, transcribed from
 * items_gst_hsn_cleaned.csv (Description / HSN Code / GST % / Rate / Qty Type /
 * Category — "Quantity" was always 1 and isn't a product-master field).
 *
 * HSN codes are stored digit-only (the sheet's "1905 31 00" grouping is just
 * for readability). Product codes are NOT sent — the backend now assigns
 * PRD-0001, PRD-0002, ... automatically.
 *
 * Two rows from the source sheet are handled specially, per the business
 * owner's decision:
 *   - "BIG" (no price, no unit, no HSN, no GST) is a leftover fragment and is
 *     dropped entirely — it carries no product data to create a record from.
 *   - "MOP without stick" had a price but no GST rate; it takes the same
 *     HSN (9603 90 00) and GST (18%) as the near-identical "MOP" row.
 *
 * Usage:
 *   node scripts/import-real-products.mjs                  # local API on :4000
 *   API_BASE=https://sva-api-8nhm.onrender.com/api/v1 \
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... \
 *     node scripts/import-real-products.mjs                # production
 */

const BASE = process.env.API_BASE ?? "http://localhost:4000/api/v1";
const EMAIL = process.env.ADMIN_EMAIL ?? "vijaychemicals05@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeThisPassword123";

/** [name, hsnCode, gstRate, price, unitName, categoryName] */
const ROWS = [
  ["BISCUIT", "19053100", 5, 2.8, "Packet", "Kitchen & Canteen"],
  ["FIRST AID KIT", "30065000", 5, 750, "Box", "Clinical & Infectious"],
  ["WALL MIRRORS", "70099100", 18, 500, "Piece", "General & Glass"],
  ["DETTOL HAND WASH", "34013000", 18, 100, "Bottle", "Washroom & Sanitary"],
  ["VELLAM", "17011310", 0, 75, "Kilogram", "Kitchen & Canteen"],
  ["CURD", "04032000", 0, 80, "Litre", "Kitchen & Canteen"],
  ["HAND WASH ORDINARY", "34013000", 18, 85, "Bottle", "Washroom & Sanitary"],
  ["URINAL CAKE (ODO FRESHNER)", "33074900", 18, 63, "Piece", "Washroom & Sanitary"],
  ["BROOM STICK", "96031000", 0, 90, "Piece", "Housekeeping Materials"],
  ["RIN SOAP", "34011990", 18, 10, "Piece", "Housekeeping Materials"],
  ["PHENYL (WHITE)", "38089400", 18, 30, "Litre", "Housekeeping Materials"],
  ["LIZOL 10 BOTTLE", "38089400", 18, 129, "Bottle", "Housekeeping Materials"],
  ["MUG SMALL", "39249090", 5, 15, "Piece", "Washroom & Sanitary"],
  ["ROOM SPRAY SANDLE BRAND", "33074900", 18, 120, "Can", "Housekeeping Materials"],
  ["URINAL CAKE", "33074900", 18, 50, "Piece", "Washroom & Sanitary"],
  ["ACID FOR CLEANING FLOOR", "38089990", 18, 25, "Litre", "Housekeeping Materials"],
  ["BLEACHING POWDER", "28289000", 18, 50, "Kilogram", "Housekeeping Materials"],
  ["HARPIC", "34025000", 18, 110, "Bottle", "Washroom & Sanitary"],
  ["SABEENA", "34029099", 18, 16, "Piece", "Housekeeping Materials"],
  ["SOAP OIL", "34029099", 18, 30, "Litre", "Housekeeping Materials"],
  ["MOP", "96039000", 18, 100, "Piece", "Housekeeping Materials"],
  ["COCONUT BROOM STICK", "96031000", 0, 30, "Piece", "Housekeeping Materials"],
  ["DISTILLED BATTERY WATER", "28539090", 18, 15, "Litre", "General & Glass"],
  ["TOILET BUCKET (MEDIUM)", "39249090", 5, 80, "Piece", "Washroom & Sanitary"],
  ["MUG", "39249090", 5, 20, "Piece", "Washroom & Sanitary"],
  ["CLASSROOM BUCKET", "39249090", 5, 200, "Piece", "Housekeeping Materials"],
  ["DUST PAN", "39249090", 5, 40, "Piece", "Housekeeping Materials"],
  ["MOP STICK", "96039000", 18, 120, "Piece", "Housekeeping Materials"],
  ["GRASS BROOM", "96031000", 0, 110, "Piece", "Housekeeping Materials"],
  ["DUST BIN (CLOSING MODEL) M SIZE", "39249090", 5, 250, "Piece", "Housekeeping Materials"],
  ["DUST BIN (OPEN TYPE)", "39249090", 5, 80, "Piece", "Housekeeping Materials"],
  ["RUBBER MAT", "40169100", 18, 300, "Piece", "Housekeeping Materials"],
  ["COMFORT", "38099100", 18, 120, "Bottle", "Housekeeping Materials"],
  ["ROOM SPRAY", "33074900", 18, 160, "Can", "Housekeeping Materials"],
  ["DETTOL SMALL", "38089400", 18, 85, "Bottle", "Clinical & Infectious"],
  ["WEB STICK", "96039000", 18, 350, "Piece", "Housekeeping Materials"],
  ["WASHING POWDER", "34025000", 18, 110, "Kilogram", "Housekeeping Materials"],
  ["STICK BRUSH", "96039000", 18, 120, "Piece", "Housekeeping Materials"],
  ["DUST BIN (CLOSING MODEL) L SIZE", "39249090", 5, 325, "Piece", "Housekeeping Materials"],
  ["BUS CLEANING BRUSH", "96039000", 18, 80, "Piece", "Housekeeping Materials"],
  ["DUSTBIN", "39249090", 5, 175, "Piece", "Housekeeping Materials"],
  ["DUSTBIN CLOSED TYPE", "39249090", 5, 175, "Piece", "Housekeeping Materials"],
  ["DUSTBIN BAG GARBAGE BAG BIG", "39232990", 18, 110, "Packet", "Housekeeping Materials"],
  ["PLASTIC BUCKET 20LTS", "39249090", 5, 100, "Piece", "Housekeeping Materials"],
  ["PLASTIC MURAM", "39249090", 5, 30, "Piece", "Housekeeping Materials"],
  ["GODREJ AER MATIC-REFILL PACK", "33074900", 18, 315, "Can", "Housekeeping Materials"],
  ["PHENYL", "38089400", 18, 30, "Litre", "Housekeeping Materials"],
  ["LIZOL", "38089400", 18, 103, "Bottle", "Housekeeping Materials"],
  ["URINAL CAKE [ODO]", "33074900", 18, 63, "Piece", "Washroom & Sanitary"],
  ["DUST BIN BAG[GARABGE BAG]", "39232990", 18, 60, "Packet", "Housekeeping Materials"],
  ["DUST BIN BAG[GARABGE BAG] BIG", "39232990", 18, 110, "Packet", "Housekeeping Materials"],
  // "BIG" (no price/unit/HSN/GST) skipped — leftover fragment, not a real product.
  ["COLIN", "34025000", 18, 120, "Bottle", "General & Glass"],
  ["LYSOL LIQUID", "38089400", 18, 123, "Litre", "Housekeeping Materials"],
  ["PHENYLE", "38089400", 18, 220, "Litre", "Housekeeping Materials"],
  ["ACID", "38089990", 18, 30, "Litre", "Housekeeping Materials"],
  ["HAND GLOVES - HEAVY", "61161000", 18, 250, "Set", "Housekeeping Materials"],
  ['PAINT BRUSH 2"', "96034010", 18, 200, "Piece", "Housekeeping Materials"],
  ["RIN SOAP (BIG)", "34011990", 18, 40, "Piece", "Housekeeping Materials"],
  ["MOP WITH STICK", "96039000", 18, 120, "Piece", "Housekeeping Materials"],
  ["TOILET BRUSH", "96039000", 18, 60, "Piece", "Washroom & Sanitary"],
  ["DOOR MAT - BIG", "57050090", 5, 250, "Piece", "Housekeeping Materials"],
  ["DOOR MAT - SMALL", "57050090", 5, 50, "Piece", "Housekeeping Materials"],
  ["SOFT BROOM", "96039000", 5, 120, "Piece", "Housekeeping Materials"],
  ["SMALL BUCKET", "39249090", 5, 70, "Piece", "Housekeeping Materials"],
  ["BUCKET - BIG SIZE", "39249090", 5, 150, "Piece", "Housekeeping Materials"],
  ["COTTON CLOTH", "63071090", 5, 20, "Piece", "Housekeeping Materials"],
  ["BAMBOO DUST CLEANER STICK - BIG", "96039000", 18, 150, "Piece", "Housekeeping Materials"],
  ["ODONIL", "33074900", 18, 63, "Piece", "Housekeeping Materials"],
  ["DUST BIN", "39249090", 5, 70, "Piece", "Housekeeping Materials"],
  ["DETTOL [500ML]", "38089400", 18, 290, "Bottle", "Clinical & Infectious"],
  ["SOFT BROOMS", "96039000", 5, 110, "Piece", "Housekeeping Materials"],
  ["DOOR CLOTH MAT SMALL", "57050090", 5, 50, "Piece", "Housekeeping Materials"],
  ["CLEANING CLOTH SMALL", "63071090", 5, 20, "Piece", "Housekeeping Materials"],
  ["DUST BIN BIG", "39249090", 5, 700, "Piece", "Housekeeping Materials"],
  ["GREEN SCRUB", "68053000", 18, 10, "Piece", "Kitchen & Canteen"],
  ["BUCKET SMALL", "39249090", 5, 80, "Piece", "Housekeeping Materials"],
  ["STEEL SCRUB", "73239990", 18, 10, "Piece", "Kitchen & Canteen"],
  ["WIPPER", "96039000", 18, 200, "Piece", "Housekeeping Materials"],
  ["LONG FLOOR BRUSH", "96039000", 18, 130, "Piece", "Housekeeping Materials"],
  ["HAND WASH", "34013000", 18, 110, "Bottle", "Washroom & Sanitary"],
  ["DUST BIN COVER BIG", "39249090", 5, 140, "Piece", "Housekeeping Materials"],
  ["DUST BIN COVER SMALL", "39249090", 5, 70, "Piece", "Housekeeping Materials"],
  ["ODONIL AIR FRESHNER", "33074900", 18, 68, "Piece", "Housekeeping Materials"],
  ["COMFORT 250 ML", "38099100", 18, 130, "Bottle", "Housekeeping Materials"],
  ["ROOM FRESHNER", "33074900", 18, 120, "Can", "Housekeeping Materials"],
  ['BRUSH PAINT 2"', "96034010", 18, 105, "Piece", "Housekeeping Materials"],
  ["DETTOL LIQUID (HAND WASH)", "34013000", 18, 110, "Bottle", "Washroom & Sanitary"],
  ["PLASTIC BUCKET (20 LITRS)", "39249090", 5, 200, "Piece", "Housekeeping Materials"],
  ["COLIN 500ML", "34025000", 18, 120, "Bottle", "General & Glass"],
  ["URINAL CAKE ODNIL", "33074900", 18, 63, "Piece", "Washroom & Sanitary"],
  ["BATH ROOM BRUSH", "96039000", 18, 50, "Piece", "Washroom & Sanitary"],
  ["SODIUM SILICATE", "28391900", 18, 20, "Kilogram", "General & Glass"],
  ["PLASTIC BUCKET (10 LITRS)", "39249090", 5, 100, "Piece", "Housekeeping Materials"],
  // "MOP without stick" had no HSN/GST in the sheet — filled from the sibling "MOP" row above.
  ["MOP without stick", "96039000", 18, 100, "Piece", "Housekeeping Materials"],
  ["DUST BIN BAG (GARBAGE BAG)", "39232990", 18, 60, "Packet", "Housekeeping Materials"],
  ["FLOOR CLEANING WIPER", "96039000", 18, 200, "Piece", "Housekeeping Materials"],
  ["BATH SOAP", "34011190", 5, 48, "Piece", "Washroom & Sanitary"],
];

async function call(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  console.log(`Importing ${ROWS.length} products into ${BASE} ...\n`);

  const login = await call("POST", "/auth/login", null, { email: EMAIL, password: PASSWORD });
  if (!login.ok) {
    console.error("Login failed:", login.json?.message ?? login.status);
    process.exit(1);
  }
  const token = login.json.data.accessToken;

  const [units, categories] = await Promise.all([
    call("GET", "/units?limit=100", token).then((r) => r.json.data),
    call("GET", "/categories?limit=100", token).then((r) => r.json.data),
  ]);
  const unitByName = new Map(units.map((u) => [u.name.toLowerCase(), u.id]));
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  let created = 0;
  let failed = 0;

  for (const [name, hsnCode, gstRate, price, unitName, categoryName] of ROWS) {
    const unitId = unitByName.get(unitName.toLowerCase());
    const categoryId = categoryByName.get(categoryName.toLowerCase());

    if (!unitId) {
      console.error(`  SKIPPED  ${name} — unknown unit "${unitName}"`);
      failed += 1;
      continue;
    }

    const result = await call("POST", "/products", token, {
      name,
      hsnCode,
      defaultGstRate: gstRate,
      defaultPrice: price,
      unitId,
      ...(categoryId ? { categoryId } : {}),
    });

    if (result.ok) {
      console.log(`  OK       ${result.json.data.productCode}  ${name}`);
      created += 1;
    } else {
      console.error(`  FAILED   ${name}  —`, result.json?.message ?? result.status, result.json?.errors ?? "");
      failed += 1;
    }
  }

  console.log(`\n${created} created, ${failed} failed, out of ${ROWS.length}.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("CRASHED:", error);
  process.exit(1);
});
