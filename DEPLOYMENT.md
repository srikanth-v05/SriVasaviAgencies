# Deploying — Vercel (website) + Render (API) + TiDB Cloud (database)

Three services. The website is static and goes to Vercel; the API is a Node
process on Render; the database is TiDB Cloud.

```
Browser ──▶ Vercel (website)
              │  /api/*     rewritten
              │  /uploads/* rewritten
              ▼
            Render (API) ──▶ TiDB Cloud
```

**Vercel rewrites `/api` through to Render, rather than the browser calling
Render directly.** That is deliberate: the browser sees one origin, so the
refresh-token cookie keeps working and there is no CORS to configure. Calling
Render directly is possible — see [Calling the API directly](#calling-the-api-directly) —
but it needs two extra settings, and getting either wrong logs everyone out
fifteen minutes after they sign in.

---

## 1. Database — TiDB Cloud

1. Create a free **Serverless** cluster at [tidbcloud.com](https://tidbcloud.com).
2. **Connect → General**, and copy the details.
3. Open the SQL editor and create the schema. The collation matters — TiDB
   defaults to `utf8mb4_bin`, which would make searching "phenyl" miss "White
   Phenyl":

   ```sql
   CREATE DATABASE sva_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
   ```

4. Build the connection string. **`sslaccept=strict` is required** — TiDB Cloud
   refuses connections without TLS:

   ```
   mysql://<user>:<password>@<host>:4000/sva_erp?sslaccept=strict
   ```

If the password contains `@`, `/`, `:` or `#`, percent-encode it or the URL will
parse wrongly.

---

## 2. API — Render

### Create the service

**New → Blueprint**, point it at the repository, and Render reads
[`render.yaml`](render.yaml). Or create a Web Service by hand with:

| Setting | Value |
|---|---|
| Root directory | *(leave blank — it is a monorepo)* |
| Build command | `npm ci --include=dev && npm run build --workspace=backend && npm run prisma:deploy --workspace=backend` |
| Start command | `npm run start --workspace=backend` |
| Health check path | `/health` |

Migrations run in the build step, so they finish before the new instance takes
traffic.

**Use `npm ci --include=dev`.** Two things are going on:

- `ci` installs exactly what `package-lock.json` pins; `install` may resolve
  newer versions.
- `--include=dev` is required because `NODE_ENV=production` is set for the
  running service, and npm reads it at install time too — skipping every
  devDependency, which is where TypeScript, prisma and all the `@types` live.
  Without the flag the build has no compiler and no type declarations.

### Environment variables

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the TiDB string from step 1 |
| `JWT_SECRET` | 64 random characters |
| `REFRESH_TOKEN_SECRET` | 64 random characters, **different** from the above |
| `ACCESS_TOKEN_TTL` | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | `7` |
| `COOKIE_SAMESITE` | `strict` |
| `STORAGE_DIR` | `/var/data/storage` |
| `LOG_LEVEL` | `info` |
| `ALLOWED_ORIGINS` | your Vercel URL — only needed if you skip the rewrite |

Generate each secret separately:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Add a disk, or lose your signature

The uploaded logo, rubber stamp and signature are **files on disk**, not rows in
the database. Render wipes the filesystem on every deploy, so without a disk they
disappear and invoices quietly start printing unsigned.

**Render → Disks → Add Disk**: mount path `/var/data`, 1 GB. Then set
`STORAGE_DIR=/var/data/storage`.

Disks are not on the free plan. On free, either re-upload the branding after each
deploy, or leave the seal and signature empty and sign the printed copy by hand —
the block leaves space for exactly that.

### Free plan spins down

A free service sleeps after 15 minutes idle, and the next request takes roughly
50 seconds to wake it. Fine for occasional use; irritating if someone is billing
all afternoon. The paid Starter plan stays warm.

---

## 3. Website — Vercel

**Add New → Project**, import the repository. [`vercel.json`](vercel.json) sets
the build; the framework preset can stay on Vite.

**Before the first deploy, edit `vercel.json`** and replace the placeholder host
in both rewrites with your Render URL:

```json
{ "source": "/api/:path*",     "destination": "https://sva-api.onrender.com/api/:path*" },
{ "source": "/uploads/:path*", "destination": "https://sva-api.onrender.com/uploads/:path*" }
```

Both matter. `/api` carries the application; `/uploads` serves the logo, stamp
and signature — miss it and the site loads but the crest is broken.

The third rewrite sends everything else to `index.html`. Without it, opening
`/admin/login` directly or refreshing on `/products` returns a Vercel 404.

No environment variables are needed on Vercel for this setup.

---

## 4. First run

Seed the company, the administrator and the masters. From your machine, pointed
at the production database:

```bash
cd backend
DATABASE_URL="mysql://…?sslaccept=strict" \
SEED_ADMIN_EMAIL="you@example.com" \
SEED_ADMIN_PASSWORD="<a long password>" \
npx tsx prisma/seed.ts
```

Set both `SEED_ADMIN_*` values. Leave them out and it falls back to the
placeholder password that is committed in this repository.

The seed creates **no products and no customers** — add your own through the
admin. `npm run seed:demo` adds a sample catalogue if you want to try things out
first; `npm run db:clean-demo` removes it again.

---

## 5. Check it worked

```bash
curl https://sva-api.onrender.com/health                  # API alive
curl https://your-site.vercel.app/api/v1/public/company   # rewrite reaching Render
```

Then in a browser:

1. Open the site — the crest should render, which proves `/uploads` rewrites.
2. Sign in at `/admin/login`.
3. **Leave the tab for twenty minutes, then click something.** The access token
   expires after fifteen, so this is what proves the refresh cookie survives. If
   you are thrown back to the login screen, see below.
4. Issue a test invoice and open the PDF.
5. Delete the test invoice's data with `db:clean-demo` before real trading.

---

## Calling the API directly

Skipping the Vercel rewrite and pointing the browser straight at Render takes
three changes together — all three, or sessions break:

| Where | Setting |
|---|---|
| Vercel | `VITE_API_URL` = `https://sva-api.onrender.com/api/v1` |
| Render | `ALLOWED_ORIGINS` = `https://your-site.vercel.app` |
| Render | `COOKIE_SAMESITE` = `none` |

`COOKIE_SAMESITE=none` is the one people miss. A `strict` cookie is never sent on
a cross-site request, so login appears to work and then the session dies at the
first refresh, fifteen minutes later.

---

## When something is wrong

| What you see | Why |
|---|---|
| Site loads, every API call 404s | The `/api` rewrite still has the placeholder host |
| Logo and crest broken | The `/uploads` rewrite is missing |
| Refresh on `/products` gives a 404 | The catch-all rewrite to `index.html` is missing |
| Logged out after ~15 minutes | Refresh cookie not reaching the API — see the section above |
| Seal and signature vanished after a deploy | No Render disk; `STORAGE_DIR` is on the ephemeral filesystem |
| First request each morning takes ~50s | Free plan cold start |
| `P1001: can't reach database` | `sslaccept=strict` missing, or the TiDB Cloud IP allowlist |
| Searching "phenyl" misses "White Phenyl" | Database created without `utf8mb4_general_ci` |

---

## Before real invoices go out

- [ ] Change the seeded admin password
- [ ] Put the real GSTIN, address and bank details in Settings → Company
- [ ] **Confirm the GST state code** — Puducherry (34) decides CGST+SGST vs IGST
- [ ] Upload the stamp and signature, and check one PDF
- [ ] Confirm the Render disk is mounted, or accept re-uploading branding each deploy
- [ ] Have an accountant check the tax treatment and the Excel export columns
- [ ] Confirm TiDB Cloud backups are on, and test a restore
- [ ] Never run the smoke tests against production — they create customers and
      issue real invoices
