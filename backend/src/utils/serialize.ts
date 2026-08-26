import { Prisma } from "@prisma/client";

/**
 * Prisma returns Decimal instances, which JSON.stringify would render as objects.
 * Convert them to numbers on the way out so API consumers get plain JSON.
 * Amounts carry at most 4 dp, well inside the exact range of a double.
 */
export function serialize<T>(value: T): T {
  return convert(value) as T;
}

function convert(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(convert);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = convert(v);
    }
    return out;
  }
  return value;
}
