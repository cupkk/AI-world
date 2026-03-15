import { useDeferredValue, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Calendar,
  Check,
  Eye,
  Heart,
  LayoutGrid,
  List,
  Pencil,
  Shield,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { SearchBar } from "../../components/ui/SearchBar";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/ui/StateDisplay";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useTranslation } from "../../hooks/useTranslation";
import {
  approveAdminHubItemByApi,
  batchUpdateAdminHubItemsByApi,
  fetchAdminHubItemsByApi,
  moveAdminHubItemToDraftByApi,
  rejectAdminHubItemByApi,
  updateAdminHubItemByApi,
} from "../../lib/api";
import { usePageTitle } from "../../lib/usePageTitle";
import { formatStatus } from "../../lib/utils";
import type {
  AdminHubItem,
  AdminHubStats,
  ContentStatus,
  ContentType,
} from "../../types";

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

const EMPTY_STATS: AdminHubStats = {
  publishedCount: 0,
  pendingReviewCount: 0,
  draftCount: 0,
  rejectedCount: 0,
};

function getStatsKey(status: ContentStatus): keyof AdminHubStats {
  switch (status) {
    case "PUBLISHED":
      return "publishedCount";
    case "PENDING_REVIEW":
      return "pendingReviewCount";
    case "DRAFT":
      return "draftCount";
    case "REJECTED":
      return "rejectedCount";
  }
}

export function AdminHub() {
  const { t } = useTranslation();
  usePageTitle(t("admin_hub.content_management"));

  const [contents, setContents] = useState<AdminHubItem[]>([]);
  const [stats, setStats] = useState<AdminHubStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<ContentType | "ALL">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search);
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);

  const hasActiveFilters =
    deferredSearch.trim().length > 0 ||
    statusFilter !== "ALL" ||
    typeFilter !== "ALL";
  const allVisibleSelected =
    contents.length > 0 && contents.every((item) => selectedIds.includes(item.id));

  async function loadData(options?: { silent?: boolean }) {
    const requestId = ++requestIdRef.current;
    const isInitialLoad = !hasLoadedRef.current;

    if (isInitialLoad) {
      setIsLoading(true);
    } else if (!options?.silent) {
      setIsRefreshing(true);
    }

    try {
      const result = await fetchAdminHubItemsByApi({
        q: deferredSearch.trim() || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        type: typeFilter === "ALL" ? undefined : typeFilter,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setContents(result.items);
      setStats(result.stats);
      setHasError(false);
      hasLoadedRef.current = true;
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setHasError(true);
      setContents([]);
      setStats(EMPTY_STATS);
    } finally {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (isInitialLoad) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }

  useEffect(() => {
    void loadData();
  }, [deferredSearch, statusFilter, typeFilter]);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => contents.some((item) => item.id === id)),
    );
  }, [contents]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  };

  const toggleSelected = (contentId: string) => {
    setSelectedIds((prev) =>
      prev.includes(contentId)
        ? prev.filter((id) => id !== contentId)
        : [...prev, contentId],
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? [] : contents.map((item) => item.id));
  };

  const reloadAfterMutation = async () => {
    await loadData({ silent: true });
  };

  const handleStatusChange = async (
    content: AdminHubItem,
    nextStatus: ContentStatus,
  ) => {
    setBusyKey(content.id);
    try {
      if (nextStatus === "PUBLISHED") {
        await approveAdminHubItemByApi(content.id);
      } else if (nextStatus === "DRAFT") {
        await moveAdminHubItemToDraftByApi(content.id);
      }

      await reloadAfterMutation();
      toast.success(`${t("admin_hub.status_updated")} ${formatStatus(nextStatus)}`);
    } catch (error: any) {
      toast.error(error?.message || t("api.request_failed"));
    } finally {
      setBusyKey(null);
    }
  };

  const handleRejectWithReason = async (content: AdminHubItem) => {
    setBusyKey(content.id);
    try {
      await rejectAdminHubItemByApi(
        content.id,
        rejectReason || t("admin_hub.no_reason"),
      );
      await reloadAfterMutation();
      toast.success(t("admin_hub.content_rejected"));
    } catch (error: any) {
      toast.error(error?.message || t("api.request_failed"));
    } finally {
      setBusyKey(null);
      setRejectingId(null);
      setRejectReason("");
    }
  };

  const handleSaveEdit = async (content: AdminHubItem) => {
    setBusyKey(content.id);
    try {
      await updateAdminHubItemByApi(content.id, {
        title: editTitle,
        description: editDesc,
      });
      await reloadAfterMutation();
      toast.success(t("admin_hub.content_updated"));
      setEditingId(null);
    } catch (error: any) {
      toast.error(error?.message || t("api.request_failed"));
    } finally {
      setBusyKey(null);
    }
  };

  const handleBatchAction = async (action: "approve" | "reject" | "draft") => {
    if (selectedIds.length === 0) {
      return;
    }

    setBusyKey("batch");
    try {
      await batchUpdateAdminHubItemsByApi({
        ids: selectedIds,
        action,
        reason:
          action === "reject"
            ? bulkRejectReason || t("admin_hub.no_reason")
            : undefined,
      });
      setSelectedIds([]);
      if (action === "reject") {
        setBulkRejectReason("");
      }
      await reloadAfterMutation();
      toast.success(t("admin_hub.bulk_action_completed"));
    } catch (error: any) {
      toast.error(error?.message || t("api.request_failed"));
    } finally {
      setBusyKey(null);
    }
  };

  if (hasError) return <ErrorState onRetry={() => void loadData()} />;
  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin_hub.content_management")}
        description={t("admin_hub.manage_all_content")}
      >
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
          >
            <Shield className="mr-1 h-3 w-3" />
            {t("admin_hub.admin")}
          </Badge>
          {isRefreshing ? (
            <Badge
              variant="outline"
              className="border-white/10 bg-white/5 text-zinc-300"
            >
              {t("admin_hub.refreshing")}
            </Badge>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {STATUS_OPTIONS.map((status) => {
          const count = stats[getStatsKey(status)];
          return (
            <button
              key={status}
              onClick={() =>
                setStatusFilter(statusFilter === status ? "ALL" : status)
              }
              data-testid={`admin-hub-stat-${status.toLowerCase()}`}
              className={`rounded-xl border p-4 text-left transition-all ${
                statusFilter === status
                  ? "border-indigo-500/50 bg-indigo-500/10"
                  : "border-white/10 bg-zinc-900/50 hover:border-white/20"
              }`}
            >
              <p className="mt-1 text-xs uppercase tracking-wider text-zinc-400">
                {formatStatus(status)}
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-100">{count}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t("admin_hub.search_placeholder")}
            className="md:max-w-xs"
          />
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as ContentType | "ALL")
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
            {hasActiveFilters ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-300"
                onClick={clearFilters}
              >
                {t("common.clear")}
              </Button>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="text-sm text-zinc-400"
              data-testid="admin-hub-results-count"
            >
              {contents.length} {t("admin_hub.results_count")}
            </span>
            <div className="flex overflow-hidden rounded-lg border border-white/10">
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

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex items-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-white/15 bg-zinc-950 text-indigo-500 focus:ring-indigo-500"
              data-testid="admin-hub-select-all"
            />
            {t("admin_hub.select_all_visible")}
          </label>
          {selectedIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 md:min-w-[560px]">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <span className="text-sm text-zinc-100">
                  {selectedIds.length} {t("admin_hub.selected_count")}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => void handleBatchAction("approve")}
                    disabled={busyKey === "batch"}
                    data-testid="admin-hub-bulk-approve"
                  >
                    {t("admin_hub.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => void handleBatchAction("draft")}
                    disabled={busyKey === "batch"}
                    data-testid="admin-hub-bulk-draft"
                  >
                    {t("admin_hub.unpublish")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => void handleBatchAction("reject")}
                    disabled={busyKey === "batch"}
                    data-testid="admin-hub-bulk-reject"
                  >
                    {t("admin_hub.reject")}
                  </Button>
                </div>
              </div>
              <Input
                value={bulkRejectReason}
                onChange={(event) => setBulkRejectReason(event.target.value)}
                placeholder={t("admin_hub.reject_reason_optional")}
                className="h-9 text-sm"
                data-testid="admin-hub-bulk-reject-reason"
              />
            </div>
          ) : null}
        </div>
      </div>

      {contents.length === 0 ? (
        <EmptyState
          title={t("admin_hub.no_content_found")}
          description={t("admin_hub.no_content_filter")}
        />
      ) : viewMode === "list" ? (
        <div className="space-y-3">
          {contents.map((content) => (
            <Card key={content.id} className="glass-panel">
              <CardContent className="flex items-center gap-4 p-4">
                <label className="self-start pt-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(content.id)}
                    onChange={() => toggleSelected(content.id)}
                    className="h-4 w-4 rounded border-white/15 bg-zinc-950 text-indigo-500 focus:ring-indigo-500"
                    data-testid={`admin-hub-select-${content.id}`}
                  />
                </label>
                {content.coverImage ? (
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                    <img
                      src={content.coverImage}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {content.type}
                    </Badge>
                    <StatusBadge status={content.status} />
                    {content.rejectReason ? (
                      <span className="text-[10px] italic text-red-400">
                        {t("admin_hub.reason_label")} {content.rejectReason}
                      </span>
                    ) : null}
                  </div>
                  {editingId === content.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        className="h-8 text-sm font-medium"
                        data-testid={`admin-hub-edit-title-${content.id}`}
                      />
                      <textarea
                        className="min-h-[60px] w-full resize-y rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        value={editDesc}
                        onChange={(event) => setEditDesc(event.target.value)}
                        data-testid={`admin-hub-edit-description-${content.id}`}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 border-emerald-500/30 text-[10px] text-emerald-400"
                          onClick={() => void handleSaveEdit(content)}
                          disabled={busyKey === content.id}
                          data-testid={`admin-hub-save-${content.id}`}
                        >
                          <Check className="h-2.5 w-2.5" />
                          {t("admin_hub.save")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px]"
                          onClick={() => setEditingId(null)}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="truncate font-medium text-zinc-100">
                        {content.title}
                      </p>
                      <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {content.author?.name || t("hub.unknown")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(content.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {content.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {content.likes}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {editingId !== content.id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100"
                        onClick={() => {
                          setEditingId(content.id);
                          setEditTitle(content.title);
                          setEditDesc(content.description);
                        }}
                        data-testid={`admin-hub-edit-${content.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    ) : null}
                    {content.status === "PENDING_REVIEW" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => void handleStatusChange(content, "PUBLISHED")}
                          disabled={busyKey === content.id}
                          data-testid={`admin-hub-approve-${content.id}`}
                        >
                          {t("admin_hub.approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() =>
                            setRejectingId(
                              rejectingId === content.id ? null : content.id,
                            )
                          }
                          disabled={busyKey === content.id}
                          data-testid={`admin-hub-reject-${content.id}`}
                        >
                          {t("admin_hub.reject")}
                        </Button>
                      </>
                    ) : null}
                    {content.status === "PUBLISHED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => void handleStatusChange(content, "DRAFT")}
                        disabled={busyKey === content.id}
                        data-testid={`admin-hub-unpublish-${content.id}`}
                      >
                        {t("admin_hub.unpublish")}
                      </Button>
                    ) : null}
                  </div>
                  {rejectingId === content.id ? (
                    <div className="flex w-full items-center gap-2">
                      <Input
                        placeholder={t("admin_hub.reject_reason_optional")}
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        className="h-7 flex-1 text-xs"
                        autoFocus
                        data-testid={`admin-hub-reject-reason-${content.id}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-red-500/30 text-xs text-red-400 hover:bg-red-500/10"
                        onClick={() => void handleRejectWithReason(content)}
                        disabled={busyKey === content.id}
                        data-testid={`admin-hub-confirm-reject-${content.id}`}
                      >
                        {t("admin_hub.confirm")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contents.map((content) => (
            <Card key={content.id} className="glass-panel">
              {content.coverImage ? (
                <div className="aspect-video w-full overflow-hidden bg-zinc-800">
                  <img
                    src={content.coverImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {content.type}
                    </Badge>
                    <StatusBadge status={content.status} />
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(content.id)}
                    onChange={() => toggleSelected(content.id)}
                    className="h-4 w-4 rounded border-white/15 bg-zinc-950 text-indigo-500 focus:ring-indigo-500"
                    data-testid={`admin-hub-select-${content.id}`}
                  />
                </div>
                <p className="line-clamp-2 font-medium text-zinc-100">
                  {content.title}
                </p>
                <p className="text-xs text-zinc-500">
                  {t("admin_hub.by")} {content.author?.name || t("hub.unknown")}
                </p>
                <div className="flex items-center gap-2 border-t border-white/5 pt-2">
                  {content.status === "PENDING_REVIEW" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => void handleStatusChange(content, "PUBLISHED")}
                        disabled={busyKey === content.id}
                        data-testid={`admin-hub-approve-${content.id}`}
                      >
                        {t("admin_hub.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() =>
                          setRejectingId(
                            rejectingId === content.id ? null : content.id,
                          )
                        }
                        disabled={busyKey === content.id}
                        data-testid={`admin-hub-reject-${content.id}`}
                      >
                        {t("admin_hub.reject")}
                      </Button>
                    </>
                  ) : null}
                  {content.status === "PUBLISHED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => void handleStatusChange(content, "DRAFT")}
                      disabled={busyKey === content.id}
                      data-testid={`admin-hub-unpublish-${content.id}`}
                    >
                      {t("admin_hub.unpublish")}
                    </Button>
                  ) : null}
                </div>
                {rejectingId === content.id ? (
                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder={t("admin_hub.reason_short")}
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      className="h-7 flex-1 text-xs"
                      data-testid={`admin-hub-reject-reason-${content.id}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-red-500/30 text-xs text-red-400"
                      onClick={() => void handleRejectWithReason(content)}
                      disabled={busyKey === content.id}
                      data-testid={`admin-hub-confirm-reject-${content.id}`}
                    >
                      {t("admin_hub.confirm")}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
