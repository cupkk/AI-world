import { Badge } from "./Badge";
import { cn } from "../../lib/utils";
import type { ContentStatus } from "../../types";

const statusConfig: Record<ContentStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  PUBLISHED: {
    label: "Published",
    className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

interface StatusBadgeProps {
  status: ContentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
