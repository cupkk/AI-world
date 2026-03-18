import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { usePageTitle } from "../lib/usePageTitle";
import { useTranslation } from "../hooks/useTranslation";
import { BrainCircuit, Sparkles, Users, Briefcase, ArrowRight, ShieldCheck } from "lucide-react";

export function Landing() {
  usePageTitle();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-indigo-500/30 overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-indigo-400">
            <BrainCircuit className="h-6 w-6" />
            <span className="text-lg font-bold tracking-tight text-white">AI-World</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
              {t("nav.sign_in")}
            </Link>
            <Link to="/login?tab=register">
              <Button className="h-9 rounded-full bg-white text-black hover:bg-zinc-200">
                {t("landing.btn_join")}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-16 md:pt-48 md:pb-32">
        {/* Atmospheric Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-indigo-300 backdrop-blur-sm mb-8">
            <Sparkles className="h-4 w-4" />
            <span>{t("landing.badge")}</span>
          </div>
          
          <h1 className="mx-auto max-w-4xl font-sans text-5xl font-bold tracking-tight sm:text-7xl md:text-8xl leading-[1.1]">
            {t("landing.title_1")} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">
              {t("landing.title_2")}
            </span>
          </h1>
          
          <p className="mx-auto mt-8 max-w-2xl text-lg text-zinc-400 leading-relaxed">
            {t("landing.desc")}
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login?tab=register">
              <Button className="h-12 px-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-base shadow-[0_0_30px_rgba(79,70,229,0.4)] gap-2">
                {t("landing.btn_join")} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" className="h-12 px-8 rounded-full border-white/10 hover:bg-white/5 text-base">
                {t("landing.btn_explore")}
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="relative z-10 border-t border-white/5 bg-[#0a0a0a] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.features_title")}</h2>
            <p className="mt-4 text-zinc-400">{t("landing.features_subtitle")}</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Learner */}
            <div className="rounded-3xl border border-white/5 bg-zinc-900/50 p-8 hover:bg-zinc-900 transition-colors">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">{t("landing.learner_title")}</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">
                {t("landing.learner_desc")}
              </p>
              <ul className="space-y-3 text-sm text-zinc-300">
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> {t("landing.learner_1")}</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> {t("landing.learner_2")}</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> {t("landing.learner_3")}</li>
              </ul>
            </div>

            {/* Expert */}
            <div className="rounded-3xl border border-white/5 bg-zinc-900/50 p-8 hover:bg-zinc-900 transition-colors relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full blur-2xl"></div>
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 relative z-10">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold relative z-10">{t("landing.expert_title")}</h3>
              <p className="text-zinc-400 leading-relaxed mb-6 relative z-10">
                {t("landing.expert_desc")}
              </p>
              <ul className="space-y-3 text-sm text-zinc-300 relative z-10">
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-indigo-400" /> {t("landing.expert_1")}</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-indigo-400" /> {t("landing.expert_2")}</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-indigo-400" /> {t("landing.expert_3")}</li>
              </ul>
            </div>

            {/* Enterprise */}
            <div className="rounded-3xl border border-white/5 bg-zinc-900/50 p-8 hover:bg-zinc-900 transition-colors">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">{t("landing.enterprise_title")}</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">
                {t("landing.enterprise_desc")}
              </p>
              <ul className="space-y-3 text-sm text-zinc-300">
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-purple-400" /> {t("landing.enterprise_1")}</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-purple-400" /> {t("landing.enterprise_2")}</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-purple-400" /> {t("landing.enterprise_3")}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#050505] py-12 text-center text-zinc-500 text-sm">
        <p>{t("landing.footer")}</p>
      </footer>
    </div>
  );
}
