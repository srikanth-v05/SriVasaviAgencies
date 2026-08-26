import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePublicCategories, usePublicProducts } from "@/features/queries";
import { money } from "@/lib/format";
import { zoneAccent } from "@/lib/zones";
import { EmptyState, Spinner } from "@/components/common/ui";

export function Products() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const categoryId = params.get("category") ?? undefined;
  const page = Number(params.get("page") ?? 1);

  const { data: categories } = usePublicCategories();
  const { data, isLoading } = usePublicProducts({
    categoryId,
    search: params.get("q") ?? undefined,
    page,
    limit: 24,
  });

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const products = data?.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="max-w-2xl">
        <p className="type-eyebrow">Catalogue</p>
        <h1 className="type-display mt-3 text-3xl text-ink sm:text-4xl">Chemicals and materials</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Prices are indicative list prices per unit and exclude GST. Bulk quantities are quoted separately — ask and
          we will price your actual list.
        </p>
      </header>

      <form
        className="mt-8 flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setParam("q", search.trim() || undefined);
        }}
        role="search"
      >
        <label className="sr-only" htmlFor="catalogue-search">
          Search the catalogue
        </label>
        <input
          id="catalogue-search"
          className="field-input max-w-xs"
          placeholder="Phenyl, gloves, HSN 3808…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="submit" className="rounded-[3px] bg-brand px-4 py-2 text-sm text-white hover:bg-brand-deep">
          Search
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setParam("category", undefined)}
          className={`rounded-[3px] border px-3 py-1.5 text-xs transition-colors ${
            categoryId ? "border-hairline bg-surface text-ink-soft hover:border-brand" : "border-brand bg-brand text-white"
          }`}
        >
          All zones
        </button>
        {categories?.map((category) => {
          const active = categoryId === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setParam("category", category.id)}
              className={`flex items-center gap-2 rounded-[3px] border px-3 py-1.5 text-xs transition-colors ${
                active ? "border-brand bg-brand text-white" : "border-hairline bg-surface text-ink-soft hover:border-brand"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: active ? "rgba(255,255,255,.9)" : zoneAccent(category.zoneCode) }}
                aria-hidden
              />
              {category.name}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <Spinner label="Loading the catalogue" />
      ) : products.length === 0 ? (
        <div className="panel mt-8">
          <EmptyState
            title="Nothing matched that search"
            description="Try a broader word, or call us — we stock more than the website lists."
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.id} className="bg-surface">
              <Link to={`/products/${product.slug}`} className="group flex h-full flex-col p-5 transition-colors hover:bg-ground">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold text-ink group-hover:text-brand">{product.name}</h2>
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: zoneAccent(product.category?.zoneCode) }}
                    aria-hidden
                  />
                </div>

                <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-muted">{product.description}</p>

                <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline pt-3 text-[11px] text-muted">
                  {product.packSize && (
                    <div className="flex gap-1">
                      <dt>Pack</dt>
                      <dd className="type-data text-ink-soft">{product.packSize}</dd>
                    </div>
                  )}
                  {product.dilutionRatio && (
                    <div className="flex gap-1">
                      <dt>Dilute</dt>
                      <dd className="type-data text-ink-soft">{product.dilutionRatio}</dd>
                    </div>
                  )}
                  {product.hsnCode && (
                    <div className="flex gap-1">
                      <dt>HSN</dt>
                      <dd className="type-data text-ink-soft">{product.hsnCode}</dd>
                    </div>
                  )}
                </dl>

                <p className="type-data mt-3 text-sm text-ink">
                  {money(product.indicativePrice)}
                  <span className="text-[11px] text-muted"> /{product.unit.shortName}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data?.pagination && data.pagination.pages > 1 && (
        <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Catalogue pages">
          <p className="type-data text-xs text-muted">
            Page {data.pagination.page} of {data.pagination.pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
              className="rounded-[3px] border border-hairline bg-surface px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= data.pagination.pages}
              onClick={() => setParam("page", String(page + 1))}
              className="rounded-[3px] border border-hairline bg-surface px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
