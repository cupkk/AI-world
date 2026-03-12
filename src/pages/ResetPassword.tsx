import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useSettingsStore } from "../store/settingsStore";
import { useTranslation } from "../hooks/useTranslation";
import { forgotPasswordByApi, resetPasswordByApi } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { BrainCircuit, Mail, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";

export function ResetPassword() {
  const { t } = useTranslation();
  usePageTitle(t("page.reset_password"));
  const { theme } = useSettingsStore();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const isLight = theme === "light";

  // If there's a token → show reset form; otherwise → show forgot (email) form
  const [mode, setMode] = useState<"forgot" | "reset" | "done">(tokenFromUrl ? "reset" : "forgot");
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // Reset password state
  const [token] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await forgotPasswordByApi(email.trim());
      setEmailSent(true);
    } catch (err: any) {
      toast.error(err?.message || t("reset.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("reset.password_mismatch"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("reset.password_too_short"));
      return;
    }
    setLoading(true);
    try {
      await resetPasswordByApi(token, password);
      setMode("done");
      toast.success(t("reset.success"));
    } catch (err: any) {
      toast.error(err?.message || t("reset.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${isLight ? "bg-gradient-to-br from-slate-50 via-white to-indigo-50" : "bg-gradient-to-br from-zinc-950 via-zinc-900 to-indigo-950/30"}`}>
      <div className={`w-full max-w-md rounded-2xl border p-8 shadow-xl ${isLight ? "bg-white/80 border-zinc-200 backdrop-blur" : "bg-zinc-900/60 border-white/10 backdrop-blur-xl"}`}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit className="h-8 w-8 text-indigo-500" />
            <span className={`text-2xl font-bold tracking-tight ${isLight ? "text-zinc-900" : "text-white"}`}>AI-World</span>
          </div>
          <p className={`text-sm ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>
            {mode === "forgot" && t("reset.forgot_title")}
            {mode === "reset" && t("reset.reset_title")}
            {mode === "done" && t("reset.done_title")}
          </p>
        </div>

        {/* Forgot password form — enter email */}
        {mode === "forgot" && !emailSent && (
          <form onSubmit={handleForgot} className="space-y-5">
            <p className={`text-sm ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
              {t("reset.forgot_description")}
            </p>
            <div className="space-y-2">
              <label className={`text-sm font-medium ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>{t("login.email")}</label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isLight ? "text-zinc-400" : "text-zinc-500"}`} />
                <Input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.email_placeholder")}
                  className={`pl-10 focus-visible:ring-indigo-500 ${isLight ? "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400" : "bg-zinc-900/50 border-white/10"}`}
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-11">
              {loading ? t("reset.sending") : t("reset.send_email")}
            </Button>
            <div className="text-center">
              <Link to="/login" className={`text-sm inline-flex items-center gap-1 ${isLight ? "text-indigo-600 hover:text-indigo-500" : "text-indigo-400 hover:text-indigo-300"}`}>
                <ArrowLeft className="h-3 w-3" />
                {t("reset.back_to_login")}
              </Link>
            </div>
          </form>
        )}

        {/* Email sent confirmation */}
        {mode === "forgot" && emailSent && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
            <p className={`text-sm ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
              {t("reset.email_sent")}
            </p>
            <p className={`text-xs ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>
              {t("reset.check_spam")}
            </p>
            <div className="pt-2">
              <Link to="/login" className={`text-sm inline-flex items-center gap-1 ${isLight ? "text-indigo-600 hover:text-indigo-500" : "text-indigo-400 hover:text-indigo-300"}`}>
                <ArrowLeft className="h-3 w-3" />
                {t("reset.back_to_login")}
              </Link>
            </div>
          </div>
        )}

        {/* Reset password form — enter new password */}
        {mode === "reset" && (
          <form onSubmit={handleReset} className="space-y-5">
            <p className={`text-sm ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
              {t("reset.reset_description")}
            </p>
            <div className="space-y-2">
              <label className={`text-sm font-medium ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>{t("reset.new_password")}</label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isLight ? "text-zinc-400" : "text-zinc-500"}`} />
                <Input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`pl-10 focus-visible:ring-indigo-500 ${isLight ? "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400" : "bg-zinc-900/50 border-white/10"}`}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className={`text-sm font-medium ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>{t("reset.confirm_password")}</label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isLight ? "text-zinc-400" : "text-zinc-500"}`} />
                <Input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`pl-10 focus-visible:ring-indigo-500 ${isLight ? "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400" : "bg-zinc-900/50 border-white/10"}`}
                />
              </div>
            </div>
            <p className={`text-xs ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>
              {t("reset.password_requirements")}
            </p>
            <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-11">
              {loading ? t("reset.resetting") : t("reset.reset_button")}
            </Button>
          </form>
        )}

        {/* Success state */}
        {mode === "done" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
            <p className={`text-sm ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
              {t("reset.success_message")}
            </p>
            <Link to="/login">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-11 mt-2">
                {t("reset.go_to_login")}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
