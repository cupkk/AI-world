import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { PageHeader } from "../../components/ui/PageHeader";
import { Avatar } from "../../components/ui/Avatar";
import { EmailVisibility, User } from "../../types";
import { Mail, Eye, EyeOff, ShieldAlert, Ban } from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useTranslation } from "../../hooks/useTranslation";
import {
  fetchBlockedUsersByApi,
  unblockUserByApi,
  updateProfileByApi,
} from "../../lib/api";
import { normalizeEmailVisibility } from "../../lib/utils";

export function Contacts() {
  const { t } = useTranslation();
  usePageTitle(t("settings.contact_title"));
  const { user, login } = useAuthStore();

  const [visibility, setVisibility] = useState<EmailVisibility>(
    user?.privacySettings?.emailVisibility
      ? normalizeEmailVisibility(user.privacySettings.emailVisibility)
      : "MASKED",
  );
  const [contactEmail, setContactEmail] = useState(user?.contactEmail || "");
  const [isSaving, setIsSaving] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;

    setIsLoadingBlockedUsers(true);
    fetchBlockedUsersByApi()
      .then((items) => {
        if (!active) return;
        setBlockedUsers(items);
      })
      .catch(() => {
        if (!active) return;
        setBlockedUsers([]);
      })
      .finally(() => {
        if (active) {
          setIsLoadingBlockedUsers(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedUser = await updateProfileByApi({
        contactEmail: contactEmail || undefined,
        emailVisibility: visibility,
      });
      login({
        ...updatedUser,
        blockedUsers: user.blockedUsers,
      });
      toast.success(t("settings.privacy_updated"));
    } catch (err: any) {
      toast.error(err?.message || t("api.request_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnblock = async (blockedUser: User) => {
    try {
      await unblockUserByApi(blockedUser.id);
      setBlockedUsers((prev) => prev.filter((item) => item.id !== blockedUser.id));
      login({
        ...user,
        blockedUsers: (user.blockedUsers || []).filter((id) => id !== blockedUser.id),
      });
      toast.success(
        (t("msg.user_unblocked") as string).replace("{name}", blockedUser.name),
      );
    } catch (err: any) {
      toast.error(err?.message || t("api.request_failed"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.contact_header")}
        description={t("settings.contact_header_desc")}
      />

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
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={t("settings.contact_email_pl")}
            />
            <p className="text-xs text-zinc-500 mt-1">
              {t("settings.contact_email_hint")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">
            {t("settings.email_visibility")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("settings.email_visibility_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <label
              className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                visibility === "PUBLIC"
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-white/10 bg-zinc-900/50 hover:bg-zinc-800/50"
              }`}
              onClick={() => setVisibility("PUBLIC")}
            >
              <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-500">
                {visibility === "PUBLIC" && (
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-zinc-300" />
                  <p className="font-medium text-zinc-100">
                    {t("settings.vis_full")}
                  </p>
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
                  <p className="font-medium text-zinc-100">
                    {t("settings.vis_masked")}
                  </p>
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
                  <p className="font-medium text-zinc-100">
                    {t("settings.vis_hidden")}
                  </p>
                </div>
                <p className="text-sm text-zinc-400">
                  {t("settings.vis_hidden_desc")}
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t("settings.saving") : t("settings.save_prefs")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Ban className="h-5 w-5 text-amber-400" />
            {t("settings.blocked_users_title")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("settings.blocked_users_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingBlockedUsers ? (
            <p className="text-sm text-zinc-500">{t("common.loading")}</p>
          ) : blockedUsers.length > 0 ? (
            blockedUsers.map((blockedUser) => (
              <div
                key={blockedUser.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/40 p-4"
              >
                <Avatar
                  src={blockedUser.avatar}
                  fallback={blockedUser.name.charAt(0)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-100">
                    {blockedUser.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {blockedUser.title || blockedUser.company || blockedUser.email}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleUnblock(blockedUser)}
                >
                  {t("msg.unblock")}
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">
              {t("settings.blocked_users_empty")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
