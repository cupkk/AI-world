import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { StatusBadge } from "../components/ui/StatusBadge";
import { EmptyState, LoadingSkeleton } from "../components/ui/StateDisplay";
import {
  ArrowLeft,
  Eye,
  Heart,
  Edit3,
  Send,
  AlertTriangle,
  Tag,
  Loader2,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { toast } from "sonner";
import type { Content, ContentType, ContentVisibility } from "../types";
import { usePageTitle } from "../lib/usePageTitle";
import { useTranslation } from "../hooks/useTranslation";
import {
  getContentDomainMeta,
  getContentPreviewSections,
} from "../lib/contentDomain";
import {
  deleteHubContentByApi,
  fetchPublishContentByIdApi,
  savePublishAsDraftByApi,
  submitPublishByApi,
  updatePublishContentByApi,
} from "../lib/api";

export function PublishDetail() {
  const { t, language } = useTranslation();
  usePageTitle(t("pub_detail.edit_content"));
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editType, setEditType] = useState<ContentType>("PAPER");
  const [editBackground, setEditBackground] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editDeliverables, setEditDeliverables] = useState("");
  const [editNeededSupport, setEditNeededSupport] = useState("");
  const [editVisibility, setEditVisibility] = useState<ContentVisibility>("ALL");
  const [isSaving, setIsSaving] = useState(false);

  const syncEditState = (nextContent: Content) => {
    setEditTitle(nextContent.title);
    setEditDescription(nextContent.description);
    setEditTags(nextContent.tags.join(", "));
    setEditType(nextContent.type);
    setEditBackground(nextContent.background ?? "");
    setEditGoal(nextContent.goal ?? "");
    setEditDeliverables(nextContent.deliverables ?? nextContent.description);
    setEditNeededSupport(nextContent.neededSupport ?? "");
    setEditVisibility(nextContent.visibility ?? "ALL");
  };

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);

    fetchPublishContentByIdApi(id)
      .then((nextContent) => {
        if (!active) return;
        setContent(nextContent);
        syncEditState(nextContent);
      })
      .catch(() => {
        if (!active) return;
        setContent(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!content) {
    return (
      <EmptyState
        title={t("pub_detail.content_not_found")}
        description={t("pub_detail.content_not_found_desc")}
        action={{ label: t("publish.back_to_hub"), onClick: () => navigate("/publish") }}
      />
    );
  }

  const isAuthor = content.authorId === user?.id;
  const canView = isAuthor || user?.role === "ADMIN";

  if (!canView) {
    return (
      <EmptyState
        title={t("pub_detail.access_denied")}
        description={t("pub_detail.access_denied_desc")}
        action={{ label: t("pub_detail.back_to_hub"), onClick: () => navigate("/hub") }}
      />
    );
  }

  const canEdit =
    isAuthor &&
    (content.status === "DRAFT" ||
      content.status === "REJECTED" ||
      content.status === "PUBLISHED");
  const canSubmit = isAuthor && (content.status === "DRAFT" || content.status === "REJECTED");
  const canDelete = isAuthor;
  const contentDomainMeta = getContentDomainMeta(content.contentDomain, t);
  const detailSections = getContentPreviewSections(content, t);
  const parsedTags = editTags.split(",").map((tag) => tag.trim()).filter(Boolean);

  const getTypeLabel = (type: ContentType) => {
    switch (type) {
      case "PAPER":
        return t("pub_detail.type_paper");
      case "PROJECT":
        return t("pub_detail.type_project");
      case "TOOL":
        return t("pub_detail.type_tool");
      case "CONTEST":
        return t("pub_detail.type_contest");
      case "POLICY":
        return t("pub_detail.type_policy");
      default:
        return type;
    }
  };

  const getVisibilityLabel = (visibility?: ContentVisibility) => {
    return visibility === "EXPERTS_LEARNERS"
      ? t("publish.visibility_experts")
      : t("publish.visibility_public");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated =
        content.contentDomain === "ENTERPRISE_NEED"
          ? await updatePublishContentByApi(content.id, {
              title: editTitle,
              background: editBackground,
              goal: editGoal,
              deliverables: editDeliverables,
              tags: parsedTags,
              visibility: editVisibility,
            })
          : content.contentDomain === "RESEARCH_PROJECT"
            ? await updatePublishContentByApi(content.id, {
                title: editTitle,
                description: editDescription,
                neededSupport: editNeededSupport,
                tags: parsedTags,
              })
            : await updatePublishContentByApi(content.id, {
                title: editTitle,
                description: editDescription,
                tags: parsedTags,
                type: editType,
              });

      setContent(updated);
      syncEditState(updated);
      setIsEditing(false);
      toast.success(t("pub_detail.content_updated_success"));
    } catch {
      toast.error(t("api.request_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const updated = await submitPublishByApi(content.id);
      const nextContent =
        updated ?? { ...content, status: "PENDING_REVIEW" as const, rejectReason: undefined };
      setContent(nextContent);
      syncEditState(nextContent);
      toast.success(t("pub_detail.submitted_for_review"));
    } catch {
      toast.error(t("api.request_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsDraft = async () => {
    if (content.status === "REJECTED") {
      setIsSaving(true);
      try {
        const updated = await savePublishAsDraftByApi(content.id);
        setContent(updated);
        syncEditState(updated);
      } catch {
        const nextContent = { ...content, status: "DRAFT" as const, rejectReason: undefined };
        setContent(nextContent);
        syncEditState(nextContent);
      } finally {
        setIsSaving(false);
      }
    }
    toast.success(t("pub_detail.saved_as_draft"));
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `${t("publish.delete_confirm")}\n\n${content.title}`,
    );
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    try {
      await deleteHubContentByApi(content.id);
      toast.success(t("publish.delete_success"));
      navigate("/publish");
    } catch {
      toast.error(t("publish.delete_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button
        onClick={() => navigate("/publish")}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("pub_detail.back_to_publish")}
      </button>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/50 backdrop-blur-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={content.status} />
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${contentDomainMeta.className}`}>
            <contentDomainMeta.Icon className="h-3.5 w-3.5" />
            {contentDomainMeta.label}
          </span>
          <span className="text-sm text-zinc-400">
            {t("pub_detail.created")}{" "}
            {formatDistanceToNow(new Date(content.createdAt), {
              addSuffix: true,
              locale: language === "zh" ? zhCN : enUS,
            })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIsEditing(true)}
              data-testid="publish-detail-edit-btn"
            >
              <Edit3 className="h-4 w-4" />
              {t("pub_detail.edit")}
            </Button>
          )}
          {canDelete && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-red-300 hover:bg-red-500/10 hover:text-red-200"
              onClick={handleDelete}
              disabled={isSaving}
              data-testid="publish-detail-delete-btn"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t("publish.delete_action")}
            </Button>
          )}
          {canSubmit && !isEditing && (
            <Button
              size="sm"
              className="gap-2"
              onClick={handleSubmit}
              disabled={isSaving}
              data-testid="publish-detail-submit-btn"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("pub_detail.submit_for_review")}
            </Button>
          )}
        </div>
      </div>

      {content.status === "REJECTED" && content.rejectReason && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-400">
                {t("pub_detail.rejected_by_admin")}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {content.rejectReason}
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="glass-panel">
        <CardHeader>
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                  {t("pub_detail.title")}
                </label>
                <Input
                  value={editTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditTitle(e.target.value)
                  }
                  placeholder={t("pub_detail.title")}
                  data-testid="publish-detail-title-input"
                />
              </div>

              {content.contentDomain === "HUB_ITEM" ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                      {t("pub_detail.type")}
                    </label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as ContentType)}
                      className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="PAPER">{t("pub_detail.type_paper")}</option>
                      <option value="PROJECT">{t("pub_detail.type_project")}</option>
                      <option value="TOOL">{t("pub_detail.type_tool")}</option>
                      <option value="CONTEST">{t("pub_detail.type_contest")}</option>
                      <option value="POLICY">{t("pub_detail.type_policy")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                      {t("pub_detail.description")}
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={6}
                      className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      placeholder={t("pub_detail.description")}
                      data-testid="publish-detail-description-input"
                    />
                  </div>
                </>
              ) : null}

              {content.contentDomain === "ENTERPRISE_NEED" ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                      {t("hub_detail.section_background")}
                    </label>
                    <textarea
                      value={editBackground}
                      onChange={(e) => setEditBackground(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      data-testid="publish-detail-background-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                      {t("hub_detail.section_goal")}
                    </label>
                    <textarea
                      value={editGoal}
                      onChange={(e) => setEditGoal(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      data-testid="publish-detail-goal-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                      {t("hub_detail.section_deliverables")}
                    </label>
                    <textarea
                      value={editDeliverables}
                      onChange={(e) => setEditDeliverables(e.target.value)}
                      rows={6}
                      className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      data-testid="publish-detail-deliverables-input"
                    />
                  </div>
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
                          checked={editVisibility === "ALL"}
                          onChange={(e) =>
                            setEditVisibility(e.target.value as ContentVisibility)
                          }
                          data-testid="publish-detail-visibility-all-radio"
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
                          checked={editVisibility === "EXPERTS_LEARNERS"}
                          onChange={(e) =>
                            setEditVisibility(e.target.value as ContentVisibility)
                          }
                          data-testid="publish-detail-visibility-experts-radio"
                          className="text-indigo-500 focus:ring-indigo-500 bg-zinc-900 border-white/10"
                        />
                        <span className="text-sm text-zinc-300">
                          {t("publish.visibility_experts")}
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              ) : null}

              {content.contentDomain === "RESEARCH_PROJECT" ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                      {t("pub_detail.description")}
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={6}
                      className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      placeholder={t("pub_detail.description")}
                      data-testid="publish-detail-description-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                      {t("hub_detail.section_needed_support")}
                    </label>
                    <textarea
                      value={editNeededSupport}
                      onChange={(e) => setEditNeededSupport(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      data-testid="publish-detail-needed-support-input"
                    />
                  </div>
                </>
              ) : null}

              <div>
                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                  {t("pub_detail.tags")}
                </label>
                <Input
                  value={editTags}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditTags(e.target.value)
                  }
                  placeholder={t("pub_detail.tags_placeholder")}
                  data-testid="publish-detail-tags-input"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleSave} size="sm" disabled={isSaving} data-testid="publish-detail-save-btn">
                  {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  {t("pub_detail.save_changes")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    syncEditState(content);
                  }}
                >
                  {t("pub_detail.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${contentDomainMeta.className}`}>
                  <contentDomainMeta.Icon className="h-3.5 w-3.5" />
                  {contentDomainMeta.label}
                </span>
                <Badge
                  variant="secondary"
                  className="text-xs uppercase tracking-wider"
                >
                  {getTypeLabel(content.type)}
                </Badge>
                {content.contentDomain === "ENTERPRISE_NEED" ? (
                  <Badge variant="outline" className="text-xs border-white/10 text-zinc-300">
                    {getVisibilityLabel(content.visibility)}
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="text-2xl text-zinc-100">
                {content.title}
              </CardTitle>
            </>
          )}
        </CardHeader>
        {!isEditing && (
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6 text-sm text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                {content.views} {t("hub_detail.views")}
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="h-4 w-4" />
                {content.likes} {t("hub_detail.likes")}
              </span>
            </div>

            {detailSections.map((section) => (
              <div
                key={section.key}
                className="rounded-lg border border-white/5 bg-zinc-900/30 p-6"
                data-testid={`publish-detail-section-${section.key}`}
              >
                <p className="mb-3 text-sm font-medium text-zinc-400">{section.label}</p>
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {section.value}
                </p>
              </div>
            ))}

            {content.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {content.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs text-zinc-400 border-white/10"
                  >
                    <Tag className="mr-1 h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}

            {canEdit && (
              <div className="flex items-center gap-2 border-t border-white/5 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleSaveAsDraft}
                  data-testid="publish-detail-save-draft-btn"
                >
                  {t("pub_detail.save_draft")}
                </Button>
                <Button size="sm" className="gap-2" onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t("pub_detail.submit_for_review")}
                </Button>
              </div>
            )}

            {content.status === "PUBLISHED" && (
              <div className="border-t border-white/5 pt-6">
                <Link to={`/hub/${content.type.toLowerCase()}/${content.id}`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    {t("publish.view_hub")}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
