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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { toast } from "sonner";
import type { Content, ContentType } from "../types";
import { usePageTitle } from "../lib/usePageTitle";
import { useTranslation } from "../hooks/useTranslation";
import { submitPublishByApi, fetchHubContentByIdApi, updatePublishContentByApi } from "../lib/api";

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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);

    fetchHubContentByIdApi(id)
      .then((c) => {
        if (!active) return;
        setContent(c);
        setEditTitle(c.title);
        setEditDescription(c.description);
        setEditTags(c.tags.join(", "));
        setEditType(c.type);
      })
      .catch(() => {
        if (!active) return;
        setContent(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
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

  // Only author or admin can view
  if (content.authorId !== user?.id && user?.role !== "ADMIN") {
    return (
      <EmptyState
        title={t("pub_detail.access_denied")}
        description={t("pub_detail.access_denied_desc")}
        action={{ label: t("pub_detail.back_to_hub"), onClick: () => navigate("/hub") }}
      />
    );
  }

  const canEdit = content.status === "DRAFT" || content.status === "REJECTED";
  const canSubmit = content.status === "DRAFT" || content.status === "REJECTED";

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updatePublishContentByApi(content.id, {
        title: editTitle,
        description: editDescription,
        tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
        type: editType,
      });
      setContent(updated);
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
      if (updated) setContent(updated);
      else setContent({ ...content, status: "PENDING_REVIEW" });
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
        const updated = await updatePublishContentByApi(content.id, {});
        setContent({ ...updated, status: "DRAFT" });
      } catch {
        // best-effort: update local state even if API fails
        setContent({ ...content, status: "DRAFT" });
      } finally {
        setIsSaving(false);
      }
    }
    toast.success(t("pub_detail.saved_as_draft"));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate("/publish")}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("pub_detail.back_to_publish")}
      </button>

      {/* Status Bar */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/50 backdrop-blur-sm p-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={content.status} />
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
            >
              <Edit3 className="h-4 w-4" />
              {t("pub_detail.edit")}
            </Button>
          )}
          {canSubmit && !isEditing && (
            <Button size="sm" className="gap-2" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("pub_detail.submit_for_review")}
            </Button>
          )}
        </div>
      </div>

      {/* Rejection Reason */}
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

      {/* Content Card */}
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
                />
              </div>
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
                />
              </div>
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
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleSave} size="sm" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  {t("pub_detail.save_changes")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditTitle(content.title);
                    setEditDescription(content.description);
                    setEditTags(content.tags.join(", "));
                    setEditType(content.type);
                  }}
                >
                  {t("pub_detail.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <Badge
                  variant="secondary"
                  className="text-xs uppercase tracking-wider"
                >
                  {getTypeLabel(content.type)}
                </Badge>
              </div>
              <CardTitle className="text-2xl text-zinc-100">
                {content.title}
              </CardTitle>
            </>
          )}
        </CardHeader>
        {!isEditing && (
          <CardContent className="space-y-6">
            {/* Stats */}
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

            {/* Description */}
            <div className="rounded-lg border border-white/5 bg-zinc-900/30 p-6">
              <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {content.description}
              </p>
            </div>

            {/* Tags */}
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

            {/* Actions */}
            {canEdit && (
              <div className="flex items-center gap-2 border-t border-white/5 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleSaveAsDraft}
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
