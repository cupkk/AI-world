import { useState, useMemo, useEffect } from "react";
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
import type { Content, User } from "../types";
import { fetchHubContents, fetchUserByIdApi } from "../lib/api";

export function Hub() {
  const { t } = useTranslation();
  usePageTitle(t("hub.title"));
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [apiContents, setApiContents] = useState<Content[]>([]);
  const [authorsById, setAuthorsById] = useState<Record<string, User>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const initialType = searchParams.get("type") || "ALL";
  const [activeTab, setActiveTab] = useState(initialType);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function loadHubFromApi() {
      setHasError(false);
      setIsLoading(true);
      try {
        const result = await fetchHubContents();
        if (!active) return;
        setApiContents(result);
        const authorIds = Array.from(new Set(result.map((item) => item.authorId).filter(Boolean)));
        const authors = await Promise.all(
          authorIds.map((authorId) => fetchUserByIdApi(authorId).catch(() => null)),
        );
        if (!active) return;
        setAuthorsById(
          authors.reduce<Record<string, User>>((acc, author) => {
            if (author) acc[author.id] = author;
            return acc;
          }, {}),
        );
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
  }, []);

  const handleRetry = () => {
    setHasError(false);
    setApiContents([]);
    setAuthorsById({});
    setIsLoading(true);
    fetchHubContents()
      .then((result) => {
        setApiContents(result);
        return Promise.all(
          Array.from(new Set(result.map((item) => item.authorId).filter(Boolean))).map((authorId) =>
            fetchUserByIdApi(authorId).catch(() => null),
          ),
        ).then((authors) => {
          setAuthorsById(
            authors.reduce<Record<string, User>>((acc, author) => {
              if (author) acc[author.id] = author;
              return acc;
            }, {}),
          );
        });
      })
      .catch(() => {
        setApiContents([]);
        setHasError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
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

  const publishedContents = useMemo(() => {
    return apiContents.filter((c) => {
      // Only published
      if (c.status !== "PUBLISHED") return false;

      // Visibility: EXPERTS_LEARNERS content hidden from enterprise leaders
      if (
        c.visibility === "EXPERTS_LEARNERS" &&
        user?.role === "ENTERPRISE_LEADER"
      ) {
        return false;
      }

      // Search filter
      if (
        searchTerm &&
        !c.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !c.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !c.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
      ) {
        return false;
      }

      // Type filter
      if (activeTab !== "ALL" && c.type !== activeTab) return false;

      // Tag filter
      if (
        selectedTags.length > 0 &&
        !selectedTags.some((tag) => c.tags.includes(tag))
      ) {
        return false;
      }

      return true;
    });
  }, [apiContents, searchTerm, activeTab, selectedTags, user?.role]);

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
      ) : publishedContents.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {publishedContents.map((content) => {
            const author = authorsById[content.authorId];
            return (
              <ContentCard
                key={content.id}
                content={content}
                author={author}
              />
            );
          })}
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
