/**
 * Indian financial year helpers. The FY runs 1 April - 31 March, and document
 * numbering is scoped to it (architecture.md §17).
 */

/** 2026-08-25 -> "2026-27"; 2026-02-10 -> "2025-26". */
export function financialYearOf(date: Date): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endShort}`;
}

/** Inclusive start and exclusive end instants of a financial year label. */
export function financialYearRange(label: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) throw new Error(`Invalid financial year label: ${label}`);
  const startYear = Number(match[1]);
  return {
    start: new Date(Date.UTC(startYear, 3, 1)),
    end: new Date(Date.UTC(startYear + 1, 3, 1)),
  };
}

export function currentFinancialYear(): string {
  return financialYearOf(new Date());
}
