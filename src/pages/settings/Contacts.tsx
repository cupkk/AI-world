import { useState } from "react";
import { toast } from "sonner";
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
import { PageHeader } from "../../components/ui/PageHeader";
import { EmailVisibility } from "../../types";
import { Mail, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useTranslation } from "../../hooks/useTranslation";

export function Contacts() {
  const { t } = useTranslation();
  usePageTitle(t("settings.contact_title"));
  const { user, login } = useAuthStore();
  const { updatePrivacySettings, updateUserProfile } = useDataStore();
  
  const [visibility, setVisibility] = useState<EmailVisibility>(
    user?.privacySettings?.emailVisibility || "MASKED"
  );
  const [contactEmail, setContactEmail] = useState(user?.contactEmail || "");
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  const handleSave = () => {
    setIsSaving(true);
    updatePrivacySettings(user.id, { emailVisibility: visibility });
    if (contactEmail !== (user.contactEmail || "")) {
      updateUserProfile(user.id, { contactEmail: contactEmail || undefined });
      login({ ...user, contactEmail: contactEmail || undefined, privacySettings: { emailVisibility: visibility } });
    }
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Privacy settings updated successfully");
    }, 500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.contact_header")}
        description={t("settings.contact_header_desc")}
      />

      {/* Contact Email */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-400" />
            {t("settings.contact_email")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("settings.contact_email_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
              {t("settings.login_email")}
            </label>
            <Input value={user.email} disabled className="opacity-50" />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
              {t("settings.contact_email_label")}
            </label>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactEmail(e.target.value)}
              placeholder="your-contact@email.com"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Leave blank to use your login email for contact purposes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Email Visibility */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t("settings.email_visibility")}</CardTitle>
          <CardDescription className="text-zinc-400">
            {t("settings.email_visibility_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <label
              className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                visibility === "FULL"
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-white/10 bg-zinc-900/50 hover:bg-zinc-800/50"
              }`}
              onClick={() => setVisibility("FULL")}
            >
              <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-500">
                {visibility === "FULL" && (
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-zinc-300" />
                  <p className="font-medium text-zinc-100">{t("settings.vis_full")}</p>
                </div>
                <p className="text-sm text-zinc-400">
                  {t("settings.vis_full_desc")} (e.g., {user.email}).
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                visibility === "MASKED"
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-white/10 bg-zinc-900/50 hover:bg-zinc-800/50"
              }`}
              onClick={() => setVisibility("MASKED")}
            >
              <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-500">
                {visibility === "MASKED" && (
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-zinc-300" />
                  <p className="font-medium text-zinc-100">{t("settings.vis_masked")}</p>
                </div>
                <p className="text-sm text-zinc-400">
                  {t("settings.vis_masked_desc")}
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                visibility === "HIDDEN"
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-white/10 bg-zinc-900/50 hover:bg-zinc-800/50"
              }`}
              onClick={() => setVisibility("HIDDEN")}
            >
              <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-500">
                {visibility === "HIDDEN" && (
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-zinc-300" />
                  <p className="font-medium text-zinc-100">{t("settings.vis_hidden")}</p>
                </div>
                <p className="text-sm text-zinc-400">
                  {t("settings.vis_hidden_desc")}
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : t("settings.save_prefs")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
