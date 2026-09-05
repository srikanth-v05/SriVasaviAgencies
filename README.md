# Sri Vasavi Agencies

Public product website and GST billing ERP for a housekeeping-chemicals and
cleaning-materials supplier. Built to [`architecture.md`](architecture.md), following the
patterns in [`.claude/skills`](.claude/skills).

```
frontend/   React + TypeScript + Vite + Tailwind      → public website and admin ERP
backend/    Express + TypeScript + Prisma             → REST API at /api/v1
docker-compose.yml                                    → TiDB (local development)
```

## Getting started

You need Node 20+ and Docker.

```bash
npm install                       # installs both workspaces
npm run db:up                     # starts TiDB on host port 4100
npm run db:create                 # creates the schema with a case-insensitive collation

cd backend
cp .env.example .env              # then set JWT_SECRET and REFRESH_TOKEN_SECRET
npx prisma migrate deploy         # or: npx prisma migrate dev
npm run seed                      # company settings, masters, 12 products, sample customers
cd ..

npm run dev                       # API on :4000, website on :5173
```

Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The seed prints the first sign-in. **Change that password immediately.**

| | |
|---|---|
| Public website | http://localhost:5173 |
| Admin ERP | http://localhost:5173/admin/login |
| API | http://localhost:4000/api/v1 |

## Commands

```bash
npm run dev            # both apps
npm run dev:api        # backend only
npm run dev:web        # frontend only
npm run build          # production build of both
npm run typecheck      # TypeScript across both
npm test               # backend unit tests (GST engine, money, financial year)

cd backend
npm run smoke          # end-to-end business flow against a running API + database
npm run smoke:reviews  # GST state treatment, contact details and the reviews module
npm run smoke:numbering # concurrent invoice numbering (CONCURRENCY=40 to push it)
npm run smoke:branding # seal and signature upload, and their place in the PDF
npm run prisma:studio  # browse the database
```

## How the money works

Every rupee figure is computed as an **exact integer of paise using BigInt**
([`backend/src/utils/money.ts`](backend/src/utils/money.ts)). Floating point is never used for
arithmetic that reaches an invoice — a half-paise drift on one line becomes a
mismatch between the printed tax invoice and the GST return.

The tax engine ([`backend/src/domain/gst.ts`](backend/src/domain/gst.ts)) is pure: no database, no
clock, no configuration lookups. Everything it needs arrives as arguments, so the
entire tax surface of the product is testable directly, and it is — see
[`backend/tests/gst.test.ts`](backend/tests/gst.test.ts).

### Price override

The price in the product master is a **default only**, never a billing
constraint (architecture.md §2.1, §13, §30). Whatever price is entered on a
document is what bills. There is no minimum, no maximum, and no warning based on
the master price.

What the system does instead is **record** it. Each line stores
`masterPriceSnapshot` alongside the price actually used, and a `PRICE_OVERRIDE`
audit event captures the list price, the entered price, who changed it and when.
In the UI the list price sits quietly under the rate input with the difference
shown — as information, not a warning.

### Snapshots

When a document is saved it keeps its own copy of the product name, code, HSN,
unit, quantity, price, discount, GST rate and every tax amount. Editing a product
later cannot alter a document already raised. The smoke test proves this: it
changes the master price from ₹100 to ₹250 and re-reads a finalised invoice to
confirm it still says ₹82.

### Invoice numbering

Numbers are allocated by one locked write inside the issuing transaction
([`numbering.service.ts`](backend/src/services/numbering.service.ts)):

```sql
UPDATE document_sequences
SET nextNumber = LAST_INSERT_ID(nextNumber) + 1
WHERE kind = ? AND financialYear = ?
```

`LAST_INSERT_ID(expr)` stores `expr` on the connection and returns it from the
next `SELECT LAST_INSERT_ID()`, so the statement hands back the number it
consumed while incrementing the counter — atomically, holding the row lock for
exactly one statement. Two concurrent finalisations serialise on that lock and
can never receive the same number. If anything later in the transaction fails,
the consumed number rolls back with it.

Verified under load: `npm run smoke:numbering` fires 12 simultaneous
finalisations (`CONCURRENCY=40` for more) and asserts every invoice came back
with a distinct, gapless number.

Drafts carry no number at all. A number is taken only at issue, so abandoned
drafts leave no gaps in the issued sequence.

```
SVA/QT/2026-27/0001    quotations
SVA/2026-27/0001       invoices
```

## Database: TiDB

TiDB speaks the MySQL 8.0 wire protocol, so Prisma targets it with the `mysql`
provider. Local development runs TiDB in Docker; production points at TiDB Cloud
by changing one line in `.env`:

```bash
# local
DATABASE_URL="mysql://root@localhost:4100/sva_erp"

# TiDB Cloud Serverless — TLS is required
DATABASE_URL="mysql://<user>:<password>@<host>:4000/sva_erp?sslaccept=strict"
```

**Create the schema with a case-insensitive collation.** TiDB defaults to
`utf8mb4_bin`, which would make catalogue search case-sensitive — searching
"phenyl" would not find "White Phenyl":

```sql
CREATE DATABASE sva_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

`npm run db:create` does this for the local container.

A few things differ from PostgreSQL and are worth knowing before editing queries:

| Concern | How it is handled |
|---|---|
| No `RETURNING` clause | Numbering uses `LAST_INSERT_ID(expr)`, read back on the same pinned connection |
| No array columns | `Enquiry.productIds` is a JSON column |
| `mode: "insensitive"` unsupported | Case-insensitivity comes from the database collation instead |
| No `date_trunc` | Period reports map each grain to `DATE()` / `DATE_FORMAT()` / `DATE_SUB()` |
| `VARCHAR(191)` default | Every prose column is explicitly `@db.Text` so nothing truncates |
| Write conflicts under load | [`db/retry.ts`](backend/src/db/retry.ts) replays transactions that abort for transient contention only |

`relationMode = "prisma"` is set, so foreign keys are enforced by Prisma rather
than by the database — the usual choice for distributed SQL. Every relation
column carries an explicit index as a result.

## Architecture

The backend follows the layered pattern from the `nodejs-backend-patterns` skill:

```
routes/         →  path, permission, validation schema
controllers/    →  parse the request, shape the response
services/       →  business rules and transactions
repositories/   →  all database access
domain/         →  pure calculation (the GST engine)
```

Wiring lives in [`backend/src/container.ts`](backend/src/container.ts), so no class constructs its
own collaborators and every one is substitutable in a test.

> **A note on the framework.** `architecture.md` §4 suggests NestJS. The
> `.claude/skills/nodejs-backend-patterns` skill prescribes Express or Fastify with
> an explicit layered structure, a DI container, `AppError` classes, an
> `ApiResponse` envelope and specific middleware. The skill was the governing
> instruction, so this is built on **Express**. Every schema, API path, business
> rule and workflow from `architecture.md` is implemented as written.

### Two rules worth knowing before you change anything

**Quotations and invoices share one pricing path.**
[`document-pricing.service.ts`](backend/src/services/document-pricing.service.ts) turns raw line
input into priced, taxed, persistence-ready snapshots, and both document types go
through it. That is what guarantees converting a quotation cannot change its tax
treatment. Do not add a second path.

**Issued invoices are immutable.** Editing, re-issuing and deleting are all
refused once a number is allocated. Corrections are made by cancelling (which
keeps the record, the number and the figures) and raising a fresh invoice.

## Permissions

Roles map to permissions as data in [`backend/src/config/permissions.ts`](backend/src/config/permissions.ts),
so the matrix in architecture.md §6 and the matrix the API enforces can be read
side by side. Routes declare `requirePermission("invoices:write")` rather than
checking role names, so a new role only has to be added to the table.

The frontend guards routes with the same permissions, but that is only to keep
someone out of a screen that would fail anyway — the server is the enforcement point.

## The public website

Designed around what a procurement officer actually decides on. A five-litre can
of concentrate is not five litres of floor cleaner; diluted 1:20 it is 105. So
the hero is a **cost-in-use calculator** that works out the price per litre of
usable solution and the monthly spend at a given usage, from real catalogue prices.

The catalogue is organised by the **colour zoning** housekeeping teams already
use — red washroom, blue general, green kitchen, yellow clinical — so whoever
raises the indent can match chemical to zone without reading a datasheet.

## Testing

| Layer | Command | Covers |
|---|---|---|
| Unit | `npm test` | GST splits, discounts, rounding, price override cases, money parsing, amount in words, financial year |
| End-to-end | `cd backend && npm run smoke` | Login → customer → quotation with overrides → PDF → accept → convert → edit → issue → payments → reports → Excel → audit |
| Reviews & GST state | `cd backend && npm run smoke:reviews` | Home-state vs out-of-state tax treatment, contact details, review CRUD, publish/unpublish, Google sync guard, simultaneous logins |
| Numbering under load | `cd backend && npm run smoke:numbering` | Concurrent invoice finalisation: unique, gapless numbers, no lost writes |
| Seal & signature | `cd backend && npm run smoke:branding` | Upload, storage, PDF embedding, replacement cleanup, removal, auth |

The smoke script needs a running API and database. It asserts the worked examples
from architecture.md directly — ₹10,000 at 18% splitting into CGST ₹900 + SGST
₹900, the same figure as IGST ₹1,800 inter-state, and 50 × ₹85 = ₹4,250 on an
overridden line.

## Seal and signature on documents

Invoices are signed the way the paper ones were: the rubber stamp goes down
first and the signature over the top of it. Upload both at **Settings → Seal &
signature** and they print in the signature block of every quotation and invoice,
above `Authorised Signatory`, with the declaration text just above them.

Both are optional — with neither uploaded the block leaves blank space to sign by
hand, which is what it did before.

### What lives in `STORAGE_DIR`

Only uploaded branding images — the logo, the rubber stamp and the signature.
Nothing else: no invoices, no PDFs, no backups, no logs. PDFs are generated on
demand and streamed straight to the browser, never written to disk.

```
backend/storage/
└── branding/
    ├── 3f2a…-….png   ← logo
    ├── 8b41…-….png   ← rubber stamp
    └── c67f…-….png   ← signature
```

At most three files, one per slot. Filenames are generated UUIDs, so the
directory is opaque — the mapping to logo/seal/signature lives in
`company_settings`. The folder is gitignored; it is runtime data, not source.

A few details worth knowing:

- The stored filename is generated server-side, never taken from the client, so
  an upload cannot escape the directory or overwrite anything.
- Replacing an image deletes the one it replaced, so the directory does not fill
  up with every re-scan of a signature.
- The PDF renderer only reads paths under `STORAGE_DIR`, and a corrupt image is
  logged and skipped rather than breaking the whole document.
- A rejected upload writes nothing. The asset slot is validated before the file
  is parsed, because multer streams to disk as it reads the body — so a
  controller that rejected afterwards used to leave an orphan behind.
- Re-running the seed refreshes the business details but leaves the seal and
  signature alone. They are scans that exist only on this server, so a routine
  re-seed must not destroy them.
- `STORAGE_DIR` is local disk. On a host with an ephemeral filesystem, point it
  at a mounted volume or the images vanish on redeploy.

### PDF typography

The document embeds IBM Plex Sans (`backend/assets/fonts`) rather than relying
on the PDF base-14 fonts. Non-embedded Helvetica is substituted by whatever the
reader has, which reflowed glyphs and opened gaps mid-word in readers without
real Helvetica metrics. An invoice gets emailed and printed on machines nobody
here controls, so it carries its own type.

## Reviews

Reviews shown on the website come from the `reviews` table and are managed at
**Settings → Website reviews**. Nothing is written by the application.

Two sources, two mechanisms:

- **Google** can be imported automatically, but only through the Google Places
  API. Set `GOOGLE_PLACES_API_KEY` in the server environment and paste the shop's
  Place ID into Company settings; an "Import from Google" button then appears on
  the reviews screen. Google returns at most five reviews per place, so the import
  tops up rather than mirrors.
- **JustDial** publishes no API, and scraping their pages would breach their
  terms. Those go in by hand, attributed, with a link back to the listing.

The reviews section stays hidden on the website until there is something real to
show. Adding the Google Maps and JustDial listing URLs in Company settings also
puts "Read every review on…" buttons on the page.

## Before production

- [ ] Change the seeded admin password, and set real secrets in `.env`
- [ ] **Confirm the GST state code.** The address is in Puducherry, so the company is set to state code **34**. Puducherry customers get CGST + SGST, Tamil Nadu customers get IGST. If the GST registration is actually in Tamil Nadu, change it to 33 in Settings → Company before issuing any invoice
- [ ] Put the real GSTIN, PAN and bank details in Settings → Company (seeded as blank on purpose)
- [ ] Have an accountant check the tax treatment and the Excel export columns against current GST rules — tax rules and filing schemas change, and the exports are a working register, not a filing template
- [ ] Decide whether zero-value billing should be allowed (off by default)
- [ ] Serve over HTTPS, set `ALLOWED_ORIGINS` to the real domain
- [ ] Point `DATABASE_URL` at TiDB Cloud (with `sslaccept=strict`), and create the schema with `utf8mb4_general_ci`
- [ ] Confirm TiDB Cloud backups are enabled and test a restore
- [ ] Upload the rubber stamp and signature at Settings → Seal & signature, and check a test invoice PDF before sending one to a customer
- [ ] Point `STORAGE_DIR` at persistent storage — uploaded branding images live on disk, not in the database
- [ ] Object storage for the company logo and any archived PDFs

## Not included

Supplier management, purchasing, inventory and stock tracking are deliberately
out of scope (architecture.md §2.3, §2.4, §39). The schema is arranged so they can
be added later without disturbing quotations, invoices, customers, payments or
reporting.
