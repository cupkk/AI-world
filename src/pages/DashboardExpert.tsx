import { Link } from "react-router-dom";
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
import { StatusBadge } from "../components/ui/StatusBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { LoadingSkeleton, ErrorState } from "../components/ui/StateDisplay";
import { Avatar } from "../components/ui/Avatar";
import { formatRole } from "../lib/utils";
import { toast } from "sonner";
import { FileText, Eye, ThumbsUp, Plus, BrainCircuit, Upload, Settings, Users, UserPlus, MessageSquare, CheckCircle, XCircle, Handshake } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";
import { useTranslation } from "../hooks/useTranslation";
import { featureFlags } from "../lib/features";
import {
  getContentDetailHref,
  getContentDomainMeta,
  getOwnerDashboardContentHref,
  getContentPreviewSections,
} from "../lib/contentDomain";
import {
  fetchExpertDashboardByApi,
  updateApplicationStatusByApi,
} from "../lib/api";
import type {
  Content,
  ExpertDashboardApplication,
  ExpertDashboardOpportunity,
  ExpertDashboardStats,
  User,
} from "../types";

export function DashboardExpert() {
  const { t } = useTranslation();
  usePageTitle(t("page.dashboard"));
  const { user } = useAuthStore();

  const [myContents, setMyContents] = useState<Content[]>([]);
  const [projectContents, setProjectContents] = useState<ExpertDashboardOpportunity[]>([]);
  const [inboundApplications, setInboundApplications] = useState<ExpertDashboardApplication[]>([]);
  const [enterpriseConnections, setEnterpriseConnections] = useState<User[]>([]);
  const [stats, setStats] = useState<ExpertDashboardStats>({
    totalContentCount: 0,
    totalViews: 0,
    totalLikes: 0,
    pendingApplicantCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const dashboard = await fetchExpertDashboardByApi();
      setMyContents(dashboard.myContents);
      setProjectContents(dashboard.collaborationOpportunities);
      setInboundApplications(dashboard.inboundApplications);
      setEnterpriseConnections(dashboard.enterpriseConnections);
      setStats(dashboard.stats);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id]);

  if (!user || user.role !== "EXPERT") return null;
  if (hasError) return <ErrorState onRetry={loadData} />;
  if (isLoading) return <LoadingSkeleton />;

  const learnerApplicants = inboundApplications.filter(
    (application) => application.applicant.role === "LEARNER",
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("dashboard.title_expert")}
        description={`${t("dashboard.welcome")}, ${user.name}. ${t("dashboard.desc_expert")}`}
      />

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/publish">
          <Button variant="outline" className="gap-2 h-9">
            <Plus className="h-4 w-4" /> {t("dashboard.action_publish_research")}
          </Button>
        </Link>
        {featureFlags.assistant ? (
          <Link to="/assistant">
            <Button variant="outline" className="gap-2 h-9">
              <BrainCircuit className="h-4 w-4" /> {t("dashboard.action_assistant")}
            </Button>
          </Link>
        ) : null}
        {featureFlags.knowledgeBase ? (
          <Link to="/settings/knowledge-base">
            <Button variant="outline" className="gap-2 h-9">
              <Upload className="h-4 w-4" /> {t("dashboard.knowledge_base")}
            </Button>
          </Link>
        ) : null}
        <Link to="/settings/profile">
          <Button variant="outline" className="gap-2 h-9">
            <Settings className="h-4 w-4" /> {t("dashboard.action_edit_profile")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.stat_total_content")}
            </CardTitle>
            <FileText className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{stats.totalContentCount}</div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.stat_total_views")}
            </CardTitle>
            <Eye className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{stats.totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.stat_likes")}
            </CardTitle>
            <ThumbsUp className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{stats.totalLikes.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.stat_applicants")}
            </CardTitle>
            <UserPlus className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{stats.pendingApplicantCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* My Content */}
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100">{t("dashboard.my_content")}</CardTitle>
            <Link to="/publish">
              <Button variant="ghost" size="sm">{t("common.view_all")}</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {myContents.length > 0 ? myContents.map((content) => {
              const contentApps = inboundApplications.filter(a => a.targetId === content.id);
              const domainMeta = getContentDomainMeta(content.contentDomain, t);
              const DomainIcon = domainMeta.Icon;
              const previewSections = getContentPreviewSections(content, t);
              return (
                <Link
                  key={content.id}
                  to={getOwnerDashboardContentHref(content)}
                  className="block border-b border-white/10 pb-4 last:border-0 last:pb-0 hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-zinc-100">{content.title}</p>
                    <StatusBadge status={content.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <Badge
                      variant="outline"
                      className={`gap-1 text-[10px] border ${domainMeta.className}`}
                      data-testid={`expert-content-domain-${content.id}`}
                    >
                      <DomainIcon className="h-3 w-3" />
                      {domainMeta.label}
                    </Badge>
                    <span>{new Date(content.createdAt).toLocaleDateString()}</span>
                    {contentApps.length > 0 && (
                      <span className="text-indigo-400">{contentApps.length} {t("hub.apply")}</span>
                    )}
                  </div>
                  {previewSections.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {previewSections.slice(0, 2).map((section) => (
                        <div key={section.key}>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                            {section.label}
                          </p>
                          <p
                            className="text-xs text-zinc-400 line-clamp-1"
                            data-testid={`expert-content-preview-${content.id}-${section.key}`}
                          >
                            {section.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Link>
              );
            }) : (
              <p className="text-sm text-zinc-500 text-center py-4">{t("dashboard.no_content_publish")}</p>
            )}
          </CardContent>
        </Card>

        {/* Collaboration Feed - Enterprise needs filtered by visibility */}
        <Card className="glass-panel border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.1)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Handshake className="h-4 w-4 text-purple-400" /> {t("dashboard.collaboration_opps")}
            </CardTitle>
            <Link to="/hub?type=PROJECT">
              <Button variant="ghost" size="sm">{t("common.view_all")}</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {projectContents.length > 0 ? projectContents.map((content) => {
              const domainMeta = getContentDomainMeta(content.contentDomain, t);
              const DomainIcon = domainMeta.Icon;
              const previewSections = getContentPreviewSections(content, t);
              return (
                <Link
                  key={content.id}
                  to={getContentDetailHref(content)}
                  className="block border-b border-white/10 pb-4 last:border-0 last:pb-0 hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
                >
                  <p className="text-sm font-medium text-zinc-300 mb-1">{content.title}</p>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <Badge
                      variant="outline"
                      className={`gap-1 text-[10px] border ${domainMeta.className}`}
                      data-testid={`expert-collab-domain-${content.id}`}
                    >
                      <DomainIcon className="h-3 w-3" />
                      {domainMeta.label}
                    </Badge>
                    <span>
                      {t("dashboard.posted_by")} <span className="text-indigo-400">{content.author?.name || t("hub.unknown")}</span>
                    </span>
                    {content.visibility === "EXPERTS_LEARNERS" && (
                      <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">{t("dashboard.experts_only")}</Badge>
                    )}
                  </div>
                  {previewSections.length > 0 ? (
                    <div className="space-y-1.5">
                      {previewSections.slice(0, 2).map((section) => (
                        <div key={section.key}>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                            {section.label}
                          </p>
                          <p
                            className="text-sm text-zinc-400 line-clamp-2"
                            data-testid={`expert-collab-preview-${content.id}-${section.key}`}
                          >
                            {section.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Link>
              );
            }) : (
              <p className="text-sm text-zinc-500 text-center py-4">{t("dashboard.no_collab")}</p>
            )}
          </CardContent>
        </Card>

        {/* Assistants - LEARNER applicants */}
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-400" /> {t("dashboard.assistants")}
            </CardTitle>
            <Link to="/talent">
              <Button variant="ghost" size="sm">{t("dashboard.find_assistants")}</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {learnerApplicants.length > 0 ? learnerApplicants.map(({ applicant, ...app }) => {
              const matchedTargetContent = myContents.find(
                (content) => content.id === app.targetId,
              );
              const targetTitle =
                app.targetContentTitle ||
                app.target?.title ||
                matchedTargetContent?.title ||
                t("hub.unknown");
              const targetType =
                app.target?.contentType ||
                matchedTargetContent?.type ||
                "PROJECT";
              const targetId = app.target?.id || matchedTargetContent?.id || app.targetId;
              const targetStatus =
                app.target?.status ||
                matchedTargetContent?.status ||
                "PUBLISHED";
              const applicantSuspended = applicant.status === "suspended";
              const canManageApplication =
                app.status === "SUBMITTED" &&
                targetStatus === "PUBLISHED" &&
                !applicantSuspended;
              const targetDomainMeta = getContentDomainMeta(
                app.target?.contentDomain ||
                  matchedTargetContent?.contentDomain ||
                  "HUB_ITEM",
                t,
              );
              const TargetDomainIcon = targetDomainMeta.Icon;
              return (
                <div key={app.id} className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar src={applicant.avatar || ""} fallback={applicant.name.charAt(0)} className="h-8 w-8" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/u/${applicant.id}`} className="text-sm font-medium text-zinc-100 hover:text-indigo-400 transition-colors">
                          {applicant.name}
                        </Link>
                        <Badge variant="secondary" className="text-[10px]">{formatRole(applicant.role)}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-zinc-500">{t("dashboard.applied_to")}</span>
                        <Link
                          to={getContentDetailHref({
                            id: targetId,
                            type: targetType,
                          })}
                          className="truncate text-indigo-400 hover:text-indigo-300 hover:underline"
                          data-testid={`expert-application-target-${app.id}`}
                        >
                          {targetTitle}
                        </Link>
                        <Badge
                          variant="outline"
                          className={`gap-1 text-[10px] border ${targetDomainMeta.className}`}
                          data-testid={`expert-application-domain-${app.id}`}
                        >
                          <TargetDomainIcon className="h-3 w-3" />
                          {targetDomainMeta.label}
                        </Badge>
                        {targetStatus ? (
                          <span
                            data-testid={`expert-application-target-status-${app.id}`}
                          >
                            <StatusBadge
                              status={targetStatus}
                              className="text-[10px]"
                            />
                          </span>
                        ) : null}
                        {applicantSuspended ? (
                          <Badge
                            variant="outline"
                            className="border-red-500/30 text-[10px] text-red-300"
                            data-testid={`expert-application-applicant-status-${app.id}`}
                          >
                            {t("admin_review.audit_flag_applicant_suspended")}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <StatusBadge status={app.status === "SUBMITTED" ? "PENDING_REVIEW" : app.status === "ACCEPTED" ? "PUBLISHED" : "REJECTED"} />
                  </div>
                  {app.message && (
                    <p className="text-xs text-zinc-400 ml-11 mb-2 line-clamp-2">{app.message}</p>
                  )}
                  {canManageApplication && (
                    <div className="flex gap-2 ml-11">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        data-testid={`expert-approve-${app.id}`}
                        onClick={async () => { try { await updateApplicationStatusByApi(app.id, "accepted"); setInboundApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "ACCEPTED" } : a)); setStats(prev => ({ ...prev, pendingApplicantCount: Math.max(0, prev.pendingApplicantCount - 1) })); toast.success(t("dashboard.app_accepted")); } catch { toast.error(t("api.request_failed")); } }}>
                        <CheckCircle className="h-3 w-3" /> {t("dashboard.approve")}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                        data-testid={`expert-reject-${app.id}`}
                        onClick={async () => { try { await updateApplicationStatusByApi(app.id, "rejected"); setInboundApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "REJECTED" } : a)); setStats(prev => ({ ...prev, pendingApplicantCount: Math.max(0, prev.pendingApplicantCount - 1) })); toast.error(t("dashboard.app_rejected")); } catch { toast.error(t("api.request_failed")); } }}>
                        <XCircle className="h-3 w-3" /> {t("dashboard.decline")}
                      </Button>
                      <Link to={`/messages?to=${applicant.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-zinc-400">
                          <MessageSquare className="h-3 w-3" /> {t("dashboard.message")}
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="text-center py-4">
                <p className="text-sm text-zinc-500 mb-2">{t("dashboard.no_applicants")}</p>
                <p className="text-xs text-zinc-600">{t("dashboard.publish_to_attract")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enterprise Connections */}
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" /> {t("dashboard.enterprise_connections")}
            </CardTitle>
            <Link to="/talent">
              <Button variant="ghost" size="sm">{t("common.view_all")}</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {enterpriseConnections.map((eu) => (
              <Link
                key={eu.id}
                to={`/u/${eu.id}`}
                className="flex items-center gap-3 border-b border-white/10 pb-4 last:border-0 last:pb-0 hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
              >
                <Avatar
                  src={eu.avatar}
                  fallback={eu.name.charAt(0)}
                  className="h-10 w-10"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-300">{eu.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{eu.title}{eu.company ? ` - ${eu.company}` : ""}</p>
                </div>
                <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-[10px] shrink-0">
                  {t("common.view_all")}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
