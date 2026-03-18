import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  FolderKanban,
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
  applyApplicationAuditActionByApi,
  adminGenerateInvitesByApi,
  approveAdminReviewByApi,
  fetchApplicationAuditByApi,
  fetchAdminAuditLogsByApi,
  fetchAdminDashboardByApi,
  handleAdminReportApi,
  rejectAdminReviewByApi,
} from "../../lib/api";
import {
  getContentDetailHref,
  getContentDomainMeta,
  getContentPreviewSections,
} from "../../lib/contentDomain";
import { usePageTitle } from "../../lib/usePageTitle";
import { formatRole } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";
import type {
  AdminAuditLogItem,
  AdminDashboardStats,
  ApplicationAuditItem,
  AdminReport,
  AdminReviewDashboardItem,
} from "../../types";

const EMPTY_STATS: AdminDashboardStats = {
  pendingReviewCount: 0,
  pendingReportCount: 0,
};

const APPLICATION_AUDIT_STATUS_FILTERS = [
  "ALL",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
] as const;

const APPLICATION_AUDIT_TARGET_FILTERS = [
  "ALL",
  "PROJECT",
  "ENTERPRISE_NEED",
  "RESEARCH_PROJECT",
] as const;

const APPLICATION_AUDIT_FLAG_FILTERS = [
  "ALL",
  "STALE_SUBMITTED",
  "OWNER_MISSING",
  "TARGET_UNAVAILABLE",
  "TARGET_NOT_PUBLISHED",
  "APPLICANT_SUSPENDED",
  "OWNER_SUSPENDED",
] as const;

const APPLICATION_AUDIT_GOVERNANCE_FILTERS = [
  "ALL",
  "OPEN",
  "REVIEWED",
] as const;

type GovernanceActivityItem = {
  id: string;
  applicationId: string;
  action: string;
  rawAction: string;
  actorId: string;
  actorName?: string;
  createdAt: string;
  reason?: string;
  targetId?: string;
  targetTitle: string;
  targetType: string;
  targetContentType?: string;
  targetStatus?: string;
  applicantId?: string;
  applicantName?: string;
  ownerId?: string;
  ownerName?: string;
};

function formatApplicationAuditStatus(
  t: (key: string) => string,
  status: ApplicationAuditItem["status"],
) {
  switch (status) {
    case "ACCEPTED":
      return t("admin_review.audit_status_accepted");
    case "REJECTED":
      return t("admin_review.audit_status_rejected");
    default:
      return t("admin_review.audit_status_submitted");
  }
}

function formatApplicationAuditTargetType(
  t: (key: string) => string,
  targetType: string,
) {
  switch (targetType) {
    case "APPLICATION":
      return t("admin_review.audit_target_application");
    case "ENTERPRISE_NEED":
      return t("admin_review.audit_target_enterprise_need");
    case "HUB_ITEM":
      return t("admin_review.audit_target_hub_item");
    case "INVITE":
      return t("admin_review.audit_target_invite");
    case "RESEARCH_PROJECT":
      return t("admin_review.audit_target_research_project");
    case "REPORT":
      return t("admin_review.audit_target_report");
    case "USER":
      return t("admin_review.audit_target_user");
    case "USER_IDENTITY":
      return t("admin_review.audit_target_user_identity");
    default:
      return t("admin_review.audit_target_project");
  }
}

function getApplicationAuditStatusClass(status: ApplicationAuditItem["status"]) {
  switch (status) {
    case "ACCEPTED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "REJECTED":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
}

function formatApplicationAuditFlag(
  t: (key: string) => string,
  flag: NonNullable<ApplicationAuditItem["auditFlags"]>[number],
) {
  switch (flag) {
    case "STALE_SUBMITTED":
      return t("admin_review.audit_flag_stale_submitted");
    case "OWNER_MISSING":
      return t("admin_review.audit_flag_owner_missing");
    case "TARGET_NOT_PUBLISHED":
      return t("admin_review.audit_flag_target_not_published");
    case "APPLICANT_SUSPENDED":
      return t("admin_review.audit_flag_applicant_suspended");
    case "OWNER_SUSPENDED":
      return t("admin_review.audit_flag_owner_suspended");
    default:
      return t("admin_review.audit_flag_target_unavailable");
  }
}

function getApplicationAuditFlagClass(
  flag: NonNullable<ApplicationAuditItem["auditFlags"]>[number],
) {
  switch (flag) {
    case "STALE_SUBMITTED":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "OWNER_MISSING":
      return "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300";
    case "TARGET_NOT_PUBLISHED":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "APPLICANT_SUSPENDED":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "OWNER_SUSPENDED":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-red-500/30 bg-red-500/10 text-red-300";
  }
}

function formatApplicationAuditGovernanceState(
  t: (key: string) => string,
  state: NonNullable<ApplicationAuditItem["governanceState"]>,
) {
  return state === "REVIEWED"
    ? t("admin_review.audit_governance_reviewed")
    : t("admin_review.audit_governance_open");
}

function getApplicationAuditGovernanceStateClass(
  state: NonNullable<ApplicationAuditItem["governanceState"]>,
) {
  return state === "REVIEWED"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300";
}

function formatApplicationAuditGovernanceAction(
  t: (key: string) => string,
  action: string,
) {
  switch (action) {
    case "application_audit_mark_reviewed":
    case "MARK_REVIEWED":
      return t("admin_review.audit_action_mark_reviewed");
    case "approve":
      return t("admin_review.admin_audit_action_approve");
    case "admin_create_hub_item":
      return t("admin_review.admin_audit_action_admin_create_hub_item");
    case "generate_invite_codes":
      return t("admin_review.admin_audit_action_generate_invite_codes");
    case "REJECT_APPLICATION":
    case "application_audit_reject_application":
      return t("admin_review.audit_action_reject_application");
    case "REJECT_TARGET_CONTENT":
    case "application_audit_reject_target_content":
      return t("admin_review.audit_action_reject_target_content");
    case "reject":
      return t("admin_review.admin_audit_action_reject");
    case "SUSPEND_APPLICANT":
    case "application_audit_suspend_applicant":
      return t("admin_review.audit_action_suspend_applicant");
    case "SUSPEND_OWNER":
    case "application_audit_suspend_owner":
      return t("admin_review.audit_action_suspend_owner");
    case "report_dismissed":
      return t("admin_review.admin_audit_action_report_dismissed");
    case "report_resolved":
      return t("admin_review.admin_audit_action_report_resolved");
    case "update_hub_item":
      return t("admin_review.admin_audit_action_update_hub_item");
    case "update_user_status":
      return t("admin_review.admin_audit_action_update_user_status");
    default:
      return action
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

function normalizeGovernanceActivityAction(action: string) {
  switch (action) {
    case "application_audit_mark_reviewed":
      return "MARK_REVIEWED";
    case "application_audit_reject_application":
      return "REJECT_APPLICATION";
    case "application_audit_reject_target_content":
      return "REJECT_TARGET_CONTENT";
    case "application_audit_suspend_applicant":
      return "SUSPEND_APPLICANT";
    case "application_audit_suspend_owner":
      return "SUSPEND_OWNER";
    default:
      return action;
  }
}

function getGovernanceActivityTargetHref(activity: GovernanceActivityItem) {
  if (!activity.targetId) {
    return undefined;
  }

  if (
    activity.targetContentType &&
    (activity.targetType === "PROJECT" ||
      activity.targetType === "ENTERPRISE_NEED" ||
      activity.targetType === "RESEARCH_PROJECT" ||
      activity.targetType === "HUB_ITEM")
  ) {
    return getContentDetailHref({
      id: activity.targetId,
      type: activity.targetContentType as any,
    });
  }

  if (
    activity.targetType === "USER" ||
    activity.targetType === "USER_IDENTITY"
  ) {
    return `/u/${activity.targetId}`;
  }

  return undefined;
}

function canRejectTargetContent(item: ApplicationAuditItem) {
  if (item.auditFlags?.includes("TARGET_UNAVAILABLE")) {
    return false;
  }

  return item.target.status !== "REJECTED";
}

export function Review() {
  const { t, language } = useTranslation();
  usePageTitle(t("admin_review.content_review"));
  const { user } = useAuthStore();
  const usersLabel = language === "zh" ? "用户总览" : "User Directory";

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [reviewItems, setReviewItems] = useState<AdminReviewDashboardItem[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [applicationAudit, setApplicationAudit] = useState<ApplicationAuditItem[]>(
    [],
  );
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [auditLoadFailed, setAuditLoadFailed] = useState(false);
  const [auditLogLoadFailed, setAuditLogLoadFailed] = useState(false);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditStatusFilter, setAuditStatusFilter] = useState<
    "ALL" | ApplicationAuditItem["status"]
  >("ALL");
  const [auditTargetFilter, setAuditTargetFilter] = useState<
    "ALL" | ApplicationAuditItem["target"]["targetType"]
  >("ALL");
  const [auditFlagFilter, setAuditFlagFilter] = useState<
    "ALL" | NonNullable<ApplicationAuditItem["auditFlags"]>[number]
  >("ALL");
  const [auditGovernanceFilter, setAuditGovernanceFilter] = useState<
    "ALL" | NonNullable<ApplicationAuditItem["governanceState"]>
  >("ALL");
  const [governanceQuery, setGovernanceQuery] = useState("");
  const [governanceActionFilter, setGovernanceActionFilter] =
    useState<string>("ALL");
  const [auditActionKey, setAuditActionKey] = useState<string | null>(null);
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);

  const [inviteCount, setInviteCount] = useState(5);
  const [inviteExpDays, setInviteExpDays] = useState(30);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null);
  const [inviteGenerating, setInviteGenerating] = useState(false);

  async function loadAdminData() {
    setIsLoading(true);
    setLoadFailed(false);
    setAuditLoadFailed(false);
    setAuditLogLoadFailed(false);

    try {
      const [dashboardResult, auditResult, auditLogResult] =
        await Promise.allSettled([
        fetchAdminDashboardByApi(),
        fetchApplicationAuditByApi(),
        fetchAdminAuditLogsByApi(),
      ]);

      if (dashboardResult.status !== "fulfilled") {
        throw dashboardResult.reason;
      }

      const dashboard = dashboardResult.value;
      setReviewItems(dashboard.reviewItems);
      setReports(dashboard.reports);
      setStats(dashboard.stats);

      if (auditResult.status === "fulfilled") {
        setApplicationAudit(auditResult.value);
      } else {
        setApplicationAudit([]);
        setAuditLoadFailed(true);
      }

      if (auditLogResult.status === "fulfilled") {
        setAdminAuditLogs(auditLogResult.value);
      } else {
        setAdminAuditLogs([]);
        setAuditLogLoadFailed(true);
      }
    } catch {
      setReviewItems([]);
      setReports([]);
      setApplicationAudit([]);
      setAdminAuditLogs([]);
      setStats(EMPTY_STATS);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function reloadApplicationAudit() {
    try {
      const auditItems = await fetchApplicationAuditByApi();
      setApplicationAudit(auditItems);
      setAuditLoadFailed(false);
    } catch {
      setAuditLoadFailed(true);
    }
  }

  async function reloadAdminAuditLogs() {
    try {
      const auditLogs = await fetchAdminAuditLogsByApi();
      setAdminAuditLogs(auditLogs);
      setAuditLogLoadFailed(false);
    } catch {
      setAuditLogLoadFailed(true);
    }
  }

  async function reloadAuditReadModels() {
    await Promise.allSettled([reloadApplicationAudit(), reloadAdminAuditLogs()]);
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  useEffect(() => {
    setSelectedAuditIds((prev) =>
      prev.filter((id) => applicationAudit.some((item) => item.id === id)),
    );
  }, [applicationAudit]);

  const auditStatusCounts = useMemo(
    () => ({
      SUBMITTED: applicationAudit.filter((item) => item.status === "SUBMITTED")
        .length,
      ACCEPTED: applicationAudit.filter((item) => item.status === "ACCEPTED")
        .length,
      REJECTED: applicationAudit.filter((item) => item.status === "REJECTED")
        .length,
    }),
    [applicationAudit],
  );
  const auditGovernanceCounts = useMemo(
    () => ({
      OPEN: applicationAudit.filter(
        (item) => (item.governanceState ?? "OPEN") === "OPEN",
      ).length,
      REVIEWED: applicationAudit.filter(
        (item) => item.governanceState === "REVIEWED",
      ).length,
    }),
    [applicationAudit],
  );

  const governanceActivities = useMemo<GovernanceActivityItem[]>(
    () =>
      adminAuditLogs
        .map((item) => {
          const target = item.target ?? item.application?.target;
          const applicant = item.application?.applicant;
          const owner = item.application?.owner;
          return {
            id: item.id,
            applicationId: item.application?.id ?? "",
            action: normalizeGovernanceActivityAction(item.action),
            rawAction: item.action,
            actorId: item.actorId,
            actorName: item.actor?.name || item.actorId,
            createdAt: item.createdAt,
            reason: item.reason,
            targetId: target?.id ?? item.targetId,
            targetTitle:
              target?.title ||
              item.targetType ||
              t("admin_review.governance_unknown_target"),
            targetType: target?.targetType || item.targetType || "APPLICATION",
            targetContentType: target?.contentType,
            targetStatus: target?.status,
            applicantId: applicant?.id,
            applicantName: applicant?.name,
            ownerId: owner?.id,
            ownerName: owner?.name,
          };
        })
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        ),
    [adminAuditLogs, t],
  );
  const governanceActionFilters = useMemo(
    () => ["ALL", ...Array.from(new Set(governanceActivities.map((item) => item.action)))],
    [governanceActivities],
  );
  const selectedAuditSet = useMemo(
    () => new Set(selectedAuditIds),
    [selectedAuditIds],
  );
  const filteredAuditItems = useMemo(() => {
    const normalizedQuery = auditQuery.trim().toLowerCase();

    return applicationAudit.filter((item) => {
      const matchesStatus =
        auditStatusFilter === "ALL" || item.status === auditStatusFilter;
      const matchesTarget =
        auditTargetFilter === "ALL" || item.target.targetType === auditTargetFilter;
      const matchesFlag =
        auditFlagFilter === "ALL" ||
        Boolean(item.auditFlags?.includes(auditFlagFilter));
      const matchesGovernance =
        auditGovernanceFilter === "ALL" ||
        (item.governanceState ?? "OPEN") === auditGovernanceFilter;

      if (!matchesStatus || !matchesTarget || !matchesFlag || !matchesGovernance) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        item.targetContentTitle,
        item.target.title,
        item.applicant.name,
        item.applicant.email,
        item.owner?.name,
        item.owner?.email,
        item.message,
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [
    applicationAudit,
    auditQuery,
    auditStatusFilter,
    auditTargetFilter,
    auditFlagFilter,
    auditGovernanceFilter,
  ]);

  const filteredGovernanceActivities = useMemo(() => {
    const normalizedQuery = governanceQuery.trim().toLowerCase();

    return governanceActivities.filter((item) => {
      const matchesAction =
        governanceActionFilter === "ALL" || item.action === governanceActionFilter;

      const matchesQuery =
        !normalizedQuery ||
        item.action.toLowerCase().includes(normalizedQuery) ||
        item.rawAction.toLowerCase().includes(normalizedQuery) ||
        item.actorName?.toLowerCase().includes(normalizedQuery) ||
        item.actorId.toLowerCase().includes(normalizedQuery) ||
        item.targetTitle.toLowerCase().includes(normalizedQuery) ||
        item.applicantName?.toLowerCase().includes(normalizedQuery) ||
        item.ownerName?.toLowerCase().includes(normalizedQuery) ||
        item.reason?.toLowerCase().includes(normalizedQuery);

      return matchesAction && matchesQuery;
    });
  }, [governanceActivities, governanceActionFilter, governanceQuery]);
  const visibleAuditIds = useMemo(
    () => filteredAuditItems.map((item) => item.id),
    [filteredAuditItems],
  );
  const selectedAuditItems = useMemo(
    () => applicationAudit.filter((item) => selectedAuditSet.has(item.id)),
    [applicationAudit, selectedAuditSet],
  );
  const allVisibleAuditSelected =
    visibleAuditIds.length > 0 &&
    visibleAuditIds.every((id) => selectedAuditSet.has(id));
  const pendingReports = reports.filter((item) => item.status === "PENDING");

  if (!user || user.role !== "ADMIN") return null;
  if (isLoading) return <LoadingSkeleton />;
  if (loadFailed) {
    return <ErrorState onRetry={() => void loadAdminData()} />;
  }

  const handleApprove = async (id: string) => {
    try {
      await approveAdminReviewByApi(id);
      setReviewItems((prev) => prev.filter((item) => item.id !== id));
      setStats((prev) => ({
        ...prev,
        pendingReviewCount: Math.max(0, prev.pendingReviewCount - 1),
      }));
      await reloadAdminAuditLogs();
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
        await reloadAdminAuditLogs();
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
      await reloadAdminAuditLogs();
      toast.success(t("admin_review.report_handled"));
    } catch {
      toast.error(t("api.request_failed"));
    }
  };

  const toggleAuditSelection = (id: string) => {
    setSelectedAuditIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  };

  const toggleVisibleAuditSelection = () => {
    setSelectedAuditIds((prev) => {
      if (allVisibleAuditSelected) {
        return prev.filter((id) => !visibleAuditIds.includes(id));
      }

      return [...new Set([...prev, ...visibleAuditIds])];
    });
  };

  const clearAuditSelection = () => {
    setSelectedAuditIds([]);
  };

  const handleAuditAction = async (
    ids: string[],
    action:
      | "MARK_REVIEWED"
      | "REJECT_APPLICATION"
      | "REJECT_TARGET_CONTENT"
      | "SUSPEND_APPLICANT"
      | "SUSPEND_OWNER",
  ) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) {
      toast.error(t("admin_review.audit_batch_no_eligible"));
      return;
    }

    const actionKey = `${action}:${uniqueIds.join(",")}`;
    setAuditActionKey(actionKey);

    try {
      await applyApplicationAuditActionByApi({
        ids: uniqueIds,
        action,
      });
      await reloadAuditReadModels();
      setSelectedAuditIds([]);
      toast.success(t("admin_review.audit_action_completed"));
    } catch {
      toast.error(t("api.request_failed"));
    } finally {
      setAuditActionKey(null);
    }
  };

  const handleBatchAuditAction = async (
    action:
      | "MARK_REVIEWED"
      | "REJECT_APPLICATION"
      | "REJECT_TARGET_CONTENT"
      | "SUSPEND_APPLICANT"
      | "SUSPEND_OWNER",
  ) => {
    const eligibleIds = selectedAuditItems
      .filter((item) => {
        switch (action) {
          case "MARK_REVIEWED":
            return (item.governanceState ?? "OPEN") !== "REVIEWED";
          case "REJECT_APPLICATION":
            return item.status === "SUBMITTED";
          case "REJECT_TARGET_CONTENT":
            return canRejectTargetContent(item);
          case "SUSPEND_OWNER":
            return Boolean(item.owner?.id);
          default:
            return true;
        }
      })
      .map((item) => item.id);

    await handleAuditAction(eligibleIds, action);
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
          <Link to="/admin/users">
            <Button variant="outline" size="sm">
              {usersLabel}
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
                const domainMeta = getContentDomainMeta(content.contentDomain, t);
                const DomainIcon = domainMeta.Icon;
                const previewSections = getContentPreviewSections(content, t);

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
                          <Badge
                            variant="outline"
                            className={`gap-1 text-[10px] border ${domainMeta.className}`}
                            data-testid={`review-domain-${content.id}`}
                          >
                            <DomainIcon className="h-3 w-3" />
                            {domainMeta.label}
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
                        {previewSections.length > 0 ? (
                          <div className="space-y-1">
                            {previewSections.slice(0, 2).map((section) => (
                              <div key={section.key}>
                                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                  {section.label}
                                </p>
                                <p
                                  className="line-clamp-2 text-sm text-zinc-400"
                                  data-testid={`review-preview-${content.id}-${section.key}`}
                                >
                                  {section.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
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
                          data-testid={`review-reject-${content.id}`}
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
                          data-testid={`review-reject-reason-${content.id}`}
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
                            data-testid={`review-confirm-reject-${content.id}`}
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
                    <Badge variant="outline" className="border-white/10 text-zinc-300">
                      {report.targetType}
                    </Badge>
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
                        {report.targetUserName || `${report.targetType}:${report.targetId.slice(0, 8)}`}
                      </span>
                    </p>
                  </div>

                  {report.targetParticipantNames && report.targetParticipantNames.length > 0 ? (
                    <p className="text-sm text-zinc-400">
                      {report.targetParticipantNames.join(" / ")}
                    </p>
                  ) : null}

                  {report.targetMessagePreview ? (
                    <div className="rounded-lg border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-300">
                      {report.targetMessagePreview}
                    </div>
                  ) : null}

                  {report.targetUserId ? (
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/u/${report.targetUserId}`}>
                        <Button variant="outline" size="sm">
                          {t("common.profile")}
                        </Button>
                      </Link>
                      <Link to="/admin/users">
                        <Button variant="outline" size="sm">
                          {t("admin_review.open_user_admin")}
                        </Button>
                      </Link>
                    </div>
                  ) : null}

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

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <FolderKanban className="h-5 w-5 text-indigo-400" />
            {t("admin_review.application_audit")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("admin_review.application_audit_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/10 text-zinc-300">
              {applicationAudit.length} {t("admin_review.audit_rows")}
            </Badge>
            <Badge
              variant="outline"
              className="border-amber-500/20 text-amber-300"
            >
              {auditStatusCounts.SUBMITTED}{" "}
              {t("admin_review.audit_status_submitted")}
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-500/20 text-emerald-300"
            >
              {auditStatusCounts.ACCEPTED}{" "}
              {t("admin_review.audit_status_accepted")}
            </Badge>
            <Badge
              variant="outline"
              className="border-red-500/20 text-red-300"
            >
              {auditStatusCounts.REJECTED}{" "}
              {t("admin_review.audit_status_rejected")}
            </Badge>
            <Badge
              variant="outline"
              className="border-indigo-500/20 text-indigo-300"
            >
              {auditGovernanceCounts.OPEN}{" "}
              {t("admin_review.audit_governance_open")}
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-500/20 text-emerald-300"
            >
              {auditGovernanceCounts.REVIEWED}{" "}
              {t("admin_review.audit_governance_reviewed")}
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              value={auditQuery}
              onChange={(event) => setAuditQuery(event.target.value)}
              placeholder={t("admin_review.audit_search_placeholder")}
              data-testid="review-audit-search"
            />
            <div className="flex flex-wrap gap-2">
              {APPLICATION_AUDIT_STATUS_FILTERS.map((status) => {
                const isActive = auditStatusFilter === status;
                const label =
                  status === "ALL"
                    ? t("admin_review.audit_filter_all")
                    : formatApplicationAuditStatus(t, status);
                return (
                  <Button
                    key={status}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={
                      isActive
                        ? "bg-indigo-600 text-white hover:bg-indigo-500"
                        : ""
                    }
                    onClick={() => setAuditStatusFilter(status)}
                    data-testid={`review-audit-status-${status.toLowerCase()}`}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {APPLICATION_AUDIT_TARGET_FILTERS.map((targetType) => {
                const isActive = auditTargetFilter === targetType;
                const label =
                  targetType === "ALL"
                    ? t("admin_review.audit_target_all")
                    : formatApplicationAuditTargetType(t, targetType);
                return (
                  <Button
                    key={targetType}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={
                      isActive
                        ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                        : ""
                    }
                    onClick={() => setAuditTargetFilter(targetType)}
                    data-testid={`review-audit-target-${targetType.toLowerCase()}`}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {APPLICATION_AUDIT_FLAG_FILTERS.map((flag) => {
              const isActive = auditFlagFilter === flag;
              const label =
                flag === "ALL"
                  ? t("admin_review.audit_flag_all")
                  : formatApplicationAuditFlag(t, flag);
              return (
                <Button
                  key={flag}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={
                    isActive
                      ? "bg-amber-500 text-zinc-950 hover:bg-amber-400"
                      : ""
                  }
                  onClick={() => setAuditFlagFilter(flag)}
                  data-testid={`review-audit-flag-${flag.toLowerCase()}`}
                >
                  {label}
                </Button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {APPLICATION_AUDIT_GOVERNANCE_FILTERS.map((state) => {
              const isActive = auditGovernanceFilter === state;
              const label =
                state === "ALL"
                  ? t("admin_review.audit_governance_all")
                  : formatApplicationAuditGovernanceState(t, state);
              return (
                <Button
                  key={state}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={
                    isActive
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : ""
                  }
                  onClick={() => setAuditGovernanceFilter(state)}
                  data-testid={`review-audit-governance-${state.toLowerCase()}`}
                >
                  {label}
                </Button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-zinc-950/40 p-3">
            <Badge variant="outline" className="border-white/10 text-zinc-300">
              {selectedAuditIds.length} {t("admin_review.audit_selected_count")}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleVisibleAuditSelection}
              disabled={visibleAuditIds.length === 0}
              data-testid="review-audit-select-visible"
            >
              {allVisibleAuditSelected
                ? t("admin_review.audit_clear_visible_selection")
                : t("admin_review.audit_select_all_visible")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAuditSelection}
              disabled={selectedAuditIds.length === 0}
              data-testid="review-audit-clear-selection"
            >
              {t("admin_review.audit_clear_selection")}
            </Button>
            <div className="flex flex-wrap gap-2 lg:ml-auto">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  selectedAuditIds.length === 0 ||
                  auditActionKey !== null
                }
                onClick={() => void handleBatchAuditAction("MARK_REVIEWED")}
                data-testid="review-audit-batch-mark-reviewed"
              >
                {t("admin_review.audit_batch_mark_reviewed")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                disabled={
                  selectedAuditIds.length === 0 ||
                  auditActionKey !== null
                }
                onClick={() => void handleBatchAuditAction("REJECT_APPLICATION")}
                data-testid="review-audit-batch-reject-application"
              >
                {t("admin_review.audit_batch_reject_application")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
                disabled={
                  selectedAuditIds.length === 0 ||
                  auditActionKey !== null
                }
                onClick={() => void handleBatchAuditAction("REJECT_TARGET_CONTENT")}
                data-testid="review-audit-batch-reject-target-content"
              >
                {t("admin_review.audit_batch_reject_target_content")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                disabled={
                  selectedAuditIds.length === 0 ||
                  auditActionKey !== null
                }
                onClick={() => void handleBatchAuditAction("SUSPEND_APPLICANT")}
                data-testid="review-audit-batch-suspend-applicant"
              >
                {t("admin_review.audit_batch_suspend_applicant")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/10"
                disabled={
                  selectedAuditIds.length === 0 ||
                  auditActionKey !== null
                }
                onClick={() => void handleBatchAuditAction("SUSPEND_OWNER")}
                data-testid="review-audit-batch-suspend-owner"
              >
                {t("admin_review.audit_batch_suspend_owner")}
              </Button>
            </div>
          </div>

          {auditLoadFailed ? (
            <ErrorState onRetry={() => void loadAdminData()} />
          ) : filteredAuditItems.length > 0 ? (
            <div className="space-y-4">
              {filteredAuditItems.map((item) => {
                const applicantProfileHref = item.applicant?.id
                  ? `/u/${item.applicant.id}`
                  : undefined;
                const ownerProfileHref = item.owner?.id
                  ? `/u/${item.owner.id}`
                  : item.target.ownerId
                    ? `/u/${item.target.ownerId}`
                    : undefined;
                const governanceState = item.governanceState ?? "OPEN";
                const latestGovernanceAction = item.latestGovernanceAction;
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-white/10 bg-zinc-900/50 p-5"
                    data-testid={`review-audit-row-${item.id}`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-white/20 bg-zinc-950 text-indigo-500 focus:ring-indigo-500"
                          checked={selectedAuditSet.has(item.id)}
                          onChange={() => toggleAuditSelection(item.id)}
                          data-testid={`review-audit-select-${item.id}`}
                        />
                        <span>{t("admin_review.audit_select_row")}</span>
                      </label>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {formatApplicationAuditTargetType(
                              t,
                              item.target.targetType,
                            )}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getApplicationAuditStatusClass(item.status)}
                          >
                            {formatApplicationAuditStatus(t, item.status)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getApplicationAuditGovernanceStateClass(
                              governanceState,
                            )}
                          >
                            {formatApplicationAuditGovernanceState(
                              t,
                              governanceState,
                            )}
                          </Badge>
                          <span className="text-xs text-zinc-500">
                            {t("admin_review.audit_created_at")}{" "}
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                          {typeof item.ageInDays === "number" ? (
                            <span className="text-xs text-zinc-500">
                              · {item.ageInDays} {t("admin_review.audit_age_days")}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          <h3 className="text-lg font-medium text-zinc-100">
                            {item.targetContentTitle || item.target.title}
                          </h3>
                          <p className="text-sm text-zinc-400">
                            {t("admin_review.audit_target")}:{" "}
                            <span className="text-zinc-200">
                              {item.target.contentType}
                            </span>
                            {item.target.status ? (
                              <span className="text-zinc-500">
                                {" "}
                                · {item.target.status}
                              </span>
                            ) : null}
                          </p>
                        </div>

                        <div className="grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
                          <p>
                            {t("admin_review.audit_applicant")}:{" "}
                            {applicantProfileHref ? (
                              <Link
                                to={applicantProfileHref}
                                className="text-indigo-400 hover:underline"
                              >
                                {item.applicant.name}
                              </Link>
                            ) : (
                              <span className="text-indigo-400">
                                {item.applicant.name}
                              </span>
                            )}
                            <span className="text-zinc-500">
                              {" "}
                              ({formatRole(item.applicant.role)})
                            </span>
                          </p>
                          <p>
                            {t("admin_review.audit_owner")}:{" "}
                            {item.owner ? (
                              ownerProfileHref ? (
                                <Link
                                  to={ownerProfileHref}
                                  className="text-indigo-400 hover:underline"
                                >
                                  {item.owner.name}
                                </Link>
                              ) : (
                                <span className="text-indigo-400">
                                  {item.owner.name}
                                </span>
                              )
                            ) : (
                              <span className="text-zinc-500">
                                {t("hub.unknown")}
                              </span>
                            )}
                            {item.owner?.role ? (
                              <span className="text-zinc-500">
                                {" "}
                                ({formatRole(item.owner.role)})
                              </span>
                            ) : null}
                          </p>
                        </div>

                        {item.message ? (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-zinc-200">
                              {t("admin_review.audit_message")}
                            </p>
                            <p className="text-sm text-zinc-400">
                              {item.message}
                            </p>
                          </div>
                        ) : null}

                        {item.auditFlags && item.auditFlags.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {item.auditFlags.map((flag) => (
                              <Badge
                                key={`${item.id}-${flag}`}
                                variant="outline"
                                className={getApplicationAuditFlagClass(flag)}
                              >
                                {formatApplicationAuditFlag(t, flag)}
                              </Badge>
                            ))}
                          </div>
                        ) : null}

                        <div className="space-y-1">
                          <p className="text-sm font-medium text-zinc-200">
                            {t("admin_review.audit_latest_action")}
                          </p>
                          {latestGovernanceAction ? (
                            <p className="text-sm text-zinc-400">
                              {formatApplicationAuditGovernanceAction(
                                t,
                                latestGovernanceAction.action,
                              )}{" "}
                              ·{" "}
                              {latestGovernanceAction.actorName ||
                                latestGovernanceAction.actorId}{" "}
                              ·{" "}
                              {new Date(
                                latestGovernanceAction.createdAt,
                              ).toLocaleString()}
                              {latestGovernanceAction.reason ? (
                                <>
                                  {" "}
                                  · {latestGovernanceAction.reason}
                                </>
                              ) : null}
                            </p>
                          ) : (
                            <p className="text-sm text-zinc-500">
                              {t("admin_review.audit_no_governance_action")}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium text-zinc-200">
                            {t("admin_review.audit_timeline")}
                          </p>
                          {item.governanceTimeline &&
                          item.governanceTimeline.length > 0 ? (
                            <div className="space-y-1">
                              {item.governanceTimeline.map((entry, index) => (
                                <p
                                  key={`${item.id}-${entry.action}-${entry.createdAt}-${index}`}
                                  className="text-sm text-zinc-400"
                                  data-testid={`review-audit-timeline-${item.id}-${index}`}
                                >
                                  {formatApplicationAuditGovernanceAction(
                                    t,
                                    entry.action,
                                  )}{" "}
                                  · {entry.actorName || entry.actorId} ·{" "}
                                  {new Date(entry.createdAt).toLocaleString()}
                                  {entry.reason ? (
                                    <>
                                      {" "}
                                      · {entry.reason}
                                    </>
                                  ) : null}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-500">
                              {t("admin_review.audit_timeline_empty")}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              auditActionKey === `MARK_REVIEWED:${item.id}`
                            }
                            onClick={() =>
                              void handleAuditAction(
                                [item.id],
                                "MARK_REVIEWED",
                              )
                            }
                            data-testid={`review-audit-action-mark-reviewed-${item.id}`}
                          >
                            {t("admin_review.audit_action_mark_reviewed")}
                          </Button>
                          {item.status === "SUBMITTED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                              disabled={
                                auditActionKey ===
                                `REJECT_APPLICATION:${item.id}`
                              }
                              onClick={() =>
                                void handleAuditAction(
                                  [item.id],
                                  "REJECT_APPLICATION",
                                )
                              }
                              data-testid={`review-audit-action-reject-application-${item.id}`}
                            >
                              {t("admin_review.audit_action_reject_application")}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                            disabled={
                              auditActionKey ===
                              `SUSPEND_APPLICANT:${item.id}`
                            }
                            onClick={() =>
                              void handleAuditAction(
                                [item.id],
                                "SUSPEND_APPLICANT",
                              )
                            }
                            data-testid={`review-audit-action-suspend-applicant-${item.id}`}
                          >
                            {t("admin_review.audit_action_suspend_applicant")}
                          </Button>
                          {canRejectTargetContent(item) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
                              disabled={
                                auditActionKey ===
                                `REJECT_TARGET_CONTENT:${item.id}`
                              }
                              onClick={() =>
                                void handleAuditAction(
                                  [item.id],
                                  "REJECT_TARGET_CONTENT",
                                )
                              }
                              data-testid={`review-audit-action-reject-target-content-${item.id}`}
                            >
                              {t("admin_review.audit_action_reject_target_content")}
                            </Button>
                          ) : null}
                          {item.owner?.id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/10"
                              disabled={
                                auditActionKey === `SUSPEND_OWNER:${item.id}`
                              }
                              onClick={() =>
                                void handleAuditAction(
                                  [item.id],
                                  "SUSPEND_OWNER",
                                )
                              }
                              data-testid={`review-audit-action-suspend-owner-${item.id}`}
                            >
                              {t("admin_review.audit_action_suspend_owner")}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<FolderKanban className="h-8 w-8 text-zinc-500" />}
              title={t("admin_review.audit_no_results_title")}
              description={t("admin_review.audit_no_results_desc")}
            />
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Shield className="h-5 w-5 text-indigo-400" />
            {t("admin_review.governance_activity")}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("admin_review.governance_activity_desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/10 text-zinc-300">
              {governanceActivities.length}{" "}
              {t("admin_review.governance_activity_rows")}
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              value={governanceQuery}
              onChange={(event) => setGovernanceQuery(event.target.value)}
              placeholder={t("admin_review.governance_search_placeholder")}
              data-testid="review-governance-search"
            />
            <div className="flex flex-wrap gap-2">
              {governanceActionFilters.map((action) => {
                const isActive = governanceActionFilter === action;
                const label =
                  action === "ALL"
                    ? t("admin_review.governance_action_all")
                    : formatApplicationAuditGovernanceAction(t, action);
                return (
                  <Button
                    key={action}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={
                      isActive
                        ? "bg-indigo-600 text-white hover:bg-indigo-500"
                        : ""
                    }
                    onClick={() => setGovernanceActionFilter(action)}
                    data-testid={`review-governance-action-${action.toLowerCase()}`}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>

          {auditLogLoadFailed ? (
            <ErrorState onRetry={() => void reloadAdminAuditLogs()} />
          ) : filteredGovernanceActivities.length > 0 ? (
            <div className="space-y-3">
              {filteredGovernanceActivities.map((activity) => {
                const applicantProfileHref = activity.applicantId
                  ? `/u/${activity.applicantId}`
                  : undefined;
                const ownerProfileHref = activity.ownerId
                  ? `/u/${activity.ownerId}`
                  : undefined;
                const targetHref = getGovernanceActivityTargetHref(activity);

                return (
                  <div
                    key={activity.id}
                    className="rounded-lg border border-white/10 bg-zinc-900/50 p-4"
                    data-testid={`review-governance-row-${activity.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-indigo-500/30 text-indigo-300"
                      >
                        {formatApplicationAuditGovernanceAction(
                          t,
                          activity.action,
                        )}
                      </Badge>
                      <Badge variant="secondary">
                        {formatApplicationAuditTargetType(t, activity.targetType)}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        {new Date(activity.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-sm text-zinc-300">
                        {t("admin_review.governance_target")}:{" "}
                        {targetHref ? (
                          <Link
                            to={targetHref}
                            className="text-indigo-400 hover:underline"
                          >
                            {activity.targetTitle}
                          </Link>
                        ) : (
                          <span className="text-zinc-100">
                            {activity.targetTitle}
                          </span>
                        )}
                        {activity.targetStatus ? (
                          <span className="text-zinc-500">
                            {" "}
                            · {activity.targetStatus}
                          </span>
                        ) : null}
                      </p>
                      <div className="grid gap-2 text-sm text-zinc-300 md:grid-cols-3">
                        <p>
                          {t("admin_review.governance_actor")}:{" "}
                          <span className="text-zinc-100">
                            {activity.actorName || activity.actorId}
                          </span>
                        </p>
                        <p>
                          {t("admin_review.governance_applicant")}:{" "}
                          {activity.applicantName ? (
                            applicantProfileHref ? (
                              <Link
                                to={applicantProfileHref}
                                className="text-indigo-400 hover:underline"
                              >
                                {activity.applicantName}
                              </Link>
                            ) : (
                              <span className="text-indigo-400">
                                {activity.applicantName}
                              </span>
                            )
                          ) : (
                            <span className="text-zinc-500">
                              {t("hub.unknown")}
                            </span>
                          )}
                        </p>
                        <p>
                          {t("admin_review.governance_owner")}:{" "}
                          {activity.ownerName ? (
                            ownerProfileHref ? (
                              <Link
                                to={ownerProfileHref}
                                className="text-indigo-400 hover:underline"
                              >
                                {activity.ownerName}
                              </Link>
                            ) : (
                              <span className="text-indigo-400">
                                {activity.ownerName}
                              </span>
                            )
                          ) : (
                            <span className="text-zinc-500">
                              {t("hub.unknown")}
                            </span>
                          )}
                        </p>
                      </div>
                      {activity.reason ? (
                        <p className="text-sm text-zinc-400">
                          {t("admin_review.governance_reason")}:{" "}
                          <span className="text-zinc-300">
                            {activity.reason}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Shield className="h-8 w-8 text-zinc-500" />}
              title={t("admin_review.governance_no_results_title")}
              description={t("admin_review.governance_no_results_desc")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
