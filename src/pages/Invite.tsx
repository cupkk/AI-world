import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  Copy,
  ShieldCheck,
  Sparkles,
  Ticket,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useTranslation } from "../hooks/useTranslation";
import {
  fetchPublicInviteSamplesByApi,
  verifyInviteCodeByApi,
} from "../lib/api";
import {
  DEFAULT_PUBLIC_INVITE_SAMPLES,
  getInviteSampleTestId,
  INVITE_SAMPLE_DESCRIPTION_KEYS,
} from "../lib/inviteSamples";
import { formatRole } from "../lib/utils";
import { usePageTitle } from "../lib/usePageTitle";
import { useAuthStore } from "../store/authStore";
import type { PublicInviteSample } from "../types";

export function Invite() {
  const { t } = useTranslation();
  const tt = (key: string) => t(key as any);
  usePageTitle(t("invite_page.invitation"));

  const navigate = useNavigate();
  const { setVerifiedInviteCode } = useAuthStore();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [samples, setSamples] = useState<PublicInviteSample[]>(
    DEFAULT_PUBLIC_INVITE_SAMPLES,
  );
  const [isLoadingSamples, setIsLoadingSamples] = useState(true);

  useEffect(() => {
    let active = true;

    void fetchPublicInviteSamplesByApi()
      .then((items) => {
        if (!active || items.length === 0) {
          return;
        }
        setSamples(items);
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
  }, []);

  const applyExampleCode = (nextCode: string) => {
    setCode(nextCode);
    setError("");
  };

  const handleCopyExampleCode = async (sampleCode: string) => {
    try {
      await navigator.clipboard.writeText(sampleCode);
      setCopiedCode(sampleCode);
      toast.success(t("invite_page.copy_success"));
      window.setTimeout(() => {
        setCopiedCode((current) => (current === sampleCode ? null : current));
      }, 2000);
    } catch {
      toast.error(t("invite_page.copy_error"));
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!code.trim()) {
      setError(t("invite_page.empty_error"));
      return;
    }

    setIsVerifying(true);

    const normalizedCode = code.trim().toUpperCase();
    try {
      const invite = await verifyInviteCodeByApi(normalizedCode);
      if (invite && invite.status === "UNUSED") {
        setVerifiedInviteCode(invite.code);
        toast.success(t("invite_page.verify_success"));
        navigate("/login?tab=register");
        return;
      }
      setError(t("invite_page.verify_error"));
    } catch (err: any) {
      setError(err?.message || t("invite_page.verify_error"));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050505] text-white selection:bg-indigo-500/30">
      <div className="relative hidden overflow-hidden border-r border-white/5 lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(79,70,229,0.22),transparent_42%),radial-gradient(circle_at_75%_72%,rgba(34,197,94,0.10),transparent_28%)]" />

        <div className="relative z-10">
          <Link to="/" className="flex w-fit items-center gap-2 text-indigo-400">
            <BrainCircuit className="h-8 w-8" />
            <span className="text-xl font-bold tracking-tight text-white">
              AI-World
            </span>
          </Link>
        </div>

        <div className="relative z-10 max-w-xl space-y-8">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-200">
              {t("login.invite_req")}
            </span>
            <h1 className="text-4xl font-bold tracking-tight">
              {t("invite_page.branding_title")}
            </h1>
            <p className="text-lg leading-8 text-zinc-400">
              {t("invite_page.branding_desc")}
            </p>
          </div>

          <div className="grid gap-4">
            {[t("invite_page.perk_1"), t("invite_page.perk_2"), t("invite_page.perk_3")].map(
              (item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.03] px-5 py-4"
                >
                  <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-300" />
                  <span className="text-zinc-200">{item}</span>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="relative z-10 text-sm text-zinc-500">
          {t("landing.footer")}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[32rem] space-y-6">
          <div className="mb-4 flex justify-center lg:hidden">
            <Link to="/" className="flex items-center gap-2 text-indigo-400">
              <BrainCircuit className="h-8 w-8" />
              <span className="text-2xl font-bold tracking-tight text-white">
                AI-World
              </span>
            </Link>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10">
                <Ticket className="h-8 w-8 text-indigo-300" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white">
                {t("invite_page.enter_code")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {t("invite_page.code_desc")}
              </p>
            </div>

            <form onSubmit={handleVerify} className="mt-8 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">
                  {t("invite_page.code_label")}
                </label>
                <Input
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError("");
                  }}
                  placeholder={t("invite_page.enter_placeholder")}
                  className="h-12 border-white/10 bg-zinc-900/60 text-center text-base tracking-[0.26em] text-white placeholder:text-zinc-500"
                  autoFocus
                  data-testid="invite-code-input"
                />
                {error ? (
                  <p className="text-sm text-red-400">{error}</p>
                ) : null}
              </div>

              <Button
                type="submit"
                disabled={isVerifying || !code.trim()}
                className="h-12 w-full bg-indigo-600 text-white hover:bg-indigo-500"
                data-testid="invite-verify-button"
              >
                {isVerifying ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t("invite_page.verifying")}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {t("invite_page.verify_code")}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            <Card className="mt-6 border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-zinc-950/80 to-zinc-900/70">
              <CardHeader className="space-y-3 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10">
                    <Sparkles className="h-5 w-5 text-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base text-zinc-50">
                      {t("invite_page.sample_codes")}
                    </CardTitle>
                    <p className="text-sm text-zinc-400">
                    {tt("invite_page.sample_desc")}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/30 px-4 py-3 text-xs leading-6 text-zinc-400">
                  <span className="font-medium text-zinc-200">
                    {t("invite_page.sample_tip_label")}
                  </span>{" "}
                  {tt("invite_page.sample_tip_fill")}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoadingSamples && samples.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    {tt("invite_page.sample_loading")}
                  </p>
                ) : null}

                {samples.map((invite) => {
                  const sampleId = getInviteSampleTestId(invite.role);
                  const isCopied = copiedCode === invite.code;

                  return (
                    <div
                      key={invite.code}
                      className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                      data-testid={`invite-example-${sampleId}`}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-200">
                            {formatRole(invite.role)}
                          </span>
                        </div>
                        <code className="block text-sm font-mono tracking-[0.24em] text-zinc-100">
                          {invite.code}
                        </code>
                        <p className="text-sm leading-6 text-zinc-400">
                          {tt(
                            INVITE_SAMPLE_DESCRIPTION_KEYS[invite.role] ??
                              "invite_page.sample_desc",
                          )}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => applyExampleCode(invite.code)}
                          className="border-white/10 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
                          data-testid={`invite-example-apply-${sampleId}`}
                        >
                          {t("invite_page.sample_apply")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleCopyExampleCode(invite.code)}
                          className="gap-2 text-zinc-300 hover:bg-white/5 hover:text-white"
                          data-testid={`invite-example-copy-${sampleId}`}
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          {isCopied
                            ? t("invite_page.sample_copied")
                            : t("invite_page.sample_copy")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="mt-6 border-white/5 bg-zinc-900/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-zinc-300">
                  {t("invite_page.how_to_get")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-zinc-500">
                <p>{t("invite_page.way_1")}</p>
                <p>{t("invite_page.way_2")}</p>
                <p>{t("invite_page.way_3")}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link
              to="/"
              className="flex items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("invite_page.back_to_home")}
            </Link>
            <Link
              to="/login"
              className="text-indigo-400 transition-colors hover:text-indigo-300"
            >
              {t("invite_page.already_have")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
