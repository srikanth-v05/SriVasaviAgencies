/**
 * Phone links. Numbers are stored in display form ("+91 99436 77409"), so the
 * digits have to be extracted for tel: and wa.me, and wa.me additionally needs a
 * country code that a locally-entered 10-digit mobile will not have.
 */

export function telLink(phone: string | null | undefined): string {
  return `tel:${(phone ?? "").replace(/\D/g, "")}`;
}

export function whatsappLink(phone: string | null | undefined, message?: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCountry}${query}`;
}
