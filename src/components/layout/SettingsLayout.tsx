import { Link, Outlet, useLocation } from "react-router-dom";
import { Database, Shield, User } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { featureFlags } from "../../lib/features";

export function SettingsLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = [
    {
      name: t("settings.nav_profile"),
      href: "/settings/profile",
      icon: User,
    },
    {
      name: t("settings.nav_kb"),
      href: "/settings/knowledge-base",
      icon: Database,
      enabled: featureFlags.knowledgeBase,
    },
    {
      name: t("settings.nav_contact"),
      href: "/settings/contacts",
      icon: Shield,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex space-x-2 md:flex-col md:space-x-0 md:space-y-1">
            {navItems.filter((item) => item.enabled !== false).map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-500/10 text-indigo-400"
                      : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-100"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
