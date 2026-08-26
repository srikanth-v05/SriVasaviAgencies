import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { PublicProduct } from "@/types";
import { money } from "@/lib/format";
import { zoneAccent } from "@/lib/zones";

/**
 * Cost-in-use calculator.
 *
 * A bulk buyer does not compare the price of a can; they compare what a litre of
 * *usable* solution costs once the concentrate is diluted, and what that comes to
 * over a month. This panel does exactly that sum, using real catalogue prices.
 *
 * Figures are indicative. The quotation is what binds.
 */

interface Props {
  products: PublicProduct[];
}

/** "1:20" -> 20. Anything that is not a ratio (e.g. "Use neat") means no dilution. */
function parseDilution(ratio: string | null): number {
  if (!ratio) return 0;
  const match = /(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/.exec(ratio);
  if (!match) return 0;
  const parts = Number(match[2]) / Number(match[1]);
  return Number.isFinite(parts) && parts > 0 ? parts : 0;
}

export function CostInUsePanel({ products }: Props) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [packSize, setPackSize] = useState(5);
  const [litresPerDay, setLitresPerDay] = useState(40);

  const product = products.find((p) => p.id === selectedId) ?? products[0];

  const result = useMemo(() => {
    if (!product) return null;

    const pricePerUnit = Number(product.indicativePrice) || 0;
    const parts = parseDilution(product.dilutionRatio);
    // Undiluted products still work here: one litre of concentrate is one litre of use.
    const solutionPerUnit = parts > 0 ? 1 + parts : 1;

    const solutionPerPack = solutionPerUnit * packSize;
    const packPrice = pricePerUnit * packSize;
    const costPerLitreOfUse = solutionPerPack > 0 ? packPrice / solutionPerPack : 0;

    const litresPerMonth = litresPerDay * 26; // a six-day working month
    const packsPerMonth = solutionPerPack > 0 ? litresPerMonth / solutionPerPack : 0;
    const monthlySpend = packsPerMonth * packPrice;

    return {
      parts,
      solutionPerPack,
      packPrice,
      costPerLitreOfUse,
      packsPerMonth,
      monthlySpend,
      litresPerMonth,
    };
  }, [product, packSize, litresPerDay]);

  if (!product || !result) {
    return (
      <div className="panel p-6">
        <p className="type-eyebrow">Cost in use</p>
        <p className="mt-3 text-sm text-muted">The calculator loads once the catalogue is available.</p>
      </div>
    );
  }

  const accent = zoneAccent(product.category?.zoneCode ?? null);

  return (
    <div className="panel overflow-hidden">
      {/* The header reads like the label screen-printed on the can. */}
      <div className="border-b border-hairline px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="type-eyebrow">Cost in use</p>
            <h2 className="type-display mt-1.5 text-xl text-ink">What a litre really costs</h2>
          </div>
          <span className="mt-1 h-8 w-1.5 shrink-0" style={{ background: accent }} aria-hidden />
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div>
          <label className="field-label" htmlFor="ciu-product">
            Product
          </label>
          <select
            id="ciu-product"
            className="field-input"
            value={product.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {products.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="ciu-pack">
              Pack size ({product.unit.shortName})
            </label>
            <input
              id="ciu-pack"
              type="number"
              min={1}
              max={250}
              step={1}
              className="field-input type-data text-right"
              value={packSize}
              onChange={(event) => setPackSize(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="ciu-usage">
              Solution used per day
            </label>
            <input
              id="ciu-usage"
              type="number"
              min={1}
              max={5000}
              step={5}
              className="field-input type-data text-right"
              value={litresPerDay}
              onChange={(event) => setLitresPerDay(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
        </div>

        <p className="type-data text-[11px] text-muted">
          {result.parts > 0
            ? `Dilution ${product.dilutionRatio} — one part concentrate to ${result.parts} parts water.`
            : "Used neat — no dilution applied."}
        </p>
      </div>

      {/* The answer, given the weight it deserves. */}
      <div className="border-t border-hairline bg-ground px-5 py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="type-eyebrow">Cost per litre of solution</p>
            <p className="type-display mt-1 text-4xl text-brand">{money(result.costPerLitreOfUse)}</p>
          </div>
          <div className="text-right">
            <p className="type-eyebrow">From one pack</p>
            <p className="type-data mt-1 text-lg text-ink">{result.solutionPerPack.toFixed(0)} L</p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-px border border-hairline bg-hairline">
          {[
            ["Pack price", money(result.packPrice)],
            ["Packs / month", result.packsPerMonth.toFixed(1)],
            ["Monthly spend", money(result.monthlySpend)],
          ].map(([term, value]) => (
            <div key={term} className="bg-surface px-3 py-2.5">
              <dt className="type-eyebrow text-[10px]">{term}</dt>
              <dd className="type-data mt-1 text-sm text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          Based on {result.litresPerMonth.toLocaleString("en-IN")} litres of solution a month (26 working days).
          Indicative prices, exclusive of GST.{" "}
          <Link to="/bulk-order" className="text-brand hover:underline">
            Ask us to quote this quantity
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
