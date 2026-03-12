import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "./Button";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { useAuthStore } from "../../store/authStore";
import { fetchMessageConversationsByApi, fetchMessageRequestsByApi } from "../../lib/api";

export function MessageBadge() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setTotalUnread(0);
      return;
    }

    let active = true;

    void Promise.all([
      fetchMessageConversationsByApi(user.id),
      fetchMessageRequestsByApi(user.id),
    ])
      .then(([conversations, requests]) => {
        if (!active) return;
        setTotalUnread(
          [...conversations, ...requests].reduce((sum, thread) => sum + thread.unreadCount, 0),
        );
      })
      .catch(() => {
        if (active) {
          setTotalUnread(0);
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, user]);

  return (
    <Link to="/messages">
      <Button
        variant="ghost"
        size="icon"
        className="text-zinc-400 relative hover:text-zinc-100"
        title={t("msg.messages")}
      >
        <MessageSquare className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(79,70,229,0.8)]">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </Button>
    </Link>
  );
}
