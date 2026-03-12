import { Badge } from "./Badge";
import { cn } from "../../lib/utils";
import type { ContentStatus } from "../../types";
import { useTranslation } from "../../hooks/useTranslation";

const statusConfig: Record<ContentStatus, { key: "content.status.draft" | "content.status.pending_review" | "content.status.published" | "content.status.rejected"; className: string }> = {
  DRAFT: {
    key: "content.status.draft",
    className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  },
  PENDING_REVIEW: {
    key: "content.status.pending_review",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  PUBLISHED: {
    key: "content.status.published",
    className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  REJECTED: {
    key: "content.status.rejected",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

interface StatusBadgeProps {
  status: ContentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();
  const config = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium whitespace-nowrap", config.className, className)}
    >
      {t(config.key)}
    </Badge>
  );
}
