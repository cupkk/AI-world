import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./Card";
import { Badge } from "./Badge";
import { formatDistanceToNow } from "date-fns";
import type { Content, User } from "../../types";
import { useTranslation } from "../../hooks/useTranslation";
import {
  getContentDetailHref,
  getContentDomainMeta,
  getContentPreviewSections,
} from "../../lib/contentDomain";

interface ContentCardProps {
  content: Content;
  author?: User;
}

export function ContentCard({ content, author }: ContentCardProps) {
  const { t } = useTranslation();
  const domainMeta = getContentDomainMeta(content.contentDomain, t);
  const DomainIcon = domainMeta.Icon;
  const previewSections = getContentPreviewSections(content, t);

  return (
    <Link to={getContentDetailHref(content)}>
      <Card className="flex flex-col overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(79,70,229,0.15)] hover:border-indigo-500/30 group glass-panel h-full">
        {content.coverImage && (
          <div className="aspect-video w-full overflow-hidden bg-zinc-800">
            <img
              src={content.coverImage}
              alt={content.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}
        <CardHeader>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="text-[10px] uppercase tracking-wider"
              >
                {content.type}
              </Badge>
              <Badge
                variant="outline"
                className={`gap-1 text-[10px] border ${domainMeta.className}`}
                data-testid={`hub-card-domain-${content.id}`}
              >
                <DomainIcon className="h-3 w-3" />
                {domainMeta.label}
              </Badge>
            </div>
            <span className="text-xs text-zinc-500">
              {formatDistanceToNow(new Date(content.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
          <CardTitle className="line-clamp-2 text-lg text-zinc-100 group-hover:text-indigo-400 transition-colors">
            {content.title}
          </CardTitle>
          {previewSections.length > 0 ? (
            <div className="space-y-2">
              {previewSections.slice(0, 2).map((section) => (
                <div key={section.key}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    {section.label}
                  </p>
                  <CardDescription
                    className="line-clamp-2 text-zinc-400"
                    data-testid={`hub-card-preview-${content.id}-${section.key}`}
                  >
                    {section.value}
                  </CardDescription>
                </div>
              ))}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="mt-auto">
          <div className="mb-4 flex flex-wrap gap-2">
            {content.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] text-zinc-400 border-white/10"
              >
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            {author && (
              <div className="flex items-center gap-2 hover:opacity-80">
                <div className="h-6 w-6 overflow-hidden rounded-full bg-zinc-800 border border-white/10">
                  {author.avatar && (
                    <img
                      src={author.avatar}
                      alt={author.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <span className="text-xs font-medium text-zinc-300">
                  {author.name}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span>{content.views} {t("common.views")}</span>
              <span>{content.likes} {t("common.likes")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
