import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  Github,
  Handshake,
  Link as LinkIcon,
  Mail,
  MapPin,
  MessageSquare,
  Sparkles,
  Target,
  Twitter,
  Linkedin,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { formatRole, normalizeEmailVisibility } from "../lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { ContactCard } from "../components/ui/ContactCard";
import { EmptyState, LoadingSkeleton } from "../components/ui/StateDisplay";
import { usePageTitle } from "../lib/usePageTitle";
import { useTranslation } from "../hooks/useTranslation";
import { fetchProfilePageByApi } from "../lib/api";
import {
  getContentDetailHref,
  getContentDomainMeta,
  getContentPreviewSections,
} from "../lib/contentDomain";
import type { Content, ContentDomain, ProfilePageData } from "../types";

type ProfileContentDomainFilter = "ALL" | ContentDomain;

function getProfileContentSectionTitle(role: string, t: (key: string) => string) {
  if (role === "EXPERT") return t("profile.research_pub");
  if (role === "ENTERPRISE_LEADER") return t("profile.ai_strategy");
  if (role === "LEARNER") return t("profile.articles_contrib");
  return t("profile.published_content");
}

function getProfileContentTypeLabel(
  type: Content["type"],
  t: (key: string) => string,
) {
  switch (type) {
    case "PAPER":
      return t("pub_detail.type_paper");
    case "PROJECT":
      return t("pub_detail.type_project");
    case "TOOL":
      return t("pub_detail.type_tool");
    case "CONTEST":
      return t("pub_detail.type_contest");
    case "POLICY":
      return t("pub_detail.type_policy");
    default:
      return type;
  }
}

function getMaskedEmail(email: string) {
  if (!email.includes("@")) {
    return email;
  }

  const [local, domain] = email.split("@");
  return `${local.charAt(0)}***@${domain}`;
}

export function Profile() {
  const { t } = useTranslation();
  usePageTitle(t("profile.title"));
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();

  const [profilePage, setProfilePage] = useState<ProfilePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeContentDomain, setActiveContentDomain] =
    useState<ProfileContentDomainFilter>("ALL");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchProfilePageByApi(id)
      .then((nextProfilePage) => setProfilePage(nextProfilePage))
      .catch(() => setProfilePage(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setActiveContentDomain("ALL");
  }, [id]);

  const user = profilePage?.user ?? null;
  const userContents = profilePage?.contents ?? [];
  const summary = profilePage?.summary ?? {
    publishedContentCount: 0,
    totalViews: 0,
    totalLikes: 0,
    featuredTypes: [],
    domainCounts: {
      hubItems: 0,
      enterpriseNeeds: 0,
      researchProjects: 0,
    },
  };

  const derivedDomainCounts = useMemo(
    () =>
      userContents.reduce(
        (counts, content) => {
          if (content.contentDomain === "ENTERPRISE_NEED") {
            counts.enterpriseNeeds += 1;
          } else if (content.contentDomain === "RESEARCH_PROJECT") {
            counts.researchProjects += 1;
          } else {
            counts.hubItems += 1;
          }
          return counts;
        },
        {
          hubItems: 0,
          enterpriseNeeds: 0,
          researchProjects: 0,
        },
      ),
    [userContents],
  );

  const hasSummaryDomainCounts =
    summary.domainCounts.hubItems +
      summary.domainCounts.enterpriseNeeds +
      summary.domainCounts.researchProjects >
    0;
  const domainCounts =
    hasSummaryDomainCounts || userContents.length === 0
      ? summary.domainCounts
      : derivedDomainCounts;

  const contentDomainFilters = [
    {
      id: "ALL" as const,
      label: t("profile.filter_all"),
      count: summary.publishedContentCount,
    },
    {
      id: "HUB_ITEM" as const,
      label: t("profile.domain_hub_item"),
      count: domainCounts.hubItems,
    },
    {
      id: "ENTERPRISE_NEED" as const,
      label: t("profile.domain_enterprise_need"),
      count: domainCounts.enterpriseNeeds,
    },
    {
      id: "RESEARCH_PROJECT" as const,
      label: t("profile.domain_research_project"),
      count: domainCounts.researchProjects,
    },
  ];

  const visibleContents =
    activeContentDomain === "ALL"
      ? userContents
      : userContents.filter(
          (content) => content.contentDomain === activeContentDomain,
        );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-20">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!profilePage?.user) {
    return (
      <div className="mx-auto max-w-4xl py-20">
        <EmptyState
          icon="search"
          title={t("profile.user_not_found")}
          description={t("profile.user_not_found_desc")}
          action={
            <Link to="/talent">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t("profile.back_talent")}
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const displayEmail = user.contactEmail || user.email;
  const emailVisibility = normalizeEmailVisibility(
    user.privacySettings?.emailVisibility,
  );
  const isOwnProfile = currentUser?.id === user.id;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-8 text-white shadow-2xl md:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-[80px]" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px]" />

        <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row md:items-start">
          <Avatar
            src={user.avatar}
            fallback={user.name.charAt(0)}
            className="h-32 w-32 border-4 border-zinc-800 shadow-2xl ring-4 ring-indigo-500/20"
          />

          <div className="flex-1 text-center md:text-left">
            <div className="mb-2 flex flex-col items-center gap-4 md:flex-row md:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-white">
                  {user.name}
                </h1>
                <p className="mt-1 text-lg font-medium text-indigo-400">
                  {user.title || formatRole(user.role)}
                </p>
              </div>
              {!isOwnProfile ? (
                <Link to={`/messages?to=${user.id}`}>
                  <Button
                    className="gap-2 rounded-full bg-zinc-100 text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-zinc-200"
                    data-testid="profile-direct-message"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {t("profile.dm")}
                  </Button>
                </Link>
              ) : null}
            </div>

            {isOwnProfile ? (
              <Link to="/settings/profile">
                <Button
                  variant="outline"
                  className="gap-2 rounded-full border-white/10 hover:bg-white/5"
                >
                  {t("profile.edit")}
                </Button>
              </Link>
            ) : null}

            <p className="mt-4 max-w-2xl leading-relaxed text-zinc-300">
              {user.bio}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-400 md:justify-start">
              {user.location ? (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {user.location}
                </div>
              ) : null}
              {user.company ? (
                <div className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  {user.company}
                </div>
              ) : null}
              <div className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                {emailVisibility === "HIDDEN" ? (
                  <span className="italic text-zinc-600">
                    {t("settings.vis_hidden")}
                  </span>
                ) : emailVisibility === "MASKED" ? (
                  <span>{getMaskedEmail(displayEmail)}</span>
                ) : (
                  displayEmail
                )}
              </div>
            </div>

            {user.socialLinks ? (
              <div className="mt-6 flex justify-center gap-3 md:justify-start">
                {user.socialLinks.github ? (
                  <a
                    href={`https://github.com/${user.socialLinks.github}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/5 bg-zinc-800/80 p-2 text-zinc-300 transition-all hover:border-white/20 hover:bg-zinc-700 hover:text-white"
                  >
                    <Github className="h-5 w-5" />
                  </a>
                ) : null}
                {user.socialLinks.linkedin ? (
                  <a
                    href={`https://linkedin.com/in/${user.socialLinks.linkedin}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/5 bg-zinc-800/80 p-2 text-zinc-300 transition-all hover:border-white/20 hover:bg-zinc-700 hover:text-white"
                  >
                    <Linkedin className="h-5 w-5" />
                  </a>
                ) : null}
                {user.socialLinks.twitter ? (
                  <a
                    href={`https://twitter.com/${user.socialLinks.twitter}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/5 bg-zinc-800/80 p-2 text-zinc-300 transition-all hover:border-white/20 hover:bg-zinc-700 hover:text-white"
                  >
                    <Twitter className="h-5 w-5" />
                  </a>
                ) : null}
                {user.socialLinks.website ? (
                  <a
                    href={user.socialLinks.website}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/5 bg-zinc-800/80 p-2 text-zinc-300 transition-all hover:border-white/20 hover:bg-zinc-700 hover:text-white"
                  >
                    <LinkIcon className="h-5 w-5" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-panel md:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {t("profile.stat_published")}
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-100">
                  {summary.publishedContentCount}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {t("profile.stat_views")}
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-100">
                  {summary.totalViews}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {t("profile.stat_likes")}
                </p>
                <p className="mt-3 text-3xl font-semibold text-zinc-100">
                  {summary.totalLikes}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-violet-500/10 bg-violet-500/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-violet-200/80">
                  {t("profile.domain_hub_item")}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {domainCounts.hubItems}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/80">
                  {t("profile.domain_enterprise_need")}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {domainCounts.enterpriseNeeds}
                </p>
              </div>
              <div className="rounded-2xl border border-sky-500/10 bg-sky-500/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-200/80">
                  {t("profile.domain_research_project")}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {domainCounts.researchProjects}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              {t("profile.what_im_doing")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed text-zinc-300">
              {user.whatImDoing || t("profile.currently_exploring")}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
              <Handshake className="h-4 w-4 text-emerald-400" />
              {t("profile.what_i_can_provide")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed text-zinc-300">
              {user.whatICanProvide || t("profile.open_to_sharing")}
            </p>
            {user.skills && user.skills.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {user.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="font-medium">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
              <Target className="h-4 w-4 text-amber-400" />
              {t("profile.what_im_looking_for")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed text-zinc-300">
              {user.whatImLookingFor || t("profile.looking_to_connect")}
            </p>
          </CardContent>
        </Card>

        <ContactCard
          user={user}
          showMessageButton={!isOwnProfile}
          messageButtonTestId="profile-contact-send-message"
        />
      </div>

      <div className="space-y-6 border-t border-white/10 pt-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
              {getProfileContentSectionTitle(user.role, t)}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {t("profile.content_mix_desc")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {contentDomainFilters
              .filter((filter) => filter.id === "ALL" || filter.count > 0)
              .map((filter) => (
                <Button
                  key={filter.id}
                  variant={
                    activeContentDomain === filter.id ? "default" : "outline"
                  }
                  size="sm"
                  className="rounded-full"
                  onClick={() => setActiveContentDomain(filter.id)}
                  data-testid={`profile-domain-filter-${filter.id.toLowerCase()}`}
                >
                  {filter.label} ({filter.count})
                </Button>
              ))}
          </div>
        </div>

        {visibleContents.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleContents.map((content) => {
              const domainMeta = getContentDomainMeta(
                content.contentDomain,
                t,
              );
              const DomainIcon = domainMeta.Icon;
              const previewSections = getContentPreviewSections(content, t);
              return (
                <Link
                  to={getContentDetailHref(content)}
                  key={content.id}
                  data-testid={`profile-content-card-${content.id}`}
                >
                  <Card className="flex h-full flex-col border-white/10 transition-colors hover:border-indigo-500/30 glass-panel">
                    <CardHeader className="space-y-3 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`gap-1 border ${domainMeta.className}`}
                        >
                          <DomainIcon className="h-3 w-3" />
                          {domainMeta.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-white/10 text-[10px] uppercase text-zinc-300"
                        >
                          {getProfileContentTypeLabel(content.type, t)}
                        </Badge>
                        {content.visibility ? (
                          <Badge
                            variant="outline"
                            className="border-white/10 text-[10px] text-zinc-400"
                          >
                            {content.visibility === "ALL"
                              ? t("dashboard.public")
                              : t("dashboard.experts_talent")}
                          </Badge>
                        ) : null}
                      </div>
                      <CardTitle className="line-clamp-2 text-base text-zinc-100">
                        {content.title}
                      </CardTitle>
                      {previewSections.length > 0 ? (
                        <div className="space-y-2">
                          {previewSections.slice(0, 2).map((section) => (
                            <div key={section.key}>
                              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                {section.label}
                              </p>
                              <p
                                className="line-clamp-2 text-sm leading-6 text-zinc-400"
                                data-testid={`profile-content-preview-${content.id}-${section.key}`}
                              >
                                {section.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="line-clamp-3 text-sm leading-6 text-zinc-400">
                          {t("profile.no_content_summary")}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="mt-auto space-y-4 p-5 pt-0">
                      {content.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {content.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>
                          {new Date(content.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex gap-3">
                          <span>{content.views} {t("common.views")}</span>
                          <span>{content.likes} {t("common.likes")}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : userContents.length > 0 ? (
          <Card className="border-dashed border-white/10 bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-zinc-500">
                {t("profile.no_published_in_domain")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-white/10 bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-zinc-500">{t("profile.no_published")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
