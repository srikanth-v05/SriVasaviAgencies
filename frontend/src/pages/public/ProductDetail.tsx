import { Link, useParams } from "react-router-dom";
import { usePublicProduct, usePublicProducts } from "@/features/queries";
import { money, percent } from "@/lib/format";
import { zoneAccent, zoneLabel } from "@/lib/zones";
import { CostInUsePanel } from "@/components/common/CostInUsePanel";
import { ErrorState, Spinner } from "@/components/common/ui";

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, error, refetch } = usePublicProduct(slug);
  const { data: related } = usePublicProducts({ categoryId: product?.category?.id, limit: 4 });

  if (isLoading) return <Spinner label="Loading product" />;
  if (error || !product) return <ErrorState error={error ?? new Error("Product not found")} onRetry={() => void refetch()} />;

  const accent = zoneAccent(product.category?.zoneCode);
  const siblings = (related?.data ?? []).filter((p) => p.id !== product.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <nav className="type-data text-xs text-muted" aria-label="Breadcrumb">
        <Link to="/products" className="hover:text-brand">
          Catalogue
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-soft">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="block h-1 w-14" style={{ background: accent }} aria-hidden />

          <h1 className="type-display mt-4 text-3xl text-ink sm:text-4xl">{product.name}</h1>

          {product.category && (
            <p className="type-eyebrow mt-3">
              {zoneLabel(product.category.zoneCode) ?? product.category.name} zone
            </p>
          )}

          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-soft">{product.description}</p>

          <dl className="mt-8 grid gap-px border border-hairline bg-hairline sm:grid-cols-2">
            {[
              ["Indicative price", `${money(product.indicativePrice)} per ${product.unit.shortName}`],
              ["GST", percent(product.gstRate)],
              ["Pack size", product.packSize ?? "Ask us"],
              ["Dilution", product.dilutionRatio ?? "Use neat"],
              ["HSN code", product.hsnCode ?? "—"],
              ["Product code", product.productCode],
            ].map(([term, value]) => (
              <div key={term} className="bg-surface px-4 py-3">
                <dt className="type-eyebrow text-[10px]">{term}</dt>
                <dd className="type-data mt-1.5 text-sm text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={`/bulk-order?product=${product.slug}`}
              className="rounded-[3px] bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-deep"
            >
              Get a quotation for this
            </Link>
            <Link
              to="/products"
              className="rounded-[3px] border border-hairline bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:border-brand hover:text-brand"
            >
              Back to catalogue
            </Link>
          </div>

          <p className="mt-4 max-w-lg text-xs leading-relaxed text-muted">
            The price above is our list price. Quoted prices depend on quantity and delivery, and the quotation we send
            is the figure that stands.
          </p>
        </div>

        <div>
          <CostInUsePanel products={[product]} />
        </div>
      </div>

      {siblings.length > 0 && (
        <section className="mt-14">
          <h2 className="type-eyebrow">Also in this zone</h2>
          <ul className="mt-4 grid gap-px border border-hairline bg-hairline sm:grid-cols-3">
            {siblings.map((sibling) => (
              <li key={sibling.id} className="bg-surface">
                <Link to={`/products/${sibling.slug}`} className="block p-4 transition-colors hover:bg-ground">
                  <h3 className="text-sm font-medium text-ink">{sibling.name}</h3>
                  <p className="type-data mt-2 text-xs text-muted">
                    {money(sibling.indicativePrice)} /{sibling.unit.shortName}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
