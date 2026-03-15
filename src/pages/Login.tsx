import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  type LucideIcon,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Building2,
  CheckCircle2,
  FlaskConical,
  GraduationCap,
  Lock,
  Mail,
  MessagesSquare,
  Phone,
  ShieldCheck,
  Ticket,
  User as UserIcon,
  Workflow,
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
  getInviteSampleTestId,
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

function getInviteSamplePresentation(
  role: PublicInviteSample["role"],
  isLight: boolean,
): {
  icon: LucideIcon;
  cardClass: string;
  iconWrapClass: string;
} {
  switch (role) {
    case "EXPERT":
      return {
        icon: FlaskConical,
        cardClass: isLight
          ? "border-[#d7e1fb] bg-[#f7f9fe] hover:border-[#8ca3d9]"
          : "border-[#30497d] bg-[#161d2b] hover:border-[#5578c5]",
        iconWrapClass: isLight
          ? "bg-[#e9f0ff] text-[#3454a1]"
          : "bg-[#22396b] text-[#a9c0ff]",
      };
    case "ENTERPRISE_LEADER":
      return {
        icon: Building2,
        cardClass: isLight
          ? "border-[#e8ddc7] bg-[#faf6ef] hover:border-[#b9965c]"
          : "border-[#5d4632] bg-[#231b15] hover:border-[#b9965c]",
        iconWrapClass: isLight
          ? "bg-[#f1e8d8] text-[#8b6a38]"
          : "bg-[#3a2c21] text-[#f1cc93]",
      };
    case "LEARNER":
    default:
      return {
        icon: GraduationCap,
        cardClass: isLight
          ? "border-[#d5e6da] bg-[#f4faf5] hover:border-[#5e8b6b]"
          : "border-[#345543] bg-[#132018] hover:border-[#5e8b6b]",
        iconWrapClass: isLight
          ? "bg-[#e6f2e8] text-[#356349]"
          : "bg-[#1f3b2b] text-[#98d4a5]",
      };
  }
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
  const getPostAuthPath = (onboardingDone?: boolean) => (onboardingDone ? "/app" : "/onboarding");
  const marketingItems = [
    {
      icon: ShieldCheck,
      label: t("invite_page.perk_1"),
      caption: tt("login.register_step_invite"),
    },
    {
      icon: MessagesSquare,
      label: t("invite_page.perk_2"),
      caption: tt("login.register_step_account"),
    },
    {
      icon: Workflow,
      label: t("invite_page.perk_3"),
      caption: tt("login.register_step_desc"),
    },
  ];

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

              <div className="max-w-2xl space-y-6">
                <div
                  className={
                    isLight
                      ? "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-medium tracking-[0.24em] text-zinc-700"
                      : "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium tracking-[0.24em] text-zinc-300"
                  }
                >
                  <span
                    className={
                      isLight
                        ? "h-2 w-2 rounded-full bg-[#3454a1]"
                        : "h-2 w-2 rounded-full bg-[#89a5e2]"
                    }
                  />
                  {t("login.invite_req")}
                </div>

                <div className="space-y-5">
                  <h1 className="max-w-xl text-5xl font-semibold leading-[1.02] tracking-tight">
                    {t("login.title")}
                  </h1>
                  <p className={`max-w-xl text-lg leading-8 ${mutedClass}`}>
                    {t("login.invite_desc")}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {marketingItems.map((item, index) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.label}
                        className={`rounded-[28px] border px-5 py-5 ${
                          index === 0 ? "sm:col-span-2" : ""
                        } ${
                          isLight
                            ? "border-black/10 bg-white/72"
                            : "border-white/10 bg-black/20"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={
                              isLight
                                ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef2fb] text-[#3454a1]"
                                : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/6 text-[#aec3f5]"
                            }
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="space-y-2">
                            <p className="text-lg font-semibold leading-6">
                              {item.label}
                            </p>
                            <p className={`text-sm leading-6 ${mutedClass}`}>
                              {item.caption}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                  {tt("login.sample_invites")}
                </p>
                <Link
                  to="/invite"
                  className={
                    isLight
                      ? "text-sm font-medium text-[#3454a1] underline-offset-4 hover:underline"
                      : "text-sm font-medium text-[#a8bff0] underline-offset-4 hover:underline"
                  }
                >
                  {tt("login.more_invites")}
                </Link>
              </div>

              <div className="grid gap-3 xl:grid-cols-3">
                {samples.slice(0, 3).map((sample) => {
                  const presentation = getInviteSamplePresentation(
                    sample.role,
                    isLight,
                  );
                  const Icon = presentation.icon;

                  return (
                    <button
                      key={`marketing-${sample.code}`}
                      type="button"
                      onClick={() => {
                        setInviteCodeInput(sample.code);
                        if (isRegister) {
                          void handleVerifyInvite(sample.code);
                        }
                      }}
                      className={`group rounded-[24px] border p-4 text-left transition-colors ${presentation.cardClass}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${presentation.iconWrapClass}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                      <div className="mt-5 space-y-2">
                        <p className="text-lg font-semibold tracking-tight">
                          {formatRole(sample.role)}
                        </p>
                        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                          {sample.code}
                        </p>
                        <p className={`text-sm leading-6 ${mutedClass}`}>
                          {tt(
                            INVITE_SAMPLE_DESCRIPTION_KEYS[sample.role] ??
                              "invite_page.sample_desc",
                          )}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-[34rem]">
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
                <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  {t("login.invite_req")}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  {t("login.title")}
                </h1>
                <p className={`mt-3 text-sm leading-7 ${mutedClass}`}>
                  {t("login.invite_desc")}
                </p>
              </div>
            </div>

            <div className={`rounded-[32px] border p-5 sm:p-8 ${authPanelClass}`}>
              <div className="flex items-start justify-between gap-4">
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

                {isRegister ? (
                  <div
                    className={
                      isLight
                        ? "hidden rounded-2xl border border-black/10 bg-[#f7f2eb] px-4 py-3 text-right sm:block"
                        : "hidden rounded-2xl border border-white/10 bg-[#0f1216] px-4 py-3 text-right sm:block"
                    }
                  >
                    <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                      2-step
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {tt("login.register_step_invite")}
                    </p>
                  </div>
                ) : null}
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
                      <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
                        {tt("login.register_unlock_desc")}
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
                      <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
                        {tt("login.register_step_desc")}
                      </p>
                    </div>
                  </div>

                  {needsInviteCode ? (
                    <div className={`rounded-[28px] border p-5 ${mutedPanelClass}`}>
                      <div className="flex items-start gap-4">
                        <div
                          className={
                            isLight
                              ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e9eef8] text-[#3454a1]"
                              : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1d2740] text-[#a8bff0]"
                          }
                        >
                          <Ticket className="h-5 w-5" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-semibold tracking-tight">
                            {tt("login.register_unlock_title")}
                          </h3>
                          <p className={`text-sm leading-7 ${mutedClass}`}>
                            {tt("login.register_unlock_desc")}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Input
                          data-testid="register-invite-input"
                          type="text"
                          value={inviteCodeInput}
                          onChange={(event) => setInviteCodeInput(event.target.value.toUpperCase())}
                          placeholder="AIWORLD-EXPERT-2026"
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

                      <div className={`mt-6 rounded-[24px] border p-4 ${surfaceClass}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold tracking-tight">
                              {tt("login.sample_invites")}
                            </p>
                            <p className={`mt-1 text-sm leading-6 ${mutedClass}`}>
                              {tt("login.sample_invite_hint")}
                            </p>
                          </div>
                          <Link
                            to="/invite"
                            className={
                              isLight
                                ? "text-sm font-medium text-[#3454a1] underline-offset-4 hover:underline"
                                : "text-sm font-medium text-[#a8bff0] underline-offset-4 hover:underline"
                            }
                          >
                            {tt("login.more_invites")}
                          </Link>
                        </div>

                        <div className="mt-4 space-y-3">
                          {isLoadingSamples ? (
                            <p className={`text-sm ${mutedClass}`}>
                              {tt("invite_page.sample_loading")}
                            </p>
                          ) : (
                            samples.map((sample) => {
                              const presentation = getInviteSamplePresentation(
                                sample.role,
                                isLight,
                              );
                              const Icon = presentation.icon;

                              return (
                                <button
                                  key={sample.code}
                                  type="button"
                                  data-testid={`login-sample-${getInviteSampleTestId(sample.role)}`}
                                  onClick={() => void handleVerifyInvite(sample.code)}
                                  className={`group w-full rounded-[22px] border p-4 text-left transition-colors ${presentation.cardClass}`}
                                >
                                  <div className="flex items-start gap-4">
                                    <div
                                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${presentation.iconWrapClass}`}
                                    >
                                      <Icon className="h-5 w-5" />
                                    </div>

                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="text-lg font-semibold tracking-tight">
                                            {formatRole(sample.role)}
                                          </p>
                                          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                                            {sample.code}
                                          </p>
                                        </div>
                                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1" />
                                      </div>
                                      <p className={`text-sm leading-6 ${mutedClass}`}>
                                        {tt(
                                          INVITE_SAMPLE_DESCRIPTION_KEYS[sample.role] ??
                                            "invite_page.sample_desc",
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
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

              <div className="mt-6 flex flex-col gap-3 border-t border-black/10 pt-5 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
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

                {isRegister ? (
                  <Link
                    to="/invite"
                    className={
                      isLight
                        ? "w-fit text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline"
                        : "w-fit text-zinc-400 underline-offset-4 hover:text-white hover:underline"
                    }
                  >
                    {tt("login.more_invites")}
                  </Link>
                ) : (
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
                )}
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
