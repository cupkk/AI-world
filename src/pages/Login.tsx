import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";
import { useTranslation } from "../hooks/useTranslation";
import { loginByApi, registerByApi } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { BrainCircuit, Mail, Lock, User as UserIcon, ArrowRight, CheckCircle2, Ticket, ShieldCheck, Phone } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";

function meetsPasswordRequirements(value: string) {
  return (
    value.length >= 8 &&
    value.length <= 64 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[\W_]/.test(value)
  );
}

function isPasswordValidationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("password must contain") ||
    normalized.includes("lowercase letter") ||
    normalized.includes("uppercase letter") ||
    normalized.includes("special character")
  );
}

export function Login() {
  const { t } = useTranslation();
  usePageTitle(t("page.login"));
  const { login, verifiedInviteCode, setVerifiedInviteCode } = useAuthStore();
  const { theme } = useSettingsStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isRegister, setIsRegister] = useState(searchParams.get("tab") === "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsRegister(searchParams.get("tab") === "register");
  }, [searchParams]);

  const needsInviteCode = isRegister && !verifiedInviteCode;
  const isLight = theme === "light";
  const getPostAuthPath = (onboardingDone?: boolean) => (onboardingDone ? "/app" : "/onboarding");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (isRegister) {
        if (!verifiedInviteCode) {
          toast.error(t("login.invite_verify_first"));
          navigate("/invite");
          return;
        }
        if (!meetsPasswordRequirements(password)) {
          toast.error(t("reset.password_requirements"));
          return;
        }
        try {
          const apiUser = await registerByApi({
            email: email.trim(),
            password,
            displayName: name.trim(),
            inviteCode: verifiedInviteCode,
            phone: phone.trim() || undefined,
          });
          login(apiUser);
          setVerifiedInviteCode(null);
          toast.success(t("login.account_created_welcome"));
          navigate(getPostAuthPath(apiUser.onboardingDone));
          return;
        } catch (err: any) {
          const msg: string = err?.message || "";
          if (msg.toLowerCase().includes("already") || msg.includes("409") || msg.includes("Conflict")) {
            try {
              const apiUser = await loginByApi({ email: email.trim(), password });
              login(apiUser);
              setVerifiedInviteCode(null);
              toast.success((t("login.welcome_back_name") as string).replace("{name}", apiUser.name));
              navigate(getPostAuthPath(apiUser.onboardingDone));
              return;
            } catch (loginErr: any) {
              toast.error(loginErr?.message || t("login.invalid_credentials"));
              return;
            }
          } else if (isPasswordValidationError(msg)) {
            toast.error(t("reset.password_requirements"));
            return;
          } else {
            toast.error(msg || t("login.register_failed"));
            return;
          }
        }
      } else {
        try {
          const apiUser = await loginByApi({
            email: email.trim(),
            password,
          });
          login(apiUser);
          toast.success((t("login.welcome_back_name") as string).replace("{name}", apiUser.name));
          navigate(getPostAuthPath(apiUser.onboardingDone));
          return;
        } catch (err: any) {
          toast.error(err?.message || t("login.invalid_credentials"));
          return;
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen overflow-hidden ${isLight ? "bg-gradient-to-br from-zinc-100 via-white to-zinc-100 text-zinc-950" : "bg-[#050505] text-white"}`}>
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className={`relative hidden overflow-hidden border-r lg:flex ${isLight ? "border-zinc-200 bg-white" : "border-white/5 bg-[#050505]"}`}>
          <div className={`absolute inset-0 ${isLight ? "bg-[radial-gradient(circle_at_35%_35%,rgba(79,70,229,0.18),transparent_45%),radial-gradient(circle_at_75%_70%,rgba(244,63,94,0.12),transparent_35%)]" : "bg-[radial-gradient(circle_at_35%_35%,rgba(79,70,229,0.22),transparent_45%),radial-gradient(circle_at_75%_70%,rgba(168,85,247,0.15),transparent_35%)]"}`} />
          <div className="relative z-10 flex w-full flex-col justify-between p-12">
            <div className="space-y-16">
              <Link to="/" className="flex w-fit items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${isLight ? "border-indigo-200 bg-indigo-50 text-indigo-600" : "border-indigo-500/20 bg-indigo-500/10 text-indigo-400"}`}>
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <span className={`text-2xl font-bold tracking-tight ${isLight ? "text-zinc-950" : "text-white"}`}>AI-World</span>
              </Link>

              <div className="max-w-xl space-y-8">
                <div className="space-y-4">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] ${isLight ? "border-indigo-200 bg-indigo-50 text-indigo-600" : "border-indigo-500/30 bg-indigo-500/10 text-indigo-200"}`}>
                    {t("login.invite_req")}
                  </span>
                  <h1 className={`text-5xl font-bold leading-tight tracking-tight ${isLight ? "text-zinc-950" : "text-white"}`}>
                    {t("login.title")}
                  </h1>
                  <p className={`text-lg leading-8 ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
                    {t("login.invite_desc")}
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className={`rounded-3xl border p-5 backdrop-blur-sm ${isLight ? "border-zinc-200 bg-white/80" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="flex items-start gap-4">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isLight ? "bg-indigo-50 text-indigo-600" : "bg-indigo-500/10 text-indigo-300"}`}>
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className={`font-medium ${isLight ? "text-zinc-950" : "text-zinc-100"}`}>{t("invite_page.perk_1")}</p>
                        <p className={`text-sm ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>{t("dashboard.desc_enterprise")}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-3xl border p-5 backdrop-blur-sm ${isLight ? "border-zinc-200 bg-white/80" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="flex items-start gap-4">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isLight ? "bg-emerald-50 text-emerald-600" : "bg-emerald-500/10 text-emerald-300"}`}>
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className={`font-medium ${isLight ? "text-zinc-950" : "text-zinc-100"}`}>{t("invite_page.perk_2")}</p>
                        <p className={`text-sm ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>{t("dashboard.action_assistant")}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-3xl border p-5 backdrop-blur-sm ${isLight ? "border-zinc-200 bg-white/80" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="flex items-start gap-4">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isLight ? "bg-amber-50 text-amber-600" : "bg-amber-500/10 text-amber-300"}`}>
                        <Ticket className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className={`font-medium ${isLight ? "text-zinc-950" : "text-zinc-100"}`}>{t("invite_page.perk_3")}</p>
                        <p className={`text-sm ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>{t("invite_page.way_1")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className={`text-sm ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>{t("landing.footer")}</p>
          </div>
        </div>

        <div className="flex min-h-screen items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link to="/" className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${isLight ? "border-indigo-200 bg-indigo-50 text-indigo-600" : "border-indigo-500/20 bg-indigo-500/10 text-indigo-400"}`}>
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <span className={`text-2xl font-bold tracking-tight ${isLight ? "text-zinc-950" : "text-white"}`}>AI-World</span>
              </Link>
            </div>

            <div className={`rounded-[2rem] border p-8 shadow-2xl backdrop-blur-xl ${isLight ? "border-zinc-200 bg-white/90 shadow-indigo-950/5" : "border-white/10 bg-white/[0.03] shadow-black/40"}`}>
              <div className="space-y-2 text-center">
                <h2 className={`text-3xl font-bold tracking-tight ${isLight ? "text-zinc-950" : "text-white"}`}>
                  {isRegister ? t("login.create_account") : t("login.welcome_back")}
                </h2>
                <p className={`${isLight ? "text-zinc-500" : "text-zinc-400"}`}>
                  {isRegister ? t("login.create_desc") : t("login.welcome_desc")}
                </p>
              </div>

              <div className={`mt-8 grid grid-cols-2 rounded-2xl p-1 ${isLight ? "bg-zinc-100" : "bg-zinc-900/70"}`}>
                <button
                  type="button"
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    !isRegister
                      ? isLight
                        ? "bg-white text-zinc-950 shadow-sm"
                        : "bg-white/10 text-white"
                      : isLight
                        ? "text-zinc-500"
                        : "text-zinc-400"
                  }`}
                  onClick={() => setIsRegister(false)}
                >
                  {t("login.sign_in_tab")}
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isRegister
                      ? isLight
                        ? "bg-white text-zinc-950 shadow-sm"
                        : "bg-white/10 text-white"
                      : isLight
                        ? "text-zinc-500"
                        : "text-zinc-400"
                  }`}
                  onClick={() => setIsRegister(true)}
                >
                  {t("login.register_tab")}
                </button>
              </div>

              {needsInviteCode && (
                <div className={`mt-6 rounded-2xl border px-4 py-4 text-sm ${isLight ? "border-amber-200 bg-amber-50 text-amber-800" : "border-amber-500/20 bg-amber-500/10 text-amber-200"}`}>
                  <div className="flex items-start gap-3">
                    <Ticket className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="space-y-2">
                      <p className="font-medium">{t("login.invite_req")}</p>
                      <p>{t("login.invite_desc")}</p>
                      <Link to="/invite" className="inline-flex items-center gap-2 font-medium underline-offset-4 hover:underline">
                        {t("login.btn_invite")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {isRegister && verifiedInviteCode && (
                <div className={`mt-6 rounded-2xl border px-4 py-4 text-sm ${isLight ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"}`}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium">{t("login.invite_verified")}</p>
                      <p className={isLight ? "text-emerald-700" : "text-emerald-300"}>{verifiedInviteCode}</p>
                    </div>
                  </div>
                </div>
              )}

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                {isRegister && (
                  <div className="space-y-2">
                    <label className={`text-sm font-medium ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>
                      {t("login.name")}
                    </label>
                    <div className="relative">
                      <UserIcon className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${isLight ? "text-zinc-400" : "text-zinc-500"}`} />
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("login.name_placeholder")}
                        className={`h-12 rounded-2xl pl-11 ${isLight ? "border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400" : "border-white/10 bg-zinc-950/60 text-white placeholder:text-zinc-500"}`}
                        required
                      />
                    </div>
                  </div>
                )}

                {isRegister && (
                  <div className="space-y-2">
                    <label className={`text-sm font-medium ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>
                      {t("settings.phone")}
                    </label>
                    <div className="relative">
                      <Phone className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${isLight ? "text-zinc-400" : "text-zinc-500"}`} />
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t("login.phone_placeholder")}
                        className={`h-12 rounded-2xl pl-11 ${isLight ? "border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400" : "border-white/10 bg-zinc-950/60 text-white placeholder:text-zinc-500"}`}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className={`text-sm font-medium ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>
                    {t("login.email")}
                  </label>
                  <div className="relative">
                    <Mail className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${isLight ? "text-zinc-400" : "text-zinc-500"}`} />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("login.email_placeholder")}
                      className={`h-12 rounded-2xl pl-11 ${isLight ? "border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400" : "border-white/10 bg-zinc-950/60 text-white placeholder:text-zinc-500"}`}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={`text-sm font-medium ${isLight ? "text-zinc-700" : "text-zinc-300"}`}>
                    {t("login.password")}
                  </label>
                  <div className="relative">
                    <Lock className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${isLight ? "text-zinc-400" : "text-zinc-500"}`} />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="********"
                      className={`h-12 rounded-2xl pl-11 ${isLight ? "border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400" : "border-white/10 bg-zinc-950/60 text-white placeholder:text-zinc-500"}`}
                      required
                    />
                  </div>
                  {isRegister && (
                    <p className={`text-xs leading-5 ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>
                      {t("reset.password_requirements")}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || (needsInviteCode && isRegister)}
                  className={`mt-2 h-12 w-full rounded-2xl text-base font-medium ${isLight ? "bg-zinc-950 text-white hover:bg-zinc-800" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t("reset.sending")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {isRegister ? t("login.create_account") : t("login.btn_sign_in")}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>

              <div className={`mt-6 flex items-center justify-between text-sm ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>
                <button
                  type="button"
                  className="font-medium underline-offset-4 hover:text-indigo-400 hover:underline"
                  onClick={() => setIsRegister((current) => !current)}
                >
                  {isRegister ? t("login.sign_in_tab") : t("login.create_account")}
                </button>
                {!isRegister && (
                  <Link to="/reset-password" className="font-medium underline-offset-4 hover:text-indigo-400 hover:underline">
                    {t("login.forgot_password")}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
