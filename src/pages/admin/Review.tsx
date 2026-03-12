import { formatRole } from "../../lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "../../store/authStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, LoadingSkeleton, ErrorState } from "../../components/ui/StateDisplay";
import { Check, X, FileText, User as UserIcon, AlertTriangle, Shield, Ticket, Copy, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../../lib/usePageTitle";
import type { Content } from "../../types";
import {
  approveAdminReviewByApi,
  fetchAdminReviewQueueByApi,
  rejectAdminReviewByApi,
  fetchAdminReportsApi,
  handleAdminReportApi,
  adminGenerateInvitesByApi,
  fetchUserByIdApi,
  type AdminReport,
} from "../../lib/api";

import { useTranslation } from "../../hooks/useTranslation";
import type { User } from "../../types";

export function Review() {
  const { t } = useTranslation();
  usePageTitle(t("admin_review.content_review"));
  const { user } = useAuthStore();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [apiPendingContents, setApiPendingContents] = useState<Content[]>([]);
  const [apiReports, setApiReports] = useState<AdminReport[]>([]);
  const [authorsById, setAuthorsById] = useState<Record<string, User>>({});
  const [isLoading, setIsLoading] = useState(true);

  /* ── Invite code generation state ── */
  const [inviteCount, setInviteCount] = useState(5);
  const [inviteExpDays, setInviteExpDays] = useState(30);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null);
  const [inviteGenerating, setInviteGenerating] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAdminData() {
      setIsLoading(true);
      try {
        const [queue, reports] = await Promise.all([
          fetchAdminReviewQueueByApi(),
          fetchAdminReportsApi().catch(() => [] as AdminReport[]),
        ]);
        if (!active) return;
        const pendingQueue = queue.filter((item) => item.status === "PENDING_REVIEW");
        setApiPendingContents(pendingQueue);
        setApiReports(reports);
        const authors = await Promise.all(
          Array.from(new Set(pendingQueue.map((item) => item.authorId).filter(Boolean))).map((authorId) =>
            fetchUserByIdApi(authorId).catch(() => null),
          ),
        );
        if (!active) return;
        setAuthorsById(
          authors.reduce<Record<string, User>>((acc, author) => {
            if (author) acc[author.id] = author;
            return acc;
          }, {}),
        );
      } catch {
        if (!active) return;
        setApiPendingContents([]);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadAdminData();

    return () => {
      active = false;
    };
  }, []);

  if (!user || user.role !== "ADMIN") return null;
  if (isLoading) return <LoadingSkeleton />;

  const pendingContents = apiPendingContents;
  const pendingReports = apiReports.filter((r) => r.status === "PENDING");

  const handleApprove = async (id: string) => {
    try {
      await approveAdminReviewByApi(id);
      setApiPendingContents((prev) => prev.filter((item) => item.id !== id));
      toast.success(t("admin_review.content_approved"));
    } catch {
      toast.error(t("api.request_failed"));
    }
  };

  const handleReject = async (id: string) => {
    if (rejectingId === id && rejectReason.trim()) {
      try {
        await rejectAdminReviewByApi(id, rejectReason.trim());
        setApiPendingContents((prev) => prev.filter((item) => item.id !== id));
        setRejectingId(null);
        setRejectReason("");
        toast.error(t("admin_review.content_rejected"));
      } catch {
        toast.error(t("api.request_failed"));
      }
    } else {
      setRejectingId(id);
      setRejectReason("");
    }
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
      // result may be string[] (codes) or InviteCode[]
      const codes: string[] = result.map((item: any) => typeof item === "string" ? item : item.code);
      setGeneratedCodes(codes);
      // Try to extract expiry from first item or from known response shape
      const firstItem = result[0];
      setGeneratedExpiry(typeof firstItem === "object" && firstItem?.expiresAt ? firstItem.expiresAt : null);
      toast.success(t("admin_review.invite_generated_ok"));
    } catch {
      toast.error(t("api.request_failed"));
    } finally {
      setInviteGenerating(false);
    }
  };

  const copyAllCodes = () => {
    const text = generatedCodes.join("\n");
    navigator.clipboard.writeText(text);
    toast.success(t("admin_review.invite_copied"));
  };

  const handleReport = async (reportId: string, status: "RESOLVED" | "DISMISSED") => {
    try {
      await handleAdminReportApi(reportId, status.toLowerCase() as "resolved" | "dismissed", reportNotes[reportId]?.trim() || undefined);
      setApiReports((prev) => prev.filter((r) => r.id !== reportId));
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
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
            <Shield className="mr-1 h-3 w-3" />
            {t("admin_hub.admin")}
          </Badge>
          <Link to="/admin/hub">
            <Button variant="outline" size="sm">{t("admin_hub.content_management")}</Button>
          </Link>
        </div>
      </PageHeader>

      {/* ── Invite Code Generator ── */}
      <Card className="glass-panel border-indigo-500/20">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
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
              <label className="text-xs text-zinc-400">{t("admin_review.invite_count")}</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={inviteCount}
                onChange={(e) => setInviteCount(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">{t("admin_review.invite_expire_days")}</label>
              <Input
                type="number"
                min={0}
                value={inviteExpDays}
                onChange={(e) => setInviteExpDays(Number(e.target.value))}
                className="w-24"
                placeholder={t("admin_review.invite_never_expire_hint")}
              />
            </div>
            <Button
              onClick={handleGenerateInvites}
              disabled={inviteGenerating}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {inviteGenerating ? t("admin_review.generating") : t("admin_review.generate_btn")}
            </Button>
          </div>

          {generatedCodes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">
                  {generatedCodes.length} {t("admin_review.codes_generated")}
                </span>
                <Button variant="ghost" size="sm" onClick={copyAllCodes} className="text-indigo-400 hover:text-indigo-300">
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {t("admin_review.copy_all")}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {generatedCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md border border-white/10 bg-zinc-900/60 px-3 py-2 font-mono text-sm"
                  >
                    <span className="text-emerald-400 select-all">{code}</span>
                    <button
                      type="button"
                      className="ml-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(code);
                        toast.success(t("admin_review.invite_copied"));
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {generatedExpiry && (
                <p className="text-xs text-zinc-500">
                  {t("admin_review.invite_expires_at")}: {new Date(generatedExpiry).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t("admin_review.pending_reviews")}</CardTitle>
          <CardDescription className="text-zinc-400">
            {pendingContents.length} {t("admin_review.items_require_attention")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingContents.length > 0 ? (
            <div className="space-y-4">
              {pendingContents.map((content) => {
                const author = authorsById[content.authorId];
                const authorProfileHref = content.authorId ? `/u/${content.authorId}` : undefined;
                const authorDisplayName = author?.name || content.title || t("hub.unknown");
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
                          {content.visibility === "EXPERTS_LEARNERS" && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                              {t("admin_review.restricted")}
                            </Badge>
                          )}
                          <span className="text-xs text-zinc-500">
                            {t("admin_review.submitted_on")} {new Date(content.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-lg font-medium text-zinc-100">
                          {content.title}
                        </h3>
                        <p className="text-sm text-zinc-400 line-clamp-2">
                          {content.description}
                        </p>
                        <div className="flex items-center gap-2 pt-2">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <UserIcon className="h-3 w-3" />
                            {authorProfileHref ? (
                              <Link to={authorProfileHref} className="hover:text-indigo-400 hover:underline">
                                {authorDisplayName}
                              </Link>
                            ) : (
                              <span>{authorDisplayName}</span>
                            )}
                            {author ? (
                              <span className="text-zinc-700">({formatRole(author.role)})</span>
                            ) : null}
                          </div>
                          <span className="text-zinc-700">•</span>
                          <div className="flex flex-wrap gap-1">
                            {content.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-xs text-zinc-500">#{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 border-t border-white/5 pt-4 md:border-t-0 md:pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => handleReject(content.id)}
                        >
                          <X className="h-4 w-4" />
                          {t("admin_review.reject")}
                        </Button>
                        <Button
                          size="sm"
                          data-testid={`review-approve-${content.id}`}
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                          onClick={() => handleApprove(content.id)}
                        >
                          <Check className="h-4 w-4" />
                          {t("admin_review.approve")}
                        </Button>
                      </div>
                    </div>

                    {/* Reject reason input */}
                    {isRejectingThis && (
                      <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-red-400">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">{t("admin_review.provide_reason")}</span>
                        </div>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t("admin_review.reason_placeholder")}
                          className="w-full rounded-lg border border-red-500/20 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={cancelReject}>
                            {t("admin_review.cancel")}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-500 text-white"
                            onClick={() => handleReject(content.id)}
                            disabled={!rejectReason.trim()}
                          >
                            {t("admin_review.confirm_reject")}
                          </Button>
                        </div>
                      </div>
                    )}
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
          <CardTitle className="text-zinc-100">{t("admin_review.user_reports")}</CardTitle>
          <CardDescription className="text-zinc-400">
            {pendingReports.length} {t("admin_review.items_require_attention")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingReports.length > 0 ? (
            <div className="space-y-4">
              {pendingReports.map((report) => {
                return (
                  <div key={report.id} className="rounded-lg border border-white/10 bg-zinc-900/50 p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-amber-500/30 text-amber-400">{t("admin_review.pending_report")}</Badge>
                        <span className="text-xs text-zinc-500">
                          {new Date(report.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {report.targetType === "user" ? (
                        <Link to={`/messages?to=${report.targetId}`}>
                          <Button variant="outline" size="sm">{t("admin_review.open_thread")}</Button>
                        </Link>
                      ) : null}
                    </div>

                    <div className="grid gap-2 text-sm md:grid-cols-2">
                      <p className="text-zinc-300">
                        {t("admin_review.reporter")}: <span className="text-indigo-400">{report.reporterName || t("hub.unknown")}</span>
                      </p>
                      <p className="text-zinc-300">
                        {t("admin_review.reported_user")}: <span className="text-indigo-400">{report.targetType}:{report.targetId.slice(0, 8)}</span>
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm text-zinc-200 font-medium">{t("admin_review.report_reason")}</p>
                      <p className="text-sm text-zinc-400">{report.reason}</p>
                    </div>

                    <Input
                      value={reportNotes[report.id] || ""}
                      onChange={(e) => setReportNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                      placeholder={t("admin_review.reason_placeholder")}
                    />

                    <div className="flex gap-3 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                        onClick={() => handleReport(report.id, "DISMISSED")}
                      >
                        {t("admin_review.dismiss_report")}
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={() => handleReport(report.id, "RESOLVED")}
                      >
                        {t("admin_review.resolve_report")}
                      </Button>
                    </div>
                  </div>
                );
              })}
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
