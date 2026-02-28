import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { BrainCircuit, ShieldCheck, Ticket, ArrowRight, ArrowLeft } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";

export function Invite() {
  const { t } = useTranslation();
  usePageTitle(t("invite_page.invitation"));
  const navigate = useNavigate();
  const { setVerifiedInviteCode } = useAuthStore();
  const { verifyInviteCode } = useDataStore();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!code.trim()) {
      setError(t("invite_page.empty_error"));
      return;
    }

    setIsVerifying(true);

    // Simulate network delay
    setTimeout(() => {
      const invite = verifyInviteCode(code.trim());
      setIsVerifying(false);

      if (invite) {
        setVerifiedInviteCode(invite.code);
        toast.success(t("invite_page.verify_success"));
        navigate("/login?tab=register");
      } else {
        setError(t("invite_page.verify_error"));
      }
    }, 800);
  };

  return (
    <div className="flex min-h-screen bg-[#050505] text-white selection:bg-indigo-500/30">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

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
          © 2026 AI-World. All rights reserved.
        </div>
      </div>

      {/* Right Side - Invite Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 relative">
        <div className="w-full max-w-md space-y-8 relative z-10">
          {/* Mobile Logo */}
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
              <label className="text-sm font-medium text-zinc-300">{t("invite_page.code_label")}</label>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                placeholder={t("invite_page.enter_placeholder")}
                className="bg-zinc-900/50 border-white/10 focus-visible:ring-indigo-500 text-center text-lg tracking-widest uppercase h-12"
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-400 mt-1">{error}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isVerifying || !code.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] h-11"
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

          <Card className="bg-zinc-900/30 border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-zinc-300">{t("invite_page.how_to_get")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-zinc-500">
              <p>{t("invite_page.way_1")}</p>
              <p>{t("invite_page.way_2")}</p>
              <p>{t("invite_page.way_3")}</p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between text-sm">
            <Link to="/" className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              {t("invite_page.back_to_home")}
            </Link>
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              {t("invite_page.already_have")}
            </Link>
          </div>

          {/* Demo Codes Section */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#050505] px-2 text-zinc-500">{t("invite_page.demo_codes")}</span>
            </div>
          </div>
          
          <div className="grid gap-2">
            {["AIWORLD-EXPERT-2026", "AIWORLD-LEARNER-2026", "AIWORLD-ENTERPRISE-2026", "WELCOME2026"].map((demoCode) => (
              <button
                key={demoCode}
                onClick={() => setCode(demoCode)}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/30 px-4 py-2.5 transition-all hover:bg-zinc-800/80 hover:border-white/10 group text-left"
              >
                <code className="text-sm font-mono text-zinc-400 group-hover:text-zinc-200 transition-colors tracking-wider">
                  {demoCode}
                </code>
                <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("invite_page.use")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
