import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { AuthGuard, PublicGuard, RoleGuard, AppRedirect } from "./components/guards";
import { MainLayout } from "./components/layout/MainLayout";
import { SettingsLayout } from "./components/layout/SettingsLayout";
import { AppLayout } from "./components/layout/AppLayout";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Hub } from "./pages/Hub";
import { HubDetail } from "./pages/HubDetail";
import { Talent } from "./pages/Talent";
import { Profile } from "./pages/Profile";
import { ProfileEdit } from "./pages/settings/ProfileEdit";
import { Messages } from "./pages/Messages";
import { Assistant } from "./pages/Assistant";
import { Publish } from "./pages/Publish";
import { PublishDetail } from "./pages/PublishDetail";
import { DashboardLearner } from "./pages/DashboardLearner";
import { DashboardExpert } from "./pages/DashboardExpert";
import { DashboardEnterprise } from "./pages/DashboardEnterprise";
import { KnowledgeBase } from "./pages/settings/KnowledgeBase";
import { Contacts } from "./pages/settings/Contacts";
import { Review } from "./pages/admin/Review";
import { AdminHub } from "./pages/admin/AdminHub";
import { Invite } from "./pages/Invite";
import { Onboarding } from "./pages/Onboarding";
import { NotFound } from "./pages/NotFound";
import { useSettingsStore } from "./store/settingsStore";

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
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicGuard><Landing /></PublicGuard>} />
          <Route path="/login" element={<PublicGuard><Login /></PublicGuard>} />
          <Route path="/invite" element={<PublicGuard><Invite /></PublicGuard>} />
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
      </BrowserRouter>
      <Toaster theme={theme === "light" ? "light" : "dark"} position="bottom-right" className="toaster-group" />
    </>
  );
}
