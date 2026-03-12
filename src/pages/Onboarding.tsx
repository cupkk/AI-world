import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";
import { GraduationCap, Microscope, Building2, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import type { Role } from "../types";
import { useTranslation } from "../hooks/useTranslation";
import { usePageTitle } from "../lib/usePageTitle";
import type { DictKey } from "../lib/i18n";
import { updateProfileByApi } from "../lib/api";

/* ────── Role cards config ────── */
const ROLE_OPTIONS: { role: Role; icon: React.ReactNode; titleKey: DictKey; descKey: DictKey }[] = [
  {
    role: "LEARNER",
    icon: <GraduationCap className="h-8 w-8" />,
    titleKey: "onb.role_learner_title",
    descKey: "onb.role_learner_desc",
  },
  {
    role: "EXPERT",
    icon: <Microscope className="h-8 w-8" />,
    titleKey: "onb.role_expert_title",
    descKey: "onb.role_expert_desc",
  },
  {
    role: "ENTERPRISE_LEADER",
    icon: <Building2 className="h-8 w-8" />,
    titleKey: "onb.role_enterprise_title",
    descKey: "onb.role_enterprise_desc",
  },
];

/* ────── Intent cards per role ────── */
type IntentCard = { id: string; emoji: string; labelKey: DictKey };

const ENTERPRISE_INTENTS: IntentCard[] = [
  { id: "find_ai_partner", emoji: "🤝", labelKey: "onb.intent_e_find_partner" },
  { id: "recruit_talent", emoji: "🎯", labelKey: "onb.intent_e_recruit" },
  { id: "post_needs", emoji: "📋", labelKey: "onb.intent_e_post_needs" },
  { id: "industry_academia", emoji: "🏫", labelKey: "onb.intent_e_academia" },
  { id: "tech_trends", emoji: "📈", labelKey: "onb.intent_e_trends" },
  { id: "find_solutions", emoji: "💡", labelKey: "onb.intent_e_solutions" },
];

const EXPERT_INTENTS: IntentCard[] = [
  { id: "publish_research", emoji: "📄", labelKey: "onb.intent_x_publish" },
  { id: "find_collaborators", emoji: "🤝", labelKey: "onb.intent_x_collab" },
  { id: "enterprise_needs", emoji: "🏢", labelKey: "onb.intent_x_enterprise" },
  { id: "mentor_students", emoji: "🎓", labelKey: "onb.intent_x_mentor" },
  { id: "find_funding", emoji: "💰", labelKey: "onb.intent_x_funding" },
  { id: "build_influence", emoji: "🌟", labelKey: "onb.intent_x_influence" },
];

const LEARNER_INTENTS: IntentCard[] = [
  { id: "learn_ai", emoji: "📚", labelKey: "onb.intent_l_learn" },
  { id: "join_projects", emoji: "🚀", labelKey: "onb.intent_l_projects" },
  { id: "find_mentor", emoji: "🧑‍🏫", labelKey: "onb.intent_l_mentor" },
  { id: "find_jobs", emoji: "💼", labelKey: "onb.intent_l_jobs" },
  { id: "competitions", emoji: "🏆", labelKey: "onb.intent_l_competitions" },
  { id: "build_skills", emoji: "⚡", labelKey: "onb.intent_l_skills" },
];

function getIntentCards(role: Role): IntentCard[] {
  switch (role) {
    case "ENTERPRISE_LEADER": return ENTERPRISE_INTENTS;
    case "EXPERT": return EXPERT_INTENTS;
    default: return LEARNER_INTENTS;
  }
}

/* ────── Component ────── */
export function Onboarding() {
  const { t } = useTranslation();
  usePageTitle(t("onb.welcome"));
  const navigate = useNavigate();
  const { user, login } = useAuthStore();

  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<Role | null>(user?.role && user.role !== "ADMIN" ? user.role : null);

  // Step 2 — role-specific required fields
  const [companyName, setCompanyName] = useState(user?.companyName || "");
  const [taxId, setTaxId] = useState(user?.taxId || "");
  const [businessScope, setBusinessScope] = useState(user?.businessScope || "");
  const [org, setOrg] = useState(user?.company || "");
  const [academicTitle, setAcademicTitle] = useState(user?.academicTitle || "");
  const [researchField, setResearchField] = useState(user?.researchField || "");
  const [personalPage, setPersonalPage] = useState(user?.personalPage || "");
  const [major, setMajor] = useState(user?.major || "");

  // Step 3 — intent selection
  const [selectedIntents, setSelectedIntents] = useState<string[]>(user?.platformIntents || []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) {
    navigate("/login");
    return null;
  }

  /* ── Validation helpers ── */
  const validateStep2 = (): boolean => {
    if (!selectedRole) return false;
    if (selectedRole === "ENTERPRISE_LEADER") {
      if (!companyName.trim() || !taxId.trim() || !businessScope.trim()) {
        toast.error(t("onb.fill_required"));
        return false;
      }
    } else if (selectedRole === "EXPERT") {
      if (!org.trim() || !academicTitle.trim() || !researchField.trim() || !personalPage.trim()) {
        toast.error(t("onb.fill_required"));
        return false;
      }
    } else {
      // LEARNER
      if (!org.trim() || !major.trim()) {
        toast.error(t("onb.fill_required"));
        return false;
      }
    }
    return true;
  };

  const toggleIntent = (id: string) => {
    setSelectedIntents((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        toast.error(t("onb.max_intents"));
        return prev;
      }
      return [...prev, id];
    });
  };

  /* ── Submit ── */
  const handleComplete = async () => {
    if (selectedIntents.length === 0) {
      toast.error(t("onb.select_at_least_one"));
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        role: selectedRole,
        platformIntents: selectedIntents,
        onboardingDone: true,
      };

      if (selectedRole === "ENTERPRISE_LEADER") {
        payload.companyName = companyName.trim();
        payload.taxId = taxId.trim();
        payload.businessScope = businessScope.trim();
      } else if (selectedRole === "EXPERT") {
        payload.org = org.trim();
        payload.academicTitle = academicTitle.trim();
        payload.researchField = researchField.trim();
        payload.personalPage = personalPage.trim();
      } else {
        payload.org = org.trim();
        payload.major = major.trim();
      }

      const updatedUser = await updateProfileByApi(payload as any);
      login(updatedUser);
      toast.success(t("onb.setup_complete"));

      const target =
        selectedRole === "EXPERT" ? "/app/expert"
        : selectedRole === "ENTERPRISE_LEADER" ? "/app/enterprise"
        : "/app/learner";
      navigate(target);
    } catch {
      toast.error(t("api.request_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* ── Progress bar ── */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step > s
                    ? "bg-indigo-600 text-white"
                    : step === s
                      ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]"
                      : "bg-zinc-800 text-zinc-500 border border-white/10"
                }`}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`h-px w-12 ${step > s ? "bg-indigo-600" : "bg-zinc-800"}`} />}
            </div>
          ))}
        </div>

        {/* ═══════ Step 1: Choose Role ═══════ */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-zinc-100 mb-2">{t("onb.welcome")}</h1>
              <p className="text-zinc-400">{t("onb.choose_role_desc")}</p>
            </div>

            <div className="space-y-4">
              {ROLE_OPTIONS.map((option) => (
                <Card
                  key={option.role}
                  className={`glass-panel cursor-pointer transition-all hover:border-indigo-500/50 ${
                    selectedRole === option.role
                      ? "border-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.2)]"
                      : ""
                  }`}
                  onClick={() => setSelectedRole(option.role)}
                >
                  <CardContent className="flex items-center gap-4 p-6">
                    <div
                      className={`rounded-xl p-3 ${
                        selectedRole === option.role ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-zinc-100">{t(option.titleKey)}</h3>
                      <p className="text-sm text-zinc-400 mt-1">{t(option.descKey)}</p>
                    </div>
                    {selectedRole === option.role && (
                      <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => selectedRole && setStep(2)}
                disabled={!selectedRole}
                className="gap-2 bg-indigo-600 hover:bg-indigo-500"
              >
                {t("onb.continue")} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════ Step 2: Role-Specific Required Fields ═══════ */}
        {step === 2 && selectedRole && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-zinc-100 mb-2">{t("onb.complete_profile")}</h1>
              <p className="text-zinc-400">{t("onb.fill_role_fields")}</p>
            </div>

            <Card className="glass-panel">
              <CardContent className="space-y-5 p-6">
                {/* ── Enterprise fields ── */}
                {selectedRole === "ENTERPRISE_LEADER" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">{t("onb.company_name")} *</label>
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder={t("onb.company_name_ph")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">{t("onb.tax_id")} *</label>
                      <Input
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                        placeholder={t("onb.tax_id_ph")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">{t("onb.business_scope")} *</label>
                      <Input
                        value={businessScope}
                        onChange={(e) => setBusinessScope(e.target.value)}
                        placeholder={t("onb.business_scope_ph")}
                      />
                    </div>
                  </>
                )}

                {/* ── Expert fields ── */}
                {selectedRole === "EXPERT" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">{t("onb.institution")} *</label>
                      <Input
                        value={org}
                        onChange={(e) => setOrg(e.target.value)}
                        placeholder={t("onb.institution_ph")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">{t("onb.academic_title")} *</label>
                      <Input
                        value={academicTitle}
                        onChange={(e) => setAcademicTitle(e.target.value)}
                        placeholder={t("onb.academic_title_ph")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">{t("onb.research_field")} *</label>
                      <Input
                        value={researchField}
                        onChange={(e) => setResearchField(e.target.value)}
                        placeholder={t("onb.research_field_ph")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">{t("onb.personal_page")} *</label>
                      <Input
                        required
                        value={personalPage}
                        onChange={(e) => setPersonalPage(e.target.value)}
                        placeholder={t("onb.personal_page_ph")}
                      />
                    </div>
                  </>
                )}

                {/* ── Learner fields ── */}
                {selectedRole === "LEARNER" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">{t("onb.school_company")} *</label>
                      <Input
                        value={org}
                        onChange={(e) => setOrg(e.target.value)}
                        placeholder={t("onb.school_company_ph")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">{t("onb.major")} *</label>
                      <Input
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                        placeholder={t("onb.major_ph")}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> {t("onb.back")}
              </Button>
              <Button
                onClick={() => validateStep2() && setStep(3)}
                className="gap-2 bg-indigo-600 hover:bg-indigo-500"
              >
                {t("onb.continue")} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════ Step 3: Intent Cards ═══════ */}
        {step === 3 && selectedRole && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Sparkles className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-zinc-100 mb-2">{t("onb.what_brings_you")}</h1>
              <p className="text-zinc-400">{t("onb.select_intents_desc")}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {getIntentCards(selectedRole).map((card) => {
                const selected = selectedIntents.includes(card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => toggleIntent(card.id)}
                    className={`relative flex flex-col items-center gap-3 rounded-2xl border p-6 text-center transition-all ${
                      selected
                        ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_24px_rgba(79,70,229,0.15)]"
                        : "border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-800/60"
                    }`}
                  >
                    <span className="text-3xl">{card.emoji}</span>
                    <span className={`text-sm font-medium leading-snug ${selected ? "text-indigo-300" : "text-zinc-300"}`}>
                      {t(card.labelKey)}
                    </span>
                    {selected && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-center text-xs text-zinc-500">
              {selectedIntents.length}/3 {t("onb.selected_intents")}
            </p>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> {t("onb.back")}
              </Button>
              <Button
                onClick={handleComplete}
                disabled={isSubmitting || selectedIntents.length === 0}
                className="gap-2 bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]"
              >
                {isSubmitting ? t("onb.saving") : t("onb.complete")} <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
