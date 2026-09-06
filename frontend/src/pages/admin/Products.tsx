import { useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCategories, useDeleteProduct, useImportCatalog, useProducts, useSetProductStatus } from "@/features/queries";
import { download } from "@/api/client";
import {
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  Pager,
  Panel,
  PanelHeader,
  Select,
  Spinner,
  TableShell,
} from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";
import { amount, percent } from "@/lib/format";
import { zoneAccent } from "@/lib/zones";
import { useAuth } from "@/hooks/useAuth";

export function Products() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { can } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const page = Number(params.get("page") ?? 1);
  const categoryId = params.get("categoryId") ?? undefined;
  const search = params.get("search") ?? undefined;

  const { data: categories } = useCategories();
  const { data, isLoading, error, refetch } = useProducts({ page, limit: 25, categoryId, search });
  const setStatus = useSetProductStatus();
  const remove = useDeleteProduct();
  const importCatalog = useImportCatalog();

  const pickFile = () => fileInput.current?.click();

  const onFileChosen = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const products = Array.isArray(parsed) ? parsed : parsed.products;
      if (!Array.isArray(products)) throw new Error("This file has no \"products\" list in it.");

      const result = await importCatalog.mutateAsync(products);
      toast.success(`Import done — ${result.created} created, ${result.updated} updated, ${result.failed} failed`);
      if (result.errors.length > 0) {
        toast.error(result.errors.slice(0, 3).map((e) => `Row ${e.row} (${e.name}): ${e.message}`).join(" · "));
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not import that file"));
    }
  };

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const writable = can("products:write");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-display text-2xl text-ink">Products</h1>
          <p className="mt-1 text-xs text-muted">
            Prices here are defaults. Any document can be billed at a different price.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void download("/products/export")}>
            Export catalog
          </Button>
          {writable && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void onFileChosen(file);
                }}
              />
              <Button variant="secondary" onClick={pickFile} disabled={importCatalog.isPending}>
                {importCatalog.isPending ? "Importing…" : "Import catalog"}
              </Button>
              <LinkButton to="/admin/products/new">New product</LinkButton>
            </>
          )}
        </div>
      </header>

      <Panel>
        <PanelHeader
          title="Catalogue"
          actions={
            <div className="flex flex-wrap gap-2">
              <input
                className="field-input w-44"
                placeholder="Name, code or HSN"
                defaultValue={search ?? ""}
                aria-label="Search products"
                onKeyDown={(e) => {
                  if (e.key === "Enter") setParam("search", (e.target as HTMLInputElement).value.trim() || undefined);
                }}
              />
              <Select
                className="w-48"
                value={categoryId ?? ""}
                onChange={(e) => setParam("categoryId", e.target.value || undefined)}
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          }
        />

        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : data && data.data.length === 0 ? (
          <EmptyState
            title="No products match"
            description="Add the chemicals and materials you sell."
            action={writable ? <LinkButton to="/admin/products/new" size="sm">New product</LinkButton> : undefined}
          />
        ) : (
          <>
            <TableShell
              head={
                <>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">HSN</th>
                  <th className="px-4 py-2">Unit</th>
                  <th className="px-4 py-2 text-right">List price</th>
                  <th className="px-4 py-2 text-right">GST</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="w-28 px-4 py-2" />
                </>
              }
            >
              {data?.data.map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-ground">
                  <td className="type-data px-4 py-2.5 text-xs text-muted">{product.productCode}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: zoneAccent(product.category?.zoneCode) }}
                        aria-hidden
                      />
                      {writable ? (
                        <Link to={`/admin/products/${product.id}`} className="text-sm text-brand hover:underline">
                          {product.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-ink">{product.name}</span>
                      )}
                    </div>
                    {product.category && <p className="ml-4 text-[11px] text-muted">{product.category.name}</p>}
                  </td>
                  <td className="type-data px-4 py-2.5 text-xs text-ink-soft">{product.hsnCode ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{product.unit.shortName}</td>
                  <td className="cell-num px-4 py-2.5 text-sm">{amount(product.defaultPrice)}</td>
                  <td className="cell-num px-4 py-2.5 text-xs text-muted">{percent(product.defaultGstRate)}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {product.isActive ? <span className="text-zone-green">Active</span> : <span className="text-muted">Inactive</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {writable && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void (async () => {
                              try {
                                await setStatus.mutateAsync({ id: product.id, isActive: !product.isActive });
                                toast.success(product.isActive ? "Product deactivated" : "Product activated");
                              } catch (err) {
                                toast.error(errorMessage(err));
                              }
                            })()
                          }
                        >
                          {product.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <button
                          type="button"
                          aria-label={`Delete ${product.name}`}
                          className="rounded px-1.5 py-1 text-xs text-muted hover:text-danger"
                          onClick={() =>
                            void (async () => {
                              if (!window.confirm(`Delete ${product.name}? Products used on documents cannot be deleted.`)) return;
                              try {
                                await remove.mutateAsync(product.id);
                                toast.success("Product deleted");
                              } catch (err) {
                                toast.error(errorMessage(err));
                              }
                            })()
                          }
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
            {data?.pagination && (
              <Pager
                page={data.pagination.page}
                pages={data.pagination.pages}
                total={data.pagination.total}
                onChange={(p) => setParam("page", String(p))}
              />
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
