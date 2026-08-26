import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  ReceiptIndianRupee,
  Wallet,
  Users,
  Package,
  TrendingUp,
  FileSpreadsheet,
  Building2,
  Star,
  ShieldCheck,
  ScrollText,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Permission } from "@/types";

type IconType = LucideIcon;

interface NavItem {
  to: string;
  label: string;
  permission: Permission;
  icon: IconType;
  end?: boolean;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Work",
    items: [
      { to: "/admin", label: "Dashboard", permission: "dashboard:read", icon: LayoutDashboard, end: true },
      { to: "/admin/quotations", label: "Quotations", permission: "quotations:read", icon: FileText },
      { to: "/admin/invoices", label: "Invoices", permission: "invoices:read", icon: ReceiptIndianRupee },
      { to: "/admin/payments", label: "Payments", permission: "payments:read", icon: Wallet },
    ],
  },
  {
    heading: "Masters",
    items: [
      { to: "/admin/customers", label: "Customers", permission: "customers:read", icon: Users },
      { to: "/admin/products", label: "Products", permission: "products:read", icon: Package },
    ],
  },
  {
    heading: "Analysis",
    items: [
      { to: "/admin/reports/sales", label: "Sales reports", permission: "reports:read", icon: TrendingUp },
      { to: "/admin/reports/gst", label: "GST & exports", permission: "reports:read", icon: FileSpreadsheet },
    ],
  },
  {
    heading: "Administration",
    items: [
      { to: "/admin/settings/company", label: "Company settings", permission: "company:manage", icon: Building2 },
      { to: "/admin/settings/reviews", label: "Website reviews", permission: "company:manage", icon: Star },
      { to: "/admin/settings/users", label: "Users", permission: "users:manage", icon: ShieldCheck },
      { to: "/admin/audit-logs", label: "Audit logs", permission: "audit:read", icon: ScrollText },
    ],
  },
];

function initials(name?: string) {
  if (!name) return "SV";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

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
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Mobile scrim */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-plum-deep/40 backdrop-blur-sm lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* ------------------------------------------------------- sidebar */}
      <aside
        className={`${
          navOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-hairline bg-surface shadow-[var(--shadow-lg)] transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-60 lg:translate-x-0 lg:shadow-none`}
      >
        <div className="gold-rule h-1 shrink-0" aria-hidden />

        {/* Brand */}
        <div className="flex items-center justify-between gap-2.5 border-b border-hairline px-4 py-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt="" width={38} height={38} className="crest h-[38px] w-[38px] shrink-0" />
            <div>
              <p className="type-display text-base leading-none text-brand">SRI VASAVI</p>
              <p className="type-eyebrow mt-1 text-[9px] text-gold">Billing &amp; ERP</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted hover:bg-ground-deep hover:text-ink lg:hidden"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.heading} className="mb-5">
              <p className="type-eyebrow px-2.5 text-[10px]">{group.heading}</p>
              <ul className="mt-2 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={() => setNavOpen(false)}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150 ${
                            isActive
                              ? "bg-brand-tint font-medium text-brand-deep"
                              : "text-ink-soft hover:bg-ground-deep hover:text-ink"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand transition-opacity ${
                                isActive ? "opacity-100" : "opacity-0"
                              }`}
                              aria-hidden
                            />
                            <Icon
                              className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                                isActive ? "text-brand" : "text-muted group-hover:text-ink"
                              }`}
                              strokeWidth={2}
                            />
                            {item.label}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="shrink-0 border-t border-hairline p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-plum text-xs font-semibold text-white type-data">
              {initials(user?.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{user?.name}</p>
              <p className="type-data truncate text-[10px] uppercase tracking-wider text-muted">
                {user?.role.replace(/_/g, " ")}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---------------------------------------------------- top bar */}
        <header className="surface-glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5 lg:hidden">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-hairline-strong px-2.5 py-1.5 text-xs text-ink-soft"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <Menu className="h-4 w-4" strokeWidth={2} />
            Menu
          </button>

          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="" width={28} height={28} className="crest h-7 w-7" />
            <span className="type-display text-sm text-brand">SRI VASAVI</span>
          </div>
        </header>

        <main id="admin-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
