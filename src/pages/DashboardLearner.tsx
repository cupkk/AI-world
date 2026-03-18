import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useTranslation } from "../hooks/useTranslation";
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
import { PageHeader } from "../components/ui/PageHeader";
import { LoadingSkeleton, ErrorState } from "../components/ui/StateDisplay";
import {
  BookOpen,
  Award,
  Clock,
  BrainCircuit,
  Briefcase,
  Upload,
  Plus,
  Settings,
  FileText,
  GraduationCap,
  ExternalLink,
  Trophy,
  Send,
  Handshake,
} from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";
import { featureFlags } from "../lib/features";
import { toast } from "sonner";
import {
  getApplicationTargetTypeForContent,
  getContentDetailHref,
  getContentDomainMeta,
  getContentPreviewSections,
} from "../lib/contentDomain";
import {
  fetchLearnerDashboardByApi,
  submitApplicationByApi,
} from "../lib/api";
import type {
  ApplicationOutboxItem,
  Content,
  LearnerDashboardData,
  LearningResource,
} from "../types";

const EMPTY_DASHBOARD: LearnerDashboardData = {
  stats: {
    publishedContentCount: 0,
    availableContentCount: 0,
    pendingReviewCount: 0,
    applicationCount: 0,
  },
  learningResources: [],
  projectOpportunities: [],
  recommendedContents: [],
  myContents: [],
  applications: [],
};

function mapLearningResource(
  content: Content,
  t: (key: string) => string,
): LearningResource {
  const preview = getContentPreviewSections(content, t)[0]?.value ?? "";

  return {
    id: content.id,
    title: content.title,
    description: preview.slice(0, 120),
    url: `/hub/${content.type.toLowerCase()}/${content.id}`,
    type:
      content.type === "PAPER"
        ? "TUTORIAL"
        : content.type === "TOOL"
          ? "COURSE"
          : "PATH",
    source: "AI-World Hub",
    tags: content.tags ?? [],
    difficulty: "INTERMEDIATE",
  };
}

export function DashboardLearner() {
  const { t } = useTranslation();
  usePageTitle(t("nav.dashboard"));
  const { user } = useAuthStore();
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [dashboard, setDashboard] =
    useState<LearnerDashboardData>(EMPTY_DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const learningResources = dashboard.learningResources.map((content) =>
    mapLearningResource(content, t),
  );
  const myApplications = dashboard.applications.filter(
    (item) => item.applicantId === user?.id,
  );
  const getActiveApplication = (contentId: string) =>
    myApplications.find(
      (item) => item.targetId === contentId && item.status !== "REJECTED",
    );
  const getRejectedApplication = (contentId: string) =>
    myApplications.find(
      (item) => item.targetId === contentId && item.status === "REJECTED",
    );
  const alreadyApplied = (contentId: string) =>
    Boolean(getActiveApplication(contentId));

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    setHasError(false);

    try {
      const result = await fetchLearnerDashboardByApi();
      setDashboard(result);
    } catch {
      setHasError(true);
      setDashboard(EMPTY_DASHBOARD);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id]);

  if (!user || user.role !== "LEARNER") return null;
  if (hasError) return <ErrorState onRetry={() => void loadData()} />;
  if (isLoading) return <LoadingSkeleton />;

  const handleApply = async (contentId: string) => {
    const matchedContent =
      dashboard.projectOpportunities.find((item) => item.id === contentId) ??
      dashboard.recommendedContents.find((item) => item.id === contentId) ??
      dashboard.learningResources.find((item) => item.id === contentId);

    try {
      const app = await submitApplicationByApi({
        targetType: getApplicationTargetTypeForContent(
          matchedContent ?? { contentDomain: "HUB_ITEM" },
        ),
        targetId: contentId,
        message: applyMessage || undefined,
      });
      const nextApplication: ApplicationOutboxItem = {
        ...app,
        target: {
          id: contentId,
          targetType: app.targetType,
          contentType: matchedContent?.type ?? "PROJECT",
          contentDomain: matchedContent?.contentDomain ?? "HUB_ITEM",
          title: matchedContent?.title ?? "",
          status: matchedContent?.status,
          ownerId: matchedContent?.authorId ?? "",
        },
        targetContentTitle: matchedContent?.title ?? "",
      };

      setDashboard((prev) => {
        const existingIndex = prev.applications.findIndex(
          (item) =>
            item.id === nextApplication.id || item.targetId === contentId,
        );
        const applications =
          existingIndex >= 0
            ? prev.applications.map((item, index) =>
                index === existingIndex ? nextApplication : item,
              )
            : [...prev.applications, nextApplication];

        return {
          ...prev,
          applications,
          stats: {
            ...prev.stats,
            applicationCount:
              existingIndex >= 0
                ? prev.stats.applicationCount
                : prev.stats.applicationCount + 1,
          },
        };
      });
      toast.success(t("dashboard.app_submitted_success"));
    } catch (err: any) {
      toast.error(err?.message || t("api.request_failed"));
    }

    setApplyingTo(null);
    setApplyMessage("");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("dashboard.title_learner")}
        description={`${t("dashboard.welcome")}, ${user.name}. ${t("dashboard.desc_learner")}`}
      />

      <div className="flex flex-wrap gap-3">
        <Link to="/publish">
          <Button variant="outline" className="gap-2 h-9">
            <Plus className="h-4 w-4" /> {t("dashboard.action_publish")}
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
              <Upload className="h-4 w-4" /> {t("dashboard.action_upload")}
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
              {t("dashboard.stat_published")}
            </CardTitle>
            <Award className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
              <div
                className="text-2xl font-bold text-zinc-100"
                data-testid="learner-stat-published"
              >
                {dashboard.stats.publishedContentCount}
              </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.stat_available")}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
              <div
                className="text-2xl font-bold text-zinc-100"
                data-testid="learner-stat-available"
              >
                {dashboard.stats.availableContentCount}
              </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.stat_pending")}
            </CardTitle>
            <Clock className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
              <div
                className="text-2xl font-bold text-zinc-100"
                data-testid="learner-stat-pending"
              >
                {dashboard.stats.pendingReviewCount}
              </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {t("dashboard.stat_apps")}
            </CardTitle>
            <Trophy className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
              <div
                className="text-2xl font-bold text-zinc-100"
                data-testid="learner-stat-applications"
              >
                {dashboard.stats.applicationCount}
              </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="glass-panel border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.1)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-400" />{" "}
              {t("dashboard.learning_growth")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {learningResources.slice(0, 4).map((resource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between border-b border-white/10 pb-4 last:border-0 last:pb-0 hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-100 group-hover:text-indigo-400 transition-colors">
                    {resource.title}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
                    <span data-testid={`learner-learning-preview-${resource.id}`}>
                    {resource.description}
                    </span>
                  </p>
                  <div className="mt-1.5 flex gap-2 items-center">
                    <Badge variant="secondary" className="text-[10px]">
                      {resource.source}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        resource.difficulty === "BEGINNER"
                          ? "border-emerald-500/30 text-emerald-400"
                          : resource.difficulty === "INTERMEDIATE"
                            ? "border-amber-500/30 text-amber-400"
                            : "border-red-500/30 text-red-400"
                      }`}
                    >
                      {resource.difficulty.charAt(0) +
                        resource.difficulty.slice(1).toLowerCase()}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-white/10 text-zinc-500"
                    >
                      {resource.type === "PATH"
                        ? t("dashboard.learning_path")
                        : resource.type.charAt(0) +
                          resource.type.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 transition-colors shrink-0 ml-2" />
              </a>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="project-opps-title-clean text-zinc-100 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-indigo-400" />
              <span className="text-indigo-400">馃幆</span>{" "}
              {t("dashboard.project_opp")}
            </CardTitle>
            <Link to="/hub?type=PROJECT">
              <Button variant="ghost" size="sm">
                {t("common.view_all")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.projectOpportunities.length > 0 ? (
              dashboard.projectOpportunities.map((content) => (
                <div
                  key={content.id}
                  className="border-b border-white/10 pb-4 last:border-0 last:pb-0"
                >
                  {(() => {
                    const hasActiveApplication = alreadyApplied(content.id);
                    const rejectedApplication = getRejectedApplication(content.id);
                    const domainMeta = getContentDomainMeta(
                      content.contentDomain,
                      t,
                    );
                    const DomainIcon = domainMeta.Icon;
                    const previewSections = getContentPreviewSections(content, t);

                    return (
                  <div className="flex items-center justify-between hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors">
                    <Link
                      to={getContentDetailHref(content)}
                      className="flex-1 min-w-0"
                    >
                      <p className="font-medium text-zinc-100">{content.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`gap-1 text-[10px] border ${domainMeta.className}`}
                          data-testid={`learner-opportunity-domain-${content.id}`}
                        >
                          <DomainIcon className="h-3 w-3" />
                          {domainMeta.label}
                        </Badge>
                        {previewSections.length > 0 ? (
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                              {previewSections[0].label}
                            </p>
                            <p
                              className="text-xs text-zinc-400 line-clamp-1"
                              data-testid={`learner-opportunity-preview-${content.id}-${previewSections[0].key}`}
                            >
                              {previewSections[0].value}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase"
                      >
                        {content.type === "PROJECT"
                          ? t("hub.type.project")
                          : content.type}
                      </Badge>
                      {hasActiveApplication ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-500/30 text-emerald-400"
                        >
                          {t("hub.applied")}
                        </Badge>
                      ) : (
                        <>
                          {rejectedApplication ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-red-500/30 text-red-400"
                            >
                              {t("content.status.rejected")}
                            </Badge>
                          ) : null}
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                            onClick={(event) => {
                              event.preventDefault();
                              setApplyingTo(content.id);
                            }}
                            data-testid={`learner-apply-${content.id}`}
                          >
                            <Send className="h-3 w-3" /> {t("hub.apply")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                    );
                  })()}
                  {applyingTo === content.id ? (
                    <div className="mt-3 ml-2 p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 space-y-3">
                      <p className="text-xs text-zinc-300">
                        {t("hub.apply_desc")}
                      </p>
                      <Input
                        placeholder={t("hub.apply_placeholder")}
                        value={applyMessage}
                        onChange={(event) => setApplyMessage(event.target.value)}
                        className="h-8 text-xs"
                        data-testid={`learner-apply-message-${content.id}`}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => {
                            setApplyingTo(null);
                            setApplyMessage("");
                          }}
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                          onClick={() => void handleApply(content.id)}
                          data-testid={`learner-submit-application-${content.id}`}
                        >
                          {t("hub.submit_application")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500 text-center py-4">
                {t("dashboard.no_projects")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100">
              {t("dashboard.recommended")}
            </CardTitle>
            <Link to="/hub">
              <Button variant="ghost" size="sm">
                {t("common.view_all")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.recommendedContents.length > 0 ? (
              dashboard.recommendedContents.map((content) => {
                const domainMeta = getContentDomainMeta(content.contentDomain, t);
                const DomainIcon = domainMeta.Icon;
                const previewSections = getContentPreviewSections(content, t);
                return (
                  <Link
                    key={content.id}
                    to={getContentDetailHref(content)}
                    className="flex items-center justify-between border-b border-white/10 pb-4 last:border-0 last:pb-0 hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
                  >
                    <div>
                      <p className="font-medium text-zinc-100">{content.title}</p>
                      {previewSections.length > 0 ? (
                        <div className="mt-1">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                            {previewSections[0].label}
                          </p>
                          <p
                            className="text-xs text-zinc-400 line-clamp-1"
                            data-testid={`learner-recommended-preview-${content.id}-${previewSections[0].key}`}
                          >
                            {previewSections[0].value}
                          </p>
                        </div>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className={`gap-1 text-[10px] border ${domainMeta.className}`}
                          data-testid={`learner-recommended-domain-${content.id}`}
                        >
                          <DomainIcon className="h-3 w-3" />
                          {domainMeta.label}
                        </Badge>
                        {content.tags.slice(0, 2).map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
                    >
                      {t("hub.status.read")}
                    </Badge>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-zinc-500 text-center py-4">
                {t("dashboard.no_content")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Handshake className="h-5 w-5 text-indigo-400" />
              {t("dashboard.my_applications")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myApplications.length > 0 ? (
              myApplications.map((application) => {
                const domainMeta = getContentDomainMeta(
                  application.target.contentDomain,
                  t,
                );
                const DomainIcon = domainMeta.Icon;
                const targetStatus = application.target.status;
                const ownerSuspended = application.owner?.status === "suspended";
                return (
                  <div
                    key={application.id}
                    className="border-b border-white/10 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-zinc-500">
                            {t("dashboard.applied_to")}
                          </span>
                          <Link
                            to={getContentDetailHref({
                              id: application.target.id,
                              type: application.target.contentType,
                            })}
                            className="truncate font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                            data-testid={`learner-application-target-${application.id}`}
                          >
                            {application.targetContentTitle || application.target.title}
                          </Link>
                          <Badge
                            variant="outline"
                            className={`gap-1 text-[10px] border ${domainMeta.className}`}
                            data-testid={`learner-application-domain-${application.id}`}
                          >
                            <DomainIcon className="h-3 w-3" />
                            {domainMeta.label}
                          </Badge>
                          {targetStatus ? (
                            <span
                              data-testid={`learner-application-target-status-${application.id}`}
                            >
                              <StatusBadge
                                status={targetStatus}
                                className="text-[10px]"
                              />
                            </span>
                          ) : null}
                          {ownerSuspended ? (
                            <Badge
                              variant="outline"
                              className="border-red-500/30 text-[10px] text-red-300"
                              data-testid={`learner-application-owner-status-${application.id}`}
                            >
                              {t("admin_review.audit_flag_owner_suspended")}
                            </Badge>
                          ) : null}
                        </div>
                        {application.message ? (
                          <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                            {application.message}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-zinc-500">
                          {new Date(application.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        data-testid={`learner-application-status-${application.id}`}
                      >
                        <StatusBadge
                          status={
                            application.status === "SUBMITTED"
                              ? "PENDING_REVIEW"
                              : application.status === "ACCEPTED"
                                ? "PUBLISHED"
                                : "REJECTED"
                          }
                        />
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-zinc-500 text-center py-4">
                {t("dashboard.no_applications_sent")}
              </p>
            )}
          </CardContent>
        </Card>

        {dashboard.myContents.length > 0 ? (
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-zinc-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />{" "}
                {t("dashboard.my_submissions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.myContents.map((content) => {
                const domainMeta = getContentDomainMeta(content.contentDomain, t);
                const DomainIcon = domainMeta.Icon;
                const previewSections = getContentPreviewSections(content, t);
                return (
                  <Link
                    key={content.id}
                    to={`/publish/${content.id}`}
                    className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0 hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-100">{content.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`gap-1 text-[10px] border ${domainMeta.className}`}
                          data-testid={`learner-content-domain-${content.id}`}
                        >
                          <DomainIcon className="h-3 w-3" />
                          {domainMeta.label}
                        </Badge>
                        <p className="text-xs text-zinc-500">
                          {new Date(content.createdAt).toLocaleDateString()}
                        </p>
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
                                data-testid={`learner-content-preview-${content.id}-${section.key}`}
                              >
                                {section.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <StatusBadge status={content.status} />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
