/**
 * Checks a DATABASE_URL against a live database before you paste it into
 * Render — using Prisma's own schema engine, so this fails in exactly the way
 * `prisma migrate deploy` would, without needing a full deploy to find out.
 *
 * Usage:
 *   DATABASE_URL="mysql://user:pass@host:4000/sva_erp?sslaccept=strict" \
 *     node scripts/check-database-url.mjs
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

// Run Prisma's own JS entry point via `node`, not `npx`. Spawning the `npx.cmd`
// shim directly with execFileSync fails with EINVAL on Windows, and going
// through a shell to work around it would mean the DATABASE_URL's own special
// characters (?, &, @) have to survive cmd.exe's quoting — this avoids both.
const prismaBin = createRequire(import.meta.url).resolve("prisma/build/index.js");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first, to exactly the value you intend to paste into Render.");
  process.exit(1);
}

let problems = 0;
function warn(message) {
  console.warn(`  ⚠ ${message}`);
  problems += 1;
}

// The single most common way this breaks: Render's dashboard stores the value
// verbatim, so pasting it with the shell quotes still attached makes them part
// of the connection string.
if (/^['"]/.test(url) || /['"]$/.test(url)) {
  warn('The value still has quote marks around it. Paste it into Render WITHOUT the surrounding " ".');
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error("That is not a valid URL — check for a typo or a stray character.");
  process.exit(1);
}

console.log("Parsed connection:");
console.log(`  host:     ${parsed.hostname}`);
console.log(`  port:     ${parsed.port || "(default)"}`);
console.log(`  database: ${parsed.pathname.replace(/^\//, "") || "(none — missing /sva_erp)"}`);
console.log(`  query:    ${parsed.search || "(none)"}`);

// TiDB Cloud Serverless refuses any connection that does not negotiate TLS.
// Prisma's MySQL connector opts into TLS with ?sslaccept=strict specifically.
if (/tidbcloud\.com$/.test(parsed.hostname) && parsed.searchParams.get("sslaccept") !== "strict") {
  warn(`sslaccept is "${parsed.searchParams.get("sslaccept") ?? "missing"}", not "strict".`);
  warn(`Add ${parsed.search ? "&" : "?"}sslaccept=strict to the end of the URL.`);
}

if (problems > 0) {
  console.log(`\n${problems} likely problem(s) found above — fix those first.\n`);
}

console.log("\nConnecting with Prisma's own engine (SELECT 1) …");
try {
  execFileSync(process.execPath, [prismaBin, "db", "execute", "--url", url, "--stdin"], {
    input: "SELECT 1;",
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log("\nSUCCESS — this DATABASE_URL works. Paste it into Render exactly as tested, with no quotes.");
} catch {
  console.error("\nFAILED — see the engine's own error above.");
  if (problems === 0) {
    console.error("No obvious formatting problem was found, so read the underlying message carefully:");
    console.error("  - 'Access denied'          -> wrong username or password");
    console.error("  - 'Unknown database'       -> the database name in the URL does not exist yet");
    console.error("  - 'insecure transport'     -> sslaccept=strict is missing or was stripped somewhere");
    console.error("  - 'ETIMEDOUT' / 'ENOTFOUND'-> wrong host, or the cluster's IP allowlist blocks this network");
  }
  process.exit(1);
}
