import { useState, useMemo, useEffect, useDeferredValue } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useTranslation } from "../hooks/useTranslation";
import { Button } from "../components/ui/Button";
import { ContentCard } from "../components/ui/ContentCard";
import { SearchBar } from "../components/ui/SearchBar";
import { TagFilter } from "../components/ui/TagFilter";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingCardGrid } from "../components/ui/StateDisplay";
import { Plus, Search } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";
import type { Content } from "../types";
import { fetchHubContents } from "../lib/api";

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
      } catch (error) {
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

  // Collect all unique tags from published content
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    apiContents
      .filter((c) => c.status === "PUBLISHED")
      .forEach((c) => c.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [apiContents]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("hub.title")}
        description={t("hub.desc")}
      >
        <Link to="/publish">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t("hub.publish_btn")}
          </Button>
        </Link>
      </PageHeader>

      {/* Search */}
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder={t("hub.search_placeholder")}
      />

      {/* Type Tabs */}
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

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <TagFilter
          tags={allTags}
          selectedTags={selectedTags}
          onChange={setSelectedTags}
        />
      )}

      {/* Content Grid */}
      {hasError ? (
        <ErrorState onRetry={handleRetry} />
      ) : isLoading ? (
        <LoadingCardGrid count={6} />
      ) : visibleContents.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleContents.map((content) => (
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
            searchTerm || selectedTags.length > 0
              ? t("hub.empty_desc_search")
              : t("hub.empty_desc")
          }
        />
      )}
    </div>
  );
}
