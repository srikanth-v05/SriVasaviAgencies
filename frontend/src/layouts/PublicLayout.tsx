import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-1.5 text-[12px]">
          <p className="text-white/80">Housekeeping chemicals &amp; materials · Villianur, Puducherry</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a href={telLink(phone)} className="type-data hover:text-gold-bright">
              {phone}
            </a>
            <a href={telLink(altPhone)} className="type-data hidden hover:text-gold-bright sm:inline">
              {altPhone}
            </a>
            <a
              href={whatsappLink(phone)}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-gold-bright"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-hairline bg-ground/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2.5">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={company?.logoUrl || "/logo.jpg"}
              alt=""
              width={40}
              height={40}
              className="crest h-10 w-10 shrink-0"
            />
            <span>
              <span className="type-display block text-lg leading-none text-brand">SRI VASAVI</span>
              <span className="type-eyebrow text-[9px] text-gold">Agencies · Puducherry</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm transition-colors ${isActive ? "font-medium text-brand" : "text-ink-soft hover:text-brand"}`
                }
              >
                {item.label}
              </NavLink>
            ))}

            <Link
              to="/bulk-order"
              className="rounded-[4px] bg-brand px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-deep"
            >
              Get a quote
            </Link>

            {/* Staff sign-in, so nobody has to type the URL. */}
            <Link
              to="/admin/login"
              className="rounded-[4px] border border-gold px-3.5 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold hover:text-white"
            >
              Sign in
            </Link>
          </nav>

          <button
            type="button"
            className="rounded-[4px] border border-hairline px-2.5 py-1.5 text-xs md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>

        {menuOpen && (
          <nav id="mobile-nav" className="border-t border-hairline bg-surface px-5 py-3 md:hidden">
            <ul className="flex flex-col gap-3">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} onClick={() => setMenuOpen(false)} className="text-sm text-ink-soft">
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li className="flex flex-wrap gap-2 pt-1">
                <Link
                  to="/bulk-order"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-[4px] bg-brand px-3.5 py-1.5 text-xs font-medium text-white"
                >
                  Get a quote
                </Link>
                <Link
                  to="/admin/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-[4px] border border-gold px-3.5 py-1.5 text-xs font-medium text-gold"
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
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
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
            <ul className="mt-3 space-y-1.5 text-xs text-white/80">
              <li>
                <a className="type-data hover:text-gold-bright" href={telLink(phone)}>
                  {phone}
                </a>
              </li>
              <li>
                <a className="type-data hover:text-gold-bright" href={telLink(altPhone)}>
                  {altPhone}
                </a>
              </li>
              <li>
                <a
                  className="hover:text-gold-bright"
                  href={whatsappLink(phone)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  WhatsApp us
                </a>
              </li>
              {company?.email && (
                <li>
                  <a className="break-all hover:text-gold-bright" href={`mailto:${company.email}`}>
                    {company.email}
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <p className="type-eyebrow text-gold-bright">Address</p>
            <address className="mt-3 text-xs not-italic leading-relaxed text-white/80">
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
            </address>
            {company?.gstin && <p className="type-data mt-2 text-[11px] text-white/60">GSTIN {company.gstin}</p>}
          </div>

          <div>
            <p className="type-eyebrow text-gold-bright">Pages</p>
            <ul className="mt-3 space-y-1.5 text-xs text-white/80">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="hover:text-gold-bright">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/admin/login" className="hover:text-gold-bright">
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
