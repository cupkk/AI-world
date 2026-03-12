import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthGuard, PublicGuard, RoleGuard, AppRedirect } from "./components/guards";
import { useSettingsStore } from "./store/settingsStore";

const MainLayout = lazy(() =>
  import("./components/layout/MainLayout").then((module) => ({ default: module.MainLayout })),
);
const SettingsLayout = lazy(() =>
  import("./components/layout/SettingsLayout").then((module) => ({
    default: module.SettingsLayout,
  })),
);
const AppLayout = lazy(() =>
  import("./components/layout/AppLayout").then((module) => ({ default: module.AppLayout })),
);
const Login = lazy(() => import("./pages/Login").then((module) => ({ default: module.Login })));
const Hub = lazy(() => import("./pages/Hub").then((module) => ({ default: module.Hub })));
const HubDetail = lazy(() =>
  import("./pages/HubDetail").then((module) => ({ default: module.HubDetail })),
);
const Talent = lazy(() => import("./pages/Talent").then((module) => ({ default: module.Talent })));
const Profile = lazy(() =>
  import("./pages/Profile").then((module) => ({ default: module.Profile })),
);
const ProfileEdit = lazy(() =>
  import("./pages/settings/ProfileEdit").then((module) => ({ default: module.ProfileEdit })),
);
const Messages = lazy(() =>
  import("./pages/Messages").then((module) => ({ default: module.Messages })),
);
const Assistant = lazy(() =>
  import("./pages/Assistant").then((module) => ({ default: module.Assistant })),
);
const Publish = lazy(() =>
  import("./pages/Publish").then((module) => ({ default: module.Publish })),
);
const PublishDetail = lazy(() =>
  import("./pages/PublishDetail").then((module) => ({ default: module.PublishDetail })),
);
const DashboardLearner = lazy(() =>
  import("./pages/DashboardLearner").then((module) => ({ default: module.DashboardLearner })),
);
const DashboardExpert = lazy(() =>
  import("./pages/DashboardExpert").then((module) => ({ default: module.DashboardExpert })),
);
const DashboardEnterprise = lazy(() =>
  import("./pages/DashboardEnterprise").then((module) => ({
    default: module.DashboardEnterprise,
  })),
);
const KnowledgeBase = lazy(() =>
  import("./pages/settings/KnowledgeBase").then((module) => ({ default: module.KnowledgeBase })),
);
const Contacts = lazy(() =>
  import("./pages/settings/Contacts").then((module) => ({ default: module.Contacts })),
);
const Review = lazy(() =>
  import("./pages/admin/Review").then((module) => ({ default: module.Review })),
);
const AdminHub = lazy(() =>
  import("./pages/admin/AdminHub").then((module) => ({ default: module.AdminHub })),
);
const Invite = lazy(() => import("./pages/Invite").then((module) => ({ default: module.Invite })));
const Onboarding = lazy(() =>
  import("./pages/Onboarding").then((module) => ({ default: module.Onboarding })),
);
const ResetPassword = lazy(() =>
  import("./pages/ResetPassword").then((module) => ({ default: module.ResetPassword })),
);
const NotFound = lazy(() =>
  import("./pages/NotFound").then((module) => ({ default: module.NotFound })),
);

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
    </div>
  );
}

export default function App() {
  const { theme } = useSettingsStore();

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<PublicGuard><Login /></PublicGuard>} />
            <Route path="/invite" element={<PublicGuard><Invite /></PublicGuard>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />

            <Route
              element={
                <AuthGuard>
                  <MainLayout />
                </AuthGuard>
              }
            >
              <Route path="/hub" element={<Hub />} />
              <Route path="/hub/:type/:id" element={<HubDetail />} />
              <Route path="/talent" element={<Talent />} />
              <Route path="/u/:id" element={<Profile />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/publish" element={<Publish />} />
              <Route path="/publish/:id" element={<PublishDetail />} />

              <Route path="/app" element={<AppRedirect />} />

              <Route element={<RoleGuard allowedRoles={["LEARNER"]}><AppLayout /></RoleGuard>}>
                <Route path="/app/learner" element={<DashboardLearner />} />
              </Route>
              <Route element={<RoleGuard allowedRoles={["EXPERT"]}><AppLayout /></RoleGuard>}>
                <Route path="/app/expert" element={<DashboardExpert />} />
              </Route>
              <Route element={<RoleGuard allowedRoles={["ENTERPRISE_LEADER"]}><AppLayout /></RoleGuard>}>
                <Route path="/app/enterprise" element={<DashboardEnterprise />} />
              </Route>

              <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="profile" replace />} />
                <Route path="profile" element={<ProfileEdit />} />
                <Route path="knowledge-base" element={<KnowledgeBase />} />
                <Route path="contacts" element={<Contacts />} />
              </Route>

              <Route path="/admin/review" element={<RoleGuard allowedRoles={["ADMIN"]}><Review /></RoleGuard>} />
              <Route path="/admin/hub" element={<RoleGuard allowedRoles={["ADMIN"]}><AdminHub /></RoleGuard>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster theme={theme === "light" ? "light" : "dark"} position="bottom-right" className="toaster-group" />
    </ErrorBoundary>
  );
}
