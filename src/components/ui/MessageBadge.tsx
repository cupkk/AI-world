import { Link } from "react-router-dom";
import { useDataStore } from "../../store/dataStore";
import { Button } from "./Button";
import { MessageSquare } from "lucide-react";

export function MessageBadge() {
  const { chatThreads } = useDataStore();
  const totalUnread = chatThreads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <Link to="/messages">
      <Button
        variant="ghost"
        size="icon"
        className="text-zinc-400 relative hover:text-zinc-100"
        title="Messages"
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
