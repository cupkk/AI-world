import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { Button } from "../components/ui/Button";
import { SearchBar } from "../components/ui/SearchBar";
import { TagFilter } from "../components/ui/TagFilter";
import { PageHeader } from "../components/ui/PageHeader";
import { ProfileMiniCard } from "../components/ui/ProfileMiniCard";
import { EmptyState, ErrorState, LoadingCardGrid } from "../components/ui/StateDisplay";
import { Users } from "lucide-react";
import type { Role } from "../types";
import { usePageTitle } from "../lib/usePageTitle";
import type { User } from "../types";
import { fetchTalentUsers } from "../lib/api";

export function Talent() {
  const { t } = useTranslation();
  usePageTitle(t("talent.title"));
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeRole, setActiveRole] = useState<"ALL" | Role>("ALL");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const ROLE_TABS: { id: "ALL" | Role; label: string }[] = [
    { id: "ALL", label: t("talent.tab_all") },
    { id: "EXPERT", label: t("talent.tab_experts") },
    { id: "LEARNER", label: t("talent.tab_learners") },
    { id: "ENTERPRISE_LEADER", label: t("talent.tab_enterprises") },
  ];

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void loadTalentFromApi();
    }, searchTerm ? 250 : 0);

    async function loadTalentFromApi() {
      setHasError(false);
      setIsLoading(true);
      try {
        const result = await fetchTalentUsers({
          q: searchTerm.trim() || undefined,
          tags: selectedSkills.length > 0 ? selectedSkills : undefined,
          role: activeRole,
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

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeRole, searchTerm, selectedSkills]);

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    fetchTalentUsers({
      q: searchTerm.trim() || undefined,
      tags: selectedSkills.length > 0 ? selectedSkills : undefined,
      role: activeRole,
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

  // Collect all unique skills
  const allSkills = useMemo(() => {
    const skills = new Set<string>();
    apiUsers
      .filter((u) => u.role !== "ADMIN")
      .forEach((u) => u.skills?.forEach((s) => skills.add(s)));
    return Array.from(skills).sort();
  }, [apiUsers]);

  const talents = useMemo(() => {
    return apiUsers.filter((u) => {
      // Exclude admin
      if (u.role === "ADMIN") return false;

      // Role filter
      if (activeRole !== "ALL" && u.role !== activeRole) return false;

      // Search filter
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(lower);
        const matchesTitle = u.title?.toLowerCase().includes(lower);
        const matchesCompany = u.company?.toLowerCase().includes(lower);
        const matchesBio = u.bio?.toLowerCase().includes(lower);
        const matchesSkills = u.skills?.some((s) =>
          s.toLowerCase().includes(lower)
        );
        if (
          !matchesName &&
          !matchesTitle &&
          !matchesCompany &&
          !matchesBio &&
          !matchesSkills
        ) {
          return false;
        }
      }

      // Skills filter
      if (
        selectedSkills.length > 0 &&
        !selectedSkills.some((skill) => u.skills?.includes(skill))
      ) {
        return false;
      }

      return true;
    });
  }, [apiUsers, searchTerm, activeRole, selectedSkills]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("talent.title")}
        description={t("talent.desc")}
      />

      {/* Search */}
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder={t("talent.search_placeholder")}
      />

      {/* Role Tabs */}
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

      {/* Skills Filter */}
      {allSkills.length > 0 && (
        <TagFilter
          tags={allSkills}
          selectedTags={selectedSkills}
          onChange={setSelectedSkills}
        />
      )}

      {/* Users Grid */}
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
            searchTerm || selectedSkills.length > 0
              ? t("talent.empty_desc_search")
              : t("talent.empty_desc")
          }
        />
      )}
    </div>
  );
}
