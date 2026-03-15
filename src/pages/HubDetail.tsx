import { useTranslation } from "../hooks/useTranslation";
import { formatRole } from "../lib/utils";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { Input } from "../components/ui/Input";
import { EmptyState, LoadingSkeleton } from "../components/ui/StateDisplay";
import {
  fetchHubDetailByApi,
  submitApplicationByApi,
} from "../lib/api";
import type { ApplicationOutboxItem, HubDetailData } from "../types";
import {
  ArrowLeft,
  Calendar,
  Eye,
  Heart,
  Tag,
  Share2,
  MessageSquare,
  Send,
  CheckCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { usePageTitle } from "../lib/usePageTitle";
import { toast } from "sonner";

export function HubDetail() {
  const { t, language } = useTranslation();
  usePageTitle(t("hub_detail.content_detail"));
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");

  const [detail, setDetail] = useState<HubDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchHubDetailByApi(id)
      .then((nextDetail) => setDetail(nextDetail))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [id, currentUser?.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl py-20">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!detail?.content) {
    return (
      <EmptyState
        title={t("hub_detail.content_not_found")}
        description={t("hub_detail.content_not_found_desc")}
        action={{ label: t("hub_detail.back_to_hub"), onClick: () => navigate("/hub") }}
      />
    );
  }

  const content = detail.content;
  const author = detail.author ?? content.author ?? null;
  const relatedContents = detail.relatedContents;
  const viewerApplication = detail.viewerApplication ?? null;

  // Visibility check
  if (
    content.visibility === "EXPERTS_LEARNERS" &&
    currentUser?.role === "ENTERPRISE_LEADER"
  ) {
    return (
      <EmptyState
        title={t("hub_detail.access_restricted")}
        description={t("hub_detail.access_restricted_desc")}
        action={{ label: t("hub_detail.back_to_hub"), onClick: () => navigate("/hub") }}
      />
    );
  }

  // Only show published or own content
  if (
    content.status !== "PUBLISHED" &&
    content.authorId !== currentUser?.id &&
    currentUser?.role !== "ADMIN"
  ) {
    return (
      <EmptyState
        title={t("hub_detail.content_not_available")}
        description={t("hub_detail.content_not_published_desc")}
        action={{ label: t("hub_detail.back_to_hub"), onClick: () => navigate("/hub") }}
      />
    );
  }

  // Application logic for PROJECT/CONTEST
  const isApplicable = (content.type === "PROJECT" || content.type === "CONTEST") && currentUser && currentUser.id !== content.authorId;
  const hasApplied = Boolean(viewerApplication);

  const getTypeLabel = (type: string) => {
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

  const handleApply = async () => {
    if (!currentUser) return;
    try {
      const app = await submitApplicationByApi({
        targetType: "PROJECT",
        targetId: content.id,
        message: applyMessage || undefined,
      });
      const nextViewerApplication: ApplicationOutboxItem = {
        ...app,
        target: {
          id: content.id,
          targetType: app.targetType,
          contentType: content.type,
          title: content.title,
          status: content.status,
          ownerId: content.authorId,
        },
        targetContentTitle: content.title,
        ...(author ? { owner: author } : {}),
      };
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              viewerApplication: nextViewerApplication,
            }
          : prev,
      );
      toast.success(t("hub_detail.application_submitted_success"));
    } catch (err: any) {
      toast.error(err?.message || t("api.request_failed"));
    }
    setShowApplyForm(false);
    setApplyMessage("");
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex gap-8">
        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("hub_detail.back")}
      </button>

      {/* Cover Image */}
      {content.coverImage && (
        <div className="aspect-[2/1] w-full overflow-hidden rounded-2xl border border-white/10">
          <img
            src={content.coverImage}
            alt={content.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="secondary"
            className="text-xs uppercase tracking-wider"
          >
            {getTypeLabel(content.type)}
          </Badge>
          <span className="flex items-center gap-1 text-sm text-zinc-500">
            <Calendar className="h-3.5 w-3.5" />
            {formatDistanceToNow(new Date(content.createdAt), {
              addSuffix: true,
              locale: language === "zh" ? zhCN : enUS,
            })}
          </span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
          {content.title}
        </h1>
      </div>

      {/* Author Card */}
      {author && (
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/50 backdrop-blur-sm p-4">
          <Link
            to={`/u/${author.id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={author.avatar}
              fallback={author.name.charAt(0)}
              className="h-12 w-12"
            />
            <div>
              <p className="font-medium text-zinc-100">{author.name}</p>
              <p className="text-sm text-zinc-400">
                {author.title || formatRole(author.role)}
                {author.company && ` ${t("common.at")} ${author.company}`}
              </p>
            </div>
          </Link>
          {currentUser && currentUser.id !== author.id && (
            <Link to={`/messages?to=${author.id}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("hub_detail.message")}
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-6 text-sm text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Eye className="h-4 w-4" />
          {content.views.toLocaleString()} {t("hub_detail.views")}
        </span>
        <span className="flex items-center gap-1.5">
          <Heart className="h-4 w-4" />
          {content.likes.toLocaleString()} {t("hub_detail.likes")}
        </span>
        <button className="ml-auto flex items-center gap-1.5 text-zinc-400 hover:text-indigo-400 transition-colors">
          <Share2 className="h-4 w-4" />
          {t("hub_detail.share")}
        </button>
      </div>

      {/* Content Body */}
      <div className="prose prose-invert max-w-none">
        <div className="rounded-xl border border-white/10 bg-zinc-900/30 backdrop-blur-sm p-8">
          <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {content.description}
          </p>
          <p className="mt-6 text-zinc-500 italic text-sm">
            {/* Full content would be rendered here (Markdown/Rich Text). This is a preview showing the description. */}
          </p>
        </div>
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

      {/* Apply to Join CTA */}
      {isApplicable && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-6">
          {hasApplied ? (
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">{t("hub_detail.application_submitted")}</p>
                <p className="text-xs text-zinc-400 mt-1">{t("hub_detail.owner_review_notice")}</p>
              </div>
            </div>
          ) : showApplyForm ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-zinc-100">{t("hub_detail.apply_join_this")} {content.type === "CONTEST" ? t("pub_detail.type_contest") : t("pub_detail.type_project")}</h3>
              <Input
                placeholder={t("hub_detail.your_message_optional")}
                value={applyMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApplyMessage(e.target.value)}
                className="text-sm"
              />
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => { setShowApplyForm(false); setApplyMessage(""); }}>{t("hub_detail.cancel")}</Button>
                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" onClick={handleApply}>
                  <Send className="h-4 w-4" /> {t("hub_detail.submit_application")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-zinc-100">{t("hub_detail.interested_this")} {content.type === "CONTEST" ? t("pub_detail.type_contest") : t("pub_detail.type_project")}?</h3>
                <p className="text-sm text-zinc-400 mt-1">{t("hub_detail.apply_join_collaborate")}</p>
              </div>
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)]" onClick={() => setShowApplyForm(true)}>
                <Send className="h-4 w-4" /> {t("hub_detail.apply_now")}
              </Button>
            </div>
          )}
        </div>
      )}
      </div>

        {/* Right Sidebar - Related Content */}
        <aside className="hidden lg:block w-72 shrink-0 space-y-6">
          <div className="rounded-xl border border-white/10 bg-zinc-900/50 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-4">{t("hub_detail.related_content")}</h3>
            {relatedContents.length > 0 ? (
              <div className="space-y-4">
                {relatedContents.map(rc => (
                  <Link key={rc.id} to={`/hub/${rc.type.toLowerCase()}/${rc.id}`} className="block group">
                    <Badge variant="outline" className="text-[9px] uppercase mb-1 border-white/10">{getTypeLabel(rc.type)}</Badge>
                    <p className="text-sm font-medium text-zinc-200 group-hover:text-indigo-400 transition-colors line-clamp-2">{rc.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500">
                      <span>{rc.views} {t("hub_detail.views")}</span>
                      <span>{rc.likes} {t("hub_detail.likes")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">{t("hub_detail.no_related")}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
