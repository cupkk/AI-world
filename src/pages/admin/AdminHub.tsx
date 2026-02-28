import { formatRole, formatStatus } from "../../lib/utils";
import { useState } from "react";
import { useDataStore } from "../../store/dataStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/StateDisplay";
import { SearchBar } from "../../components/ui/SearchBar";
import { TagFilter } from "../../components/ui/TagFilter";
import {
  Eye,
  Heart,
  Calendar,
  User,
  Shield,
  Filter,
  LayoutGrid,
  List,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { ContentStatus, ContentType } from "../../types";
import { usePageTitle } from "../../lib/usePageTitle";

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
  usePageTitle(t("admin_hub.content_management") || "Content Management");
  const { contents, users, updateContentStatus, updateContent } = useDataStore();

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
    return users.find((u) => u.id === authorId)?.name || "Unknown";
  };

  const handleStatusChange = (
    contentId: string,
    newStatus: ContentStatus
  ) => {
    updateContentStatus(contentId, newStatus);
    toast.success(`${t("admin_hub.status_updated")} ${formatStatus(newStatus)}`);
  };

  const handleRejectWithReason = (contentId: string) => {
    updateContentStatus(contentId, "REJECTED", rejectReason || undefined);
    toast.success(`${t("admin_hub.content_rejected")}`);
    setRejectingId(null);
    setRejectReason("");
  };

  const handleSaveEdit = (contentId: string) => {
    updateContent(contentId, { title: editTitle, description: editDesc });
    toast.success(t("admin_hub.content_updated") || "Content updated");
    setEditingId(null);
  };

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
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
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
          title="No Content Found"
          description="No content matches your current filters."
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
                      <span className="text-[10px] text-red-400 italic">Reason: {content.rejectReason}</span>
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
                          <Check className="h-2.5 w-2.5" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingId(null)}>Cancel</Button>
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
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => setRejectingId(rejectingId === content.id ? null : content.id)}
                        >
                          Reject
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
                        Unpublish
                      </Button>
                    )}
                  </div>
                  {/* Inline reject reason input */}
                  {rejectingId === content.id && (
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        placeholder="Rejection reason (optional)..."
                        value={rejectReason}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)}
                        className="h-7 text-xs flex-1"
                        autoFocus
                      />
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => handleRejectWithReason(content.id)}>
                        Confirm
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
                  by {getAuthorName(content.authorId)}
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
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => setRejectingId(rejectingId === content.id ? null : content.id)}
                      >
                        Reject
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
                      Unpublish
                    </Button>
                  )}
                </div>
                {rejectingId === content.id && (
                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder="Reason..."
                      value={rejectReason}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400" onClick={() => handleRejectWithReason(content.id)}>OK</Button>
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
