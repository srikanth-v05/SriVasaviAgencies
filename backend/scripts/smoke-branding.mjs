/**
 * Seal and signature: upload, storage, PDF rendering, replacement and removal.
 *
 * The point of the feature is that a printed invoice carries the rubber stamp
 * with the signature over the top of it, so the checks follow that all the way
 * through to the bytes of the PDF.
 */

import { Buffer } from "node:buffer";
import zlib from "node:zlib";

const BASE = "http://localhost:4000/api/v1";
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "vijaychemicals05@gmail.com";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeThisPassword123";

let token = null;
const results = [];

function check(label, condition, detail = "") {
  results.push(Boolean(condition));
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!condition) process.exitCode = 1;
}

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

/** A real, decodable PNG of the given size — PDFKit rejects anything malformed. */
function pngBytes(width, height, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  // Raw scanlines, each prefixed with a zero filter byte.
  const raw = Buffer.concat(
    Array.from({ length: height }, () =>
      Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: width }, () => Buffer.from(rgb)))]),
    ),
  );

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function uploadAsset(asset, bytes, filename, type = "image/png") {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), filename);
  const res = await fetch(`${BASE}/company/branding/${asset}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  const login = await call("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
  token = login.json?.data?.accessToken;
  check("login", Boolean(token));

  // ------------------------------------------------------------- upload
  const sealPng = pngBytes(64, 64, [200, 40, 80]);
  const signPng = pngBytes(120, 40, [20, 30, 90]);

  const sealUp = await uploadAsset("seal", sealPng, "seal.png");
  check("seal uploads", sealUp.ok, sealUp.json?.message ?? sealUp.json?.message);
  const sealUrl = sealUp.json?.data?.sealUrl;
  check("seal URL stored under /api/v1/public/branding", Boolean(sealUrl?.startsWith("/api/v1/public/branding/")), sealUrl);

  const signUp = await uploadAsset("signature", signPng, "sign.png");
  check("signature uploads", signUp.ok);
  const signUrl = signUp.json?.data?.signatureUrl;
  check("signature URL stored", Boolean(signUrl?.startsWith("/api/v1/public/branding/")), signUrl);

  // -------------------------------------------------------- served back
  const fetched = await fetch(`http://localhost:4000${sealUrl}`);
  const withBrandingSealBytes = Buffer.from(await fetched.arrayBuffer()).length;
  check("uploaded seal is served back", fetched.ok && fetched.headers.get("content-type")?.includes("image/png"),
    `${fetched.status} ${fetched.headers.get("content-type")}`);

  // ------------------------------------------------------------ refused
  const bad = await uploadAsset("seal", Buffer.from("#!/bin/sh\necho hi"), "evil.sh", "application/x-sh");
  check("non-image upload refused", bad.status === 400, bad.json?.message);

  const wrongSlot = await uploadAsset("banner", sealPng, "x.png");
  check("unknown asset slot refused", wrongSlot.status === 400 || wrongSlot.status === 404, `status ${wrongSlot.status}`);

  const anon = await fetch(`${BASE}/company/branding/seal`, { method: "POST" }).then((r) => r.status);
  check("upload requires auth", anon === 401);

  // ------------------------------------------------- appears in the PDF
  const products = await call("GET", "/products?limit=5");
  const product = products.json.data[0];
  const company = (await call("GET", "/company")).json.data;

  const customer = await call("POST", "/customers", {
    customerType: "COMPANY",
    name: `Branding Test ${Date.now()}`,
    phone: "9840000002",
    gstin: `${company.stateCode.padStart(2, "0")}ABCDE1234F1Z5`,
    state: company.state,
    stateCode: company.stateCode,
    addresses: [
      {
        addressType: "BILLING",
        line1: "1 Stamp Street",
        city: company.city,
        state: company.state,
        stateCode: company.stateCode,
        pincode: company.pincode,
        isDefault: true,
      },
    ],
  });
  const invoice = await call("POST", "/invoices", {
    customerId: customer.json.data.id,
    items: [{ productId: product.id, quantity: 2, unitPrice: 100, hsnCode: product.hsnCode ?? "3808" }],
  });
  const issued = await call("POST", `/invoices/${invoice.json.data.id}/finalize`);
  check("invoice issued for the PDF check", issued.ok, issued.json?.data?.invoiceNumber);

  const pdfRes = await fetch(`${BASE}/invoices/${invoice.json.data.id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const withBranding = Buffer.from(await pdfRes.arrayBuffer());
  check("invoice PDF renders", pdfRes.ok && withBranding.subarray(0, 4).toString() === "%PDF", `${withBranding.length} bytes`);

  // A PDF that embeds two images is materially larger than one that embeds none,
  // and PDFKit writes an /Image XObject for each.
  const imageCount = (withBranding.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;
  check("PDF embeds the seal and the signature", imageCount >= 2, `${imageCount} embedded image(s)`);

  const declaration = (await call("GET", "/company")).json.data.declaration;
  check("declaration stored on company settings", Boolean(declaration), declaration?.slice(0, 48) + "…");

  // ---------------------------------------------------------- replacing
  // The URL is a fixed endpoint (the image lives in the database row, not a
  // per-upload filename), so replacing keeps the same URL but serves new bytes.
  const replacement = await uploadAsset("seal", pngBytes(48, 48, [10, 120, 60]), "seal2.png");
  const newSealUrl = replacement.json?.data?.sealUrl;
  check("seal replace keeps the same URL", replacement.ok && newSealUrl === sealUrl, newSealUrl);

  const replaced = await fetch(`http://localhost:4000${sealUrl}`);
  const replacedBytes = Buffer.from(await replaced.arrayBuffer());
  check("the same URL now serves the replaced image", replaced.ok && replacedBytes.length !== withBrandingSealBytes,
    `${replacedBytes.length} bytes`);

  // ----------------------------------------------------------- removing
  const removed = await call("DELETE", "/company/branding/signature");
  check("signature can be removed", removed.ok && removed.json.data.signatureUrl === null);

  const afterRemoval = await fetch(`${BASE}/invoices/${invoice.json.data.id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const withoutSignature = Buffer.from(await afterRemoval.arrayBuffer());
  const fewerImages = (withoutSignature.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;
  check("PDF still renders with the signature gone", withoutSignature.subarray(0, 4).toString() === "%PDF");
  check("one fewer image once the signature is removed", fewerImages === imageCount - 1,
    `${fewerImages} vs ${imageCount}`);

  // Put the seal back to a clean state for the next run.
  await call("DELETE", "/company/branding/seal");
  const cleared = (await call("GET", "/company")).json.data;
  check("branding cleared for a clean slate", cleared.sealUrl === null && cleared.signatureUrl === null);

  const bareInvoice = await fetch(`${BASE}/invoices/${invoice.json.data.id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const bare = Buffer.from(await bareInvoice.arrayBuffer());
  check("PDF renders with no branding at all", bare.subarray(0, 4).toString() === "%PDF", `${bare.length} bytes`);

  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
}

main().catch((error) => {
  console.error("CRASHED:", error);
  process.exit(1);
});
