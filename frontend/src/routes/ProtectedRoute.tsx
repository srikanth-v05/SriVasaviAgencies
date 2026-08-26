import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/common/ui";
import type { Permission } from "@/types";

/**
 * Route guard. The server enforces the same permission matrix — this only keeps
 * a user from walking into a screen that would fail anyway.
 */
export function ProtectedRoute({ children, permission }: { children: ReactNode; permission?: Permission }) {
  const { user, isLoading, can } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;

  if (permission && !can(permission)) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm font-medium text-ink">Your role does not have access to this screen</p>
        <p className="mt-1 text-xs text-muted">
          Signed in as {user.name} ({user.role.replace(/_/g, " ").toLowerCase()}).
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
