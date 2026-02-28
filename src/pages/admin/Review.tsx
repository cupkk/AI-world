import { formatRole } from "../../lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "../../store/authStore";
import { useDataStore } from "../../store/dataStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/StateDisplay";
import { Check, X, FileText, User as UserIcon, AlertTriangle, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../../lib/usePageTitle";

import { useTranslation } from "../../lib/i18n";

export function Review() {
  const { t } = useTranslation();
  usePageTitle(t("admin_review.content_review"));
  const { user } = useAuthStore();
  const { contents, users, updateContentStatus } = useDataStore();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  
  if (!user || user.role !== "ADMIN") return null;

  const pendingContents = contents.filter((c) => c.status === "PENDING_REVIEW");

  const handleApprove = (id: string) => {
    updateContentStatus(id, "PUBLISHED");
    toast.success(t("admin_review.content_approved"));
  };

  const handleReject = (id: string) => {
    if (rejectingId === id && rejectReason.trim()) {
      updateContentStatus(id, "REJECTED", rejectReason.trim());
      setRejectingId(null);
      setRejectReason("");
      toast.error(t("admin_review.content_rejected"));
    } else {
      setRejectingId(id);
      setRejectReason("");
    }
  };

  const cancelReject = () => {
    setRejectingId(null);
    setRejectReason("");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title={t("admin_review.admin_review_dash")}
        description={t("admin_review.review_desc")}
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
            <Shield className="mr-1 h-3 w-3" />
            {t("admin_hub.admin")}
          </Badge>
          <Link to="/admin/hub">
            <Button variant="outline" size="sm">{t("admin_hub.content_management")}</Button>
          </Link>
        </div>
      </PageHeader>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t("admin_review.pending_reviews")}</CardTitle>
          <CardDescription className="text-zinc-400">
            {pendingContents.length} {t("admin_review.items_require_attention")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingContents.length > 0 ? (
            <div className="space-y-4">
              {pendingContents.map((content) => {
                const author = users.find((u) => u.id === content.authorId);
                const isRejectingThis = rejectingId === content.id;
                return (
                  <div
                    key={content.id}
                    className="rounded-lg border border-white/10 bg-zinc-900/50 p-6 transition-colors hover:bg-zinc-800/50"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {content.type}
                          </Badge>
                          {content.visibility === "EXPERTS_LEARNERS" && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                              {t("admin_review.restricted")}
                            </Badge>
                          )}
                          <span className="text-xs text-zinc-500">
                            {t("admin_review.submitted_on")} {new Date(content.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-lg font-medium text-zinc-100">
                          {content.title}
                        </h3>
                        <p className="text-sm text-zinc-400 line-clamp-2">
                          {content.description}
                        </p>
                        <div className="flex items-center gap-2 pt-2">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <UserIcon className="h-3 w-3" />
                            <Link to={`/u/${author?.id}`} className="hover:text-indigo-400 hover:underline">
                              {author?.name}
                            </Link>
                            <span className="text-zinc-700">({author ? formatRole(author.role) : ""})</span>
                          </div>
                          <span className="text-zinc-700">•</span>
                          <div className="flex flex-wrap gap-1">
                            {content.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-xs text-zinc-500">#{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 border-t border-white/5 pt-4 md:border-t-0 md:pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => handleReject(content.id)}
                        >
                          <X className="h-4 w-4" />
                          {t("admin_review.reject")}
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                          onClick={() => handleApprove(content.id)}
                        >
                          <Check className="h-4 w-4" />
                          {t("admin_review.approve")}
                        </Button>
                      </div>
                    </div>

                    {/* Reject reason input */}
                    {isRejectingThis && (
                      <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-red-400">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">{t("admin_review.provide_reason")}</span>
                        </div>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t("admin_review.reason_placeholder")}
                          className="w-full rounded-lg border border-red-500/20 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={cancelReject}>
                            {t("admin_review.cancel")}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-500 text-white"
                            onClick={() => handleReject(content.id)}
                            disabled={!rejectReason.trim()}
                          >
                            {t("admin_review.confirm_reject")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="h-8 w-8 text-zinc-500" />}
              title={t("admin_review.no_pending_title")}
              description={t("admin_review.no_pending_desc")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
