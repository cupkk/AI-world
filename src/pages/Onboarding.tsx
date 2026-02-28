import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { toast } from "sonner";
import { GraduationCap, Microscope, Building2, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import type { Role } from "../types";
import { useTranslation } from "../lib/i18n";
import { usePageTitle } from "../lib/usePageTitle";

const ROLE_OPTIONS: { role: Role; icon: React.ReactNode; title: string; description: string; titleKey?: string; descKey?: string }[] = [
  {
    role: "LEARNER",
    icon: <GraduationCap className="h-8 w-8" />,
    title: "AI Talent",
    description: "Student, engineer, or researcher looking to grow skills, join projects, and build reputation.",
    titleKey: "onb.role_learner_title",
    descKey: "onb.role_learner_desc"
  },
  {
    role: "EXPERT",
    icon: <Microscope className="h-8 w-8" />,
    title: "AI Scientist",
    description: "Professor, researcher, or senior expert sharing knowledge, publishing research, and finding collaborators.",
    titleKey: "onb.role_expert_title",
    descKey: "onb.role_expert_desc"
  },
  {
    role: "ENTERPRISE_LEADER",
    icon: <Building2 className="h-8 w-8" />,
    title: "Enterprise",
    description: "Business leader or recruiter looking to hire talent, find experts, or solve industry problems.",
    titleKey: "onb.role_enterprise_title",
    descKey: "onb.role_enterprise_desc"
  },
];

const SUGGESTED_SKILLS = [
  "Python", "PyTorch", "TensorFlow", "NLP", "Computer Vision", "LLM",
  "Transformers", "RAG", "Data Science", "MLOps", "CUDA", "Rust",
  "React", "TypeScript", "Java", "C++", "Reinforcement Learning",
  "Robotics", "Healthcare AI", "FinTech AI",
];

export function Onboarding() {
  const { t } = useTranslation();
  usePageTitle(t("onb.welcome") || "Get Started");
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const { updateUserProfile } = useDataStore();

  const [step, setStep] = useState(1); // 1: choose role, 2: basic info, 3: role-specific
  const [selectedRole, setSelectedRole] = useState<Role | null>(user?.role || null);
  const [name, setName] = useState(user?.name || "");
  const [title, setTitle] = useState(user?.title || "");
  const [company, setCompany] = useState(user?.company || "");
  const [location, setLocation] = useState(user?.location || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(user?.skills || []);
  const [customSkill, setCustomSkill] = useState("");
  const [whatImDoing, setWhatImDoing] = useState(user?.whatImDoing || "");
  const [whatICanProvide, setWhatICanProvide] = useState(user?.whatICanProvide || "");
  const [whatImLookingFor, setWhatImLookingFor] = useState(user?.whatImLookingFor || "");
  const [aiStrategy, setAiStrategy] = useState(user?.aiStrategy || "");

  if (!user) {
    navigate("/login");
    return null;
  }

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !selectedSkills.includes(customSkill.trim())) {
      setSelectedSkills(prev => [...prev, customSkill.trim()]);
      setCustomSkill("");
    }
  };

  const handleComplete = () => {
    if (!selectedRole || !name.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    const updates = {
      name: name.trim(),
      role: selectedRole,
      title: title.trim() || undefined,
      company: company.trim() || undefined,
      location: location.trim() || undefined,
      bio: bio.trim() || undefined,
      skills: selectedSkills,
      whatImDoing: whatImDoing.trim() || undefined,
      whatICanProvide: whatICanProvide.trim() || undefined,
      whatImLookingFor: whatImLookingFor.trim() || undefined,
      aiStrategy: selectedRole === "ENTERPRISE_LEADER" ? aiStrategy.trim() || undefined : undefined,
    };

    updateUserProfile(user.id, updates);
    // Re-login with updated role
    login({ ...user, ...updates } as typeof user);

    toast.success("Profile setup complete! Welcome to AI-World.");

    // Redirect to appropriate dashboard
    const target = selectedRole === "EXPERT" ? "/app/expert"
      : selectedRole === "ENTERPRISE_LEADER" ? "/app/enterprise"
      : "/app/learner";
    navigate(target);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step > s ? "bg-indigo-600 text-white" :
                step === s ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]" :
                "bg-zinc-800 text-zinc-500 border border-white/10"
              }`}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`h-px w-12 ${step > s ? "bg-indigo-600" : "bg-zinc-800"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Choose Role */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-zinc-100 mb-2">{t("onb.welcome") || "Welcome to AI-World"}</h1>
              <p className="text-zinc-400">{t("onb.setup_profile") || "Choose your role to get a personalized experience"}</p>
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
                    <div className={`rounded-xl p-3 ${
                      selectedRole === option.role ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-zinc-100">{t(option.titleKey || "") || option.title}</h3>
                      <p className="text-sm text-zinc-400 mt-1">{t(option.descKey || "") || option.description}</p>
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

        {/* Step 2: Basic Info */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-zinc-100 mb-2">{t("onb.setup_profile")}</h1>
              <p className="text-zinc-400">{t("onb.tell_community", "Tell the community who you are")}</p>
            </div>

            <Card className="glass-panel">
              <CardContent className="space-y-4 p-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">{t("onb.your_name")} *</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("onb.your_name")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">{t("onb.your_title")}</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("onb.title_placeholder", "e.g. ML Engineer")} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">{t("onb.your_company")}</label>
                    <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("onb.company_placeholder", "e.g. MIT, Google")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">{t("onb.your_location")}</label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("onb.location_placeholder", "e.g. Beijing, China")} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">{t("onb.bio")}</label>
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("onb.bio_placeholder") || "A brief introduction about yourself..."} rows={3} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">{t("onb.skills_tags", "Skills & Tags")}</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {SUGGESTED_SKILLS.map((skill) => (
                      <Badge
                        key={skill}
                        variant={selectedSkills.includes(skill) ? "default" : "outline"}
                        className={`cursor-pointer text-xs transition-colors ${
                          selectedSkills.includes(skill)
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "border-white/10 text-zinc-400 hover:border-indigo-500/50 hover:text-indigo-400"
                        }`}
                        onClick={() => toggleSkill(skill)}
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={customSkill}
                      onChange={(e) => setCustomSkill(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustomSkill()}
                      placeholder={t("onb.add_custom_skill", "Add custom skill...")}
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm" onClick={addCustomSkill}>{t("onb.add", "Add")}</Button>
                  </div>
                  {selectedSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-zinc-500">{t("onb.selected", "Selected:")}</span>
                      {selectedSkills.map(s => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="text-[10px] cursor-pointer hover:bg-red-500/20"
                          onClick={() => toggleSkill(s)}
                        >
                          {s} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> {t("onb.back")}
              </Button>
              <Button
                onClick={() => name.trim() ? setStep(3) : toast.error(t("onb.error") || "Name is required")}
                className="gap-2 bg-indigo-600 hover:bg-indigo-500"
              >
                {t("onb.continue")} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Role-Specific Info */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Sparkles className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-zinc-100 mb-2">{t("onb.almost_done", "Almost Done!")}</h1>
              <p className="text-zinc-400">{t("onb.complete_profile", "Complete your profile to help others find and connect with you")}</p>
            </div>

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-zinc-100">{t("onb.bonjour_cards", "Your Bonjour Cards")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">⚡ {t("profile.what_im_doing")}</label>
                  <Textarea value={whatImDoing} onChange={(e) => setWhatImDoing(e.target.value)} placeholder={t("onb.what_im_doing_placeholder", "Describe your current projects or research...")} rows={2} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">💡 {t("profile.what_i_can_provide")}</label>
                  <Textarea value={whatICanProvide} onChange={(e) => setWhatICanProvide(e.target.value)} placeholder={t("onb.what_i_can_provide_placeholder", "Your expertise, resources, or help you can offer...")} rows={2} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">🎯 {t("profile.what_im_looking_for")}</label>
                  <Textarea value={whatImLookingFor} onChange={(e) => setWhatImLookingFor(e.target.value)} placeholder={t("onb.what_im_looking_for_placeholder", "Collaborators, projects, mentors, opportunities...")} rows={2} />
                </div>
                {selectedRole === "ENTERPRISE_LEADER" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">🚀 {t("dashboard.ai_strategy_showcase")}</label>
                    <Textarea value={aiStrategy} onChange={(e) => setAiStrategy(e.target.value)} placeholder={t("onb.ai_strategy_placeholder", "Describe your enterprise AI vision, current initiatives, and what you're looking to achieve...")} rows={3} />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> {t("onb.back")}
              </Button>
              <Button
                onClick={handleComplete}
                className="gap-2 bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]"
              >
                {t("onb.complete")} <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
