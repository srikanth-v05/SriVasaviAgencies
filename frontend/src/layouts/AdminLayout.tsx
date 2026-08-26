import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { Permission } from "@/types";

interface NavItem {
  to: string;
  label: string;
  permission: Permission;
  end?: boolean;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Work",
    items: [
      { to: "/admin", label: "Dashboard", permission: "dashboard:read", end: true },
      { to: "/admin/quotations", label: "Quotations", permission: "quotations:read" },
      { to: "/admin/invoices", label: "Invoices", permission: "invoices:read" },
      { to: "/admin/payments", label: "Payments", permission: "payments:read" },
    ],
  },
  {
    heading: "Masters",
    items: [
      { to: "/admin/customers", label: "Customers", permission: "customers:read" },
      { to: "/admin/products", label: "Products", permission: "products:read" },
    ],
  },
  {
    heading: "Analysis",
    items: [
      { to: "/admin/reports/sales", label: "Sales reports", permission: "reports:read" },
      { to: "/admin/reports/gst", label: "GST & exports", permission: "reports:read" },
    ],
  },
  {
    heading: "Administration",
    items: [
      { to: "/admin/settings/company", label: "Company settings", permission: "company:manage" },
      { to: "/admin/settings/reviews", label: "Website reviews", permission: "company:manage" },
      { to: "/admin/settings/users", label: "Users", permission: "users:manage" },
      { to: "/admin/audit-logs", label: "Audit logs", permission: "audit:read" },
    ],
  },
];

export function AdminLayout() {
  const { user, signOut, can } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-ground lg:flex">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* ------------------------------------------------------- sidebar */}
      <aside
        className={`${navOpen ? "block" : "hidden"} border-b border-hairline bg-surface lg:sticky lg:top-0 lg:block lg:h-screen lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r`}
      >
        <div className="gold-rule h-1" aria-hidden />
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <img src="/logo.jpg" alt="" width={34} height={34} className="crest h-[34px] w-[34px] shrink-0" />
          <div>
            <p className="type-display text-base leading-none text-brand">SRI VASAVI</p>
            <p className="type-eyebrow mt-0.5 text-[9px] text-gold">Billing &amp; ERP</p>
          </div>
        </div>

        <nav className="px-2 pb-6">
          {visibleGroups.map((group) => (
            <div key={group.heading} className="mb-5">
              <p className="type-eyebrow px-2 text-[10px]">{group.heading}</p>
              <ul className="mt-1.5 space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => setNavOpen(false)}
                      className={({ isActive }) =>
                        `block rounded-[3px] px-2 py-1.5 text-sm transition-colors ${
                          isActive ? "bg-brand-tint font-medium text-brand-deep" : "text-ink-soft hover:bg-ground"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---------------------------------------------------- top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-hairline bg-surface/95 px-4 py-2.5 backdrop-blur">
          <button
            type="button"
            className="rounded-[3px] border border-hairline px-2.5 py-1.5 text-xs lg:hidden"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? "Close" : "Menu"}
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-medium text-ink">{user?.name}</p>
              <p className="type-data text-[10px] uppercase tracking-wider text-muted">
                {user?.role.replace(/_/g, " ")}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-[3px] border border-hairline px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:border-brand hover:text-brand"
            >
              Sign out
            </button>
          </div>
        </header>

        <main id="admin-content" className="min-w-0 flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
