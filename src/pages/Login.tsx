import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Ticket,
  User as UserIcon,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useTranslation } from "../hooks/useTranslation";
import {
  fetchPublicInviteSamplesByApi,
  loginByApi,
  registerByApi,
  verifyInviteCodeByApi,
} from "../lib/api";
import {
  DEFAULT_PUBLIC_INVITE_SAMPLES,
  INVITE_SAMPLE_DESCRIPTION_KEYS,
} from "../lib/inviteSamples";
import { usePageTitle } from "../lib/usePageTitle";
import { formatRole } from "../lib/utils";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";
import type { PublicInviteSample } from "../types";

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
  const { theme } = useSettingsStore();
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
  const [samples, setSamples] = useState<PublicInviteSample[]>(DEFAULT_PUBLIC_INVITE_SAMPLES);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);

  useEffect(() => {
    setIsRegister(searchParams.get("tab") === "register");
  }, [searchParams]);

  useEffect(() => {
    if (verifiedInviteCode) {
      setInviteCodeInput(verifiedInviteCode);
    }
  }, [verifiedInviteCode]);

  useEffect(() => {
    if (!isRegister) return;
    let active = true;
    setIsLoadingSamples(true);
    void fetchPublicInviteSamplesByApi()
      .then((items) => {
        if (active && items.length > 0) {
          setSamples(items);
        }
      })
      .catch(() => {
        if (active) {
          setSamples(DEFAULT_PUBLIC_INVITE_SAMPLES);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingSamples(false);
        }
      });
    return () => {
      active = false;
    };
  }, [isRegister]);

  const isLight = theme === "light";
  const needsInviteCode = isRegister && !verifiedInviteCode;
  const cardClass = isLight
    ? "border-zinc-200 bg-white/90 text-zinc-950 shadow-indigo-950/5"
    : "border-white/10 bg-white/[0.03] text-white shadow-black/40";
  const mutedClass = isLight ? "text-zinc-500" : "text-zinc-400";
  const inputClass = isLight
    ? "border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400"
    : "border-white/10 bg-zinc-950/60 text-white placeholder:text-zinc-500";
  const iconClass = isLight ? "text-zinc-400" : "text-zinc-500";
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
    <div className={isLight ? "min-h-screen bg-gradient-to-br from-zinc-100 via-white to-zinc-100 text-zinc-950" : "min-h-screen bg-[#050505] text-white"}>
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <div className={isLight ? "relative hidden border-r border-zinc-200 bg-white lg:flex" : "relative hidden border-r border-white/5 bg-[#050505] lg:flex"}>
          <div className={isLight ? "absolute inset-0 bg-[radial-gradient(circle_at_28%_30%,rgba(79,70,229,0.18),transparent_42%),radial-gradient(circle_at_72%_68%,rgba(16,185,129,0.12),transparent_28%)]" : "absolute inset-0 bg-[radial-gradient(circle_at_28%_30%,rgba(79,70,229,0.26),transparent_42%),radial-gradient(circle_at_72%_68%,rgba(16,185,129,0.12),transparent_28%)]"} />
          <div className="relative z-10 flex w-full flex-col justify-between p-12">
            <div className="space-y-12">
              <Link to="/" className="flex w-fit items-center gap-3">
                <div className={isLight ? "flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-600" : "flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400"}>
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <span className={isLight ? "text-2xl font-bold tracking-tight text-zinc-950" : "text-2xl font-bold tracking-tight text-white"}>AI-World</span>
              </Link>

              <div className="max-w-xl space-y-6">
                <span className={isLight ? "inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600" : "inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-indigo-200"}>{t("login.invite_req")}</span>
                <h1 className={isLight ? "text-5xl font-bold tracking-tight text-zinc-950" : "text-5xl font-bold tracking-tight text-white"}>{t("login.title")}</h1>
                <p className={isLight ? "text-lg leading-8 text-zinc-600" : "text-lg leading-8 text-zinc-400"}>{t("login.invite_desc")}</p>
                {[t("invite_page.perk_1"), t("invite_page.perk_2"), t("invite_page.perk_3")].map((item) => (
                  <div key={item} className={isLight ? "flex items-center gap-3 rounded-3xl border border-zinc-200 bg-white/80 px-5 py-4" : "flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-4"}>
                    <ShieldCheck className={isLight ? "h-5 w-5 text-indigo-600" : "h-5 w-5 text-indigo-300"} />
                    <span className={isLight ? "font-medium text-zinc-900" : "font-medium text-zinc-100"}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm text-zinc-500">{t("landing.footer")}</p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[32rem]">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link to="/" className="flex items-center gap-3">
                <div className={isLight ? "flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-600" : "flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400"}>
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <span className={isLight ? "text-2xl font-bold tracking-tight text-zinc-950" : "text-2xl font-bold tracking-tight text-white"}>AI-World</span>
              </Link>
            </div>

            <div className={`rounded-[2rem] border p-8 shadow-2xl backdrop-blur-xl ${cardClass}`}>
              <div className="space-y-2 text-center">
                <h2 className="text-3xl font-bold tracking-tight">{isRegister ? t("login.create_account") : t("login.welcome_back")}</h2>
                <p className={mutedClass}>{isRegister ? tt("login.register_step_desc") : t("login.welcome_desc")}</p>
              </div>

              <div className={isLight ? "mt-8 grid grid-cols-2 rounded-2xl bg-zinc-100 p-1" : "mt-8 grid grid-cols-2 rounded-2xl bg-zinc-900/70 p-1"}>
                <button type="button" className={!isRegister ? (isLight ? "rounded-xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 shadow-sm" : "rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white") : (isLight ? "rounded-xl px-4 py-3 text-sm font-medium text-zinc-500" : "rounded-xl px-4 py-3 text-sm font-medium text-zinc-400")} onClick={() => switchTab(false)}>{t("login.sign_in_tab")}</button>
                <button type="button" className={isRegister ? (isLight ? "rounded-xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 shadow-sm" : "rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white") : (isLight ? "rounded-xl px-4 py-3 text-sm font-medium text-zinc-500" : "rounded-xl px-4 py-3 text-sm font-medium text-zinc-400")} onClick={() => switchTab(true)}>{t("login.register_tab")}</button>
              </div>

              {isRegister ? (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className={needsInviteCode ? (isLight ? "rounded-2xl border border-zinc-900 bg-zinc-950 px-4 py-3 text-white" : "rounded-2xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-white") : (isLight ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900" : "rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-100")}>
                      <p className="text-xs uppercase tracking-[0.22em] opacity-70">01</p>
                      <p className="mt-2 text-sm font-semibold">{tt("login.register_step_invite")}</p>
                    </div>
                    <div className={needsInviteCode ? (isLight ? "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-500" : "rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-zinc-500") : (isLight ? "rounded-2xl border border-zinc-900 bg-zinc-950 px-4 py-3 text-white" : "rounded-2xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-white")}>
                      <p className="text-xs uppercase tracking-[0.22em] opacity-70">02</p>
                      <p className="mt-2 text-sm font-semibold">{tt("login.register_step_account")}</p>
                    </div>
                  </div>

                  {needsInviteCode ? (
                    <div className={isLight ? "rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5" : "rounded-3xl border border-white/10 bg-zinc-950/40 p-5"}>
                      <div className="flex items-start gap-3">
                        <div className={isLight ? "flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600" : "flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300"}>
                          <Ticket className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <p className={isLight ? "font-semibold text-zinc-950" : "font-semibold text-zinc-100"}>{tt("login.register_unlock_title")}</p>
                            <p className={`text-sm ${mutedClass}`}>{tt("login.register_unlock_desc")}</p>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row">
                            <Input value={inviteCodeInput} onChange={(event) => { setInviteCodeInput(event.target.value); setInviteError(""); }} placeholder={t("invite_page.enter_placeholder")} className={`h-12 flex-1 ${inputClass}`} data-testid="register-invite-input" />
                            <Button type="button" className={isLight ? "h-12 min-w-36 bg-zinc-950 text-white hover:bg-zinc-800" : "h-12 min-w-36 bg-indigo-600 text-white hover:bg-indigo-500"} onClick={() => void handleVerifyInvite()} disabled={isVerifyingInvite || !inviteCodeInput.trim()} data-testid="register-invite-verify">{isVerifyingInvite ? t("invite_page.verifying") : tt("login.verify_invite")}</Button>
                          </div>
                          {inviteError ? <p className="text-sm text-red-400">{inviteError}</p> : null}

                          <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-indigo-300" />
                              <p className={isLight ? "text-sm font-medium text-zinc-900" : "text-sm font-medium text-zinc-100"}>{tt("login.sample_invites")}</p>
                            </div>
                            <div className="grid gap-3">
                              {samples.map((sample) => (
                                <button key={sample.code} type="button" onClick={() => void handleVerifyInvite(sample.code)} className={isLight ? "rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-zinc-300" : "rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-indigo-400/30"} data-testid={`login-sample-${sample.role.toLowerCase()}`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="space-y-1">
                                      <p className={isLight ? "text-sm font-semibold text-zinc-950" : "text-sm font-semibold text-zinc-100"}>{formatRole(sample.role)}</p>
                                      <p className="font-mono text-xs tracking-[0.18em] text-zinc-500">{sample.code}</p>
                                      <p className="text-xs leading-5 text-zinc-500">{tt(INVITE_SAMPLE_DESCRIPTION_KEYS[sample.role] ?? "invite_page.sample_desc")}</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
                                  </div>
                                </button>
                              ))}
                            </div>
                            {isLoadingSamples ? <p className="mt-3 text-xs text-zinc-500">{tt("invite_page.sample_loading")}</p> : null}
                          </div>

                          <div className="flex items-center justify-between gap-3 text-sm">
                            <Link to="/invite" className="font-medium text-indigo-400 underline-offset-4 hover:underline">{tt("login.more_invites")}</Link>
                            <p className="text-zinc-500">{tt("login.sample_invite_hint")}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={isLight ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800" : "rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200"} data-testid="register-invite-verified">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <div className="space-y-1">
                          <p className="font-medium">{t("login.invite_verified")}</p>
                          <p className={isLight ? "text-emerald-700" : "text-emerald-300"}>{verifiedInviteCode}</p>
                        </div>
                        <button type="button" onClick={() => { setVerifiedInviteCode(null); setInviteError(""); }} className="ml-auto text-xs font-medium underline-offset-4 hover:underline">{t("login.change")}</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                {isRegister && !needsInviteCode ? (
                  <>
                    <Field label={t("login.name")} icon={<UserIcon className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`} />} input={<Input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("login.name_placeholder")} className={`h-12 rounded-2xl pl-11 ${inputClass}`} required />} />
                    <Field label={t("settings.phone")} icon={<Phone className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`} />} input={<Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t("login.phone_placeholder")} className={`h-12 rounded-2xl pl-11 ${inputClass}`} />} />
                  </>
                ) : null}

                {!isRegister || !needsInviteCode ? (
                  <>
                    <Field label={t("login.email")} icon={<Mail className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`} />} input={<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("login.email_placeholder")} className={`h-12 rounded-2xl pl-11 ${inputClass}`} required />} />
                    <Field label={t("login.password")} icon={<Lock className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${iconClass}`} />} input={<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="********" className={`h-12 rounded-2xl pl-11 ${inputClass}`} required />} />
                    {isRegister ? <p className="text-xs leading-5 text-zinc-500">{t("reset.password_requirements")}</p> : null}
                    <Button type="submit" disabled={isSubmitting} className={isLight ? "mt-2 h-12 w-full rounded-2xl bg-zinc-950 text-base font-medium text-white hover:bg-zinc-800" : "mt-2 h-12 w-full rounded-2xl bg-indigo-600 text-base font-medium text-white hover:bg-indigo-500"}>
                      {isSubmitting ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />{t("reset.sending")}</span> : <span className="flex items-center gap-2">{isRegister ? t("login.create_account") : t("login.btn_sign_in")}<ArrowRight className="h-4 w-4" /></span>}
                    </Button>
                  </>
                ) : null}
              </form>

              <div className={`mt-6 flex items-center justify-between text-sm ${mutedClass}`}>
                <button type="button" className="font-medium underline-offset-4 hover:text-indigo-400 hover:underline" onClick={() => switchTab(!isRegister)}>{isRegister ? t("login.sign_in_tab") : t("login.create_account")}</button>
                {!isRegister ? <Link to="/reset-password" className="font-medium underline-offset-4 hover:text-indigo-400 hover:underline">{t("login.forgot_password")}</Link> : null}
              </div>
            </div>
          </div>
        </div>
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
