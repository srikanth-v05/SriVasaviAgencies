/**
 * End-to-end smoke test of the business flow in architecture.md §34:
 * login -> customer -> product -> quotation (with price override) -> PDF
 * -> accept -> convert -> edit price -> finalize -> payment -> reports -> export
 */

const BASE = "http://localhost:4000/api/v1";
let token = null;
const results = [];

async function call(method, path, body, expectBinary = false) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (expectBinary) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: res.ok, status: res.status, bytes: buf.length, head: buf.subarray(0, 4).toString("latin1") };
  }
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

function check(label, condition, detail = "") {
  results.push({ label, pass: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!condition) process.exitCode = 1;
}

const money = (n) => Number(n).toFixed(2);

async function main() {
  // ---------------------------------------------------------------- login
  const login = await call("POST", "/auth/login", {
    email: "vijaychemicals05@gmail.com",
    password: "ChangeThisPassword123",
  });
  check("login succeeds", login.ok && login.json?.data?.accessToken, `role=${login.json?.data?.user?.role}`);
  token = login.json.data.accessToken;

  const badLogin = await call("POST", "/auth/login", { email: "vijaychemicals05@gmail.com", password: "wrong" });
  check("wrong password rejected with 401", badLogin.status === 401);

  // ---------------------------------------------------------------- masters
  const products = await call("GET", "/products?limit=100");
  check("products listed", products.ok && products.json.data.length >= 12, `${products.json?.data?.length} products`);

  const phenyl = products.json.data.find((p) => p.productCode === "SVA-WP-05");
  check("white phenyl master price is 100", Number(phenyl.defaultPrice) === 100, `₹${phenyl.defaultPrice}/${phenyl.unit.shortName}`);

  // The intra-state case is derived from the company's own state code, so this
  // suite stays correct if the business ever re-registers in another state.
  const company = (await call("GET", "/company")).json.data;
  const homeStateCode = company.stateCode;
  check("company state code loaded", Boolean(homeStateCode), `${company.state} (${homeStateCode})`);

  const customers = await call("GET", "/customers?limit=100");
  const kaCustomer = customers.json.data.find((c) => c.stateCode !== homeStateCode);
  check("an out-of-state customer exists for the IGST case", Boolean(kaCustomer),
    kaCustomer ? `${kaCustomer.name} (${kaCustomer.stateCode})` : "none");

  // A registered buyer in the home state, created fresh so the run does not
  // depend on whatever the seed left behind.
  const stamp = Date.now();
  const created = await call("POST", "/customers", {
    customerType: "COMPANY",
    name: `Smoke Test Buyer ${stamp}`,
    companyName: `Smoke Test Buyer ${stamp} Pvt Ltd`,
    phone: "9840000000",
    gstin: `${homeStateCode.padStart(2, "0")}ABCDE1234F1Z5`,
    state: company.state,
    stateCode: homeStateCode,
    addresses: [
      {
        addressType: "BILLING",
        line1: "1 Test Street",
        city: company.city,
        state: company.state,
        stateCode: homeStateCode,
        pincode: company.pincode,
        isDefault: true,
      },
    ],
  });
  check("intra-state test customer created", created.ok, created.json?.message);
  const tnCustomer = created.json.data;

  // ------------------------------------------------- quotation with override
  // §2.1 / §30: master price is 100; we quote 85 and 120 on the same document.
  const quotation = await call("POST", "/quotations", {
    customerId: tnCustomer.id,
    items: [
      { productId: phenyl.id, quantity: 50, unitPrice: 85 },
      { productId: phenyl.id, quantity: 10, unitPrice: 120 },
      { productId: products.json.data.find((p) => p.productCode === "SVA-BRM-SF").id, quantity: 20 },
    ],
  });
  check("quotation created", quotation.ok, quotation.json?.data?.quotationNumber ?? quotation.json?.message);

  const q = quotation.json.data;
  check("quotation number follows SVA/QT/FY/0001", /^SVA\/QT\/\d{4}-\d{2}\/\d{4}$/.test(q.quotationNumber), q.quotationNumber);
  check("override below master accepted (50 x 85 = 4250)", money(q.items[0].lineTaxableValue) === "4250.00", `₹${q.items[0].lineTaxableValue}`);
  check("override above master accepted (10 x 120 = 1200)", money(q.items[1].lineTaxableValue) === "1200.00", `₹${q.items[1].lineTaxableValue}`);
  check("omitted price falls back to master (20 x 95 = 1900)", money(q.items[2].lineTaxableValue) === "1900.00", `₹${q.items[2].lineTaxableValue}`);
  check("master price snapshotted for audit", Number(q.items[0].masterPriceSnapshot) === 100);
  check("home-state supply split into CGST+SGST", Number(q.cgstTotal) > 0 && Number(q.sgstTotal) > 0 && Number(q.igstTotal) === 0,
    `cgst=${q.cgstTotal} sgst=${q.sgstTotal} igst=${q.igstTotal}`);
  check("quotation snapshots product name", q.items[0].productNameSnapshot === phenyl.name);

  const qPdf = await call("GET", `/quotations/${q.id}/pdf`, null, true);
  check("quotation PDF generated", qPdf.ok && qPdf.head === "%PDF" && qPdf.bytes > 2000, `${qPdf.bytes} bytes`);

  // ---------------------------------------------------------- state machine
  const badConvert = await call("POST", `/quotations/${q.id}/convert-to-invoice`);
  check("cannot convert a draft quotation", badConvert.status === 422, badConvert.json?.message);

  await call("POST", `/quotations/${q.id}/send`);
  const accepted = await call("POST", `/quotations/${q.id}/accept`);
  check("quotation accepted", accepted.ok && accepted.json.data.status === "ACCEPTED");

  // ---------------------------------------------------------- conversion
  const converted = await call("POST", `/quotations/${q.id}/convert-to-invoice`);
  check("converted to a draft invoice", converted.ok && converted.json.data.status === "DRAFT");

  const inv = converted.json.data;
  check("conversion copies the quoted price, not the master price", Number(inv.items[0].unitPrice) === 85, `₹${inv.items[0].unitPrice}`);
  check("conversion preserves the grand total", money(inv.grandTotal) === money(q.grandTotal), `₹${inv.grandTotal}`);
  check("draft invoice has no number yet", inv.invoiceNumber === null);

  const reconvert = await call("POST", `/quotations/${q.id}/convert-to-invoice`);
  check("a quotation cannot be converted twice", reconvert.status === 422, reconvert.json?.message);

  // ------------------------------------------ edit price before finalisation
  const edited = await call("PUT", `/invoices/${inv.id}`, {
    customerId: inv.customerId,
    items: inv.items.map((item, i) => ({
      productId: item.productId,
      productName: item.productNameSnapshot,
      hsnCode: item.hsnCodeSnapshot,
      unit: item.unitSnapshot,
      quantity: Number(item.quantity),
      unitPrice: i === 0 ? 82 : Number(item.unitPrice),
      gstRate: Number(item.gstRate),
    })),
  });
  check("invoice price editable before issue (85 -> 82)", edited.ok && Number(edited.json.data.items[0].unitPrice) === 82,
    `₹${edited.json?.data?.items?.[0]?.unitPrice}`);
  check("totals recomputed after the edit (50 x 82 = 4100)", money(edited.json.data.items[0].lineTaxableValue) === "4100.00");

  // -------------------------------------------------------------- finalise
  const finalized = await call("POST", `/invoices/${inv.id}/finalize`);
  check("invoice finalised", finalized.ok && finalized.json.data.status === "ISSUED", finalized.json?.data?.invoiceNumber ?? finalized.json?.message);

  const issued = finalized.json.data;
  check("invoice number follows SVA/FY/0001", /^SVA\/\d{4}-\d{2}\/\d{4}$/.test(issued.invoiceNumber), issued.invoiceNumber);
  check("buyer details frozen on the invoice", Boolean(issued.customerNameSnapshot && issued.customerGstinSnapshot));

  const editIssued = await call("PUT", `/invoices/${inv.id}`, { customerId: inv.customerId, items: [{ productId: phenyl.id, quantity: 1, unitPrice: 1 }] });
  check("an issued invoice is locked against edits", editIssued.status === 422, editIssued.json?.message);

  const refinalize = await call("POST", `/invoices/${inv.id}/finalize`);
  check("an issued invoice cannot be re-issued", refinalize.status === 422);

  const invPdf = await call("GET", `/invoices/${inv.id}/pdf`, null, true);
  check("tax invoice PDF generated", invPdf.ok && invPdf.head === "%PDF" && invPdf.bytes > 2000, `${invPdf.bytes} bytes`);

  // --------------------------------------------------------------- payments
  const overpay = await call("POST", "/payments", { invoiceId: inv.id, amount: Number(issued.grandTotal) + 1000, paymentMethod: "CASH" });
  check("overpayment rejected", overpay.status === 400, overpay.json?.message);

  const partial = await call("POST", "/payments", { invoiceId: inv.id, amount: 1000, paymentMethod: "UPI", referenceNumber: "UPI-001" });
  check("partial payment recorded", partial.ok);

  const afterPartial = await call("GET", `/invoices/${inv.id}`);
  check("invoice marked PARTIALLY_PAID", afterPartial.json.data.status === "PARTIALLY_PAID", afterPartial.json.data.status);
  check("balance due recalculated", money(afterPartial.json.data.balanceDue) === money(Number(issued.grandTotal) - 1000),
    `₹${afterPartial.json.data.balanceDue}`);

  const rest = await call("POST", "/payments", { invoiceId: inv.id, amount: Number(afterPartial.json.data.balanceDue), paymentMethod: "BANK_TRANSFER" });
  check("balance payment recorded", rest.ok);

  const afterFull = await call("GET", `/invoices/${inv.id}`);
  check("invoice marked PAID", afterFull.json.data.status === "PAID", afterFull.json.data.status);
  check("balance is zero", Number(afterFull.json.data.balanceDue) === 0);

  // ------------------------------------------- inter-state invoice -> IGST
  const igstInvoice = await call("POST", "/invoices", {
    customerId: kaCustomer.id,
    items: [{ productId: phenyl.id, quantity: 100, unitPrice: 100 }],
  });
  check("out-of-state invoice charges IGST only",
    Number(igstInvoice.json.data.igstTotal) === 1800 && Number(igstInvoice.json.data.cgstTotal) === 0,
    `igst=${igstInvoice.json.data.igstTotal}`);
  check("inter-state grand total matches §12 example", money(igstInvoice.json.data.grandTotal) === "11800.00",
    `₹${igstInvoice.json.data.grandTotal}`);

  // ------------------------------- master price change must not rewrite history
  const bumped = await call("PUT", `/products/${phenyl.id}`, { defaultPrice: 250 });
  check("product master price changed to 250", bumped.ok && Number(bumped.json.data.defaultPrice) === 250);

  const historical = await call("GET", `/invoices/${inv.id}`);
  check("historical invoice unchanged after master price change",
    Number(historical.json.data.items[0].unitPrice) === 82 && money(historical.json.data.grandTotal) === money(issued.grandTotal),
    `unit=₹${historical.json.data.items[0].unitPrice} total=₹${historical.json.data.grandTotal}`);

  await call("PUT", `/products/${phenyl.id}`, { defaultPrice: 100 });

  // ---------------------------------------------------------- zero-value gate
  const zero = await call("POST", "/invoices", { customerId: tnCustomer.id, items: [{ productId: phenyl.id, quantity: 5, unitPrice: 0 }] });
  check("zero-value line blocked while the setting is off", zero.status === 400, zero.json?.message);

  // ---------------------------------------------------------------- reports
  const sales = await call("GET", "/reports/sales?grain=month");
  check("sales report returns figures", sales.ok && sales.json.data.summary.invoiceCount >= 1,
    `${sales.json?.data?.summary?.invoiceCount} invoices, ₹${sales.json?.data?.summary?.grandTotal}`);

  const gst = await call("GET", "/reports/gst");
  check("GST report splits B2B and B2C", gst.ok && gst.json.data.b2b && gst.json.data.b2c,
    `b2b=${gst.json?.data?.b2b?.invoiceCount} b2c=${gst.json?.data?.b2c?.invoiceCount}`);

  const hsn = await call("GET", "/reports/hsn");
  check("HSN summary produced", hsn.ok && hsn.json.data.length > 0, `${hsn.json?.data?.length} rows`);

  const outstanding = await call("GET", "/reports/outstanding");
  check("outstanding report with ageing", outstanding.ok && outstanding.json.data.ageing !== undefined);

  const dashboard = await call("GET", "/dashboard");
  check("dashboard summary", dashboard.ok && dashboard.json.data.cards !== undefined,
    `outstanding=₹${dashboard.json?.data?.cards?.outstandingAmount}`);

  // ---------------------------------------------------------------- exports
  const gstXlsx = await call("GET", "/exports/gst.xlsx", null, true);
  check("GST Excel export generated", gstXlsx.ok && gstXlsx.head.startsWith("PK") && gstXlsx.bytes > 5000, `${gstXlsx.bytes} bytes`);

  const salesXlsx = await call("GET", "/exports/sales.xlsx", null, true);
  check("sales Excel export generated", salesXlsx.ok && salesXlsx.bytes > 5000, `${salesXlsx.bytes} bytes`);

  const ledgerXlsx = await call("GET", `/exports/customer-ledger.xlsx?customerId=${tnCustomer.id}`, null, true);
  check("customer ledger export generated", ledgerXlsx.ok && ledgerXlsx.bytes > 3000, `${ledgerXlsx.bytes} bytes`);

  // ------------------------------------------------------------------ audit
  const audit = await call("GET", "/audit-logs?limit=100");
  const actions = new Set(audit.json.data.map((a) => a.action));
  check("audit trail captured the key events",
    ["LOGIN", "CREATE_QUOTATION", "CONVERT_QUOTATION", "FINALIZE_INVOICE", "CREATE_PAYMENT", "PRICE_OVERRIDE", "EXPORT_REPORT"].every((a) => actions.has(a)),
    [...actions].join(", "));

  const overrideEvent = audit.json.data.find((a) => a.action === "PRICE_OVERRIDE");
  check("price override recorded with master vs entered price",
    Boolean(overrideEvent?.newValues?.overrides?.[0]?.masterPrice && overrideEvent?.newValues?.overrides?.[0]?.enteredPrice),
    JSON.stringify(overrideEvent?.newValues?.overrides?.[0] ?? {}));

  // ------------------------------------------------------------ authorisation
  const noToken = await fetch(`${BASE}/products`).then((r) => r.status);
  check("unauthenticated request rejected", noToken === 401);

  const publicProducts = await fetch(`${BASE}/public/products`).then((r) => r.json());
  check("public catalogue reachable without auth", Array.isArray(publicProducts.data) && publicProducts.data.length > 0,
    `${publicProducts.data?.length} products`);
  check("public catalogue hides internal fields", publicProducts.data[0].defaultPrice === undefined && publicProducts.data[0].indicativePrice !== undefined);

  const enquiry = await fetch(`${BASE}/public/enquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test Buyer", phone: "9840000000", message: "Need a quote for 200 litres of white phenyl." }),
  });
  check("public enquiry accepted", enquiry.status === 201);

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} checks passed`);
}

main().catch((error) => {
  console.error("SMOKE RUN CRASHED:", error);
  process.exit(1);
});
