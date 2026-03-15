import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  Plus,
  Shield,
  Ticket,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../../components/ui/PageHeader";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/ui/StateDisplay";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useTranslation } from "../../hooks/useTranslation";
import {
  adminGenerateInvitesByApi,
  approveAdminReviewByApi,
  fetchAdminDashboardByApi,
  handleAdminReportApi,
  rejectAdminReviewByApi,
} from "../../lib/api";
import { usePageTitle } from "../../lib/usePageTitle";
import { formatRole } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";
import type {
  AdminDashboardStats,
  AdminReport,
  AdminReviewDashboardItem,
} from "../../types";

const EMPTY_STATS: AdminDashboardStats = {
  pendingReviewCount: 0,
  pendingReportCount: 0,
};

export function Review() {
  const { t } = useTranslation();
  usePageTitle(t("admin_review.content_review"));
  const { user } = useAuthStore();

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [reviewItems, setReviewItems] = useState<AdminReviewDashboardItem[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [inviteCount, setInviteCount] = useState(5);
  const [inviteExpDays, setInviteExpDays] = useState(30);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null);
  const [inviteGenerating, setInviteGenerating] = useState(false);

  async function loadAdminData() {
    setIsLoading(true);
    setLoadFailed(false);

    try {
      const dashboard = await fetchAdminDashboardByApi();
      setReviewItems(dashboard.reviewItems);
      setReports(dashboard.reports);
      setStats(dashboard.stats);
    } catch {
      setReviewItems([]);
      setReports([]);
      setStats(EMPTY_STATS);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  if (!user || user.role !== "ADMIN") return null;
  if (isLoading) return <LoadingSkeleton />;
  if (loadFailed) {
    return <ErrorState onRetry={() => void loadAdminData()} />;
  }

  const pendingReports = reports.filter((item) => item.status === "PENDING");

  const handleApprove = async (id: string) => {
    try {
      await approveAdminReviewByApi(id);
      setReviewItems((prev) => prev.filter((item) => item.id !== id));
      setStats((prev) => ({
        ...prev,
        pendingReviewCount: Math.max(0, prev.pendingReviewCount - 1),
      }));
      toast.success(t("admin_review.content_approved"));
    } catch {
      toast.error(t("api.request_failed"));
    }
  };

  const handleReject = async (id: string) => {
    if (rejectingId === id && rejectReason.trim()) {
      try {
        await rejectAdminReviewByApi(id, rejectReason.trim());
        setReviewItems((prev) => prev.filter((item) => item.id !== id));
        setStats((prev) => ({
          ...prev,
          pendingReviewCount: Math.max(0, prev.pendingReviewCount - 1),
        }));
        setRejectingId(null);
        setRejectReason("");
        toast.error(t("admin_review.content_rejected"));
      } catch {
        toast.error(t("api.request_failed"));
      }
      return;
    }

    setRejectingId(id);
    setRejectReason("");
  };

  const cancelReject = () => {
    setRejectingId(null);
    setRejectReason("");
  };

  const handleGenerateInvites = async () => {
    if (inviteCount < 1 || inviteCount > 100) {
      toast.error(t("admin_review.invite_count_range"));
      return;
    }

    setInviteGenerating(true);
    try {
      const result = await adminGenerateInvitesByApi({
        count: inviteCount,
        expiresInDays: inviteExpDays > 0 ? inviteExpDays : undefined,
      });
      const codes = result.map((item: any) =>
        typeof item === "string" ? item : item.code,
      );
      const firstItem = result[0];

      setGeneratedCodes(codes);
      setGeneratedExpiry(
        typeof firstItem === "object" && firstItem?.expiresAt
          ? firstItem.expiresAt
          : null,
      );
      toast.success(t("admin_review.invite_generated_ok"));
    } catch {
      toast.error(t("api.request_failed"));
    } finally {
      setInviteGenerating(false);
    }
  };

  const copyAllCodes = () => {
    void navigator.clipboard.writeText(generatedCodes.join("\n"));
    toast.success(t("admin_review.invite_copied"));
  };

  const handleReport = async (
    reportId: string,
    status: "RESOLVED" | "DISMISSED",
  ) => {
    try {
      await handleAdminReportApi(
        reportId,
        status.toLowerCase() as "resolved" | "dismissed",
        reportNotes[reportId]?.trim() || undefined,
      );
      setReports((prev) => prev.filter((item) => item.id !== reportId));
      setStats((prev) => ({
        ...prev,
        pendingReportCount: Math.max(0, prev.pendingReportCount - 1),
      }));
      setReportNotes((prev) => ({ ...prev, [reportId]: "" }));
      toast.success(t("admin_review.report_handled"));
    } catch {
      toast.error(t("api.request_failed"));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title={t("admin_review.admin_review_dash")}
        description={t("admin_review.review_desc")}
      >
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
          >
            <Shield className="mr-1 h-3 w-3" />
            {t("admin_hub.admin")}
          </Badge>
          <Link to="/admin/hub">
            <Button variant="outline" size="sm">
              {t("admin_hub.content_management")}
            </Button>
          </Link>
        </div>
      </PageHeader>

      <Card className="glass-panel border-indigo-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Ticket className="h-5 w-5 text-indigo-400" />
            {t("admin_review.invite_title")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("admin_review.invite_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">
                {t("admin_review.invite_count")}
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={inviteCount}
                onChange={(event) => setInviteCount(Number(event.target.value))}
                className="w-24"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">
                {t("admin_review.invite_expire_days")}
              </label>
              <Input
                type="number"
                min={0}
                value={inviteExpDays}
                onChange={(event) => setInviteExpDays(Number(event.target.value))}
                className="w-24"
                placeholder={t("admin_review.invite_never_expire_hint")}
              />
            </div>
            <Button
              onClick={handleGenerateInvites}
              disabled={inviteGenerating}
              className="bg-indigo-600 text-white hover:bg-indigo-500"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {inviteGenerating
                ? t("admin_review.generating")
                : t("admin_review.generate_btn")}
            </Button>
          </div>

          {generatedCodes.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">
                  {generatedCodes.length} {t("admin_review.codes_generated")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAllCodes}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {t("admin_review.copy_all")}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {generatedCodes.map((code) => (
                  <div
                    key={code}
                    className="flex items-center justify-between rounded-md border border-white/10 bg-zinc-900/60 px-3 py-2 font-mono text-sm"
                  >
                    <span className="select-all text-emerald-400">{code}</span>
                    <button
                      type="button"
                      className="ml-2 text-zinc-500 transition-colors hover:text-zinc-300"
                      onClick={() => {
                        void navigator.clipboard.writeText(code);
                        toast.success(t("admin_review.invite_copied"));
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {generatedExpiry ? (
                <p className="text-xs text-zinc-500">
                  {t("admin_review.invite_expires_at")}:{" "}
                  {new Date(generatedExpiry).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">
            {t("admin_review.pending_reviews")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {stats.pendingReviewCount} {t("admin_review.items_require_attention")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviewItems.length > 0 ? (
            <div className="space-y-4">
              {reviewItems.map((content) => {
                const author = content.author;
                const authorProfileHref = content.authorId
                  ? `/u/${content.authorId}`
                  : undefined;
                const authorDisplayName = author?.name || t("hub.unknown");
                const authorRole = author?.role ? formatRole(author.role) : null;
                const isRejectingThis = rejectingId === content.id;

                return (
                  <div
                    key={content.id}
                    className="rounded-lg border border-white/10 bg-zinc-900/50 p-6 transition-colors hover:bg-zinc-800/50"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {content.type}
                          </Badge>
                          {content.visibility === "EXPERTS_LEARNERS" ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 text-[10px] text-amber-400"
                            >
                              {t("admin_review.restricted")}
                            </Badge>
                          ) : null}
                          <span className="text-xs text-zinc-500">
                            {t("admin_review.submitted_on")}{" "}
                            {new Date(content.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-lg font-medium text-zinc-100">
                          {content.title}
                        </h3>
                        <p className="line-clamp-2 text-sm text-zinc-400">
                          {content.description}
                        </p>
                        <div className="flex items-center gap-2 pt-2">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <UserIcon className="h-3 w-3" />
                            {authorProfileHref ? (
                              <Link
                                to={authorProfileHref}
                                className="hover:text-indigo-400 hover:underline"
                              >
                                {authorDisplayName}
                              </Link>
                            ) : (
                              <span>{authorDisplayName}</span>
                            )}
                            {authorRole ? (
                              <span className="text-zinc-700">({authorRole})</span>
                            ) : null}
                          </div>
                          <span className="text-zinc-700">•</span>
                          <div className="flex flex-wrap gap-1">
                            {content.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-xs text-zinc-500">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 border-t border-white/5 pt-4 md:border-t-0 md:pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => void handleReject(content.id)}
                        >
                          <X className="h-4 w-4" />
                          {t("admin_review.reject")}
                        </Button>
                        <Button
                          size="sm"
                          data-testid={`review-approve-${content.id}`}
                          className="gap-1.5 bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-500"
                          onClick={() => void handleApprove(content.id)}
                        >
                          <Check className="h-4 w-4" />
                          {t("admin_review.approve")}
                        </Button>
                      </div>
                    </div>

                    {isRejectingThis ? (
                      <div className="mt-4 space-y-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                        <div className="flex items-center gap-2 text-sm text-red-400">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">
                            {t("admin_review.provide_reason")}
                          </span>
                        </div>
                        <textarea
                          value={rejectReason}
                          onChange={(event) => setRejectReason(event.target.value)}
                          placeholder={t("admin_review.reason_placeholder")}
                          className="w-full resize-none rounded-lg border border-red-500/20 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={cancelReject}>
                            {t("admin_review.cancel")}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 text-white hover:bg-red-500"
                            onClick={() => void handleReject(content.id)}
                            disabled={!rejectReason.trim()}
                          >
                            {t("admin_review.confirm_reject")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="h-8 w-8 text-zinc-500" />}
              title={t("admin_review.no_pending_title")}
              description={t("admin_review.no_pending_desc")}
            />
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">
            {t("admin_review.user_reports")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {stats.pendingReportCount} {t("admin_review.items_require_attention")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingReports.length > 0 ? (
            <div className="space-y-4">
              {pendingReports.map((report) => (
                <div
                  key={report.id}
                  className="space-y-4 rounded-lg border border-white/10 bg-zinc-900/50 p-6"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 text-amber-400"
                      >
                        {t("admin_review.pending_report")}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {report.targetType === "user" ? (
                      <Link to={`/messages?to=${report.targetId}`}>
                        <Button variant="outline" size="sm">
                          {t("admin_review.open_thread")}
                        </Button>
                      </Link>
                    ) : null}
                  </div>

                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <p className="text-zinc-300">
                      {t("admin_review.reporter")}:{" "}
                      <span className="text-indigo-400">
                        {report.reporterName || t("hub.unknown")}
                      </span>
                    </p>
                    <p className="text-zinc-300">
                      {t("admin_review.reported_user")}:{" "}
                      <span className="text-indigo-400">
                        {report.targetType}:{report.targetId.slice(0, 8)}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-200">
                      {t("admin_review.report_reason")}
                    </p>
                    <p className="text-sm text-zinc-400">{report.reason}</p>
                  </div>

                  <Input
                    value={reportNotes[report.id] || ""}
                    onChange={(event) =>
                      setReportNotes((prev) => ({
                        ...prev,
                        [report.id]: event.target.value,
                      }))
                    }
                    placeholder={t("admin_review.reason_placeholder")}
                  />

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                      onClick={() => void handleReport(report.id, "DISMISSED")}
                    >
                      {t("admin_review.dismiss_report")}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-500"
                      onClick={() => void handleReport(report.id, "RESOLVED")}
                    >
                      {t("admin_review.resolve_report")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8 text-zinc-500" />}
              title={t("admin_review.no_pending_reports_title")}
              description={t("admin_review.no_pending_reports_desc")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
