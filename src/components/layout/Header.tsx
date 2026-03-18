import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useTranslation } from "../../hooks/useTranslation";
import { logoutByApi } from "../../lib/api";
import { featureFlags } from "../../lib/features";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { MessageBadge } from "../ui/MessageBadge";
import {
  BrainCircuit,
  Settings,
  Shield,
  Menu,
  X,
  Sun,
  Moon,
  Languages,
  Upload,
} from "lucide-react";

export function Header() {
  const { user, logout } = useAuthStore();
  const { theme, language, toggleTheme, toggleLanguage } = useSettingsStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logoutByApi();
    logout();
    navigate("/login");
  };

  // Calculate real unread count is now handled by MessageBadge

  const isActive = (path: string) =>
    location.pathname.startsWith(path) ? "text-zinc-100" : "text-zinc-400";

  const navLinks = [
    { to: "/hub", label: t("nav.knowledge_hub") },
    { to: "/talent", label: t("nav.talent_pool") },
  ];

  const dashboardLink = user
    ? user.role === "ADMIN"
      ? { to: "/admin/review", label: t("nav.review"), icon: <Shield className="h-4 w-4" /> }
      : {
          to:
            user.role === "ENTERPRISE_LEADER"
              ? "/app/enterprise"
              : `/app/${user.role.toLowerCase()}`,
          label: t("nav.dashboard"),
        }
    : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200/5 dark:border-white/10 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md transition-colors" data-no-invert role="banner">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md">
        Skip to main content
      </a>
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 transition-colors">
              AI-World
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" aria-label="Main navigation">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`${isActive(link.to)} hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors`}
              >
                {link.label}
              </Link>
            ))}
            {dashboardLink && (
              <Link
                to={dashboardLink.to}
                className={`${isActive(dashboardLink.to)} hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-1`}
              >
                {dashboardLink.icon}
                {dashboardLink.label}
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggles */}
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            onClick={toggleLanguage}
            title={language === "zh" ? t("lang.en") : t("lang.zh")}
            aria-label={language === "zh" ? t("lang.en") : t("lang.zh")}
          >
            <Languages className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            onClick={toggleTheme}
            title={theme === "dark" ? t("theme.light") : t("theme.dark")}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {user ? (
            <>
              {featureFlags.assistant ? (
                <Link to="/assistant" className="hidden md:inline-flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400"
                    title={t("nav.ai_assistant")}
                  >
                    <BrainCircuit className="h-5 w-5" />
                  </Button>
                </Link>
              ) : null}
              {featureFlags.knowledgeBase ? (
                <Link to="/settings/knowledge-base" className="hidden md:inline-flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400"
                    title={t("app.nav_knowledge_base")}
                  >
                    <Upload className="h-5 w-5" />
                  </Button>
                </Link>
              ) : null}
              <MessageBadge />
              <Link to="/settings/profile" className="hidden md:inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  title={t("nav.settings")}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
              <div className="hidden md:flex items-center gap-3 pl-4 ml-2 border-l border-zinc-200 dark:border-white/10">
                <Link to={`/u/${user.id}`}>
                  <Avatar src={user.avatar} fallback={user.name.charAt(0)} />
                </Link>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  {t("nav.logout")}
                </Button>
              </div>

              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </>
          ) : (
            <Link to="/login">
              <Button>{t("nav.sign_in")}</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && user && (
        <div className="md:hidden border-t border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md" role="navigation" aria-label="Mobile navigation">
          <div className="container mx-auto max-w-7xl px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {dashboardLink && (
              <Link
                to={dashboardLink.to}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                {dashboardLink.icon}
                {dashboardLink.label}
              </Link>
            )}
            {featureFlags.assistant ? (
              <Link
                to="/assistant"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                {t("nav.ai_assistant")}
              </Link>
            ) : null}
            {featureFlags.knowledgeBase ? (
              <Link
                to="/settings/knowledge-base"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                {t("app.nav_knowledge_base")}
              </Link>
            ) : null}
            <Link
              to="/settings/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              {t("nav.settings")}
            </Link>
            <Link
              to={`/u/${user.id}`}
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              {t("nav.my_profile")}
            </Link>
            <div className="pt-2 border-t border-zinc-200 dark:border-white/10">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
              >
                {t("nav.logout")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
