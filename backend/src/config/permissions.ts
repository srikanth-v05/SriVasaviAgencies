/**
 * Role-based permissions (architecture.md §6).
 *
 * The permission table lives here as data rather than as scattered role checks,
 * so the matrix in the architecture document and the matrix the API enforces can
 * be read side by side.
 */

export const PERMISSIONS = [
  "dashboard:read",
  "products:read",
  "products:write",
  "customers:read",
  "customers:write",
  "quotations:read",
  "quotations:write",
  "invoices:read",
  "invoices:write",
  "payments:read",
  "payments:write",
  "reports:read",
  "exports:read",
  "users:manage",
  "company:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type RoleName = "SUPER_ADMIN" | "ADMIN" | "BILLING_USER" | "REPORT_USER";

const READ_ONLY_EVERYTHING: Permission[] = [
  "dashboard:read",
  "products:read",
  "customers:read",
  "quotations:read",
  "invoices:read",
  "payments:read",
  "reports:read",
  "exports:read",
];

export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: PERMISSIONS,
  BILLING_USER: [
    "dashboard:read",
    "products:read",
    "customers:read",
    "customers:write",
    "quotations:read",
    "quotations:write",
    "invoices:read",
    "invoices:write",
    "payments:read",
    "payments:write",
    "reports:read",
    "exports:read",
  ],
  // Read everything it is allowed to see, plus audit logs in view-only form.
  REPORT_USER: [...READ_ONLY_EVERYTHING, "audit:read"],
};

export function roleHasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsForRole(role: RoleName): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
