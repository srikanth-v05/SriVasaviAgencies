/** Checks for this round: Puducherry GST treatment, reviews, contact details. */

const BASE = "http://localhost:4000/api/v1";
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
    email: "vijaychemicals05@gmail.com",
    password: "ChangeThisPassword123",
  });
  token = login.json.data.accessToken;
  check("login", login.ok);

  // ---------------------------------------------------- contact details
  const company = await call("GET", "/company");
  const c = company.json.data;
  check("company state is Puducherry (34)", c.stateCode === "34" && c.state === "Puducherry", `${c.state} / ${c.stateCode}`);
  check("both phone numbers stored", c.phone.includes("99436 77409") && c.alternatePhone.includes("90928 97386"),
    `${c.phone} · ${c.alternatePhone}`);
  // The address as printed on the business's own tax invoice.
  check("address matches the invoice", c.addressLine1.includes("West Car Street") && c.addressLine2.includes("Villianur") && c.pincode === "605110",
    `${c.addressLine1}, ${c.addressLine2}, ${c.pincode}`);
  check("logo set", c.logoUrl === "/logo.jpg", c.logoUrl);

  // -------------------------------- GST now keys off Puducherry, not TN
  const products = await call("GET", "/products?limit=100");
  const phenyl = products.json.data.find((p) => p.productCode === "SVA-WP-05");
  const customers = await call("GET", "/customers?limit=50");
  const pyCustomer = customers.json.data.find((x) => x.stateCode === "34");
  const tnCustomer = customers.json.data.find((x) => x.stateCode === "33");

  const intra = await call("POST", "/invoices", {
    customerId: pyCustomer.id,
    items: [{ productId: phenyl.id, quantity: 100, unitPrice: 100 }],
  });
  check("Puducherry customer -> CGST + SGST",
    Number(intra.json.data.cgstTotal) === 900 && Number(intra.json.data.sgstTotal) === 900 && Number(intra.json.data.igstTotal) === 0,
    `cgst=${intra.json.data.cgstTotal} sgst=${intra.json.data.sgstTotal} igst=${intra.json.data.igstTotal}`);

  const inter = await call("POST", "/invoices", {
    customerId: tnCustomer.id,
    items: [{ productId: phenyl.id, quantity: 100, unitPrice: 100 }],
  });
  check("Tamil Nadu customer -> IGST (now inter-state)",
    Number(inter.json.data.igstTotal) === 1800 && Number(inter.json.data.cgstTotal) === 0,
    `igst=${inter.json.data.igstTotal}`);
  check("both routes reach the same total",
    Number(intra.json.data.grandTotal) === Number(inter.json.data.grandTotal),
    `₹${intra.json.data.grandTotal}`);

  // ------------------------------------------------------------ reviews
  const empty = await fetch(`${BASE}/public/reviews`).then((r) => r.json());
  check("reviews start empty — nothing fabricated", empty.data.reviews.length === 0 && empty.data.summary.count === 0);

  const created = await call("POST", "/reviews", {
    source: "JUSTDIAL",
    authorName: "Test Reviewer",
    authorRole: "Facilities Manager",
    rating: 5,
    text: "Delivered on time and the invoice matched the quotation exactly.",
    sourceUrl: "https://www.justdial.com/example",
  });
  check("admin can add a review", created.ok, created.json?.message ?? created.json?.data?.id);

  const listed = await fetch(`${BASE}/public/reviews`).then((r) => r.json());
  check("review appears on the public endpoint", listed.data.reviews.length === 1, `avg=${listed.data.summary.average}`);
  check("aggregate rating computed", listed.data.summary.average === 5 && listed.data.summary.count === 1);

  const reviewId = created.json.data.id;
  const hidden = await call("PUT", `/reviews/${reviewId}`, { isPublished: false });
  check("unpublish works", hidden.ok);

  const afterHide = await fetch(`${BASE}/public/reviews`).then((r) => r.json());
  check("unpublished review is hidden from the public", afterHide.data.reviews.length === 0);

  const badRating = await call("POST", "/reviews", {
    source: "GOOGLE", authorName: "X Y", rating: 9, text: "Rating out of range should fail",
  });
  check("rating outside 1-5 rejected", badRating.status === 400);

  const syncStatus = await call("GET", "/reviews-sync/status");
  check("Google sync reports it is not configured", syncStatus.ok && syncStatus.json.data.configured === false,
    syncStatus.json?.data?.missing?.join("; "));

  const syncAttempt = await call("POST", "/reviews-sync/google");
  check("sync refuses cleanly without credentials", syncAttempt.status === 400, syncAttempt.json?.message);

  // clean up the test row
  await call("DELETE", `/reviews/${reviewId}`);
  const finalList = await fetch(`${BASE}/public/reviews`).then((r) => r.json());
  check("test review removed", finalList.data.reviews.length === 0);

  // ------------------------------------------------------ authorisation
  const anon = await fetch(`${BASE}/reviews`).then((r) => r.status);
  check("review management requires auth", anon === 401);

  // ------------------------------------------- concurrent login regression
  // Refresh tokens are stored by unique hash. Before `jti` was added to the
  // payload, two logins in the same second produced a byte-identical token, so
  // the second one failed on the unique constraint and returned a 500.
  const burst = await Promise.all(
    Array.from({ length: 5 }, () =>
      fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.SEED_ADMIN_EMAIL ?? "vijaychemicals05@gmail.com",
          password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeThisPassword123",
        }),
      }),
    ),
  );
  const statuses = burst.map((r) => r.status);
  check("simultaneous logins all succeed", statuses.every((s) => s === 200), `statuses: ${statuses.join(", ")}`);

  const bodies = await Promise.all(burst.map((r) => r.json()));
  const refreshTokens = bodies.map((b) => b.data?.refreshToken).filter(Boolean);
  check(
    "each login gets a distinct refresh token",
    refreshTokens.length === 5 && new Set(refreshTokens).size === refreshTokens.length,
    `${new Set(refreshTokens).size} distinct of ${refreshTokens.length}`,
  );

  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
}

main().catch((error) => {
  console.error("CRASHED:", error);
  process.exit(1);
});
