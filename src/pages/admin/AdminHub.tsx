import { formatStatus } from "../../lib/utils";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
} from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, LoadingSkeleton, ErrorState } from "../../components/ui/StateDisplay";
import { SearchBar } from "../../components/ui/SearchBar";

import {
  Eye,
  Heart,
  Calendar,
  User,
  Shield,
  LayoutGrid,
  List,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Content, ContentStatus, ContentType, User as UserType } from "../../types";
import { usePageTitle } from "../../lib/usePageTitle";
import {
  fetchHubContents,
  fetchTalentUsers,
  approveAdminReviewByApi,
  rejectAdminReviewByApi,
} from "../../lib/api";

const STATUS_OPTIONS: ContentStatus[] = [
  "PUBLISHED",
  "PENDING_REVIEW",
  "DRAFT",
  "REJECTED",
];
const TYPE_OPTIONS: ContentType[] = [
  "PAPER",
  "PROJECT",
  "TOOL",
  "CONTEST",
  "POLICY",
];

export function AdminHub() {
  const { t } = useTranslation();
  usePageTitle(t("admin_hub.content_management"));

  const [contents, setContents] = useState<Content[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadData = () => {
    setIsLoading(true);
    setHasError(false);
    Promise.all([
      fetchHubContents(),
      fetchTalentUsers(),
    ]).then(([c, u]) => {
      setContents(c);
      setUsers(u);
    }).catch(() => {
      setHasError(true);
    }).finally(() => {
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<ContentType | "ALL">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const filteredContents = contents.filter((c) => {
    const matchesSearch =
      search === "" ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || c.status === statusFilter;
    const matchesType = typeFilter === "ALL" || c.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getAuthorName = (authorId: string) => {
    return users.find((u) => u.id === authorId)?.name || t("hub.unknown");
  };

  const handleStatusChange = async (
    contentId: string,
    newStatus: ContentStatus
  ) => {
    try {
      if (newStatus === "PUBLISHED") {
        await approveAdminReviewByApi(contentId);
      }
      setContents(prev => prev.map(c => c.id === contentId ? { ...c, status: newStatus } : c));
      toast.success(`${t("admin_hub.status_updated")} ${formatStatus(newStatus)}`);
    } catch (err: any) {
      toast.error(err?.message || t("api.request_failed"));
    }
  };

  const handleRejectWithReason = async (contentId: string) => {
    try {
      await rejectAdminReviewByApi(contentId, rejectReason || t("admin_hub.no_reason"));
      setContents(prev => prev.map(c => c.id === contentId ? { ...c, status: "REJECTED", rejectReason: rejectReason || undefined } : c));
      toast.success(`${t("admin_hub.content_rejected")}`);
    } catch (err: any) {
      toast.error(err?.message || t("api.request_failed"));
    }
    setRejectingId(null);
    setRejectReason("");
  };

  const handleSaveEdit = (contentId: string) => {
    setContents(prev => prev.map(c => c.id === contentId ? { ...c, title: editTitle, description: editDesc } : c));
    toast.success(t("admin_hub.content_updated"));
    setEditingId(null);
  };

  if (hasError) return <ErrorState onRetry={loadData} />;
  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin_hub.content_management")}
        description={t("admin_hub.manage_all_content")}
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
            <Shield className="mr-1 h-3 w-3" />
            {t("admin_hub.admin")}
          </Badge>
        </div>
      </PageHeader>

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {STATUS_OPTIONS.map((status) => {
          const count = contents.filter((c) => c.status === status).length;
          return (
            <button
              key={status}
              onClick={() =>
                setStatusFilter(statusFilter === status ? "ALL" : status)
              }
              className={`rounded-xl border p-4 text-left transition-all ${
                statusFilter === status
                  ? "border-indigo-500/50 bg-indigo-500/10"
                  : "border-white/10 bg-zinc-900/50 hover:border-white/20"
              }`}
            >
              <p className="text-xs text-zinc-400 uppercase tracking-wider">
                {formatStatus(status)}
              </p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t("admin_hub.search_placeholder")}
          className="md:max-w-xs"
        />
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as ContentType | "ALL")
            }
            className="rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">{t("admin_hub.all_types")}</option>
            {TYPE_OPTIONS.map((typeOption) => (
              <option key={typeOption} value={typeOption}>
                {typeOption}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 ${
                viewMode === "list"
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title={t("admin_hub.list_view")}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${
                viewMode === "grid"
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title={t("admin_hub.grid_view")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content List */}
      {filteredContents.length === 0 ? (
        <EmptyState
          title={t("admin_hub.no_content_found")}
          description={t("admin_hub.no_content_filter")}
        />
      ) : viewMode === "list" ? (
        <div className="space-y-3">
          {filteredContents.map((content) => (
            <Card key={content.id} className="glass-panel">
              <CardContent className="flex items-center gap-4 p-4">
                {content.coverImage && (
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                    <img
                      src={content.coverImage}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-[10px] uppercase">{content.type}</Badge>
                    <StatusBadge status={content.status} />
                    {content.rejectReason && (
                      <span className="text-[10px] text-red-400 italic">{t("admin_hub.reason_label")} {content.rejectReason}</span>
                    )}
                  </div>
                  {editingId === content.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editTitle}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
                        className="h-8 text-sm font-medium"
                      />
                      <textarea
                        className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[60px] resize-y"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-emerald-400 border-emerald-500/30" onClick={() => handleSaveEdit(content.id)}>
                          <Check className="h-2.5 w-2.5" /> {t("admin_hub.save")}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingId(null)}>{t("common.cancel")}</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-zinc-100 truncate">{content.title}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{getAuthorName(content.authorId)}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDistanceToNow(new Date(content.createdAt), { addSuffix: true })}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{content.views}</span>
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{content.likes}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {editingId !== content.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100"
                        onClick={() => { setEditingId(content.id); setEditTitle(content.title); setEditDesc(content.description); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {content.status === "PENDING_REVIEW" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          onClick={() => handleStatusChange(content.id, "PUBLISHED")}
                        >
                          {t("admin_hub.approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => setRejectingId(rejectingId === content.id ? null : content.id)}
                        >
                          {t("admin_hub.reject")}
                        </Button>
                      </>
                    )}
                    {content.status === "PUBLISHED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                        onClick={() => handleStatusChange(content.id, "DRAFT")}
                      >
                        {t("admin_hub.unpublish")}
                      </Button>
                    )}
                  </div>
                  {/* Inline reject reason input */}
                  {rejectingId === content.id && (
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        placeholder={t("admin_hub.reject_reason_optional")}
                        value={rejectReason}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)}
                        className="h-7 text-xs flex-1"
                        autoFocus
                      />
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => handleRejectWithReason(content.id)}>
                        {t("admin_hub.confirm")}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRejectingId(null); setRejectReason(""); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContents.map((content) => (
            <Card key={content.id} className="glass-panel">
              {content.coverImage && (
                <div className="aspect-video w-full overflow-hidden bg-zinc-800">
                  <img
                    src={content.coverImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="text-[10px] uppercase"
                  >
                    {content.type}
                  </Badge>
                  <StatusBadge status={content.status} />
                </div>
                <p className="font-medium text-zinc-100 line-clamp-2">
                  {content.title}
                </p>
                <p className="text-xs text-zinc-500">
                  {t("admin_hub.by")} {getAuthorName(content.authorId)}
                </p>
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  {content.status === "PENDING_REVIEW" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => handleStatusChange(content.id, "PUBLISHED")}
                      >
                        {t("admin_hub.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => setRejectingId(rejectingId === content.id ? null : content.id)}
                      >
                        {t("admin_hub.reject")}
                      </Button>
                    </>
                  )}
                  {content.status === "PUBLISHED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                      onClick={() => handleStatusChange(content.id, "DRAFT")}
                    >
                      {t("admin_hub.unpublish")}
                    </Button>
                  )}
                </div>
                {rejectingId === content.id && (
                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder={t("admin_hub.reason_short")}
                      value={rejectReason}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400" onClick={() => handleRejectWithReason(content.id)}>{t("admin_hub.confirm")}</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
