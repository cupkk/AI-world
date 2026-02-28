import { cn } from "../../lib/utils";
import { Inbox, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  } | React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mb-4 rounded-full bg-zinc-800 p-4 border border-white/5">
        {icon || <Inbox className="h-8 w-8 text-zinc-500" />}
      </div>
      <h3 className="text-lg font-medium text-zinc-100">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-zinc-500">{description}</p>
      )}
      {action && (
        typeof action === 'object' && 'label' in action ? (
          <Button className="mt-4" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : (
          <div className="mt-4">{action}</div>
        )
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title = "Something went wrong", description = "An error occurred while loading data. Please try again.", onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mb-4 rounded-full bg-red-500/10 p-4 border border-red-500/20">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <h3 className="text-lg font-medium text-zinc-100">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-zinc-500">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({ rows = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-zinc-900/30 p-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-zinc-800" />
              <div className="h-3 w-2/3 rounded bg-zinc-800/70" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingCardGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-zinc-900/30 overflow-hidden">
          <div className="aspect-video bg-zinc-800/50" />
          <div className="p-5 space-y-3">
            <div className="h-3 w-16 rounded bg-zinc-800" />
            <div className="h-4 w-3/4 rounded bg-zinc-800" />
            <div className="h-3 w-full rounded bg-zinc-800/70" />
            <div className="flex gap-2 pt-2">
              <div className="h-5 w-14 rounded-full bg-zinc-800/60" />
              <div className="h-5 w-14 rounded-full bg-zinc-800/60" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
