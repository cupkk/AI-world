import { useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Users, FileText, MessageSquare, BrainCircuit, Upload, Plus, Settings, Inbox, Eye, CheckCircle, XCircle, Pencil, Save, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Avatar } from "../components/ui/Avatar";
import { formatRole } from "../lib/utils";
import { toast } from "sonner";
import { usePageTitle } from "../lib/usePageTitle";
import { useTranslation } from "../hooks/useTranslation";

export function DashboardEnterprise() {
  usePageTitle("Dashboard");
  const { t } = useTranslation();
  const { user, login } = useAuthStore();
  const { users, contents, chatThreads, applications, updateApplicationStatus, addContent, updateUserProfile } = useDataStore();

  // Inline AI Strategy editing
  const [editingStrategy, setEditingStrategy] = useState(false);
  const [strategyDraft, setStrategyDraft] = useState({ aiStrategy: "", whatImDoing: "", whatImLookingFor: "" });

  // Inline Post Needs form
  const [showPostForm, setShowPostForm] = useState(false);
  const [needTitle, setNeedTitle] = useState("");
  const [needDesc, setNeedDesc] = useState("");
  const [needTags, setNeedTags] = useState("");

  if (!user || user.role !== "ENTERPRISE_LEADER") return null;

  const experts = users.filter((u) => u.role === "EXPERT").slice(0, 4);
  const myContents = contents.filter((c) => c.authorId === user.id);
  const myConversations = chatThreads.filter(t => t.participants.some(p => p.id === user.id) && t.status === "ACCEPTED");

  // Get applications for my posted content (Inbound)
  const myContentIds = myContents.map(c => c.id);
  const inboundApplications = applications.filter(a => myContentIds.includes(a.targetId));

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("dashboard.title_enterprise")}
        description={`${t("dashboard.welcome")}, ${user.name}. ${t("dashboard.desc_enterprise")}`}
      />

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/publish">
          <Button variant="outline" className="gap-2 h-9">
            <Plus className="h-4 w-4" /> {t("dashboard.action_post_project")}
          </Button>
        </Link>
        <Link to="/assistant">
          <Button variant="outline" className="gap-2 h-9">
            <BrainCircuit className="h-4 w-4" /> {t("dashboard.action_assistant")}
          </Button>
        </Link>
        <Link to="/settings/knowledge-base">
          <Button variant="outline" className="gap-2 h-9">
            <Upload className="h-4 w-4" /> {t("dashboard.knowledge_base")}
          </Button>
        </Link>
        <Link to="/settings/profile">
          <Button variant="outline" className="gap-2 h-9">
            <Settings className="h-4 w-4" /> {t("dashboard.action_edit_profile")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.recommended_experts")}
            </CardTitle>
            <Users className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{experts.length}</div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.active_conversations")}
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{myConversations.length}</div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.project_needs_posted")}
            </CardTitle>
            <FileText className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{myContents.length}</div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.inbound_applications")}
            </CardTitle>
            <Inbox className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{inboundApplications.filter(a => a.status === "SUBMITTED").length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* AI Strategy Showcase - Dynamic from user data */}
        <Card className="glass-panel border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.1)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <span className="text-indigo-400">🚀</span> {t("dashboard.ai_strategy_showcase")}
            </CardTitle>
            {!editingStrategy && (
              <Button variant="ghost" size="sm" className="gap-1 text-zinc-400 hover:text-zinc-100"
                onClick={() => { setEditingStrategy(true); setStrategyDraft({ aiStrategy: user.aiStrategy || "", whatImDoing: user.whatImDoing || "", whatImLookingFor: user.whatImLookingFor || "" }); }}>
                <Pencil className="h-3.5 w-3.5" /> {t("dashboard.edit")}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {editingStrategy ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">{t("dashboard.our_ai_strategy")}</label>
                  <textarea
                    className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[80px] resize-y"
                    value={strategyDraft.aiStrategy}
                    onChange={(e) => setStrategyDraft(prev => ({ ...prev, aiStrategy: e.target.value }))}
                    placeholder={t("dashboard.desc_ai_strategy")}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">{t("dashboard.current_focus")}</label>
                  <textarea
                    className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[60px] resize-y"
                    value={strategyDraft.whatImDoing}
                    onChange={(e) => setStrategyDraft(prev => ({ ...prev, whatImDoing: e.target.value }))}
                    placeholder={t("dashboard.desc_current_focus")}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">{t("dashboard.looking_for")}</label>
                  <textarea
                    className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[60px] resize-y"
                    value={strategyDraft.whatImLookingFor}
                    onChange={(e) => setStrategyDraft(prev => ({ ...prev, whatImLookingFor: e.target.value }))}
                    placeholder={t("dashboard.desc_looking_for")}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => setEditingStrategy(false)}>
                    <X className="h-3.5 w-3.5" /> {t("dashboard.cancel")}
                  </Button>
                  <Button size="sm" className="gap-1 bg-indigo-600 hover:bg-indigo-500 text-white" onClick={() => {
                    updateUserProfile(user.id, strategyDraft);
                    login({ ...user, ...strategyDraft });
                    setEditingStrategy(false);
                    // toast needs to be translated too? toast.success isn't fully set up for i18n safely but we can inject t()
                    toast.success(t("dashboard.strategy_updated"));
                  }}>
                    <Save className="h-3.5 w-3.5" /> {t("dashboard.save")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {user.aiStrategy ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-zinc-300">{t("dashboard.our_ai_strategy")}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
                      {user.aiStrategy}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-zinc-500 mb-2">{t("dashboard.no_strategy")}</p>
                    <p className="text-xs text-zinc-600">{t("dashboard.share_vision")}</p>
                  </div>
                )}

                {user.whatImDoing && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-zinc-300">Current Focus</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{user.whatImDoing}</p>
                  </div>
                )}

                {user.whatImLookingFor && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-zinc-300">Looking For</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{user.whatImLookingFor}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Inbound Applications */}
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Inbox className="h-5 w-5 text-indigo-400" /> {t("dashboard.inbound_applications")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {inboundApplications.length > 0 ? inboundApplications.map((app) => {
              const applicant = users.find(u => u.id === app.applicantId);
              const targetContent = contents.find(c => c.id === app.targetId);
              if (!applicant) return null;
              return (
                <div key={app.id} className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar src={applicant.avatar || ""} fallback={applicant.name.charAt(0)} className="h-8 w-8" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/u/${applicant.id}`} className="text-sm font-medium text-zinc-100 hover:text-indigo-400 transition-colors">
                          {applicant.name}
                        </Link>
                        <Badge variant="secondary" className="text-[10px]">{formatRole(applicant.role)}</Badge>
                      </div>
                      <p className="text-xs text-zinc-500 truncate">{t("dashboard.applied_to")} {targetContent?.title || t("hub.unknown")}</p>
                    </div>
                    <StatusBadge status={app.status === "SUBMITTED" ? "PENDING_REVIEW" : app.status === "ACCEPTED" ? "PUBLISHED" : "REJECTED"} />
                  </div>
                  {app.message && (
                    <p className="text-xs text-zinc-400 ml-11 mb-2 line-clamp-2">{app.message}</p>
                  )}
                  {app.status === "SUBMITTED" && (
                    <div className="flex gap-2 ml-11">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => { updateApplicationStatus(app.id, "ACCEPTED"); toast.success("Application accepted"); }}>
                        <CheckCircle className="h-3 w-3" /> {t("dashboard.approve")}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => { updateApplicationStatus(app.id, "REJECTED"); toast.error("Application rejected"); }}>
                        <XCircle className="h-3 w-3" /> {t("dashboard.decline")}
                      </Button>
                      <Link to={`/messages?to=${applicant.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-zinc-400">
                          <MessageSquare className="h-3 w-3" /> {t("dashboard.message")}
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              );
            }) : (
              <p className="text-sm text-zinc-500 text-center py-4">{t("dashboard.no_apps_received")}</p>
            )}
          </CardContent>
        </Card>

        {/* My Posted Needs */}
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-400" /> {t("dashboard.my_posted_needs")}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowPostForm(!showPostForm)}>
                <Plus className="h-3 w-3" /> {t("dashboard.quick_post")}
              </Button>
              <Link to="/publish">
                <Button variant="ghost" size="sm" className="h-7 text-xs">{t("dashboard.manage")}</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Inline Quick Post Form */}
            {showPostForm && (
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
                <h4 className="text-sm font-medium text-zinc-200">{t("dashboard.quick_post_project")}</h4>
                <Input
                  placeholder={t("dashboard.post_title_pl")}
                  value={needTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNeedTitle(e.target.value)}
                  className="h-9 text-sm"
                />
                <textarea
                  className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[80px] resize-y"
                  placeholder={t("dashboard.post_desc_pl")}
                  value={needDesc}
                  onChange={(e) => setNeedDesc(e.target.value)}
                />
                <Input
                  placeholder={t("dashboard.post_tags_pl")}
                  value={needTags}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNeedTags(e.target.value)}
                  className="h-9 text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowPostForm(false); setNeedTitle(""); setNeedDesc(""); setNeedTags(""); }}>{t("dashboard.cancel")}</Button>
                  <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white" disabled={!needTitle.trim() || !needDesc.trim()}
                    onClick={() => {
                      addContent({
                        id: `c-${Date.now()}`,
                        title: needTitle,
                        description: needDesc,
                        type: "PROJECT",
                        status: "PENDING_REVIEW",
                        authorId: user.id,
                        createdAt: new Date().toISOString(),
                        tags: needTags.split(",").map(t => t.trim()).filter(Boolean),
                        likes: 0,
                        views: 0,
                        visibility: "ALL",
                      });
                      setShowPostForm(false);
                      setNeedTitle(""); setNeedDesc(""); setNeedTags("");
                      toast.success(t("dashboard.toast_project_submitted"));
                    }}>
                    {t("dashboard.submit_review")}
                  </Button>
                </div>
              </div>
            )}

            {myContents.length > 0 ? myContents.map((content) => (
                <Link
                  key={content.id}
                  to={`/publish/${content.id}`}
                  className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0 hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-100 truncate">{content.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-zinc-500">{new Date(content.createdAt).toLocaleDateString()}</span>
                      {content.visibility && (
                        <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400 gap-1">
                          <Eye className="h-3 w-3" />
                          {content.visibility === "ALL" ? t("dashboard.public") : t("dashboard.experts_talent")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={content.status} />
                </Link>
              )) : !showPostForm ? (
                <p className="text-sm text-zinc-500 text-center py-4">{t("dashboard.no_projects_click")}</p>
              ) : null}
            </CardContent>
          </Card>

        {/* Recommended Experts */}
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100">{t("dashboard.recommended_experts")}</CardTitle>
            <Link to="/talent">
              <Button variant="ghost" size="sm">
                {t("common.view_all")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {experts.map((expert) => (
              <div
                key={expert.id}
                className="flex items-center justify-between border-b border-white/10 pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-800 border border-white/10">
                    <img
                      src={expert.avatar}
                      alt={expert.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-100">{expert.name}</p>
                    <p className="text-xs text-zinc-400">{expert.title}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/u/${expert.id}`}>
                    <Button variant="outline" size="sm">
                      {t("common.profile")}
                    </Button>
                  </Link>
                  <Link to={`/messages?to=${expert.id}`}>
                    <Button size="sm">{t("dashboard.message")}</Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
