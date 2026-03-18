import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../store/authStore";
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
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/ui/StateDisplay";
import { ContentType, ContentVisibility, Content } from "../types";
import { AlertTriangle, FileText, Loader2, Pencil, Plus, Save, Send, Trash2 } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";
import { useTranslation } from "../hooks/useTranslation";
import { detectRecruitmentKeywords } from "../lib/recruitment";
import {
  getContentDomainMeta,
  getContentPreviewSections,
} from "../lib/contentDomain";
import {
  createPublishDraftByApi,
  deleteHubContentByApi,
  fetchMyPublishContentsByApi,
  submitPublishByApi,
} from "../lib/api";

// Content types available per role
const ROLE_CONTENT_TYPES: Record<string, { types: ContentType[]; defaultType: ContentType }> = {
  LEARNER: { types: ["PAPER", "PROJECT", "TOOL"], defaultType: "PAPER" },
  EXPERT: { types: ["PAPER", "PROJECT", "TOOL", "CONTEST"], defaultType: "PROJECT" },
  ENTERPRISE_LEADER: { types: ["PROJECT"], defaultType: "PROJECT" },
  ADMIN: { types: ["CONTEST", "PAPER", "POLICY", "PROJECT", "TOOL"], defaultType: "PAPER" },
};

const EDITABLE_CONTENT_STATUSES: Content["status"][] = [
  "DRAFT",
  "REJECTED",
  "PUBLISHED",
];

function getAuthoringContentDomain(
  role: string | undefined,
  type: ContentType,
): Content["contentDomain"] {
  if (type === "PROJECT" && role === "ENTERPRISE_LEADER") {
    return "ENTERPRISE_NEED";
  }

  if (type === "PROJECT" && role === "EXPERT") {
    return "RESEARCH_PROJECT";
  }

  return "HUB_ITEM";
}

export function Publish() {
  const { t } = useTranslation();
  usePageTitle(t("publish.title"));
  const { user } = useAuthStore();
  const [apiMyContents, setApiMyContents] = useState<Content[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingContents, setIsLoadingContents] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
  const [neededSupport, setNeededSupport] = useState("");

  // My existing content
  const myContents = apiMyContents;
  const authoringContentDomain = useMemo(
    () => getAuthoringContentDomain(user?.role, type),
    [type, user?.role],
  );
  const isEnterpriseNeedDraft = authoringContentDomain === "ENTERPRISE_NEED";
  const isResearchProjectDraft = authoringContentDomain === "RESEARCH_PROJECT";
  const descriptionLabel = isEnterpriseNeedDraft
    ? t("hub_detail.section_deliverables")
    : t("publish.content_desc");
  const descriptionPlaceholder = isEnterpriseNeedDraft
    ? t("hub_detail.section_deliverables")
    : t("publish.content_desc_pl");

  useEffect(() => {
    if (!roleConfig.types.includes(type)) {
      setType(roleConfig.defaultType);
    }
  }, [roleConfig.defaultType, roleConfig.types, type]);

  useEffect(() => {
    let active = true;

    async function loadMyContentsFromApi() {
      setIsLoadingContents(true);
      setHasLoadError(false);
      try {
        const result = await fetchMyPublishContentsByApi();
        if (!active) return;
        setApiMyContents(result);
      } catch {
        if (!active) return;
        setApiMyContents([]);
        setHasLoadError(true);
      } finally {
        if (active) setIsLoadingContents(false);
      }
    }

    void loadMyContentsFromApi();

    return () => {
      active = false;
    };
  }, []);

  // Check for recruitment keywords
  const detectedKeywords = useMemo(() => {
    if (user?.role !== "ENTERPRISE_LEADER") return [];
    const text = `${title} ${description} ${tags} ${projectBackground} ${projectGoal}`;
    return detectRecruitmentKeywords(text);
  }, [title, description, tags, projectBackground, projectGoal, user?.role]);

  const handleSubmit = async (asDraft: boolean) => {
    if (!user) return;
    if (!title.trim() || !description.trim()) {
      toast.error(t("publish.toast_fill"));
      return;
    }
    if (user.role === "ENTERPRISE_LEADER" && detectedKeywords.length > 0) {
      toast.error(t("publish.recruitment_warning"), {
        description: `${t("publish.recruitment_warning_desc")} ${detectedKeywords.join(", ")}. ${t("publish.recruitment_warning_desc_2")}`,
      });
      return;
    }

    const parsedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setIsSubmitting(true);

    try {
      const created = await createPublishDraftByApi({
        title,
        description,
        type,
        tags: parsedTags,
        ...(isEnterpriseNeedDraft
          ? {
              visibility,
              background: projectBackground || undefined,
              goal: projectGoal || undefined,
              deliverables: description || undefined,
            }
          : {}),
        ...(isResearchProjectDraft
          ? { neededSupport: neededSupport || undefined }
          : {}),
      });

      if (asDraft) {
        const draftItem = {
          ...created,
          authorId: created.authorId || user.id,
          status: "DRAFT" as const,
        };
        setApiMyContents((prev) => [draftItem, ...prev]);
      } else {
        const submitted = await submitPublishByApi(created.id);
        const reviewItem: Content = {
          ...(submitted ?? created),
          authorId: (submitted ?? created).authorId || user.id,
          status: "PENDING_REVIEW" as const,
        };
        setApiMyContents((prev) => [reviewItem, ...prev]);
      }
    } catch {
      toast.error(t("api.request_failed"));
      setIsSubmitting(false);
      return; // Keep form data so user can retry
    } finally {
      setIsSubmitting(false);
    }

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
    setNeededSupport("");
    setVisibility("ALL");
    setShowForm(false);
  };

  const handleDelete = async (contentId: string, contentTitle: string) => {
    const confirmed = window.confirm(
      `${t("publish.delete_confirm")}\n\n${contentTitle}`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(contentId);

    try {
      await deleteHubContentByApi(contentId);
      setApiMyContents((prev) => prev.filter((item) => item.id !== contentId));
      toast.success(t("publish.delete_success"));
    } catch {
      toast.error(t("publish.delete_failed"));
    } finally {
      setDeletingId(null);
    }
  };

  if (hasLoadError) return <ErrorState onRetry={() => { setHasLoadError(false); setIsLoadingContents(true); fetchMyPublishContentsByApi().then(r => setApiMyContents(r)).catch(() => setHasLoadError(true)).finally(() => setIsLoadingContents(false)); }} />;
  if (isLoadingContents) return <LoadingSkeleton />;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title={t("publish.my_content")}
        description={t("publish.desc")}
      >
        {!showForm && (
          <Button data-testid="publish-new-content-btn" className="gap-2" onClick={() => setShowForm(true)}>
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
                <div>
                  {(() => {
                    const meta = getContentDomainMeta(authoringContentDomain, t);
                    return (
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${meta.className}`}>
                        <meta.Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    );
                  })()}
                </div>
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
                          data-testid="publish-form-visibility-all-radio"
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
                          data-testid="publish-form-visibility-experts-radio"
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
                    data-testid="publish-form-title-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">
                    {descriptionLabel}
                  </label>
                  <p className="text-xs text-zinc-500">{t("publish.content_desc_help")}</p>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    data-testid="publish-form-description-input"
                    className="flex min-h-[120px] w-full rounded-md border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 backdrop-blur-sm transition-all resize-none"
                    placeholder={descriptionPlaceholder}
                  />
                </div>

                {/* Enterprise-specific fields */}
                {isEnterpriseNeedDraft && (
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
                        data-testid="publish-form-background-input"
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
                        data-testid="publish-form-goal-input"
                        className="flex min-h-[80px] w-full rounded-md border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 backdrop-blur-sm resize-none"
                        placeholder={t("publish.project_goal_pl")}
                      />
                    </div>
                  </>
                )}

                {isResearchProjectDraft && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">
                      {t("hub_detail.section_needed_support")}
                    </label>
                    <textarea
                      value={neededSupport}
                      onChange={(e) => setNeededSupport(e.target.value)}
                      data-testid="publish-form-needed-support-input"
                      className="flex min-h-[80px] w-full rounded-md border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 backdrop-blur-sm resize-none"
                      placeholder={t("hub_detail.section_needed_support")}
                    />
                  </div>
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
                    disabled={isSubmitting || (user?.role === "ENTERPRISE_LEADER" && detectedKeywords.length > 0)}
                  >
                    <Save className="h-4 w-4" />
                    {t("publish.save_draft")}
                  </Button>
                  <Button
                    type="button"
                    className="gap-2"
                    data-testid="publish-submit-review-btn"
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting || (user?.role === "ENTERPRISE_LEADER" && detectedKeywords.length > 0)}
                  >
                    <Send className="h-4 w-4" />
                    {t("publish.submit_review")}
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
            {t("publish.my_submissions")} ({myContents.length})
          </h2>
          {myContents.map((content) => {
            const previewSections = getContentPreviewSections(content, t);
            const isEditable = EDITABLE_CONTENT_STATUSES.includes(content.status);
            const isDeleting = deletingId === content.id;
            return (
              <Card
                key={content.id}
                className="glass-panel transition-all hover:border-indigo-500/30"
              >
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                  <Link
                    to={`/publish/${content.id}`}
                    className="min-w-0 flex-1 rounded-lg transition-opacity hover:opacity-90"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={content.status} />
                        {(() => {
                          const meta = getContentDomainMeta(content.contentDomain, t);
                          return (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                              <meta.Icon className="h-3 w-3" />
                              {meta.label}
                            </span>
                          );
                        })()}
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">
                          {content.type}
                        </span>
                      </div>
                      <p className="font-medium text-zinc-100 truncate">
                        <span data-testid="publish-item-title">{content.title}</span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {new Date(content.createdAt).toLocaleDateString()}
                      </p>
                      {previewSections.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {previewSections.slice(0, 2).map((section) => (
                            <div key={section.key}>
                              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                {section.label}
                              </p>
                              <p
                                className="line-clamp-1 text-xs text-zinc-400"
                                data-testid={`publish-item-preview-${content.id}-${section.key}`}
                              >
                                {section.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {content.status === "REJECTED" && content.rejectReason && (
                        <div className="text-xs text-red-400 max-w-[200px] truncate">
                          {t("publish.reason")}: {content.rejectReason}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
                    {isEditable ? (
                      <Link to={`/publish/${content.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          data-testid={`publish-item-edit-${content.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                          {t("publish.edit_action")}
                        </Button>
                      </Link>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                      onClick={() => void handleDelete(content.id, content.title)}
                      disabled={isDeleting}
                      data-testid={`publish-item-delete-${content.id}`}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {t("publish.delete_action")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
