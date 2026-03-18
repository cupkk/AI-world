import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Lock,
  Languages,
  Mail,
  Phone,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useTranslation } from "../hooks/useTranslation";
import {
  loginByApi,
  registerByApi,
  verifyInviteCodeByApi,
} from "../lib/api";
import { usePageTitle } from "../lib/usePageTitle";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";

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
  const tt = (key: string) => t(key as any);
  usePageTitle(t("page.login"));

  const { login, verifiedInviteCode, setVerifiedInviteCode } = useAuthStore();
  const { theme, language, setLanguage } = useSettingsStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isRegister, setIsRegister] = useState(searchParams.get("tab") === "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState(searchParams.get("invite") ?? verifiedInviteCode ?? "");
  const [inviteError, setInviteError] = useState("");
  const [isVerifyingInvite, setIsVerifyingInvite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsRegister(searchParams.get("tab") === "register");
  }, [searchParams]);

  useEffect(() => {
    if (verifiedInviteCode) {
      setInviteCodeInput(verifiedInviteCode);
    }
  }, [verifiedInviteCode]);

  const isLight = theme === "light";
  const needsInviteCode = isRegister && !verifiedInviteCode;
  const mutedClass = isLight ? "text-zinc-600" : "text-zinc-400";
  const authPanelClass = isLight
    ? "border-black/10 bg-white/90 text-zinc-950 shadow-[0_28px_80px_rgba(15,23,42,0.08)]"
    : "border-white/10 bg-[#171b21]/92 text-[#f4efe6] shadow-[0_34px_90px_rgba(0,0,0,0.45)]";
  const mutedPanelClass = isLight
    ? "border-black/10 bg-[#f6f1ea]"
    : "border-white/10 bg-[#101319]";
  const surfaceClass = isLight
    ? "border-black/10 bg-white"
    : "border-white/8 bg-[#0d1014]";
  const inputClass = isLight
    ? "border-black/10 bg-white text-zinc-950 placeholder:text-zinc-400 focus:border-[#3454a1]"
    : "border-white/10 bg-[#0d1014] text-[#f4efe6] placeholder:text-zinc-500 focus:border-[#5d7fca]";
  const iconClass = isLight ? "text-zinc-400" : "text-zinc-500";
  const primaryButtonClass = isLight
    ? "h-12 rounded-2xl bg-[#1f2937] text-white hover:bg-[#111827] shadow-none"
    : "h-12 rounded-2xl bg-[#2b4e93] text-white hover:bg-[#355da9] shadow-none";
  const pageClass = isLight
    ? "min-h-screen bg-[#efe8de] text-zinc-950"
    : "min-h-screen bg-[#111318] text-[#f4efe6]";
  const languageShellClass = isLight
    ? "inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/80 p-1 text-sm shadow-sm"
    : "inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#171b21]/90 p-1 text-sm";
  const languageIconClass = isLight ? "text-zinc-500" : "text-zinc-400";
  const languageButtonClass = (active: boolean) =>
    active
      ? isLight
        ? "rounded-full bg-[#1f2937] px-3 py-1.5 text-white"
        : "rounded-full bg-[#2b4e93] px-3 py-1.5 text-white"
      : isLight
        ? "rounded-full px-3 py-1.5 text-zinc-600 hover:text-zinc-950"
        : "rounded-full px-3 py-1.5 text-zinc-400 hover:text-white";
  const getPostAuthPath = (onboardingDone?: boolean) => (onboardingDone ? "/app" : "/onboarding");

  const switchTab = (nextIsRegister: boolean) => {
    setIsRegister(nextIsRegister);
    setInviteError("");
  };

  const handleVerifyInvite = async (rawCode?: string) => {
    const normalizedCode = (rawCode ?? inviteCodeInput).trim().toUpperCase();
    if (!normalizedCode) {
      setInviteError(t("invite_page.empty_error"));
      return;
    }

    setIsVerifyingInvite(true);
    setInviteError("");
    try {
      const invite = await verifyInviteCodeByApi(normalizedCode);
      if (!invite || invite.status !== "UNUSED") {
        setInviteError(t("invite_page.verify_error"));
        return;
      }
      setInviteCodeInput(invite.code);
      setVerifiedInviteCode(invite.code);
      toast.success(t("invite_page.verify_success"));
    } catch (err: any) {
      setInviteError(err?.message || t("invite_page.verify_error"));
    } finally {
      setIsVerifyingInvite(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (isRegister) {
        if (!verifiedInviteCode) {
          toast.error(t("login.invite_verify_first"));
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
          const message: string = err?.message || "";
          if (message.toLowerCase().includes("already") || message.includes("409") || message.includes("Conflict")) {
            const apiUser = await loginByApi({ email: email.trim(), password });
            login(apiUser);
            setVerifiedInviteCode(null);
            toast.success((t("login.welcome_back_name") as string).replace("{name}", apiUser.name));
            navigate(getPostAuthPath(apiUser.onboardingDone));
            return;
          }
          if (isPasswordValidationError(message)) {
            toast.error(t("reset.password_requirements"));
            return;
          }
          toast.error(message || t("login.register_failed"));
          return;
        }
      }

      const apiUser = await loginByApi({ email: email.trim(), password });
      login(apiUser);
      toast.success((t("login.welcome_back_name") as string).replace("{name}", apiUser.name));
      navigate(getPostAuthPath(apiUser.onboardingDone));
    } catch (err: any) {
      toast.error(err?.message || t("login.invalid_credentials"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={pageClass}>
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <aside
          className={
            isLight
              ? "relative hidden overflow-hidden border-r border-black/10 bg-[#f3eee6] lg:flex"
              : "relative hidden overflow-hidden border-r border-white/8 bg-[#14171d] lg:flex"
          }
        >
          <div
            className={
              isLight
                ? "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(62,92,164,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(80,111,95,0.14),transparent_32%),linear-gradient(120deg,rgba(255,255,255,0.24),transparent_48%)]"
                : "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,106,178,0.22),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(60,95,79,0.2),transparent_28%),linear-gradient(120deg,rgba(255,255,255,0.04),transparent_42%)]"
            }
          />
          <div
            className={
              isLight
                ? "absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:72px_72px]"
                : "absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px]"
            }
          />

          <div className="relative z-10 flex w-full flex-col justify-between p-12">
            <div className="space-y-12">
              <Link to="/" className="flex w-fit items-center gap-3">
                <div
                  className={
                    isLight
                      ? "flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white text-[#3454a1]"
                      : "flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#9fb7f0]"
                  }
                >
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.32em] text-zinc-500">
                    AI-World
                  </p>
                  <p className="text-2xl font-semibold tracking-tight">
                    AI-World
                  </p>
                </div>
              </Link>

              <div className="max-w-2xl space-y-4">
                <h1 className="max-w-none whitespace-nowrap text-[clamp(3.2rem,4.6vw,5.2rem)] font-semibold leading-[0.96] tracking-tight">
                  {t("login.title")}
                </h1>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-[34rem]">
            <div className="mb-4 flex justify-end">
              <div className={languageShellClass}>
                <Languages className={`mx-1 h-4 w-4 ${languageIconClass}`} />
                <button
                  type="button"
                  data-testid="login-language-zh"
                  className={languageButtonClass(language === "zh")}
                  onClick={() => setLanguage("zh")}
                >
                  {t("lang.zh")}
                </button>
                <button
                  type="button"
                  data-testid="login-language-en"
                  className={languageButtonClass(language === "en")}
                  onClick={() => setLanguage("en")}
                >
                  {t("lang.en")}
                </button>
              </div>
            </div>

            <div className="mb-6 space-y-5 lg:hidden">
              <Link to="/" className="flex w-fit items-center gap-3">
                <div
                  className={
                    isLight
                      ? "flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-white text-[#3454a1]"
                      : "flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#9fb7f0]"
                  }
                >
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <span className="text-2xl font-semibold tracking-tight">
                  AI-World
                </span>
              </Link>

              <div className={`rounded-[28px] border p-5 ${mutedPanelClass}`}>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {t("login.title")}
                </h1>
              </div>
            </div>

            <div className={`rounded-[32px] border p-5 sm:p-8 ${authPanelClass}`}>
              <div className="space-y-3">
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-zinc-500">
                    {isRegister ? t("login.register_tab") : t("login.sign_in_tab")}
                  </p>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-semibold tracking-tight">
                      {isRegister
                        ? t("login.create_account")
                        : t("login.welcome_back")}
                    </h2>
                    <p className={`max-w-md text-sm leading-7 ${mutedClass}`}>
                      {isRegister
                        ? tt("login.register_step_desc")
                        : t("login.welcome_desc")}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={
                  isLight
                    ? "mt-7 grid grid-cols-2 rounded-full bg-[#f3eee6] p-1"
                    : "mt-7 grid grid-cols-2 rounded-full bg-[#0d1014] p-1"
                }
              >
                <button
                  type="button"
                  className={
                    !isRegister
                      ? isLight
                        ? "rounded-full bg-white px-4 py-3 text-sm font-medium text-zinc-950 shadow-sm"
                        : "rounded-full bg-[#222832] px-4 py-3 text-sm font-medium text-white"
                      : "rounded-full px-4 py-3 text-sm font-medium text-zinc-500"
                  }
                  onClick={() => switchTab(false)}
                >
                  {t("login.sign_in_tab")}
                </button>
                <button
                  type="button"
                  className={
                    isRegister
                      ? isLight
                        ? "rounded-full bg-white px-4 py-3 text-sm font-medium text-zinc-950 shadow-sm"
                        : "rounded-full bg-[#222832] px-4 py-3 text-sm font-medium text-white"
                      : "rounded-full px-4 py-3 text-sm font-medium text-zinc-500"
                  }
                  onClick={() => switchTab(true)}
                >
                  {t("login.register_tab")}
                </button>
              </div>

              {isRegister ? (
                <div className="mt-7 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div
                      className={`rounded-[24px] border p-4 ${
                        needsInviteCode
                          ? isLight
                            ? "border-[#ced8ef] bg-[#eef3fb]"
                            : "border-[#355288] bg-[#182338]"
                          : isLight
                            ? "border-black/10 bg-[#f7f2eb]"
                            : "border-white/10 bg-[#0f1216]"
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                        01
                      </p>
                      <p className="mt-3 text-lg font-semibold tracking-tight">
                        {tt("login.register_step_invite")}
                      </p>
                    </div>

                    <div
                      className={`rounded-[24px] border p-4 ${
                        !needsInviteCode
                          ? isLight
                            ? "border-[#d4decf] bg-[#edf5ee]"
                            : "border-[#35553f] bg-[#16231a]"
                          : isLight
                            ? "border-black/10 bg-[#f7f2eb]"
                            : "border-white/10 bg-[#0f1216]"
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                        02
                      </p>
                      <p className="mt-3 text-lg font-semibold tracking-tight">
                        {tt("login.register_step_account")}
                      </p>
                    </div>
                  </div>

                  {needsInviteCode ? (
                    <div className={`rounded-[24px] border p-4 ${surfaceClass}`}>
                      <label className="text-sm font-medium">
                        {tt("login.register_step_invite")}
                      </label>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <Input
                          data-testid="register-invite-input"
                          type="text"
                          value={inviteCodeInput}
                          onChange={(event) => setInviteCodeInput(event.target.value.toUpperCase())}
                          placeholder={t("invite_page.enter_placeholder")}
                          className={`h-12 flex-1 rounded-2xl pl-4 font-mono text-sm tracking-[0.12em] ${inputClass}`}
                        />
                        <Button
                          data-testid="register-invite-verify"
                          type="button"
                          className={`w-full sm:w-auto sm:min-w-[10rem] ${primaryButtonClass}`}
                          disabled={isVerifyingInvite}
                          onClick={() => void handleVerifyInvite()}
                        >
                          {isVerifyingInvite
                            ? tt("invite_page.verifying")
                            : tt("login.verify_invite")}
                        </Button>
                      </div>

                      {inviteError ? (
                        <p className="mt-3 text-sm text-rose-400">{inviteError}</p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div
                        data-testid="register-invite-verified"
                        className={
                          isLight
                            ? "flex items-start justify-between gap-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4"
                            : "flex items-start justify-between gap-4 rounded-[24px] border border-emerald-900/80 bg-emerald-950/40 px-5 py-4"
                        }
                      >
                        <div className="flex items-start gap-3">
                          <CheckCircle2
                            className={
                              isLight
                                ? "mt-0.5 h-5 w-5 text-emerald-700"
                                : "mt-0.5 h-5 w-5 text-emerald-400"
                            }
                          />
                          <div>
                            <p className="text-sm font-semibold">
                              {t("login.invite_verified")}
                            </p>
                            <p className={`mt-1 font-mono text-xs tracking-[0.24em] ${mutedClass}`}>
                              {verifiedInviteCode}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={
                            isLight
                              ? "text-sm font-medium text-[#3454a1]"
                              : "text-sm font-medium text-[#a8bff0]"
                          }
                          onClick={() => {
                            setVerifiedInviteCode(null);
                            setInviteError("");
                          }}
                        >
                          {t("login.change")}
                        </button>
                      </div>

                      <form className="space-y-4" onSubmit={handleSubmit}>
                        <Field
                          label={t("login.name")}
                          icon={
                            <UserIcon
                              className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`}
                            />
                          }
                          input={
                            <Input
                              type="text"
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              placeholder={tt("login.name_placeholder")}
                              className={`h-12 rounded-2xl pl-11 ${inputClass}`}
                            />
                          }
                        />

                        <Field
                          label={tt("login.phone")}
                          icon={
                            <Phone
                              className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`}
                            />
                          }
                          input={
                            <Input
                              type="tel"
                              value={phone}
                              onChange={(event) => setPhone(event.target.value)}
                              placeholder={tt("login.phone_placeholder")}
                              className={`h-12 rounded-2xl pl-11 ${inputClass}`}
                            />
                          }
                        />

                        <Field
                          label={t("login.email")}
                          icon={
                            <Mail
                              className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`}
                            />
                          }
                          input={
                            <Input
                              type="email"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              placeholder={tt("login.email_placeholder")}
                              className={`h-12 rounded-2xl pl-11 ${inputClass}`}
                            />
                          }
                        />

                        <Field
                          label={t("login.password")}
                          icon={
                            <Lock
                              className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`}
                            />
                          }
                          input={
                            <Input
                              type="password"
                              value={password}
                              onChange={(event) => setPassword(event.target.value)}
                              placeholder="Password123!"
                              className={`h-12 rounded-2xl pl-11 ${inputClass}`}
                            />
                          }
                        />

                        <p className={`text-sm leading-6 ${mutedClass}`}>
                          {tt("reset.password_requirements")}
                        </p>

                        <Button
                          type="submit"
                          className={`w-full ${primaryButtonClass}`}
                          disabled={isSubmitting}
                        >
                          {isSubmitting
                            ? `${t("login.btn_create")}...`
                            : t("login.btn_create")}
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              ) : (
                <div className="mt-7 space-y-5">
                  <div className={`rounded-[28px] border p-5 ${mutedPanelClass}`}>
                    <div className="flex items-start gap-4">
                      <div
                        className={
                          isLight
                            ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ede8df] text-[#3454a1]"
                            : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0f1216] text-[#a8bff0]"
                        }
                      >
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold tracking-tight">
                          {t("login.welcome_back")}
                        </h3>
                        <p className={`text-sm leading-7 ${mutedClass}`}>
                          {t("login.welcome_desc")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {[t("login.check_1"), t("login.check_2"), t("login.check_3")].map(
                        (item) => (
                          <div
                            key={item}
                            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${surfaceClass}`}
                          >
                            <CheckCircle2
                              className={
                                isLight
                                  ? "h-4 w-4 text-[#3454a1]"
                                  : "h-4 w-4 text-[#a8bff0]"
                              }
                            />
                            <span className="text-sm">{item}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <Field
                      label={t("login.email")}
                      icon={
                        <Mail
                          className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`}
                        />
                      }
                      input={
                        <Input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder={tt("login.email_placeholder")}
                          className={`h-12 rounded-2xl pl-11 ${inputClass}`}
                        />
                      }
                    />

                    <Field
                      label={t("login.password")}
                      icon={
                        <Lock
                          className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`}
                        />
                      }
                      input={
                        <Input
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Password123!"
                          className={`h-12 rounded-2xl pl-11 ${inputClass}`}
                        />
                      }
                    />

                    <Button
                      type="submit"
                      className={`w-full ${primaryButtonClass}`}
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? `${t("login.btn_sign_in")}...`
                        : t("login.btn_sign_in")}
                    </Button>
                  </form>
                </div>
              )}

              <div
                className={`mt-6 flex flex-col gap-3 border-t border-black/10 pt-5 text-sm sm:flex-row sm:items-center ${
                  isRegister ? "" : "sm:justify-between"
                } dark:border-white/10`}
              >
                <button
                  type="button"
                  className={
                    isLight
                      ? "w-fit font-medium text-[#3454a1]"
                      : "w-fit font-medium text-[#a8bff0]"
                  }
                  onClick={() => switchTab(!isRegister)}
                >
                  {isRegister ? t("login.sign_in_tab") : t("login.register_tab")}
                </button>

                {!isRegister ? (
                  <Link
                    to="/reset-password"
                    className={
                      isLight
                        ? "w-fit text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline"
                        : "w-fit text-zinc-400 underline-offset-4 hover:text-white hover:underline"
                    }
                  >
                    {tt("login.forgot_password")}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  input,
}: {
  label: string;
  icon: ReactNode;
  input: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        {icon}
        {input}
      </div>
    </div>
  );
}
