/**
 * One-off import of 18 existing customers, transcribed from the office's own
 * spreadsheet (name, address, state/city, GSTIN — no phone or PIN code
 * captured in the source).
 *
 * The state code that decides CGST+SGST vs IGST is derived from each GSTIN's
 * own first two digits, not from the spreadsheet's "State" column — that
 * column actually holds a city/town name in most rows ("CHENNAI",
 * "PUDUCHERRY", "KANCHIPURAM", ...) and only two rows literally say a state
 * name ("TAMIL NADU"), so it is not a reliable state source. The GSTIN prefix
 * is authoritative and consistent for every row.
 *
 * Two pairs share a GSTIN (RAJ CHEMICALS / RAJ CHEMICALS GOODEN, and the two
 * SUNBEAM rows) — the schema does not require gstin to be unique, and the
 * spreadsheet lists them as distinct addresses, so each row becomes its own
 * customer record rather than one customer with two addresses.
 *
 * Usage:
 *   node scripts/import-real-customers.mjs                  # local API on :4000
 *   API_BASE=https://sva-api-8nhm.onrender.com/api/v1 \
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... \
 *     node scripts/import-real-customers.mjs                # production
 */

const BASE = process.env.API_BASE ?? "http://localhost:4000/api/v1";
const EMAIL = process.env.ADMIN_EMAIL ?? "vijaychemicals05@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeThisPassword123";

const STATE_NAMES = { "33": "Tamil Nadu", "34": "Puducherry" };

/** [name, address line, sheet's own "State" column, GSTIN] — transcribed verbatim. */
const ROWS = [
  ["SRI LAKSHMI INTERNATIONAL MARKETING", "Plot 31, Usha Nagar, Nindhivaran", "Guduvanchery", "33AFLPV5813L1ZY"],
  ["SAM PAUL EDUCATIONAL TRUST", "1, Jaya Nagar, Reddiyarpalayam", "Puducherry", "34AAETS3725Q1ZZ"],
  ["NILKAMAL LTD", "Olavaikkal Village, Koodapakkam Road", "Puducherry", "34AAACN2329N1ZF"],
  ["RAJ CHEMICALS", "No 6 EVP Prabha Avenue, Iyyappanthangal", "Chennai", "33AGZPR7069K1ZC"],
  ["RAJ CHEMICALS GOODEN", "82A Karthik Nagar, Valarpuram, Sriperumbudur", "Kanchipuram", "33AGZPR7069K1ZC"],
  // The sheet's own State column says "Tamil Nadu" here (not a city), so the
  // city is taken from the tail of the address itself.
  ["SURIYA CHEMICALS", "8/76, Main Road, Ramnagar", "Tirunelveli", "33GADPS0638K1ZI"],
  ["SUNBEAM GENERATORS PVT LTD", "R.S No:24/3A-3D & 5 Canal Road, Koodapakkam", "Puducherry", "34AAICS1168C2ZL"],
  ["SUNBEAM GENERATORS PVT LTD 2", "R.S No:139/1,2,3 & 141/2, Ramanathapuram", "Puducherry", "34AAICS1168C2ZL"],
  ["REIL ELECTRICAL INDIAN LIMITED", "Villianur Commune", "Puducherry", "34AACCS8997B1Z3"],
  ["SIVAGAMI CHEMICAL TRADERS", "Pattanikalam, Villianur", "Puducherry", "34AJXPM5977C1ZM"],
  ["VISHNU ENTERPRISES", "Uruvaiyar Main Road, Villianur", "Puducherry", "34BUNPS6447P2ZK"],
  // Same case as SURIYA CHEMICALS: sheet says "Tamil Nadu", city taken from the address.
  ["MANI MAGALAI CHEMICALS", "No.25, Meenachipethai", "Kurijipadi", "33AJVPT4840P1Z8"],
  ["UNION PHARMAA", "Plot No 25, Near Kannagi School, Kannagi Nagar, Villianur", "Puducherry", "34CRKPS1434B1Z1"],
  ["KUMAR AGENCIES", "22, Panjali Amman Nagar, Mettupalayam", "Puducherry", "34AAZPR6619K1ZS"],
  ["KATEEL INDUSTRIES", "#1687, Aythappalayam Village, Tandrampet Taluk", "Tiruvanamalai", "33AWSPR1350C1ZN"],
  ["ARUNA SOAP AND POWDER", "14, Cuddalore Pondy Main Road", "Cuddalore", "33GVFPS8826E1Z8"],
  ["SAIRAM HOUSEHOLD PRODUCTS", "No 7 Forth Cross Jayanagar, Reddiyarpalayam", "Puducherry", "34CRIPS6679G1Z4"],
  ["FUTURE CHEM CORPORATION", "No.504, 3rd Main Road, Balaji Nagar, Ambattur", "Chennai", "33BSYPM2254F1Z1"],
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
  console.log(`Importing ${ROWS.length} customers into ${BASE} ...\n`);

  const login = await call("POST", "/auth/login", null, { email: EMAIL, password: PASSWORD });
  if (!login.ok) {
    console.error("Login failed:", login.json?.message ?? login.status);
    process.exit(1);
  }
  const token = login.json.data.accessToken;

  let created = 0;
  let failed = 0;

  for (const [name, line1, city, gstin] of ROWS) {
    const stateCode = gstin.slice(0, 2);
    const state = STATE_NAMES[stateCode];
    if (!state) {
      console.error(`  SKIPPED  ${name} — unrecognised state code "${stateCode}" from GSTIN ${gstin}`);
      failed += 1;
      continue;
    }

    const result = await call("POST", "/customers", token, {
      customerType: "COMPANY",
      name,
      companyName: name,
      gstin,
      state,
      stateCode,
      addresses: [
        {
          addressType: "BILLING",
          line1,
          city,
          state,
          stateCode,
          isDefault: true,
        },
      ],
    });

    if (result.ok) {
      console.log(`  OK       ${name}  (${state}, GSTIN ${gstin})`);
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
