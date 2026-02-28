import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { StatusBadge } from "../components/ui/StatusBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/StateDisplay";
import { ContentType, ContentVisibility } from "../types";
import { AlertTriangle, FileText, Plus, Save, Send } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";
import { useTranslation } from "../hooks/useTranslation";

// Keywords that indicate recruitment ads (prohibited for enterprise users)
const RECRUITMENT_KEYWORDS = [
  // English
  "hiring", "job opening", "resume", "salary", "benefits package",
  "apply now", "open position", "we are looking for", "join our team", "compensation",
  // Chinese (per spec §6.8)
  "薪资", "简历", "入职", "五险一金", "招聘", "应聘", "岗位",
  "底薪", "月薪", "年薪", "待遇", "福利",
];

// Content types available per role
const ROLE_CONTENT_TYPES: Record<string, { types: ContentType[]; defaultType: ContentType }> = {
  LEARNER: { types: ["PAPER", "PROJECT", "TOOL"], defaultType: "PAPER" },
  EXPERT: { types: ["PAPER", "PROJECT", "TOOL", "CONTEST"], defaultType: "PROJECT" },
  ENTERPRISE_LEADER: { types: ["PROJECT"], defaultType: "PROJECT" },
  ADMIN: { types: ["CONTEST", "PAPER", "POLICY", "PROJECT", "TOOL"], defaultType: "PAPER" },
};

export function Publish() {
  const { t, language } = useTranslation();
  usePageTitle(t("publish.title"));
  const { user } = useAuthStore();
  const { contents, addContent } = useDataStore();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const roleConfig = ROLE_CONTENT_TYPES[user?.role || "LEARNER"] || ROLE_CONTENT_TYPES.LEARNER;
  const [type, setType] = useState<ContentType>(roleConfig.defaultType);
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<ContentVisibility>("ALL");
  const [showForm, setShowForm] = useState(false);

  // Enterprise-specific fields
  const [projectBackground, setProjectBackground] = useState("");
  const [projectGoal, setProjectGoal] = useState("");

  // My existing content
  const myContents = user
    ? contents.filter((c) => c.authorId === user.id)
    : [];

  // Check for recruitment keywords
  const detectedKeywords = useMemo(() => {
    if (user?.role !== "ENTERPRISE_LEADER") return [];
    const text = `${title} ${description}`.toLowerCase();
    return RECRUITMENT_KEYWORDS.filter((kw) => text.includes(kw));
  }, [title, description, user?.role]);

  const handleSubmit = (asDraft: boolean) => {
    if (!user) return;
    if (!title.trim() || !description.trim()) {
      toast.error(t("publish.toast_fill"));
      return;
    }

    const fullDescription =
      user.role === "ENTERPRISE_LEADER" && (projectBackground || projectGoal)
        ? `${description}\n\n**${language === 'zh' ? '背景' : 'Background'}:** ${projectBackground}\n\n**${language === 'zh' ? '目标' : 'Goal'}:** ${projectGoal}`
        : description;

    addContent({
      id: `c${Date.now()}`,
      title,
      description: fullDescription,
      type,
      status: asDraft ? "DRAFT" : "PENDING_REVIEW",
      authorId: user.id,
      createdAt: new Date().toISOString(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      likes: 0,
      views: 0,
      visibility: user.role === "ENTERPRISE_LEADER" ? visibility : "ALL",
    });

    toast.success(
      asDraft
        ? t("publish.toast_saved")
        : t("publish.toast_submitted"),
      asDraft
        ? undefined
        : {
            description: t("publish.toast_pending"),
          }
    );

    setTitle("");
    setDescription("");
    setTags("");
    setProjectBackground("");
    setProjectGoal("");
    setShowForm(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title={t("publish.my_content")}
        description={t("publish.desc")}
      >
        {!showForm && (
          <Button className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            {t("publish.new_content")}
          </Button>
        )}
      </PageHeader>

      {/* New Content Form */}
      {showForm && (
        <>
          {user?.role === "ENTERPRISE_LEADER" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-amber-400">
                  {t("publish.notice_title")}
                </h3>
                <p className="text-sm text-amber-400/80 mt-1">
                  <strong>{t("publish.notice_desc_1")}</strong> {t("publish.notice_desc_2")}
                </p>
              </div>
            </div>
          )}

          {/* Recruitment keyword warning */}
          {detectedKeywords.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-400">
                  {t("publish.recruitment_warning")}
                </h3>
                <p className="text-sm text-red-400/80 mt-1">
                  {t("publish.recruitment_warning_desc")}{" "}
                  <strong>{detectedKeywords.join(", ")}</strong>. {t("publish.recruitment_warning_desc_2")}
                </p>
              </div>
            </div>
          )}

          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-zinc-100">{t("publish.content_details")}</CardTitle>
              <CardDescription className="text-zinc-400">
                {t("publish.content_details_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">
                    {t("publish.content_type")}
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {roleConfig.types.map(
                      (t) => (
                        <label
                          key={t}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="type"
                            value={t}
                            checked={type === t}
                            onChange={(e) =>
                              setType(e.target.value as ContentType)
                            }
                            className="text-indigo-500 focus:ring-indigo-500 bg-zinc-900 border-white/10"
                          />
                          <span className="text-sm text-zinc-300">{t}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                {user?.role === "ENTERPRISE_LEADER" && (
                  <div className="space-y-2 pt-2">
                    <label className="text-sm font-medium text-zinc-300">
                      {t("publish.visibility")}
                    </label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value="ALL"
                          checked={visibility === "ALL"}
                          onChange={(e) =>
                            setVisibility(
                              e.target.value as ContentVisibility
                            )
                          }
                          className="text-indigo-500 focus:ring-indigo-500 bg-zinc-900 border-white/10"
                        />
                        <span className="text-sm text-zinc-300">
                          {t("publish.visibility_public")}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value="EXPERTS_LEARNERS"
                          checked={visibility === "EXPERTS_LEARNERS"}
                          onChange={(e) =>
                            setVisibility(
                              e.target.value as ContentVisibility
                            )
                          }
                          className="text-indigo-500 focus:ring-indigo-500 bg-zinc-900 border-white/10"
                        />
                        <span className="text-sm text-zinc-300">
                          {t("publish.visibility_experts")}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">
                    {t("publish.content_title")}
                  </label>
                  <Input
                    value={title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTitle(e.target.value)
                    }
                    placeholder={t("publish.content_title_pl")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">
                    {t("publish.content_desc")}
                  </label>
                  <p className="text-xs text-zinc-500">{t("publish.content_desc_help")}</p>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex min-h-[120px] w-full rounded-md border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 backdrop-blur-sm transition-all resize-none"
                    placeholder={t("publish.content_desc_pl")}
                  />
                </div>

                {/* Enterprise-specific fields */}
                {user?.role === "ENTERPRISE_LEADER" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">
                        {t("publish.project_bg")}
                      </label>
                      <textarea
                        value={projectBackground}
                        onChange={(e) =>
                          setProjectBackground(e.target.value)
                        }
                        className="flex min-h-[80px] w-full rounded-md border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 backdrop-blur-sm resize-none"
                        placeholder={t("publish.project_bg_pl")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-300">
                        {t("publish.project_goal")}
                      </label>
                      <textarea
                        value={projectGoal}
                        onChange={(e) => setProjectGoal(e.target.value)}
                        className="flex min-h-[80px] w-full rounded-md border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 backdrop-blur-sm resize-none"
                        placeholder={t("publish.project_goal_pl")}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">
                    {t("publish.tags")}
                  </label>
                  <Input
                    value={tags}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTags(e.target.value)
                    }
                    placeholder={t("publish.tags_pl")}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowForm(false)}
                  >
                    {t("publish.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleSubmit(true)}
                  >
                    <Save className="h-4 w-4" />
                    {t("publish.save_draft")}
                  </Button>
                  <Button
                    type="button"
                    className={`gap-2 ${detectedKeywords.length > 0 ? "bg-amber-600 hover:bg-amber-500" : ""}`}
                    onClick={() => handleSubmit(false)}
                  >
                    <Send className="h-4 w-4" />
                    {detectedKeywords.length > 0 ? (language === 'zh' ? "仍要提交（需审核）" : "Submit Anyway (Will Be Reviewed)") : t("publish.submit_review")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* My Content List */}
      {myContents.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            {language === 'zh' ? `我的提交 (${myContents.length})` : `My Submissions (${myContents.length})`}
          </h2>
          {myContents.map((content) => (
            <Link key={content.id} to={`/publish/${content.id}`}>
              <Card className="glass-panel hover:border-indigo-500/30 transition-all cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={content.status} />
                      <span className="text-xs text-zinc-500 uppercase tracking-wider">
                        {content.type}
                      </span>
                    </div>
                    <p className="font-medium text-zinc-100 truncate">
                      {content.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(content.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {content.status === "REJECTED" && content.rejectReason && (
                    <div className="text-xs text-red-400 max-w-[200px] truncate">
                      {language === 'zh' ? '原因' : 'Reason'}: {content.rejectReason}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : !showForm ? (
        <EmptyState
          icon={<FileText className="h-8 w-8 text-zinc-500" />}
          title={t("publish.empty_title")}
          description={t("publish.empty_desc")}
          action={{
            label: t("publish.new_content"),
            onClick: () => setShowForm(true),
          }}
        />
      ) : null}
    </div>
  );
}
