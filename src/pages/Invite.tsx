import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation";
import { toast } from "sonner";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { verifyInviteCodeByApi } from "../lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import {
  BrainCircuit,
  ShieldCheck,
  Ticket,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";
import { formatRole } from "../lib/utils";

const SAMPLE_INVITES = [
  {
    code: "AIWORLD-EXPERT-EXAMPLE",
    role: "Expert",
    roleValue: "EXPERT",
    descriptionKey: "invite_page.sample_expert_desc",
  },
  {
    code: "AIWORLD-LEARNER-EXAMPLE",
    role: "Learner",
    roleValue: "LEARNER",
    descriptionKey: "invite_page.sample_learner_desc",
  },
  {
    code: "AIWORLD-ENTERPRISE-EXAMPLE",
    role: "Enterprise",
    roleValue: "ENTERPRISE_LEADER",
    descriptionKey: "invite_page.sample_enterprise_desc",
  },
] as const;

export function Invite() {
  const { t } = useTranslation();
  usePageTitle(t("invite_page.invitation"));

  const navigate = useNavigate();
  const { setVerifiedInviteCode } = useAuthStore();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 text-indigo-400 w-fit">
            <BrainCircuit className="h-8 w-8" />
            <span className="text-xl font-bold tracking-tight text-white">AI-World</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-bold tracking-tight mb-6 leading-tight">
            {t("invite_page.branding_title")}
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed mb-8">
            {t("invite_page.branding_desc")}
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-zinc-300">
              <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0" />
              <span>{t("invite_page.perk_1")}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
              <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0" />
              <span>{t("invite_page.perk_2")}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
              <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0" />
              <span>{t("invite_page.perk_3")}</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-zinc-500">
          {t("landing.footer")}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6 relative">
        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="flex items-center gap-2 text-indigo-400">
              <BrainCircuit className="h-8 w-8" />
              <span className="text-2xl font-bold tracking-tight text-white">AI-World</span>
            </Link>
          </div>

          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
              <Ticket className="h-8 w-8 text-indigo-400" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">
              {t("invite_page.enter_code")}
            </h2>
            <p className="mt-3 text-sm text-zinc-400 max-w-sm mx-auto">
              {t("invite_page.code_desc")}
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">
                {t("invite_page.code_label")}
              </label>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                placeholder={t("invite_page.enter_placeholder")}
                className="bg-zinc-900/50 border-white/10 focus-visible:ring-indigo-500 text-center text-lg tracking-widest uppercase h-12"
                autoFocus
                data-testid="invite-code-input"
              />
              {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
            </div>

            <Button
              type="submit"
              disabled={isVerifying || !code.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] h-11"
              data-testid="invite-verify-button"
            >
              {isVerifying ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("invite_page.verifying")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t("invite_page.verify_code")} <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-zinc-950/80 to-zinc-900/80 shadow-[0_20px_80px_rgba(79,70,229,0.12)]">
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
                    {t("invite_page.sample_desc")}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/30 px-4 py-3 text-xs leading-6 text-zinc-400">
                <span className="font-medium text-zinc-200">
                  {t("invite_page.sample_tip_label")}
                </span>{" "}
                {t("invite_page.sample_tip_fill")}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {SAMPLE_INVITES.map((invite) => {
                const isCopied = copiedCode === invite.code;

                return (
                  <div
                    key={invite.code}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-sm"
                    data-testid={`invite-example-${invite.roleValue.toLowerCase()}`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-200">
                          {invite.role}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatRole(invite.roleValue)}
                        </span>
                      </div>
                      <code className="block text-sm font-mono tracking-[0.24em] text-zinc-100">
                        {invite.code}
                      </code>
                      <p className="text-sm leading-6 text-zinc-400">
                        {t(invite.descriptionKey)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyExampleCode(invite.code)}
                        className="border-white/10 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
                        data-testid={`invite-example-apply-${invite.roleValue.toLowerCase()}`}
                      >
                        {t("invite_page.sample_apply")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleCopyExampleCode(invite.code)}
                        className="gap-2 text-zinc-300 hover:bg-white/5 hover:text-white"
                        data-testid={`invite-example-copy-${invite.roleValue.toLowerCase()}`}
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

          <Card className="bg-zinc-900/30 border-white/5">
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

          <div className="flex items-center justify-between text-sm">
            <Link
              to="/"
              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("invite_page.back_to_home")}
            </Link>
            <Link
              to="/login"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {t("invite_page.already_have")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
