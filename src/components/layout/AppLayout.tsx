import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useTranslation } from "../../hooks/useTranslation";
import { featureFlags } from "../../lib/features";
import { DictKey } from "../../lib/i18n";
import {
  BookOpen,
  Rocket,
  Award,
  FlaskConical,
  Users,
  Handshake,
  Target,
  FileText,
  Eye,
  BrainCircuit,
  Upload,
  Plus,
} from "lucide-react";

type NavItem = {
  nameKey: DictKey;
  href: string;
  icon: any;
  enabled?: boolean;
};

const LEARNER_NAV: NavItem[] = [
  { nameKey: "app.nav_overview", href: "/app/learner", icon: BookOpen },
  { nameKey: "app.nav_opportunities", href: "/hub?type=PROJECT", icon: Rocket },
  { nameKey: "app.nav_reputation", href: "/publish", icon: Award },
  { nameKey: "nav.ai_assistant", href: "/assistant", icon: BrainCircuit, enabled: featureFlags.assistant },
  { nameKey: "app.nav_knowledge_base", href: "/settings/knowledge-base", icon: Upload, enabled: featureFlags.knowledgeBase },
];

const EXPERT_NAV: NavItem[] = [
  { nameKey: "app.nav_overview", href: "/app/expert", icon: FlaskConical },
  { nameKey: "app.nav_publish", href: "/publish", icon: Plus },
  { nameKey: "app.nav_collaborators", href: "/talent", icon: Users },
  { nameKey: "nav.ai_assistant", href: "/assistant", icon: BrainCircuit, enabled: featureFlags.assistant },
  { nameKey: "app.nav_knowledge_base", href: "/settings/knowledge-base", icon: Upload, enabled: featureFlags.knowledgeBase },
];

const ENTERPRISE_NAV: NavItem[] = [
  { nameKey: "app.nav_overview", href: "/app/enterprise", icon: Target },
  { nameKey: "app.nav_post_project", href: "/publish", icon: FileText },
  { nameKey: "app.nav_discover_talent", href: "/talent", icon: Users },
  { nameKey: "nav.ai_assistant", href: "/assistant", icon: BrainCircuit, enabled: featureFlags.assistant },
  { nameKey: "app.nav_knowledge_base", href: "/settings/knowledge-base", icon: Upload, enabled: featureFlags.knowledgeBase },
];

export function AppLayout() {
  const { user } = useAuthStore();
  const location = useLocation();
  const { t } = useTranslation();

  const navItems =
    user?.role === "EXPERT"
      ? EXPERT_NAV
      : user?.role === "ENTERPRISE_LEADER"
        ? ENTERPRISE_NAV
        : LEARNER_NAV;
  const filteredNavItems = navItems.filter((item) => item.enabled !== false);

  const roleLabel =
    user?.role === "EXPERT"
      ? t("role.expert")
      : user?.role === "ENTERPRISE_LEADER"
        ? t("role.enterprise")
        : t("role.learner");

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="w-full md:w-56 shrink-0">
          <div className="mb-4 px-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {roleLabel} {t("app.workspace")}
            </span>
          </div>
          <nav className="flex space-x-2 overflow-x-auto pb-2 md:flex-col md:space-x-0 md:space-y-1 md:pb-0 custom-scrollbar">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href || (item.href !== "/app/learner" && item.href !== "/app/expert" && item.href !== "/app/enterprise" && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-indigo-500/10 text-indigo-400"
                      : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-100"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {t(item.nameKey)}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
