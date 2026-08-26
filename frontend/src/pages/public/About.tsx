import { Link } from "react-router-dom";
import { usePublicCompany } from "@/features/queries";
import { ZONES, zoneAccent } from "@/lib/zones";

export function About() {
  const { data: company } = usePublicCompany();

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="flex flex-wrap items-start gap-6">
        <img src={company?.logoUrl || "/logo.jpg"} alt="" width={96} height={96} className="crest h-24 w-24 shrink-0" />
        <div className="max-w-2xl">
          <p className="type-eyebrow text-gold">About</p>
          <h1 className="type-display mt-3 text-3xl text-ink sm:text-4xl">
            A supply house, not a shop.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
            Sri Vasavi Agencies supplies housekeeping chemicals and cleaning materials to organisations that clean the
            same floors every day — schools and colleges, hospitals and clinics, factories, hostels and offices across
            Puducherry and Tamil Nadu. We also sell to individual customers over the counter.
          </p>
        </div>
      </header>

      <div className="mt-12 grid gap-px border border-hairline bg-hairline sm:grid-cols-3">
        {[
          [
            "We sell concentrate",
            "Ready-to-use bottles are mostly water and freight. Concentrate dilutes on site, which is why we publish dilution ratios beside every price.",
          ],
          [
            "We quote before we bill",
            "Institutional buyers need a document to raise an indent against. Every order starts as a quotation, and the invoice matches it line for line.",
          ],
          [
            "We invoice properly",
            "GST tax invoice with HSN codes, CGST/SGST or IGST shown separately, and a monthly ledger if you buy on account.",
          ],
        ].map(([title, body]) => (
          <section key={title} className="bg-surface p-6">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">{body}</p>
          </section>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="type-display text-2xl text-ink">What we stock</h2>
        <ul className="mt-6 grid gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          {ZONES.map((zone) => (
            <li key={zone.code} className="bg-surface p-5">
              <span className="block h-1 w-10" style={{ background: zoneAccent(zone.code) }} aria-hidden />
              <h3 className="mt-3 text-sm font-semibold text-ink">{zone.label}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{zone.usedFor}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Plus mops, brooms, wipers, dusters, gloves and the rest of the trolley.{" "}
          <Link to="/products" className="text-brand hover:underline">
            See the catalogue
          </Link>
          .
        </p>
      </section>

      {company && (
        <section className="panel mt-14 p-6">
          <h2 className="type-eyebrow text-gold">Registered details</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted">Name</dt>
              <dd className="mt-1 text-sm text-ink">{company.name}</dd>
            </div>
            {company.gstin && (
              <div>
                <dt className="text-xs text-muted">GSTIN</dt>
                <dd className="type-data mt-1 text-sm text-ink">{company.gstin}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted">Address</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink">
                {company.addressLine1}, {company.city} {company.pincode}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
