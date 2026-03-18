import { useState, useMemo, useEffect, useDeferredValue } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { Button } from "../components/ui/Button";
import { SearchBar } from "../components/ui/SearchBar";
import { TagFilter } from "../components/ui/TagFilter";
import { PageHeader } from "../components/ui/PageHeader";
import { ProfileMiniCard } from "../components/ui/ProfileMiniCard";
import {
  EmptyState,
  ErrorState,
  LoadingCardGrid,
} from "../components/ui/StateDisplay";
import { Input } from "../components/ui/Input";
import { Building2, MapPin, Users } from "lucide-react";
import type { Role, User } from "../types";
import { usePageTitle } from "../lib/usePageTitle";
import { fetchTalentUsers } from "../lib/api";

const INTENT_LABEL_KEYS: Record<string, string> = {
  find_ai_partner: "onb.intent_e_find_partner",
  recruit_talent: "onb.intent_e_recruit",
  post_needs: "onb.intent_e_post_needs",
  industry_academia: "onb.intent_e_academia",
  tech_trends: "onb.intent_e_trends",
  find_solutions: "onb.intent_e_solutions",
  publish_research: "onb.intent_x_publish",
  find_collaborators: "onb.intent_x_collab",
  enterprise_needs: "onb.intent_x_enterprise",
  mentor_students: "onb.intent_x_mentor",
  find_funding: "onb.intent_x_funding",
  build_influence: "onb.intent_x_influence",
  learn_ai: "onb.intent_l_learn",
  join_projects: "onb.intent_l_projects",
  find_mentor: "onb.intent_l_mentor",
  find_jobs: "onb.intent_l_jobs",
  competitions: "onb.intent_l_competitions",
  build_skills: "onb.intent_l_skills",
};

function formatIntentLabel(intent: string, t: (key: string) => string) {
  const key = INTENT_LABEL_KEYS[intent];
  if (key) {
    return t(key);
  }

  return intent
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Talent() {
  const { t } = useTranslation();
  usePageTitle(t("talent.title"));

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [orgQuery, setOrgQuery] = useState("");
  const [activeRole, setActiveRole] = useState<"ALL" | Role>("ALL");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<
    "profile_strength" | "relevance" | "newest" | "name"
  >("profile_strength");

  const deferredSearchTerm = useDeferredValue(searchTerm.trim());
  const deferredLocationQuery = useDeferredValue(locationQuery.trim());
  const deferredOrgQuery = useDeferredValue(orgQuery.trim());

  const ROLE_TABS: { id: "ALL" | Role; label: string }[] = [
    { id: "ALL", label: t("talent.tab_all") },
    { id: "EXPERT", label: t("talent.tab_experts") },
    { id: "LEARNER", label: t("talent.tab_learners") },
    { id: "ENTERPRISE_LEADER", label: t("talent.tab_enterprises") },
  ];

  useEffect(() => {
    let active = true;

    async function loadTalentFromApi() {
      setHasError(false);
      setIsLoading(true);
      try {
        const result = await fetchTalentUsers({
          q: deferredSearchTerm || undefined,
          tags: selectedSkills.length > 0 ? selectedSkills : undefined,
          intents: selectedIntents.length > 0 ? selectedIntents : undefined,
          location: deferredLocationQuery || undefined,
          org: deferredOrgQuery || undefined,
          role: activeRole,
          sort: sortBy,
        });
        if (!active) return;
        setApiUsers(result);
      } catch {
        if (!active) return;
        setApiUsers([]);
        setHasError(true);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadTalentFromApi();

    return () => {
      active = false;
    };
  }, [
    activeRole,
    deferredLocationQuery,
    deferredOrgQuery,
    deferredSearchTerm,
    selectedIntents,
    selectedSkills,
    sortBy,
  ]);

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    fetchTalentUsers({
      q: deferredSearchTerm || undefined,
      tags: selectedSkills.length > 0 ? selectedSkills : undefined,
      intents: selectedIntents.length > 0 ? selectedIntents : undefined,
      location: deferredLocationQuery || undefined,
      org: deferredOrgQuery || undefined,
      role: activeRole,
      sort: sortBy,
    })
      .then((result) => {
        setApiUsers(result);
      })
      .catch(() => {
        setApiUsers([]);
        setHasError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const allSkills = useMemo(() => {
    const values = new Set(selectedSkills);
    apiUsers
      .filter((user) => user.role !== "ADMIN")
      .forEach((user) => user.skills?.forEach((skill) => values.add(skill)));
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [apiUsers, selectedSkills]);

  const allIntents = useMemo(() => {
    const values = new Set(selectedIntents);
    apiUsers
      .filter((user) => user.role !== "ADMIN")
      .forEach((user) =>
        user.platformIntents?.forEach((intent) => values.add(intent)),
      );
    return Array.from(values).sort((left, right) =>
      formatIntentLabel(left, t).localeCompare(formatIntentLabel(right, t)),
    );
  }, [apiUsers, selectedIntents, t]);

  const talents = useMemo(
    () => apiUsers.filter((user) => user.role !== "ADMIN"),
    [apiUsers],
  );

  const hasActiveFilters =
    Boolean(deferredSearchTerm) ||
    Boolean(deferredLocationQuery) ||
    Boolean(deferredOrgQuery) ||
    selectedSkills.length > 0 ||
    selectedIntents.length > 0 ||
    activeRole !== "ALL" ||
    sortBy !== "profile_strength";

  const clearAllFilters = () => {
    setSearchTerm("");
    setLocationQuery("");
    setOrgQuery("");
    setSelectedSkills([]);
    setSelectedIntents([]);
    setActiveRole("ALL");
    setSortBy("profile_strength");
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("talent.title")} description={t("talent.desc")} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_220px]">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={t("talent.search_placeholder")}
        />
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={locationQuery}
            onChange={(event) =>
              setLocationQuery(event.target.value)
            }
            placeholder={t("talent.location_placeholder")}
            className="pl-10"
          />
        </div>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={orgQuery}
            onChange={(event) =>
              setOrgQuery(event.target.value)
            }
            placeholder={t("talent.org_placeholder")}
            className="pl-10"
          />
        </div>
        <select
          value={sortBy}
          onChange={(event) =>
            setSortBy(
              event.target.value as
                | "profile_strength"
                | "relevance"
                | "newest"
                | "name",
            )
          }
          className="h-10 rounded-md border border-white/10 bg-zinc-950/70 px-3 text-sm text-zinc-100 outline-none transition focus:border-indigo-500"
        >
          <option value="profile_strength">{t("talent.sort_profile")}</option>
          <option value="relevance">{t("talent.sort_relevance")}</option>
          <option value="newest">{t("talent.sort_newest")}</option>
          <option value="name">{t("talent.sort_name")}</option>
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {ROLE_TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeRole === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveRole(tab.id)}
            className="rounded-full shrink-0"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {allIntents.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-100">
                {t("talent.intent_filters")}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {t("talent.intent_filters_desc")}
              </p>
            </div>
          </div>
          <TagFilter
            tags={allIntents}
            selectedTags={selectedIntents}
            onChange={setSelectedIntents}
            getLabel={(intent) => formatIntentLabel(intent, t)}
          />
        </div>
      ) : null}

      {allSkills.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {t("talent.skill_filters")}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {t("talent.skill_filters_desc")}
            </p>
          </div>
          <TagFilter
            tags={allSkills}
            selectedTags={selectedSkills}
            onChange={setSelectedSkills}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Users className="h-4 w-4 text-indigo-400" />
          <span>
            {talents.length} {t("talent.results_count")}
          </span>
        </div>
        {hasActiveFilters ? (
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            {t("talent.clear_filters")}
          </Button>
        ) : null}
      </div>

      {hasError ? (
        <ErrorState onRetry={handleRetry} />
      ) : isLoading ? (
        <LoadingCardGrid count={8} />
      ) : talents.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {talents.map((user) => (
            <ProfileMiniCard key={user.id} user={user} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="h-8 w-8 text-zinc-500" />}
          title={t("talent.empty_title")}
          description={
            hasActiveFilters
              ? t("talent.empty_desc_search")
              : t("talent.empty_desc")
          }
        />
      )}
    </div>
  );
}
