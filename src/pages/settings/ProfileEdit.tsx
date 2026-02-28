import { useState, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { useDataStore } from "../../store/dataStore";
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
import { Save, Camera, Globe, Github, Linkedin, Twitter } from "lucide-react";
import { formatRole } from "../../lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "../../lib/usePageTitle";
import { useTranslation } from "../../hooks/useTranslation";

export function ProfileEdit() {
  const { t } = useTranslation();
  usePageTitle(t("settings.profile_title"));
  const { user, login } = useAuthStore();
  const { updateUserProfile } = useDataStore();

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

  // Role-specific fields
  const [whatImDoing, setWhatImDoing] = useState(user?.whatImDoing || "");
  const [whatICanProvide, setWhatICanProvide] = useState(
    user?.whatICanProvide || ""
  );
  const [whatImLookingFor, setWhatImLookingFor] = useState(
    user?.whatImLookingFor || ""
  );
  const [aiStrategy, setAiStrategy] = useState(user?.aiStrategy || "");

  if (!user) return null;

  const handleSave = () => {
    const updates = {
      name,
      bio,
      title,
      company,
      location,
      contactEmail: contactEmail || undefined,
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      socialLinks: {
        github: github || undefined,
        linkedin: linkedin || undefined,
        twitter: twitter || undefined,
        website: website || undefined,
      },
      whatImDoing,
      whatICanProvide,
      whatImLookingFor,
      aiStrategy,
    };

    updateUserProfile(user.id, updates);
    // Also update auth store so UI reflects changes
    login({ ...user, ...updates });
    toast.success("Profile updated successfully");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.profile_title")}
        description={t("settings.profile_desc")}
      >
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
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
            <button className="absolute bottom-0 right-0 rounded-full bg-indigo-600 p-1.5 text-white hover:bg-indigo-500 transition-colors">
              <Camera className="h-4 w-4" />
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setName(e.target.value)
                }
                placeholder={t("settings.full_name")}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                {t("settings.job_title")}
              </label>
              <Input
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTitle(e.target.value)
                }
                placeholder="e.g. AI Engineer"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                {t("settings.company")}
              </label>
              <Input
                value={company}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCompany(e.target.value)
                }
                placeholder="e.g. OpenAI"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                {t("settings.location")}
              </label>
              <Input
                value={location}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocation(e.target.value)
                }
                placeholder="e.g. San Francisco, CA"
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
              className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              placeholder="..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
              {t("settings.skills_pl")}
            </label>
            <Input
              value={skills}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSkills(e.target.value)
              }
              placeholder="e.g. PyTorch, Transformers, Python"
            />
            {skills && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skills
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {skill}
                    </Badge>
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
          <CardDescription>
            {t("settings.contact_email_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="email"
            value={contactEmail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setContactEmail(e.target.value)
            }
            placeholder="your-contact@email.com"
          />
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t("settings.social_links")}</CardTitle>
          <CardDescription>
            {t("settings.social_links_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 text-zinc-400 shrink-0" />
              <Input
                value={github}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setGithub(e.target.value)
                }
                placeholder="GitHub username"
              />
            </div>
            <div className="flex items-center gap-3">
              <Linkedin className="h-5 w-5 text-zinc-400 shrink-0" />
              <Input
                value={linkedin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLinkedin(e.target.value)
                }
                placeholder="LinkedIn username"
              />
            </div>
            <div className="flex items-center gap-3">
              <Twitter className="h-5 w-5 text-zinc-400 shrink-0" />
              <Input
                value={twitter}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTwitter(e.target.value)
                }
                placeholder="Twitter handle"
              />
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-zinc-400 shrink-0" />
              <Input
                value={website}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setWebsite(e.target.value)
                }
                placeholder="Website URL"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-specific Fields */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t("settings.about_work")}</CardTitle>
          <CardDescription>
            {t("settings.about_work_desc")}
          </CardDescription>
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
              className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              placeholder="..."
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
              className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              placeholder="..."
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
              className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              placeholder="..."
            />
          </div>
          {user.role === "ENTERPRISE_LEADER" && (
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                🏢 {t("dashboard.ai_strategy_showcase")}
              </label>
              <textarea
                value={aiStrategy}
                onChange={(e) => setAiStrategy(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                placeholder="..."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button at Bottom */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          {t("settings.save")}
        </Button>
      </div>
    </div>
  );
}
