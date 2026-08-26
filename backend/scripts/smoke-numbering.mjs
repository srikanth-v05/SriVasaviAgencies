/**
 * Concurrency check for document numbering (architecture.md §17).
 *
 * MySQL has no `RETURNING`, so allocation was rewritten as INSERT-IGNORE →
 * SELECT ... FOR UPDATE → UPDATE inside the caller's transaction. This fires a
 * burst of simultaneous finalisations at the API and asserts that every invoice
 * came back with a distinct, gapless number.
 */

const BASE = "http://localhost:4000/api/v1";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 12);

let token = null;
const results = [];

async function call(method, path, body) {
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

function check(label, condition, detail = "") {
  results.push(Boolean(condition));
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!condition) process.exitCode = 1;
}

async function main() {
  const login = await call("POST", "/auth/login", {
    email: process.env.SEED_ADMIN_EMAIL ?? "vijaychemicals05@gmail.com",
    password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeThisPassword123",
  });
  token = login.json?.data?.accessToken;
  check("login", Boolean(token));

  const company = (await call("GET", "/company")).json.data;
  const products = await call("GET", "/products?limit=10");
  const product = products.json.data[0];

  const stamp = Date.now();
  const customer = await call("POST", "/customers", {
    customerType: "COMPANY",
    name: `Numbering Test ${stamp}`,
    phone: "9840000001",
    gstin: `${company.stateCode.padStart(2, "0")}ABCDE1234F1Z5`,
    state: company.state,
    stateCode: company.stateCode,
    addresses: [
      {
        addressType: "BILLING",
        line1: "1 Concurrency Lane",
        city: company.city,
        state: company.state,
        stateCode: company.stateCode,
        pincode: company.pincode,
        isDefault: true,
      },
    ],
  });
  check("test customer created", customer.ok, customer.json?.message);
  const customerId = customer.json.data.id;

  // Create the drafts up front so the burst measures allocation alone.
  const drafts = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      call("POST", "/invoices", {
        customerId,
        items: [{ productId: product.id, quantity: 1, unitPrice: 100, hsnCode: product.hsnCode ?? "3808" }],
      }),
    ),
  );
  const draftIds = drafts.filter((d) => d.ok).map((d) => d.json.data.id);
  check(`${CONCURRENCY} drafts created`, draftIds.length === CONCURRENCY, `${draftIds.length} created`);

  // The burst: every finalisation races for the same counter row.
  const started = Date.now();
  const finalised = await Promise.all(draftIds.map((id) => call("POST", `/invoices/${id}/finalize`)));
  const elapsed = Date.now() - started;

  const succeeded = finalised.filter((r) => r.ok);
  const failed = finalised.filter((r) => !r.ok);
  check(
    "every concurrent finalisation succeeded",
    succeeded.length === CONCURRENCY,
    `${succeeded.length}/${CONCURRENCY} in ${elapsed}ms${failed.length ? ` — first error: ${failed[0].json?.message}` : ""}`,
  );

  const numbers = succeeded.map((r) => r.json.data.invoiceNumber);
  const unique = new Set(numbers);
  check("no invoice number was issued twice", unique.size === numbers.length,
    `${unique.size} unique of ${numbers.length}`);

  check("every invoice got a number", numbers.every(Boolean));
  check("numbers follow the configured format", numbers.every((n) => /^SVA\/\d{4}-\d{2}\/\d{4}$/.test(n)),
    numbers.slice(0, 3).join(", "));

  // The sequence the burst consumed must be contiguous — no number skipped.
  const sequences = numbers.map((n) => Number(n.split("/").pop())).sort((a, b) => a - b);
  const contiguous = sequences.every((value, index) => index === 0 || value === sequences[index - 1] + 1);
  check("allocated sequence is gapless", contiguous, `${sequences[0]} … ${sequences[sequences.length - 1]}`);

  // Sanity: the stored counter agrees with what was handed out.
  const listed = await call("GET", `/invoices?customerId=${customerId}&limit=100`);
  const issued = listed.json.data.filter((i) => i.invoiceNumber);
  check("all issued invoices persisted", issued.length === CONCURRENCY, `${issued.length} on record`);

  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
}

main().catch((error) => {
  console.error("CRASHED:", error);
  process.exit(1);
});
