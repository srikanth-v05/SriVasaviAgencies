import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Phone } from "lucide-react";
import { usePublicCategories, usePublicCompany, usePublicProducts } from "@/features/queries";

const HeroScene = lazy(() =>
  import("@/components/common/HeroScene").then((m) => ({ default: m.HeroScene })),
);
import { CostInUsePanel } from "@/components/common/CostInUsePanel";
import { Reveal } from "@/components/common/Reveal";
import { Reviews } from "@/components/common/Reviews";
import { ZONES, zoneAccent } from "@/lib/zones";
import { money } from "@/lib/format";
import { telLink, whatsappLink } from "@/lib/contact";

/** Only these three appear in the cost-in-use calculator — a deliberate, curated set, not "whatever loaded first". */
const CALCULATOR_PRODUCTS = ["PHENYL", "SOAP OIL", "ACID"];

export function Home() {
  const { data: allProducts } = usePublicProducts({ limit: 100 });
  const { data: categories } = usePublicCategories();
  const { data: company } = usePublicCompany();

  const all = allProducts?.data ?? [];
  const featured = all.slice(0, 6);
  const calculatorProducts = CALCULATOR_PRODUCTS.map((name) => all.find((p) => p.name.toUpperCase() === name)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );
  const phone = company?.phone ?? "+91 99436 77409";

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-hairline bg-ground">
        {/* A soft crimson-and-gold wash, so the page opens with the crest colours. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            background:
              "radial-gradient(900px 420px at 82% -10%, var(--color-brand-bright), transparent 65%), radial-gradient(680px 340px at 8% 110%, var(--color-gold-bright), transparent 60%)",
          }}
          aria-hidden
        />

        {/* Abstract brand shapes in crimson, gold and plum — quiet ambient motion. */}
        <div className="pointer-events-none absolute inset-0 opacity-70 lg:opacity-100">
          <Suspense fallback={null}>
            <HeroScene />
          </Suspense>
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="rise">
            <p className="type-eyebrow text-gold">Housekeeping chemicals &amp; materials · Villianur</p>

            <h1 className="type-display mt-4 text-4xl text-ink sm:text-5xl lg:text-[3.4rem]">
              Concentrate is cheaper
              <br />
              <span className="text-brand">than it looks.</span>
            </h1>

            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft">
              A five-litre can of white phenyl is not five litres of floor cleaner — diluted 1:20 it is a hundred and
              five. Work out what your cleaning actually costs per litre, then ask us to quote for that quantity.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-brand)] transition-all hover:bg-brand-deep hover:shadow-[var(--shadow-md)] active:scale-[0.98]"
              >
                Browse the catalogue
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
              <Link
                to="/bulk-order"
                className="rounded-lg border border-gold bg-gold-tint px-5 py-2.5 text-sm font-medium text-gold transition-colors hover:bg-gold hover:text-white active:scale-[0.98]"
              >
                Ask for a quotation
              </Link>
              <a
                href={telLink(phone)}
                className="inline-flex items-center gap-2 rounded-lg border border-hairline-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink shadow-[var(--shadow-xs)] transition-colors hover:border-brand hover:text-brand active:scale-[0.98]"
              >
                <Phone className="h-4 w-4" strokeWidth={2} />
                Call us
              </a>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-[4px] border border-hairline bg-hairline">
              {[
                ["Supplied to", "Schools, colleges, hospitals, factories"],
                ["Invoicing", "GST tax invoice with every order"],
                ["Quotation", "Same day, on your indent quantities"],
              ].map(([term, detail]) => (
                <div key={term} className="bg-surface px-3 py-3">
                  <dt className="type-eyebrow text-[10px] text-gold">{term}</dt>
                  <dd className="mt-1.5 text-xs leading-snug text-ink-soft">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* The signature: the sum a procurement officer actually does. */}
          <div className="rise" style={{ animationDelay: "120ms" }}>
            <CostInUsePanel products={calculatorProducts} />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- colour zones */}
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <Reveal className="max-w-2xl">
            <p className="type-eyebrow text-gold">How the catalogue is organised</p>
            <h2 className="type-display mt-3 text-2xl text-ink sm:text-3xl">Four colours, four zones</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Housekeeping teams colour-code cloths, mops and buckets so a washroom mop never reaches a kitchen floor.
              Our catalogue follows the same coding, so whoever raises the indent can match the chemical to the zone
              without reading a datasheet.
            </p>
          </Reveal>

          <Reveal
            as="ul"
            stagger
            className="mt-8 grid gap-px overflow-hidden rounded-[4px] border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4"
          >
            {ZONES.map((zone) => {
              const category = categories?.find((c) => c.zoneCode === zone.code);
              return (
                <li key={zone.code} className="bg-surface">
                  <Link
                    to={category ? `/products?category=${category.id}` : "/products"}
                    className="group block h-full p-5 transition-colors hover:bg-ground"
                  >
                    <span className="block h-1.5 w-12 rounded-full" style={{ background: zoneAccent(zone.code) }} aria-hidden />
                    <h3 className="mt-3 text-sm font-semibold text-ink group-hover:text-brand">{zone.label}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">{zone.usedFor}</p>
                    {category && (
                      <p className="type-data mt-3 text-[11px] text-brand opacity-0 transition-opacity group-hover:opacity-100">
                        View products →
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------ featured strip */}
      {featured.length > 0 && (
        <section className="border-b border-hairline bg-ground">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="type-eyebrow text-gold">In stock and moving</p>
                <h2 className="type-display mt-3 text-2xl text-ink sm:text-3xl">What most buyers order</h2>
              </div>
              <Link to="/products" className="text-sm font-medium text-brand hover:underline">
                See the full catalogue →
              </Link>
            </div>

            <ul className="mt-8 grid gap-px overflow-hidden rounded-[4px] border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((product) => (
                <li key={product.id} className="bg-surface">
                  <Link to={`/products/${product.slug}`} className="group block h-full p-5 transition-colors hover:bg-brand-tint/40">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-ink group-hover:text-brand">{product.name}</h3>
                      {product.category?.zoneCode && (
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: zoneAccent(product.category.zoneCode) }}
                          aria-label={`${product.category.name} zone`}
                        />
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{product.description}</p>
                    <div className="mt-4 flex items-baseline justify-between border-t border-hairline pt-3">
                      <span className="type-data text-sm font-medium text-brand">
                        {money(product.indicativePrice)}
                        <span className="text-[11px] font-normal text-muted"> /{product.unit.shortName}</span>
                      </span>
                      {product.dilutionRatio && (
                        <span className="type-data rounded-full bg-gold-tint px-2 py-0.5 text-[10px] text-gold">
                          {product.dilutionRatio}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ reviews */}
      <Reviews />

      {/* ------------------------------------------------------ closing */}
      <section className="brand-band">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-14">
          <div>
            <h2 className="type-display text-2xl text-white sm:text-3xl">Send us your list.</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/75">
              Quantities, delivery address and GSTIN if you have one. You get a priced quotation back the same working
              day, and an invoice against it when you confirm.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/bulk-order"
              className="rounded-lg bg-gold-bright px-5 py-2.5 text-sm font-semibold text-plum-deep shadow-[var(--shadow-md)] transition-colors hover:bg-white active:scale-[0.98]"
            >
              Request a quotation
            </Link>
            <a
              href={whatsappLink(phone, "Hello, I would like a quotation for housekeeping supplies.")}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 active:scale-[0.98]"
            >
              WhatsApp us
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
