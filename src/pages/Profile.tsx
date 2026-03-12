import { formatRole, normalizeEmailVisibility } from "../lib/utils";
import { useParams, Link } from "react-router-dom";
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
import { Avatar } from "../components/ui/Avatar";
import { ContactCard } from "../components/ui/ContactCard";
import { EmptyState, LoadingSkeleton } from "../components/ui/StateDisplay";
import { usePageTitle } from "../lib/usePageTitle";
import { useTranslation } from "../hooks/useTranslation";
import { fetchProfileByIdApi, fetchHubContents } from "../lib/api";
import type { User, Content } from "../types";
import {
  MapPin,
  Briefcase,
  Mail,
  Github,
  Linkedin,
  Twitter,
  MessageSquare,
  Link as LinkIcon,
  ArrowLeft,
} from "lucide-react";

export function Profile() {
  const { t } = useTranslation();
  usePageTitle(t("profile.title"));
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();

  const [user, setUser] = useState<User | null>(null);
  const [userContents, setUserContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchProfileByIdApi(id).catch(() => null),
      fetchHubContents().then(all => all.filter(c => c.authorId === id && c.status === "PUBLISHED")).catch(() => []),
    ]).then(([u, contents]) => {
      setUser(u);
      setUserContents(contents);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-20">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!user) {
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
  const emailVisibility = normalizeEmailVisibility(user.privacySettings?.emailVisibility);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Bonjour Card Style Header */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900 border border-white/10 p-8 text-white shadow-2xl md:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-[80px]"></div>
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/20 blur-[80px]"></div>

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
                <p className="mt-1 text-lg text-indigo-400 font-medium">
                  {user.title || formatRole(user.role)}
                </p>
              </div>
              <Link to={`/messages?to=${user.id}`}>
                <Button className="gap-2 rounded-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  <MessageSquare className="h-4 w-4" />
                  {t("profile.dm")}
                </Button>
              </Link>
            </div>
            {currentUser?.id === user.id && (
              <Link to="/settings/profile">
                <Button variant="outline" className="gap-2 rounded-full border-white/10 hover:bg-white/5">
                  {t("profile.edit")}
                </Button>
              </Link>
            )}

            <p className="mt-4 max-w-2xl text-zinc-300 leading-relaxed">
              {user.bio}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-400 md:justify-start">
              {user.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {user.location}
                </div>
              )}
              {user.company && (
                <div className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  {user.company}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                {emailVisibility === "HIDDEN" ? (
                  <span className="italic text-zinc-600">{t("settings.vis_hidden")}</span>
                ) : emailVisibility === "MASKED" ? (
                  <span>
                    {displayEmail.charAt(0)}***@{displayEmail.split("@")[1]}
                  </span>
                ) : (
                  displayEmail
                )}
              </div>
            </div>

            {user.socialLinks && (
              <div className="mt-6 flex gap-3 justify-center md:justify-start">
                {user.socialLinks.github && (
                  <a
                    href={`https://github.com/${user.socialLinks.github}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-zinc-800/80 backdrop-blur-sm border border-white/5 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white hover:border-white/20 transition-all"
                  >
                    <Github className="h-5 w-5" />
                  </a>
                )}
                {user.socialLinks.linkedin && (
                  <a
                    href={`https://linkedin.com/in/${user.socialLinks.linkedin}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-zinc-800/80 backdrop-blur-sm border border-white/5 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white hover:border-white/20 transition-all"
                  >
                    <Linkedin className="h-5 w-5" />
                  </a>
                )}
                {user.socialLinks.twitter && (
                  <a
                    href={`https://twitter.com/${user.socialLinks.twitter}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-zinc-800/80 backdrop-blur-sm border border-white/5 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white hover:border-white/20 transition-all"
                  >
                    <Twitter className="h-5 w-5" />
                  </a>
                )}
                {user.socialLinks.website && (
                  <a
                    href={user.socialLinks.website}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-zinc-800/80 backdrop-blur-sm border border-white/5 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white hover:border-white/20 transition-all"
                  >
                    <LinkIcon className="h-5 w-5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <span className="text-indigo-400">⚡</span> {t("profile.what_im_doing")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-300 leading-relaxed">
              {user.whatImDoing || t("profile.currently_exploring")}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <span className="text-emerald-400">💡</span> {t("profile.what_i_can_provide")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-300 leading-relaxed">
              {user.whatICanProvide || t("profile.open_to_sharing")}
            </p>
            {user.skills && user.skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {user.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="font-medium">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <span className="text-amber-400">🎯</span> {t("profile.what_im_looking_for")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-300 leading-relaxed">
              {user.whatImLookingFor || t("profile.looking_to_connect")}
            </p>
          </CardContent>
        </Card>

        <ContactCard user={user} />
      </div>

      <div className="space-y-6 pt-8 border-t border-white/10">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
          {user.role === "EXPERT" ? t("profile.research_pub") : user.role === "ENTERPRISE_LEADER" ? t("profile.ai_strategy") : user.role === "LEARNER" ? t("profile.articles_contrib") : t("profile.published_content")}
        </h2>
        {userContents.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userContents
              .filter((c) => {
                if (user.role === "EXPERT") return ["PAPER", "PROJECT", "TOOL"].includes(c.type);
                if (user.role === "ENTERPRISE_LEADER") return ["PROJECT"].includes(c.type);
                if (user.role === "LEARNER") return ["PAPER", "TOOL"].includes(c.type);
                return true;
              })
              .map((content) => (
              <Link to={`/hub/${content.type.toLowerCase()}/${content.id}`} key={content.id}>
                <Card className="flex flex-col hover:border-indigo-500/30 transition-colors glass-panel h-full">
                  <CardHeader className="p-5">
                    <Badge
                      variant="outline"
                      className="mb-2 w-fit text-[10px] uppercase border-white/10"
                    >
                      {content.type}
                    </Badge>
                    <CardTitle className="line-clamp-2 text-base text-zinc-100">
                      {content.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 mt-auto">
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
            ))}
          </div>
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
