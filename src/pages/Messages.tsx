import { formatRole } from "../lib/utils";
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../store/authStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { EmptyState, LoadingSkeleton, ErrorState } from "../components/ui/StateDisplay";
import { Send, Search, Check, X, ShieldAlert, User as UserIcon, Flag, ArrowLeft, Ban } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";
import { useTranslation } from "../hooks/useTranslation";
import type { ChatThread, Message, User } from "../types";
import {
  acceptMessageRequestByApi,
  blockUserByApi,
  createMessageRequestByApi,
  fetchBlockedUsersByApi,
  fetchConversationMessagesByApi,
  fetchMessageConversationsByApi,
  fetchMessageRequestsByApi,
  fetchUserByIdApi,
  markConversationReadByApi,
  rejectMessageRequestByApi,
  reportByApi,
  sendConversationMessageByApi,
  unblockUserByApi,
} from "../lib/api";
import { closeMessageSocket, getMessageSocket } from "../lib/ws";

export function Messages() {
  const { t } = useTranslation();
  usePageTitle(t("msg.title"));
  const { user, login } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [reportTarget, setReportTarget] = useState<{
    type: "user" | "message" | "conversation";
    id: string;
    label: string;
  } | null>(null);
  const [apiThreads, setApiThreads] = useState<ChatThread[]>([]);
  const [apiMessagesByThread, setApiMessagesByThread] = useState<Record<string, Message[]>>({});
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const toMessage = (raw: any): Message => ({
    id: String(raw?.id ?? `m-${Date.now()}`),
    senderId: String(raw?.senderId ?? raw?.fromUserId ?? ""),
    receiverId: String(raw?.receiverId ?? raw?.toUserId ?? ""),
    content: String(raw?.content ?? raw?.bodyText ?? ""),
    createdAt: String(raw?.createdAt ?? new Date().toISOString()),
    read: Boolean(raw?.read ?? false),
  });

  const mergeThreadsById = (list: ChatThread[]) => {
    const map = new Map<string, ChatThread>();
    list.forEach((thread) => {
      map.set(thread.id, thread);
    });
    return Array.from(map.values());
  };

  const findThreadByPeer = (threads: ChatThread[], peerId: string) =>
    threads.find(
      (thread) =>
        thread.participants.some((participant) => participant.id === user?.id) &&
        thread.participants.some((participant) => participant.id === peerId),
    );

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function loadMessageThreadsFromApi() {
      setIsLoading(true);
      setHasError(false);
      try {
        const [conversations, requests, blocked] = await Promise.all([
          fetchMessageConversationsByApi(user.id),
          fetchMessageRequestsByApi(user.id),
          fetchBlockedUsersByApi(),
        ]);
        if (!active) return;
        setApiThreads(mergeThreadsById([...conversations, ...requests]));
        setBlockedUsers(blocked);
      } catch {
        if (!active) return;
        setApiThreads([]);
        setBlockedUsers([]);
        setHasError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadMessageThreadsFromApi();

    return () => {
      active = false;
    };
  }, [user]);

  const loadThreadMessages = async (threadId: string) => {
    try {
      const data = await fetchConversationMessagesByApi(threadId);
      setApiMessagesByThread((prev) => ({ ...prev, [threadId]: data }));
      await markConversationReadByApi(threadId);
      setApiThreads((prev) =>
        prev
          ? prev.map((thread) =>
              thread.id === threadId ? { ...thread, unreadCount: 0 } : thread,
            )
          : prev,
      );
    } catch {
      toast.error(t("api.request_failed"));
    }
  };

  useEffect(() => {
    if (!user) return;

    const socket = getMessageSocket();

    const handleMessageNew = (payload: any) => {
      const rawMessage = payload?.message ?? payload;
      const conversationId = String(
        payload?.conversationId ??
        rawMessage?.conversationId ??
        payload?.threadId ??
        payload?.conversation?.id ??
        "",
      );
      if (!conversationId) return;

      const incoming = toMessage(rawMessage);

      setApiMessagesByThread((prev) => {
        const threadMessages = prev[conversationId] ?? [];
        if (threadMessages.some((item) => item.id === incoming.id)) {
          return prev;
        }
        return {
          ...prev,
          [conversationId]: [...threadMessages, incoming],
        };
      });

      setApiThreads((prev) =>
        prev
          ? prev.map((thread) =>
              thread.id === conversationId
                ? {
                    ...thread,
                    lastMessage: incoming,
                    unreadCount: selectedThreadId === conversationId
                      ? 0
                      : thread.unreadCount + 1,
                  }
                : thread,
            )
          : prev,
      );
    };

    const handleConversationUpdate = (payload: any) => {
      const conversationId = String(payload?.conversationId ?? payload?.id ?? "");
      if (!conversationId) return;

      setApiThreads((prev) =>
        prev
          ? prev.map((thread) => {
              if (thread.id !== conversationId) return thread;
              return {
                ...thread,
                lastMessage: payload?.lastMessage
                  ? toMessage({
                      ...thread.lastMessage,
                      ...payload.lastMessage,
                    })
                  : thread.lastMessage,
                unreadCount:
                  typeof payload?.unreadCount === "number"
                    ? payload.unreadCount
                    : thread.unreadCount,
                status:
                  payload?.status === "PENDING" ||
                  payload?.status === "ACCEPTED" ||
                  payload?.status === "REJECTED"
                    ? payload.status
                    : thread.status,
              };
            })
          : prev,
      );
    };

    socket.on("message:new", handleMessageNew);
    socket.on("conversation:update", handleConversationUpdate);

    return () => {
      socket.off("message:new", handleMessageNew);
      socket.off("conversation:update", handleConversationUpdate);
    };
  }, [user, selectedThreadId]);

  useEffect(() => {
    const to = searchParams.get("to");
    if (!to || !user) return;

    let active = true;

    async function ensureConversation() {
      const existingThread = findThreadByPeer(apiThreads, to);

      if (existingThread) {
        if (!active) return;
        setSelectedThreadId(existingThread.id);
        setSearchParams({});
        if (existingThread.status === "ACCEPTED") {
          void loadThreadMessages(existingThread.id);
        }
        return;
      }

      const receiver = await fetchUserByIdApi(to).catch(() => null);
      if (!receiver) return;

      try {
        await createMessageRequestByApi(to);
        const [conversations, requests] = await Promise.all([
          fetchMessageConversationsByApi(user.id),
          fetchMessageRequestsByApi(user.id),
        ]);
        if (!active) return;
        const merged = mergeThreadsById([...conversations, ...requests]);
        setApiThreads(merged);
        const pendingThread = findThreadByPeer(merged, to);
        setSelectedThreadId(pendingThread?.id ?? null);
        setSearchParams({});
        toast.success((t("msg.request_sent_to") as string).replace("{name}", receiver.name));
      } catch (error: any) {
        const [conversations, requests] = await Promise.all([
          fetchMessageConversationsByApi(user.id).catch(() => []),
          fetchMessageRequestsByApi(user.id).catch(() => []),
        ]);
        if (!active) return;
        const merged = mergeThreadsById([...conversations, ...requests]);
        setApiThreads(merged);
        const existingAfterError = findThreadByPeer(merged, to);
        if (existingAfterError) {
          setSelectedThreadId(existingAfterError.id);
          setSearchParams({});
          if (existingAfterError.status === "ACCEPTED") {
            void loadThreadMessages(existingAfterError.id);
          }
          return;
        }
        toast.error(error?.message || t("api.request_failed"));
      }
    }

    void ensureConversation();

    return () => {
      active = false;
    };
  }, [searchParams, user, apiThreads, t]);

  useEffect(() => {
    setShowBlockConfirm(false);
    setShowReportForm(false);
    setReportTarget(null);
    setReportReason("");
    setReportDetail("");
  }, [selectedThreadId]);

  if (!user) return null;
  if (hasError) return <ErrorState onRetry={() => {
    setHasError(false);
    setIsLoading(true);
    Promise.all([
      fetchMessageConversationsByApi(user.id),
      fetchMessageRequestsByApi(user.id),
      fetchBlockedUsersByApi(),
    ])
      .then(([c, r, blocked]) => {
        setApiThreads(mergeThreadsById([...c, ...r]));
        setBlockedUsers(blocked);
      })
      .catch(() => setHasError(true))
      .finally(() => setIsLoading(false));
  }} />;
  if (isLoading) return <LoadingSkeleton />;

  // Get threads for current user, filtered by search & blocked users
  const blockedIds = Array.from(
    new Set([...(user.blockedUsers || []), ...blockedUsers.map((item) => item.id)]),
  );
  const myThreads = apiThreads.filter(t => {
    if (!t.participants.some(p => p.id === user.id)) return false;
    const other = t.participants.find(p => p.id !== user.id);
    if (other && blockedIds.includes(other.id)) return false;
    if (searchTerm) {
      if (!other?.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    }
    return true;
  });
  const selectedThread = myThreads.find(t => t.id === selectedThreadId);
  const selectedUser = selectedThread?.participants.find(p => p.id !== user.id);

  const currentMessages = (
    selectedThreadId && apiMessagesByThread[selectedThreadId]
      ? apiMessagesByThread[selectedThreadId]
      : []
  );

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    if (selectedThreadId) {
      try {
        const socket = getMessageSocket();
        const bodyText = newMessage;
        let sent: Message | null = null;

        if (socket.connected) {
          const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          sent = await new Promise<Message | null>((resolve, reject) => {
            const cleanup = () => {
              socket.off("message:ack", handleAck);
              socket.off("message:error", handleError);
              window.clearTimeout(timer);
            };

            const handleAck = (payload: any) => {
              if (payload?.clientMsgId !== clientMsgId) return;
              cleanup();
              resolve(payload?.message ? toMessage(payload.message) : null);
            };

            const handleError = (payload: any) => {
              if (payload?.clientMsgId !== clientMsgId) return;
              cleanup();
              reject(new Error(String(payload?.error ?? t("api.request_failed"))));
            };

            const timer = window.setTimeout(() => {
              cleanup();
              resolve(null);
            }, 5000);

            socket.on("message:ack", handleAck);
            socket.on("message:error", handleError);
            socket.emit("message:send", {
              conversationId: selectedThreadId,
              bodyText,
              clientMsgId,
            });
          });
        }

        if (!sent) {
          sent = await sendConversationMessageByApi(selectedThreadId, bodyText);
        }

        if (sent) {
          setApiMessagesByThread((prev) => ({
            ...prev,
            [selectedThreadId]: [...(prev[selectedThreadId] ?? []), sent],
          }));
          setApiThreads((prev) =>
            prev
              ? prev.map((thread) =>
                  thread.id === selectedThreadId
                    ? { ...thread, lastMessage: sent }
                    : thread,
                )
              : prev,
          );
          setNewMessage("");
          return;
        }
      } catch {
        toast.error(t("api.request_failed"));
        return;
      }
    }

    setNewMessage("");
  };

  const handleAccept = async () => {
    if (selectedThreadId) {
      try {
        const conversationId = await acceptMessageRequestByApi(selectedThreadId);
        const [conversations, requests] = await Promise.all([
          fetchMessageConversationsByApi(user.id),
          fetchMessageRequestsByApi(user.id),
        ]);
        const merged = mergeThreadsById([...conversations, ...requests]);
        setApiThreads(merged);
        const acceptedThread =
          (conversationId
            ? merged.find((thread) => thread.id === conversationId)
            : undefined) ??
          (selectedUser ? findThreadByPeer(merged, selectedUser.id) : undefined);

        if (acceptedThread) {
          closeMessageSocket();
          getMessageSocket();
          setSelectedThreadId(acceptedThread.id);
          void loadThreadMessages(acceptedThread.id);
        } else {
          setSelectedThreadId(null);
        }
      } catch {
        toast.error(t("api.request_failed"));
        return;
      }
      toast.success((t("msg.can_chat_now_with") as string).replace("{name}", selectedUser?.name || ""));
    }
  };

  const handleReject = async () => {
    if (selectedThreadId) {
      try {
        await rejectMessageRequestByApi(selectedThreadId);
      } catch {
        toast.error(t("api.request_failed"));
        return;
      }

      setApiThreads((prev) => prev ? prev.filter((thread) => thread.id !== selectedThreadId) : prev);
      setSelectedThreadId(null);
      toast.error((t("msg.request_rejected_from") as string).replace("{name}", selectedUser?.name || ""));
    }
  };

  const handleUnblock = async (blockedUser: User) => {
    try {
      await unblockUserByApi(blockedUser.id);
      setBlockedUsers((prev) => prev.filter((item) => item.id !== blockedUser.id));
      login({
        ...user,
        blockedUsers: (user.blockedUsers || []).filter((id) => id !== blockedUser.id),
      });
      toast.success((t("msg.user_unblocked") as string).replace("{name}", blockedUser.name));
    } catch {
      toast.error(t("api.request_failed"));
    }
  };

  const openReportForm = (target: {
    type: "user" | "message" | "conversation";
    id: string;
    label: string;
  }) => {
    setReportTarget(target);
    setShowReportForm(true);
  };

  const handleSubmitReport = async () => {
    if (!reportTarget) return;
    if (!reportReason.trim()) {
      toast.error(t("msg.report_reason_required"));
      return;
    }

    try {
      await reportByApi({
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason: reportDetail.trim()
          ? `${reportReason.trim()}: ${reportDetail.trim()}`
          : reportReason.trim(),
      });
    } catch {
      toast.error(t("api.request_failed"));
      return;
    }

    setShowReportForm(false);
    setReportTarget(null);
    setReportReason("");
    setReportDetail("");
    toast.success(t("msg.report_submitted"));
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 md:gap-6">
      {/* Sidebar - hidden on mobile when a thread is selected */}
      <Card className={`${selectedThreadId ? "hidden md:flex" : "flex"} w-full md:w-80 flex-col overflow-hidden glass-panel`}>
        <CardHeader className="border-b border-white/10 p-4">
          <CardTitle className="text-lg text-zinc-100">{t("msg.title")}</CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input placeholder={t("msg.search_pl")} className="pl-9 h-9" value={searchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0 custom-scrollbar">
          {/* Message Requests Section */}
          {(() => {
            const pendingRequests = myThreads.filter(t => t.status === "PENDING" && t.initiatorId !== user.id);
            if (pendingRequests.length === 0) return null;
            return (
              <div>
                <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
                  <p className="text-xs font-medium text-amber-400">{t("msg.requests")} ({pendingRequests.length})</p>
                </div>
                {pendingRequests.map((thread) => {
                  const chatUser = thread.participants.find(p => p.id !== user.id);
                  if (!chatUser) return null;
                  return (
                    <div
                      key={thread.id}
                      data-testid={`thread-item-${thread.id}`}
                      onClick={() => {
                        setSelectedThreadId(thread.id);
                        setSearchParams({});
                        if (thread.status === "ACCEPTED") {
                          void loadThreadMessages(thread.id);
                        }
                      }}
                      className={`flex cursor-pointer items-center gap-3 border-b border-amber-500/10 p-4 transition-colors hover:bg-amber-500/5 ${selectedThreadId === thread.id ? "bg-amber-500/10" : ""}`}
                    >
                      <Avatar src={chatUser.avatar} fallback={chatUser.name.charAt(0)} />
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate font-medium text-zinc-100">{chatUser.name}</p>
                        <p className="truncate text-xs text-amber-400 font-medium">{t("msg.new_request")}</p>
                      </div>
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Active Conversations */}
          {(() => {
            const activeThreads = myThreads.filter(t => t.status !== "REJECTED" && !(t.status === "PENDING" && t.initiatorId !== user.id));
            if (activeThreads.length === 0 && myThreads.filter(t => t.status === "PENDING" && t.initiatorId !== user.id).length === 0) {
              return (
                <EmptyState
                  title={t("msg.no_conversations")}
                  description={t("msg.select_conv")}
                  className="py-10"
                  action={
                    <Link to="/talent">
                      <Button size="sm">{t("talent.title")}</Button>
                    </Link>
                  }
                />
              );
            }
            return activeThreads.map((thread) => {
              const chatUser = thread.participants.find(p => p.id !== user.id);
              if (!chatUser) return null;
              
              const lastMsg = thread.lastMessage;

              return (
                <div
                  key={thread.id}
                  data-testid={`thread-item-${thread.id}`}
                  onClick={() => {
                    setSelectedThreadId(thread.id);
                    setSearchParams({});
                    if (thread.status === "ACCEPTED") {
                      void loadThreadMessages(thread.id);
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-3 border-b border-white/5 p-4 transition-colors hover:bg-zinc-800/50 ${selectedThreadId === thread.id ? "bg-zinc-800/80" : ""}`}
                >
                  <Avatar
                    src={chatUser.avatar}
                    fallback={chatUser.name.charAt(0)}
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <p className="truncate font-medium text-zinc-100">
                        {chatUser.name}
                      </p>
                      {lastMsg && (
                        <span className="text-[10px] text-zinc-500">
                          {new Date(lastMsg.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className={`truncate text-xs ${thread.status === "PENDING" ? "text-zinc-500 italic" : "text-zinc-400"}`}>
                      {thread.status === "PENDING" ? t("msg.waiting_accept") : (lastMsg ? lastMsg.content : t("msg.start_conv"))}
                    </p>
                  </div>
                  {thread.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white shrink-0">
                      {thread.unreadCount}
                    </span>
                  )}
                </div>
              );
            });
          })()}

          {blockedUsers.length > 0 ? (
            <div className="border-t border-white/10">
              <div className="px-4 py-2 bg-zinc-950/60">
                <p className="text-xs font-medium text-zinc-400">
                  {t("msg.blocked_users")} ({blockedUsers.length})
                </p>
              </div>
              {blockedUsers.map((blockedUser) => (
                <div
                  key={blockedUser.id}
                  className="flex items-center gap-3 border-b border-white/5 p-4"
                >
                  <Avatar
                    src={blockedUser.avatar}
                    fallback={blockedUser.name.charAt(0)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-100">
                      {blockedUser.name}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {blockedUser.title || formatRole(blockedUser.role)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/10 text-xs"
                    onClick={() => void handleUnblock(blockedUser)}
                  >
                    {t("msg.unblock")}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Chat Area - hidden on mobile when no thread is selected */}
      <Card className={`${selectedThreadId ? "flex" : "hidden md:flex"} flex-1 flex-col overflow-hidden glass-panel`}>
        {selectedThread && selectedUser ? (
          <>
            <CardHeader className="border-b border-white/10 p-4 flex flex-row items-center gap-4">
              <button
                onClick={() => setSelectedThreadId(null)}
                className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar
                src={selectedUser.avatar}
                fallback={selectedUser.name.charAt(0)}
              />
              <div className="flex-1">
                <CardTitle className="text-lg text-zinc-100">{selectedUser.name}</CardTitle>
                <p className="text-xs text-zinc-400">
                  {selectedUser.title || formatRole(selectedUser.role)}
                  {selectedUser.company ? ` ${t("common.at")} ${selectedUser.company}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link to={`/u/${selectedUser.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-zinc-400 hover:text-zinc-100">
                    <UserIcon className="h-4 w-4" />
                    {t("common.profile")}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-500 hover:text-red-400"
                  title={t("msg.block_user")}
                  onClick={() => setShowBlockConfirm(true)}
                >
                  <Ban className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-500 hover:text-amber-300"
                  title={t("msg.report_conversation")}
                  onClick={() =>
                    openReportForm({
                      type: "conversation",
                      id: selectedThread.id,
                      label: selectedUser.name,
                    })
                  }
                >
                  <ShieldAlert className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-500 hover:text-red-400"
                  title={t("msg.report_user")}
                  onClick={() =>
                    openReportForm({
                      type: "user",
                      id: selectedUser.id,
                      label: selectedUser.name,
                    })
                  }
                >
                  <Flag className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            {/* Block confirmation dialog */}
            {showBlockConfirm && (
              <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-red-400">{t("msg.block_confirm_prefix")} {selectedUser.name} {t("msg.block_confirm_suffix")}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowBlockConfirm(false)}>{t("msg.cancel")}</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={async () => {
                    try {
                      await blockUserByApi(selectedUser.id);
                      setBlockedUsers((prev) => {
                        if (prev.some((item) => item.id === selectedUser.id)) {
                          return prev;
                        }
                        return [selectedUser, ...prev];
                      });
                      login({ ...user, blockedUsers: [...new Set([...(blockedIds || []), selectedUser.id])] });
                      setShowBlockConfirm(false);
                      setSelectedThreadId(null);
                      setApiThreads((prev) =>
                        prev
                          ? prev.filter((thread) => !thread.participants.some((participant) => participant.id === selectedUser.id))
                          : prev,
                      );
                      toast.success((t("msg.user_blocked") as string).replace("{name}", selectedUser.name));
                    } catch {
                      toast.error(t("api.request_failed"));
                    }
                  }}>
                    <Ban className="h-3 w-3 mr-1" /> {t("msg.block")}
                  </Button>
                </div>
              </div>
            )}

            {showReportForm && (
              <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-3">
                <p className="text-sm text-amber-300 font-medium">{t("msg.report_title")}</p>
                {reportTarget ? (
                  <p className="text-xs text-amber-100/80">
                    {t("msg.report_target_prefix")} {reportTarget.label}
                  </p>
                ) : null}
                <Input
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder={t("msg.report_reason_placeholder")}
                />
                <textarea
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  placeholder={t("msg.report_detail_placeholder")}
                  rows={3}
                  className="w-full rounded-lg border border-amber-500/20 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowReportForm(false);
                      setReportTarget(null);
                      setReportReason("");
                      setReportDetail("");
                    }}
                  >
                    {t("msg.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                    onClick={handleSubmitReport}
                    disabled={!reportReason.trim()}
                  >
                    {t("msg.report_submit")}
                  </Button>
                </div>
              </div>
            )}
            
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar flex flex-col">
              {currentMessages.length === 0 && selectedThread.status === "ACCEPTED" && (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState
                    title={t("msg.start_conv")}
                    description={t("msg.select_conv")}
                    className="py-10"
                  />
                </div>
              )}
              {currentMessages.map((msg) => {
                const isMe = msg.senderId === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? "bg-indigo-600 text-white rounded-br-sm shadow-[0_0_10px_rgba(79,70,229,0.3)]" : "bg-zinc-800 text-zinc-100 rounded-bl-sm border border-white/5"}`}
                    >
                      <p className="text-sm" data-testid="message-content">{msg.content}</p>
                      <span
                        className={`mt-1 block text-[10px] ${isMe ? "text-indigo-200" : "text-zinc-500"}`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {!isMe ? (
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1 text-[10px] text-zinc-500 transition-colors hover:text-amber-300"
                          onClick={() =>
                            openReportForm({
                              type: "message",
                              id: msg.id,
                              label: msg.content.slice(0, 36),
                            })
                          }
                        >
                          <Flag className="h-3 w-3" />
                          {t("msg.report_message")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              
              {selectedThread.status === "PENDING" && selectedThread.initiatorId !== user.id && (
                <div className="mt-auto pt-4">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
                    <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-amber-400" />
                    <h3 className="mb-2 text-lg font-medium text-amber-400">{t("msg.requests")}</h3>
                    <p className="mb-6 text-sm text-zinc-300">
                      {(t("msg.req_desc") as string).replace("{name}", selectedUser.name)}
                    </p>
                    <div className="flex justify-center gap-4">
                      <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={handleReject}>
                        <X className="mr-2 h-4 w-4" />
                        {t("msg.reject")}
                      </Button>
                      <Button className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]" onClick={handleAccept}>
                        <Check className="mr-2 h-4 w-4" />
                        {t("msg.accept")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {selectedThread.status === "PENDING" && selectedThread.initiatorId === user.id && (
                <div className="mt-auto pt-4 text-center text-sm text-zinc-500">
                  {(t("msg.waiting_other") as string).replace("{name}", selectedUser.name)}
                </div>
              )}
            </CardContent>
            
            {selectedThread.status === "ACCEPTED" && (
              <div className="border-t border-white/10 p-4 flex items-center gap-2 bg-zinc-900/50">
                <Input
                  data-testid="message-input"
                  placeholder={t("msg.type_pl")}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1"
                />
                <Button
                  data-testid="message-send-btn"
                  size="icon"
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              title={t("msg.no_conversations")}
              description={t("msg.select_conv")}
              className="py-10"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
