import { useState, useRef } from "react";
import { useAuthStore } from "../../store/authStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Avatar } from "../../components/ui/Avatar";
import { PageHeader } from "../../components/ui/PageHeader";
import { Badge } from "../../components/ui/Badge";
import { Save, Camera, Globe, Github, Linkedin, Twitter, Loader2, Phone, Building2, FileText, Microscope, GraduationCap, ExternalLink, BrainCircuit } from "lucide-react";
import { formatRole } from "../../lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "../../lib/usePageTitle";
import { useTranslation } from "../../hooks/useTranslation";
import { updateProfileByApi, uploadAvatarByApi } from "../../lib/api";

const textareaClasses = "w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none";

export function ProfileEdit() {
  const { t } = useTranslation();
  usePageTitle(t("settings.profile_title"));
  const { user, login } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [title, setTitle] = useState(user?.title || "");
  const [company, setCompany] = useState(user?.company || "");
  const [location, setLocation] = useState(user?.location || "");
  const [contactEmail, setContactEmail] = useState(user?.contactEmail || "");
  const [skills, setSkills] = useState(user?.skills?.join(", ") || "");

  // Social links
  const [github, setGithub] = useState(user?.socialLinks?.github || "");
  const [linkedin, setLinkedin] = useState(user?.socialLinks?.linkedin || "");
  const [twitter, setTwitter] = useState(user?.socialLinks?.twitter || "");
  const [website, setWebsite] = useState(user?.socialLinks?.website || "");

  // Role-specific "about work" fields
  const [whatImDoing, setWhatImDoing] = useState(user?.whatImDoing || "");
  const [whatICanProvide, setWhatICanProvide] = useState(user?.whatICanProvide || "");
  const [whatImLookingFor, setWhatImLookingFor] = useState(user?.whatImLookingFor || "");
  const [aiStrategy, setAiStrategy] = useState(user?.aiStrategy || "");

  // Onboarding fields (editable after completion)
  const [phone, setPhone] = useState(user?.phone || "");
  const [companyName, setCompanyName] = useState(user?.companyName || "");
  const [taxId, setTaxId] = useState(user?.taxId || "");
  const [businessScope, setBusinessScope] = useState(user?.businessScope || "");
  const [researchField, setResearchField] = useState(user?.researchField || "");
  const [personalPage, setPersonalPage] = useState(user?.personalPage || "");
  const [academicTitle, setAcademicTitle] = useState(user?.academicTitle || "");
  const [major, setMajor] = useState(user?.major || "");

  if (!user) return null;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("settings.avatar_too_large"));
      return;
    }
    setUploading(true);
    try {
      const updatedUser = await uploadAvatarByApi(file);
      login(updatedUser);
      toast.success(t("settings.avatar_updated"));
    } catch (err: any) {
      toast.error(err?.message || t("api.request_failed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const socialLinksObj = {
        github: github || undefined,
        linkedin: linkedin || undefined,
        twitter: twitter || undefined,
        website: website || undefined,
      };
      const hasSocialLinks = Object.values(socialLinksObj).some(Boolean);

      const payload: Record<string, unknown> = {
        displayName: name,
        bio,
        title,
        org: company,
        location,
        contactEmail: contactEmail || undefined,
        tags: skills.split(",").map((s) => s.trim()).filter(Boolean),
        socialLinks: hasSocialLinks ? socialLinksObj : undefined,
        whatImDoing: whatImDoing || undefined,
        whatICanProvide: whatICanProvide || undefined,
        whatImLookingFor: whatImLookingFor || undefined,
        aiStrategy: aiStrategy || undefined,
        phone: phone || undefined,
      };

      // Role-specific onboarding fields
      if (user.role === "ENTERPRISE_LEADER") {
        payload.companyName = companyName || undefined;
        payload.taxId = taxId || undefined;
        payload.businessScope = businessScope || undefined;
      }
      if (user.role === "EXPERT") {
        payload.researchField = researchField || undefined;
        payload.personalPage = personalPage || undefined;
        payload.academicTitle = academicTitle || undefined;
      }
      if (user.role === "LEARNER") {
        payload.major = major || undefined;
      }

      const updatedUser = await updateProfileByApi(payload as any);
      login(updatedUser);
      toast.success(t("settings.profile_updated"));
    } catch (err: any) {
      toast.error(err?.message || t("api.request_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.profile_title")}
        description={t("settings.profile_desc")}
      >
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("settings.save")}
        </Button>
      </PageHeader>

      {/* Avatar Section */}
      <Card className="glass-panel">
        <CardContent className="flex items-center gap-6 p-6">
          <div className="relative">
            <Avatar
              src={user.avatar}
              fallback={user.name.charAt(0)}
              className="h-24 w-24"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              onClick={handleAvatarClick}
              disabled={uploading}
              className="absolute bottom-0 right-0 rounded-full bg-indigo-600 p-1.5 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          </div>
          <div>
            <p className="font-medium text-zinc-100">{user.name}</p>
            <Badge variant="secondary" className="mt-1 text-xs capitalize">
              {formatRole(user.role)}
            </Badge>
            <p className="mt-2 text-xs text-zinc-500">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t("settings.basic_info")}</CardTitle>
          <CardDescription>{t("settings.basic_info_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                {t("settings.full_name")}
              </label>
              <Input
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder={t("settings.full_name")}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                {t("settings.job_title")}
              </label>
              <Input
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder={t("settings.job_title_pl")}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                {t("settings.company")}
              </label>
              <Input
                value={company}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompany(e.target.value)}
                placeholder={t("settings.company_pl")}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                {t("settings.location")}
              </label>
              <Input
                value={location}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
                placeholder={t("settings.location_pl")}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
              {t("settings.bio")}
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className={textareaClasses}
              placeholder={t("settings.bio_pl")}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
              {t("settings.skills_pl")}
            </label>
            <Input
              value={skills}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSkills(e.target.value)}
              placeholder={t("settings.skills_input_pl")}
            />
            {skills && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skills.split(",").map((s) => s.trim()).filter(Boolean).map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t("settings.contact_email")}</CardTitle>
          <CardDescription>{t("settings.contact_email_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="email"
            value={contactEmail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactEmail(e.target.value)}
            placeholder={t("settings.contact_email_pl")}
          />
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
              <Phone className="inline h-4 w-4 mr-1" />
              {t("settings.phone")}
            </label>
            <Input
              value={phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
              placeholder={t("settings.phone_pl")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Role-specific Onboarding Fields */}
      {user.role === "ENTERPRISE_LEADER" && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-zinc-100">
              <Building2 className="inline h-5 w-5 mr-1.5" />
              {t("settings.enterprise_info")}
            </CardTitle>
            <CardDescription>{t("settings.enterprise_info_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                {t("onb.company_name")}
              </label>
              <Input
                  value={companyName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                  {t("onb.tax_id")}
                </label>
                <Input
                  value={taxId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaxId(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                {t("onb.business_scope")}
              </label>
              <textarea
                value={businessScope}
                onChange={(e) => setBusinessScope(e.target.value)}
                rows={2}
                className={textareaClasses}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {user.role === "EXPERT" && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-zinc-100">
              <Microscope className="inline h-5 w-5 mr-1.5" />
              {t("settings.expert_info")}
            </CardTitle>
            <CardDescription>{t("settings.expert_info_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                  {t("onb.academic_title")}
                </label>
                <Input
                  value={academicTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAcademicTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                  {t("onb.research_field")}
                </label>
                <Input
                  value={researchField}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResearchField(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                <ExternalLink className="inline h-4 w-4 mr-1" />
                {t("onb.personal_page")}
              </label>
              <Input
                value={personalPage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPersonalPage(e.target.value)}
                placeholder="https://"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {user.role === "LEARNER" && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-zinc-100">
              <GraduationCap className="inline h-5 w-5 mr-1.5" />
              {t("settings.learner_info")}
            </CardTitle>
            <CardDescription>{t("settings.learner_info_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                {t("onb.major")}
              </label>
              <Input
                value={major}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMajor(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Social Links */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t("settings.social_links")}</CardTitle>
          <CardDescription>{t("settings.social_links_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 text-zinc-400 shrink-0" />
              <Input
                value={github}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGithub(e.target.value)}
                placeholder={t("settings.social_github_pl")}
              />
            </div>
            <div className="flex items-center gap-3">
              <Linkedin className="h-5 w-5 text-zinc-400 shrink-0" />
              <Input
                value={linkedin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLinkedin(e.target.value)}
                placeholder={t("settings.social_linkedin_pl")}
              />
            </div>
            <div className="flex items-center gap-3">
              <Twitter className="h-5 w-5 text-zinc-400 shrink-0" />
              <Input
                value={twitter}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTwitter(e.target.value)}
                placeholder={t("settings.social_twitter_pl")}
              />
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-zinc-400 shrink-0" />
              <Input
                value={website}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWebsite(e.target.value)}
                placeholder={t("settings.social_website_pl")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-specific "About Work" Fields */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t("settings.about_work")}</CardTitle>
          <CardDescription>{t("settings.about_work_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
              🔬 {t("profile.what_im_doing")}
            </label>
            <textarea
              value={whatImDoing}
              onChange={(e) => setWhatImDoing(e.target.value)}
              rows={2}
              className={textareaClasses}
              placeholder={t("onb.what_im_doing_placeholder")}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
              🤝 {t("profile.what_i_can_provide")}
            </label>
            <textarea
              value={whatICanProvide}
              onChange={(e) => setWhatICanProvide(e.target.value)}
              rows={2}
              className={textareaClasses}
              placeholder={t("onb.what_i_can_provide_placeholder")}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
              🔍 {t("profile.what_im_looking_for")}
            </label>
            <textarea
              value={whatImLookingFor}
              onChange={(e) => setWhatImLookingFor(e.target.value)}
              rows={2}
              className={textareaClasses}
              placeholder={t("onb.what_im_looking_for_placeholder")}
            />
          </div>
          {user.role === "ENTERPRISE_LEADER" && (
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                <span className="inline-flex items-center gap-1.5">
                  <BrainCircuit className="h-4 w-4 text-indigo-400" />
                  {t("dashboard.ai_strategy_showcase")}
                </span>
              </label>
              <textarea
                value={aiStrategy}
                onChange={(e) => setAiStrategy(e.target.value)}
                rows={3}
                className={textareaClasses}
                placeholder={t("onb.ai_strategy_placeholder")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button at Bottom */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("settings.save")}
        </Button>
      </div>
    </div>
  );
}
