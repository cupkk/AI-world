import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
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
import { BookOpen, Award, Clock, BrainCircuit, Upload, Plus, Settings, FileText, GraduationCap, ExternalLink, Trophy, Send } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";
import { toast } from "sonner";
import {
  fetchMyPublishContentsByApi,
  fetchHubContents,
  fetchMyApplicationsByApi,
  submitApplicationByApi,
} from "../lib/api";
import type { Content, Application, LearningResource } from "../types";

export function DashboardLearner() {
  const { t } = useTranslation();
  usePageTitle(t("nav.dashboard"));
  const { user } = useAuthStore();
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState("");

  const [contents, setContents] = useState<Content[]>([]);
  const [myContents, setMyContents] = useState<Content[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const learningResources: LearningResource[] = contents
    .filter((c) => c.status === "PUBLISHED" && (c.type === "PAPER" || c.type === "TOOL" || c.type === "PROJECT"))
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description?.slice(0, 120) || "",
      url: `/hub/${c.type.toLowerCase()}/${c.id}`,
      type: c.type === "PAPER" ? "TUTORIAL" as const : c.type === "TOOL" ? "COURSE" as const : "PATH" as const,
      source: "AI-World Hub",
      tags: c.tags ?? [],
      difficulty: "INTERMEDIATE" as const,
    }));

  const loadData = () => {
    if (!user) return;
    setIsLoading(true);
    setHasError(false);
    Promise.all([
      fetchMyPublishContentsByApi(),
      fetchHubContents(),
      fetchMyApplicationsByApi(),
    ]).then(([mine, all, apps]) => {
      setMyContents(mine);
      setContents(all);
      setApplications(apps);
    }).catch(() => {
      setHasError(true);
    }).finally(() => {
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  if (!user || user.role !== "LEARNER") return null;
  if (hasError) return <ErrorState onRetry={loadData} />;
  if (isLoading) return <LoadingSkeleton />;

  const myApplications = applications.filter((a) => a.applicantId === user.id);
  const alreadyApplied = (contentId: string) => myApplications.some(a => a.targetId === contentId);
  const recentContents = contents
    .filter((c) => c.status === "PUBLISHED")
    .slice(0, 3);
  const projectContents = contents
    .filter((c) => c.status === "PUBLISHED" && (c.type === "PROJECT" || c.type === "CONTEST"))
    .slice(0, 4);

  const handleApply = async (contentId: string) => {
    try {
      const app = await submitApplicationByApi({
        targetType: "PROJECT",
        targetId: contentId,
        message: applyMessage || undefined,
      });
      setApplications(prev => [...prev, app]);
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

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/publish">
          <Button variant="outline" className="gap-2 h-9">
            <Plus className="h-4 w-4" /> {t("dashboard.action_publish")}
          </Button>
        </Link>
        <Link to="/assistant">
          <Button variant="outline" className="gap-2 h-9">
            <BrainCircuit className="h-4 w-4" /> {t("dashboard.action_assistant")}
          </Button>
        </Link>
        <Link to="/settings/knowledge-base">
          <Button variant="outline" className="gap-2 h-9">
            <Upload className="h-4 w-4" /> {t("dashboard.action_upload")}
          </Button>
        </Link>
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
            <div className="text-2xl font-bold text-zinc-100">{myContents.filter(c => c.status === "PUBLISHED").length}</div>
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
            <div className="text-2xl font-bold text-zinc-100">{contents.filter(c => c.status === "PUBLISHED").length}</div>
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
            <div className="text-2xl font-bold text-zinc-100">{myContents.filter(c => c.status === "PENDING_REVIEW").length}</div>
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
            <div className="text-2xl font-bold text-zinc-100">{myApplications.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Learning & Growth */}
        <Card className="glass-panel border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.1)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-400" /> {t("dashboard.learning_growth")}
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
                  <p className="font-medium text-zinc-100 group-hover:text-indigo-400 transition-colors">{resource.title}</p>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{resource.description}</p>
                  <div className="mt-1.5 flex gap-2 items-center">
                    <Badge variant="secondary" className="text-[10px]">{resource.source}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${
                      resource.difficulty === "BEGINNER" ? "border-emerald-500/30 text-emerald-400" :
                      resource.difficulty === "INTERMEDIATE" ? "border-amber-500/30 text-amber-400" :
                      "border-red-500/30 text-red-400"
                    }`}>
                      {resource.difficulty.charAt(0) + resource.difficulty.slice(1).toLowerCase()}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-500">
                      {resource.type === "PATH" ? t("dashboard.learning_path") : resource.type.charAt(0) + resource.type.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-indigo-400 transition-colors shrink-0 ml-2" />
              </a>
            ))}
          </CardContent>
        </Card>

        {/* Project Opportunities */}
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <span className="text-indigo-400">🎯</span> {t("dashboard.project_opp")}
            </CardTitle>
            <Link to="/hub?type=PROJECT">
              <Button variant="ghost" size="sm">{t("common.view_all")}</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {projectContents.length > 0 ? projectContents.map((content) => (
              <div
                key={content.id}
                className="border-b border-white/10 pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors">
                  <Link
                    to={`/hub/${content.type.toLowerCase()}/${content.id}`}
                    className="flex-1 min-w-0"
                  >
                    <p className="font-medium text-zinc-100">{content.title}</p>
                    <p className="text-xs text-zinc-400 mt-1">{content.description.slice(0, 60)}...</p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {content.type === "PROJECT" ? t("hub.type.project") : content.type}
                    </Badge>
                    {alreadyApplied(content.id) ? (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">{t("hub.applied")}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                        onClick={(e) => { e.preventDefault(); setApplyingTo(content.id); }}
                      >
                        <Send className="h-3 w-3" /> {t("hub.apply")}
                      </Button>
                    )}
                  </div>
                </div>
                {/* Inline application form */}
                {applyingTo === content.id && (
                  <div className="mt-3 ml-2 p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 space-y-3">
                    <p className="text-xs text-zinc-300">{t("hub.apply_desc")}</p>
                    <Input
                      placeholder={t("hub.apply_placeholder")}
                      value={applyMessage}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApplyMessage(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setApplyingTo(null); setApplyMessage(""); }}>{t("common.cancel")}</Button>
                      <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white" onClick={() => handleApply(content.id)}>{t("hub.submit_application")}</Button>
                    </div>
                  </div>
                )}
              </div>
            )) : (
              <p className="text-sm text-zinc-500 text-center py-4">{t("dashboard.no_projects")}</p>
            )}
          </CardContent>
        </Card>

        {/* Recommended for You */}
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100">{t("dashboard.recommended")}</CardTitle>
            <Link to="/hub">
              <Button variant="ghost" size="sm">{t("common.view_all")}</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentContents.length > 0 ? recentContents.map((content) => (
              <Link
                key={content.id}
                to={`/hub/${content.type.toLowerCase()}/${content.id}`}
                className="flex items-center justify-between border-b border-white/10 pb-4 last:border-0 last:pb-0 hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
              >
                <div>
                  <p className="font-medium text-zinc-100">{content.title}</p>
                  <div className="mt-1 flex gap-2">
                    {content.tags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                  <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">{t("hub.status.read")}</Badge>
              </Link>
            )) : (
              <p className="text-sm text-zinc-500 text-center py-4">{t("dashboard.no_content")}</p>
            )}
          </CardContent>
        </Card>

        {/* My Submissions */}
        {myContents.length > 0 && (
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-zinc-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" /> {t("dashboard.my_submissions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {myContents.map((content) => (
                <Link
                  key={content.id}
                  to={`/publish/${content.id}`}
                  className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0 hover:bg-zinc-800/30 -mx-2 px-2 py-1 rounded-lg transition-colors"
                >
                  <div>
                    <p className="font-medium text-zinc-100">{content.title}</p>
                    <p className="text-xs text-zinc-500">{new Date(content.createdAt).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={content.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
