import { useState, useMemo, useEffect, useDeferredValue } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useTranslation } from "../hooks/useTranslation";
import { Button } from "../components/ui/Button";
import { ContentCard } from "../components/ui/ContentCard";
import { SearchBar } from "../components/ui/SearchBar";
import { TagFilter } from "../components/ui/TagFilter";
import { PageHeader } from "../components/ui/PageHeader";
import {
  EmptyState,
  ErrorState,
  LoadingCardGrid,
} from "../components/ui/StateDisplay";
import { Card, CardContent } from "../components/ui/Card";
import { GraduationCap, Layers3, Plus, Search, Wrench } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";
import type { Content } from "../types";
import { fetchHubContents } from "../lib/api";

type HubLane = "ALL" | "COURSES" | "RESOURCES" | "TOOLS";

const COURSE_KEYWORDS = [
  "course",
  "tutorial",
  "learning",
  "learn",
  "curriculum",
  "bootcamp",
  "workshop",
  "课程",
  "教程",
  "学习",
  "训练营",
  "实战",
];

const RESOURCE_KEYWORDS = [
  "resource",
  "dataset",
  "benchmark",
  "guide",
  "playbook",
  "report",
  "framework",
  "论文",
  "资源",
  "数据集",
  "指南",
  "报告",
  "框架",
];

const TOOL_KEYWORDS = [
  "tool",
  "workflow",
  "agent",
  "platform",
  "stack",
  "automation",
  "工具",
  "平台",
  "自动化",
  "工作流",
];

function normalizeContentText(content: Content) {
  return [content.title, content.description, ...(content.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesKeyword(content: Content, keywords: string[]) {
  const normalized = normalizeContentText(content);
  return keywords.some((keyword) => normalized.includes(keyword));
}

function matchesHubLane(content: Content, lane: HubLane) {
  switch (lane) {
    case "COURSES":
      return matchesKeyword(content, COURSE_KEYWORDS);
    case "RESOURCES":
      return (
        content.type === "PAPER" ||
        content.type === "POLICY" ||
        content.type === "PROJECT" ||
        matchesKeyword(content, RESOURCE_KEYWORDS)
      );
    case "TOOLS":
      return content.type === "TOOL" || matchesKeyword(content, TOOL_KEYWORDS);
    case "ALL":
    default:
      return true;
  }
}

export function Hub() {
  const { t } = useTranslation();
  usePageTitle(t("hub.title"));
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [apiContents, setApiContents] = useState<Content[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const initialType = searchParams.get("type") || "ALL";
  const [activeTab, setActiveTab] = useState(initialType);
  const [activeLane, setActiveLane] = useState<HubLane>("ALL");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const deferredSearchTerm = useDeferredValue(searchTerm.trim());

  useEffect(() => {
    let active = true;

    async function loadHubFromApi() {
      setHasError(false);
      setIsLoading(true);
      try {
        const result = await fetchHubContents({
          type: activeTab !== "ALL" ? activeTab : undefined,
          q: deferredSearchTerm || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        });
        if (!active) return;
        setApiContents(result);
      } catch {
        if (!active) return;
        setApiContents([]);
        setHasError(true);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadHubFromApi();

    return () => {
      active = false;
    };
  }, [activeTab, deferredSearchTerm, reloadToken, selectedTags]);

  const handleRetry = () => {
    setApiContents([]);
    setHasError(false);
    setReloadToken((current) => current + 1);
  };

  const TABS = [
    { id: "ALL", label: t("hub.tab_all") },
    { id: "CONTEST", label: t("hub.tab_contest") },
    { id: "PAPER", label: t("hub.tab_paper") },
    { id: "POLICY", label: t("hub.tab_policy") },
    { id: "PROJECT", label: t("hub.tab_project") },
    { id: "TOOL", label: t("hub.tab_tool") },
  ];

  const visibleContents = useMemo(
    () =>
      apiContents.filter((content) => {
        if (content.status !== "PUBLISHED") {
          return false;
        }

        if (
          content.visibility === "EXPERTS_LEARNERS" &&
          user?.role === "ENTERPRISE_LEADER"
        ) {
          return false;
        }

        return true;
      }),
    [apiContents, user?.role],
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    visibleContents.forEach((content) =>
      content.tags.forEach((tag) => tags.add(tag)),
    );
    return Array.from(tags).sort();
  }, [visibleContents]);

  const laneCounts = useMemo(
    () => ({
      COURSES: visibleContents.filter((content) =>
        matchesHubLane(content, "COURSES"),
      ).length,
      RESOURCES: visibleContents.filter((content) =>
        matchesHubLane(content, "RESOURCES"),
      ).length,
      TOOLS: visibleContents.filter((content) => matchesHubLane(content, "TOOLS"))
        .length,
    }),
    [visibleContents],
  );

  const laneContents = useMemo(
    () =>
      visibleContents.filter((content) => matchesHubLane(content, activeLane)),
    [activeLane, visibleContents],
  );

  const laneCards = [
    {
      id: "COURSES" as const,
      icon: GraduationCap,
      title: t("hub.lane_courses"),
      description: t("hub.lane_courses_desc"),
      count: laneCounts.COURSES,
      className: "border-sky-500/20 bg-sky-500/[0.06]",
    },
    {
      id: "RESOURCES" as const,
      icon: Layers3,
      title: t("hub.lane_resources"),
      description: t("hub.lane_resources_desc"),
      count: laneCounts.RESOURCES,
      className: "border-emerald-500/20 bg-emerald-500/[0.06]",
    },
    {
      id: "TOOLS" as const,
      icon: Wrench,
      title: t("hub.lane_tools"),
      description: t("hub.lane_tools_desc"),
      count: laneCounts.TOOLS,
      className: "border-amber-500/20 bg-amber-500/[0.06]",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("hub.title")} description={t("hub.desc")}>
        <Link to="/publish">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("hub.publish_btn")}
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        {laneCards.map((lane) => {
          const Icon = lane.icon;
          const isActive = activeLane === lane.id;
          return (
            <button
              key={lane.id}
              type="button"
              className={`rounded-2xl border p-5 text-left transition-all ${
                isActive
                  ? `${lane.className} shadow-[0_0_18px_rgba(99,102,241,0.12)]`
                  : "border-white/10 bg-zinc-950/40 hover:border-white/20"
              }`}
              onClick={() =>
                setActiveLane((current) => (current === lane.id ? "ALL" : lane.id))
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <Icon className="h-5 w-5 text-zinc-100" />
                </div>
                <span className="text-sm font-semibold text-zinc-100">
                  {lane.count}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-zinc-100">
                {lane.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {lane.description}
              </p>
            </button>
          );
        })}
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder={t("hub.search_placeholder")}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeLane === "ALL" ? "default" : "outline"}
          size="sm"
          className="rounded-full"
          onClick={() => setActiveLane("ALL")}
        >
          {t("hub.lane_all")}
        </Button>
        {laneCards.map((lane) => (
          <Button
            key={lane.id}
            variant={activeLane === lane.id ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setActiveLane(lane.id)}
          >
            {lane.title}
          </Button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="rounded-full shrink-0"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {allTags.length > 0 && (
        <TagFilter
          tags={allTags}
          selectedTags={selectedTags}
          onChange={setSelectedTags}
        />
      )}

      <Card className="glass-panel">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-sm text-zinc-300">
            {laneContents.length} {t("hub.results_count")}
          </div>
          {(activeLane !== "ALL" || selectedTags.length > 0 || searchTerm) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveLane("ALL");
                setSelectedTags([]);
                setSearchTerm("");
              }}
            >
              {t("hub.clear_filters")}
            </Button>
          )}
        </CardContent>
      </Card>

      {hasError ? (
        <ErrorState onRetry={handleRetry} />
      ) : isLoading ? (
        <LoadingCardGrid count={6} />
      ) : laneContents.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {laneContents.map((content) => (
            <ContentCard
              key={content.id}
              content={content}
              author={content.author}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search className="h-8 w-8 text-zinc-500" />}
          title={t("hub.empty_title")}
          description={
            searchTerm || selectedTags.length > 0 || activeLane !== "ALL"
              ? t("hub.empty_desc_search")
              : t("hub.empty_desc")
          }
        />
      )}
    </div>
  );
}
