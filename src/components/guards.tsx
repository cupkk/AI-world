import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { fetchMeByApi } from "../lib/api";
import type { Role } from "../types";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, sessionChecked, logout, updateUser, markSessionChecked, user } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated || sessionChecked) return;
    // Re-validate session cookie against the server
    fetchMeByApi()
      .then((freshUser) => {
        updateUser(freshUser);
        markSessionChecked();
      })
      .catch(() => {
        // Session expired or cookie invalid — force logout
        logout();
      });
  }, [isAuthenticated, sessionChecked, logout, updateUser, markSessionChecked]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Show loading spinner while verifying session
  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
      </div>
    );
  }

  // Force onboarding if not completed (skip for admins and the onboarding page itself)
  if (
    user &&
    user.role !== "ADMIN" &&
    !user.onboardingDone &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function PublicGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/app" replace />;
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
  // If onboarding not complete, go there first
  if (user.role !== "ADMIN" && !user.onboardingDone) {
    return <Navigate to="/onboarding" replace />;
  }
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
