/**
 * Housekeeping colour zoning — the coding real cleaning teams use so a washroom
 * mop never reaches a kitchen floor. The catalogue is organised around it, so
 * whoever raises the indent can match chemical to zone without a datasheet.
 */

export interface Zone {
  code: string;
  label: string;
  usedFor: string;
}

export const ZONES: Zone[] = [
  { code: "red", label: "Washroom & sanitary", usedFor: "Toilets, urinals, washroom floors and fittings." },
  { code: "blue", label: "General & glass", usedFor: "Offices, corridors, glass and low-risk surfaces." },
  { code: "green", label: "Kitchen & canteen", usedFor: "Food preparation areas, canteens and dishwash." },
  { code: "yellow", label: "Clinical & infectious", usedFor: "Sick bays, clinics, isolation and spill response." },
];

const ACCENTS: Record<string, string> = {
  red: "#c8384e",
  blue: "#2f5fbf",
  green: "#3e8e4e",
  yellow: "#b8791a",
};

/** Falls back to the brand teal for products with no zone (mops, gloves, tools). */
export function zoneAccent(code: string | null | undefined): string {
  return (code && ACCENTS[code]) || "#0f6e63";
}

export function zoneLabel(code: string | null | undefined): string | null {
  return ZONES.find((z) => z.code === code)?.label ?? null;
}
