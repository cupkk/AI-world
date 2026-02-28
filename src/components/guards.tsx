import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { Role } from "../types";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function PublicGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/hub" replace />;
  return <>{children}</>;
}

export function RoleGuard({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: Role[] }) {
  const { user } = useAuthStore();
  if (!user || !allowedRoles.includes(user.role)) {
    const target =
      user?.role === "EXPERT"
        ? "/app/expert"
        : user?.role === "ENTERPRISE_LEADER"
          ? "/app/enterprise"
          : user?.role === "ADMIN"
            ? "/admin/review"
            : "/app/learner";
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}

export function AppRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  const target =
    user.role === "EXPERT"
      ? "/app/expert"
      : user.role === "ENTERPRISE_LEADER"
        ? "/app/enterprise"
        : user.role === "ADMIN"
          ? "/admin/review"
          : "/app/learner";
  return <Navigate to={target} replace />;
}
