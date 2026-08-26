import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Phone, MessageCircle, Mail, MapPin, Menu, X } from "lucide-react";
import { usePublicCompany } from "@/features/queries";
import { telLink, whatsappLink } from "@/lib/contact";

const NAV = [
  { to: "/products", label: "Catalogue" },
  { to: "/bulk-order", label: "Bulk order" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function PublicLayout() {
  const { data: company } = usePublicCompany();
  const [menuOpen, setMenuOpen] = useState(false);

  const phone = company?.phone ?? "+91 99436 77409";
  const altPhone = company?.alternatePhone ?? "+91 90928 97386";

  return (
    <div className="flex min-h-screen flex-col bg-ground">
      {/* Gold rule under the brand band — the crest colours, not the zone coding. */}
      <div className="gold-rule h-1" aria-hidden />

      {/* Contact strip: the two numbers, always one tap away. */}
      <div className="brand-band text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2 text-[12px]">
          <p className="flex items-center gap-1.5 text-white/80">
            <MapPin className="h-3.5 w-3.5 text-gold-bright" strokeWidth={2} />
            Housekeeping chemicals &amp; materials · Villianur, Puducherry
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a href={telLink(phone)} className="type-data flex items-center gap-1.5 transition-colors hover:text-gold-bright">
              <Phone className="h-3.5 w-3.5" strokeWidth={2} />
              {phone}
            </a>
            <a href={telLink(altPhone)} className="type-data hidden transition-colors hover:text-gold-bright sm:inline">
              {altPhone}
            </a>
            <a
              href={whatsappLink(phone)}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1.5 transition-colors hover:text-gold-bright"
            >
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <header className="surface-glass sticky top-0 z-40 border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="group flex items-center gap-3">
            <img
              src={company?.logoUrl || "/logo.jpg"}
              alt=""
              width={42}
              height={42}
              className="crest h-10 w-10 shrink-0 transition-transform duration-200 group-hover:scale-105"
            />
            <span>
              <span className="type-display block text-lg leading-none text-brand">SRI VASAVI</span>
              <span className="type-eyebrow text-[9px] text-gold">Agencies · Puducherry</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? "font-medium text-brand" : "text-ink-soft hover:bg-brand-tint/40 hover:text-brand"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    <span
                      className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand transition-all duration-200 ${
                        isActive ? "opacity-100" : "opacity-0"
                      }`}
                      aria-hidden
                    />
                  </>
                )}
              </NavLink>
            ))}

            <Link
              to="/bulk-order"
              className="ml-2 rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-deep"
            >
              Get a quote
            </Link>

            {/* Staff sign-in, so nobody has to type the URL. */}
            <Link
              to="/admin/login"
              className="rounded-lg border border-gold px-4 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold hover:text-white"
            >
              Sign in
            </Link>
          </nav>

          <button
            type="button"
            className="rounded-lg border border-hairline-strong p-2 text-ink-soft md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
          </button>
        </div>

        {menuOpen && (
          <nav id="mobile-nav" className="border-t border-hairline bg-surface px-5 py-4 md:hidden">
            <ul className="flex flex-col gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2.5 text-sm ${
                        isActive ? "bg-brand-tint font-medium text-brand-deep" : "text-ink-soft hover:bg-ground-deep"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li className="mt-2 flex flex-wrap gap-2 border-t border-hairline pt-3">
                <Link
                  to="/bulk-order"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white"
                >
                  Get a quote
                </Link>
                <Link
                  to="/admin/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg border border-gold px-4 py-2 text-xs font-medium text-gold"
                >
                  Sign in
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="brand-band text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <img src={company?.logoUrl || "/logo.jpg"} alt="" width={44} height={44} className="crest h-11 w-11" />
              <p className="type-display text-base leading-tight">
                SRI VASAVI
                <span className="block text-[11px] font-normal tracking-widest text-gold-bright">AGENCIES</span>
              </p>
            </div>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-white/70">
              Housekeeping chemicals and cleaning materials, supplied by the can and by the drum across Puducherry and
              Tamil Nadu.
            </p>
          </div>

          <div>
            <p className="type-eyebrow text-gold-bright">Reach us</p>
            <ul className="mt-3 space-y-2 text-xs text-white/80">
              <li>
                <a className="type-data flex items-center gap-2 hover:text-gold-bright" href={telLink(phone)}>
                  <Phone className="h-3.5 w-3.5 text-gold-bright" strokeWidth={2} />
                  {phone}
                </a>
              </li>
              <li>
                <a className="type-data flex items-center gap-2 hover:text-gold-bright" href={telLink(altPhone)}>
                  <Phone className="h-3.5 w-3.5 text-gold-bright" strokeWidth={2} />
                  {altPhone}
                </a>
              </li>
              <li>
                <a
                  className="flex items-center gap-2 hover:text-gold-bright"
                  href={whatsappLink(phone)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-gold-bright" strokeWidth={2} />
                  WhatsApp us
                </a>
              </li>
              {company?.email && (
                <li>
                  <a className="flex items-center gap-2 break-all hover:text-gold-bright" href={`mailto:${company.email}`}>
                    <Mail className="h-3.5 w-3.5 shrink-0 text-gold-bright" strokeWidth={2} />
                    {company.email}
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <p className="type-eyebrow text-gold-bright">Address</p>
            <address className="mt-3 flex gap-2 text-xs not-italic leading-relaxed text-white/80">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-bright" strokeWidth={2} />
              <span>
                {company ? (
                  <>
                    {company.addressLine1}
                    <br />
                    {company.addressLine2 && (
                      <>
                        {company.addressLine2}
                        <br />
                      </>
                    )}
                    {company.city} {company.pincode}
                    <br />
                    {company.state}
                  </>
                ) : (
                  <>
                    No. 1, Villupuram Main Road
                    <br />
                    Sundara Murthi Vinayaga Puram, Villianur
                    <br />
                    Puducherry 605110
                  </>
                )}
              </span>
            </address>
            {company?.gstin && <p className="type-data mt-2 text-[11px] text-white/60">GSTIN {company.gstin}</p>}
          </div>

          <div>
            <p className="type-eyebrow text-gold-bright">Pages</p>
            <ul className="mt-3 space-y-1.5 text-xs text-white/80">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="transition-colors hover:text-gold-bright">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/admin/login" className="transition-colors hover:text-gold-bright">
                  Staff sign-in
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15">
          <p className="mx-auto max-w-6xl px-5 py-4 text-[11px] text-white/55">
            © {new Date().getFullYear()} Sri Vasavi Agencies. Prices shown are indicative and exclude GST unless stated.
          </p>
        </div>
      </footer>
    </div>
  );
}
