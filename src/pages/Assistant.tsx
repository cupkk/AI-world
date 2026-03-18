import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  BrainCircuit,
  Database,
  ExternalLink,
  Eye,
  FileText,
  Heart,
  History,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Tag,
  User as UserIcon,
} from "lucide-react";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useTranslation } from "../hooks/useTranslation";
import {
  ApiError,
  fetchHubContentByIdApi,
  fetchKnowledgeBaseFilesApi,
  fetchUserByIdApi,
  requestAssistantRecommend,
} from "../lib/api";
import { featureFlags } from "../lib/features";
import { usePageTitle } from "../lib/usePageTitle";
import { formatRole } from "../lib/utils";
import { useAuthStore } from "../store/authStore";
import type { AssistantMessage, KnowledgeDocument } from "../types";

type ConversationHistoryEntry = {
  id: string;
  title: string;
  date: string;
  preview: string;
};

function getInitialAssistantMessage(content: string): AssistantMessage[] {
  return [
    {
      id: "msg-welcome",
      role: "assistant",
      content,
    },
  ];
}

function formatKnowledgeScore(score?: number) {
  if (score === undefined) return null;
  return `${Math.round(score * 100)}%`;
}

export function Assistant() {
  const { t, language } = useTranslation();
  usePageTitle(t("assistant.ai_assistant"));
  const { user } = useAuthStore();

  const [showHistory, setShowHistory] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationHistoryEntry[]
  >(() => {
    try {
      const stored = sessionStorage.getItem("assistant_history");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [messages, setMessages] = useState<AssistantMessage[]>(
    getInitialAssistantMessage(t("assistant.welcome_message_full")),
  );
  const [input, setInput] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<
    KnowledgeDocument[]
  >([]);
  const [isKnowledgeBaseLoading, setIsKnowledgeBaseLoading] = useState(
    featureFlags.knowledgeBase,
  );
  const [hasKnowledgeBaseError, setHasKnowledgeBaseError] = useState(false);
  const [assistantKnowledgeBaseReadyCount, setAssistantKnowledgeBaseReadyCount] =
    useState<number | null>(null);

  const loadKnowledgeBase = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!featureFlags.knowledgeBase) return;

    if (!silent) {
      setIsKnowledgeBaseLoading(true);
    }

    try {
      const files = await fetchKnowledgeBaseFilesApi();
      setKnowledgeDocuments(files);
      setHasKnowledgeBaseError(false);
    } catch {
      setHasKnowledgeBaseError(true);
    } finally {
      if (!silent) {
        setIsKnowledgeBaseLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!featureFlags.knowledgeBase) return;
    void loadKnowledgeBase();
  }, []);

  const processingDocumentCount = knowledgeDocuments.filter(
    (item) => item.status === "PROCESSING",
  ).length;
  const failedDocumentCount = knowledgeDocuments.filter(
    (item) => item.status === "FAILED",
  ).length;
  const readyDocumentCountFromList = knowledgeDocuments.filter(
    (item) => item.status === "READY",
  ).length;
  const readyDocumentCount = Math.max(
    assistantKnowledgeBaseReadyCount ?? 0,
    readyDocumentCountFromList,
  );

  useEffect(() => {
    if (!featureFlags.knowledgeBase || processingDocumentCount === 0) return;

    const timer = window.setInterval(() => {
      void loadKnowledgeBase({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [processingDocumentCount]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const prompt = input.trim();
    const nextUserMessage: AssistantMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: prompt,
    };
    const requestHistory = messages
      .concat(nextUserMessage)
      .slice(-6)
      .map((item) => ({ role: item.role, content: item.content }));

    setMessages((prev) => [...prev, nextUserMessage]);
    setInput("");
    setIsReplying(true);
    setAssistantError(null);

    try {
      const result = await requestAssistantRecommend({
        query: prompt,
        userId: user?.id,
        locale: language === "zh" ? "zh-CN" : "en",
        history: requestHistory,
      });

      setAssistantKnowledgeBaseReadyCount(
        result.knowledgeBaseReadyCount ?? null,
      );

      const [recommendedUser, recommendedContent] = await Promise.all([
        result.recommendedUserId
          ? fetchUserByIdApi(result.recommendedUserId).catch(() => undefined)
          : Promise.resolve(undefined),
        result.recommendedContentId
          ? fetchHubContentByIdApi(result.recommendedContentId).catch(
              () => undefined,
            )
          : Promise.resolve(undefined),
      ]);

      const aiResponse: AssistantMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: result.reply || t("assistant.generic_reply"),
        recommendedUser,
        recommendedContent,
        knowledgeSources: result.knowledgeSources,
      };

      setMessages((prev) => [...prev, aiResponse]);

      const previewSource = result.reply || t("assistant.generic_reply");
      const entry = {
        id: `conv_${Date.now()}`,
        title: prompt.slice(0, 30) + (prompt.length > 30 ? "..." : ""),
        date: new Date().toISOString().split("T")[0],
        preview:
          previewSource.slice(0, 50) +
          (previewSource.length > 50 ? "..." : ""),
      };

      setConversationHistory((prev) => {
        const updated = [entry, ...prev].slice(0, 20);
        try {
          sessionStorage.setItem("assistant_history", JSON.stringify(updated));
        } catch {
          // Ignore storage errors and keep the current chat usable.
        }
        return updated;
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.errorCode === "ASSISTANT_UNAVAILABLE"
      ) {
        setAssistantError(error.message || t("assistant.service_unavailable"));
        toast.error(error.message || t("assistant.service_unavailable"));
      } else {
        toast.error(t("api.request_failed"));
      }
    } finally {
      setIsReplying(false);
    }
  };

  const resetConversation = () => {
    setMessages(getInitialAssistantMessage(t("assistant.welcome_message_short")));
    setAssistantError(null);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-5xl flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-100">
              {t("assistant.ai_assistant")}
            </h1>
            <p className="text-sm text-zinc-400">
              {t("assistant.ai_assistant_powered")}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/10"
          onClick={() => setShowHistory((prev) => !prev)}
        >
          <History className="h-4 w-4" />
          {t("nav.history")}
        </Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {showHistory && (
          <div className="flex w-64 shrink-0 flex-col rounded-xl border border-white/10 bg-zinc-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-white/10 p-3">
              <div>
                <h3 className="text-sm font-medium text-zinc-200">
                  {t("assistant.chat_history_title")}
                </h3>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {t("assistant.history_local_only")}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs text-indigo-400"
                onClick={resetConversation}
              >
                <Plus className="h-3 w-3" />
                {t("assistant.new_chat")}
              </Button>
            </div>
            <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
              {conversationHistory.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  {t("assistant.no_history")}
                </p>
              ) : (
                conversationHistory.map((conversation) => (
                  <button
                    key={conversation.id}
                    className="w-full rounded-lg p-2.5 text-left transition-colors hover:bg-zinc-800/50"
                  >
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {conversation.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">
                      {conversation.date}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-400">
                      {conversation.preview}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <Card className="glass-panel flex flex-1 flex-col overflow-hidden border-white/10 shadow-xl">
          <CardContent className="custom-scrollbar flex-1 space-y-6 overflow-y-auto bg-zinc-900/30 p-6">
            {featureFlags.knowledgeBase ? (
              <div
                data-testid="assistant-kb-banner"
                className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                      <Database className="h-4 w-4 text-indigo-400" />
                      {t("assistant.kb_status_title")}
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">
                      {processingDocumentCount > 0
                        ? t("assistant.kb_processing_hint")
                        : t("assistant.kb_status_desc")}
                    </p>
                  </div>
                  <Link to="/settings/knowledge-base">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-white/10"
                    >
                      <FileText className="h-4 w-4" />
                      {t("assistant.kb_open_settings")}
                    </Button>
                  </Link>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      {t("assistant.kb_ready_count")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-100">
                      {readyDocumentCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      {t("assistant.kb_processing_count")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-100">
                      {processingDocumentCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      {t("assistant.kb_failed_count")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-100">
                      {failedDocumentCount}
                    </p>
                  </div>
                </div>

                {isKnowledgeBaseLoading ? (
                  <p className="mt-4 text-xs text-zinc-500">
                    {t("assistant.kb_loading")}
                  </p>
                ) : null}

                {hasKnowledgeBaseError ? (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                    {t("assistant.kb_load_error")}
                  </div>
                ) : null}

                {!isKnowledgeBaseLoading &&
                !hasKnowledgeBaseError &&
                readyDocumentCount === 0 ? (
                  <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
                    <div className="text-sm font-medium text-sky-100">
                      {t("assistant.kb_empty_title")}
                    </div>
                    <p className="mt-1 text-xs text-sky-100/80">
                      {t("assistant.kb_empty_desc")}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {assistantError ? (
              <div
                data-testid="assistant-error-banner"
                className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              >
                <div className="font-medium">
                  {t("assistant.service_unavailable")}
                </div>
                <p className="mt-1 text-xs text-amber-200/80">
                  {t("assistant.service_unavailable_desc")}
                </p>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                data-testid={`assistant-message-${message.role}`}
                className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    message.role === "user"
                      ? "border border-white/10 bg-zinc-800 text-zinc-300"
                      : "bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                  }`}
                >
                  {message.role === "user" ? (
                    <span className="text-xs font-medium">
                      {t("assistant.user_label")}
                    </span>
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`flex max-w-[80%] flex-col gap-3 rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                    message.role === "user"
                      ? "border border-white/10 bg-zinc-800/80 text-zinc-100"
                      : "border border-white/10 bg-zinc-900/80 text-zinc-100"
                  }`}
                >
                  <p>{message.content}</p>

                  {message.knowledgeSources && message.knowledgeSources.length > 0 ? (
                    <div className="mt-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                      <div className="mb-3">
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-sky-100/90">
                          {t("assistant.kb_sources_title")}
                        </div>
                        <p className="mt-1 text-xs text-sky-100/75">
                          {t("assistant.kb_sources_desc")}
                        </p>
                      </div>
                      <div className="space-y-3">
                        {message.knowledgeSources.map((source, index) => (
                          <div
                            key={`${message.id}-${source.fileId}-${index}`}
                            data-testid={`assistant-knowledge-source-${index}`}
                            className="rounded-xl border border-white/10 bg-black/10 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className="gap-1 border-white/10 text-[10px] text-sky-100"
                              >
                                <FileText className="h-3 w-3" />
                                {source.fileName}
                              </Badge>
                              {formatKnowledgeScore(source.score) ? (
                                <Badge
                                  variant="outline"
                                  className="border-white/10 text-[10px] text-zinc-200"
                                >
                                  {t("assistant.kb_source_relevance")}:{" "}
                                  {formatKnowledgeScore(source.score)}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs leading-6 text-zinc-100/85">
                              {source.excerpt}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {message.recommendedUser ? (
                    <div className="mt-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                      <div className="flex items-start gap-4">
                        <Avatar
                          src={message.recommendedUser.avatar}
                          fallback={message.recommendedUser.name.charAt(0)}
                          className="h-12 w-12 border border-white/10"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-zinc-100">
                            {message.recommendedUser.name}
                          </h4>
                          <p className="mb-2 text-xs text-indigo-400">
                            {message.recommendedUser.title ||
                              formatRole(message.recommendedUser.role)}
                          </p>
                          <p className="mb-3 line-clamp-2 text-xs text-zinc-400">
                            {message.recommendedUser.bio}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Link to={`/u/${message.recommendedUser.id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 border-white/10 text-xs hover:bg-white/5"
                              >
                                <UserIcon className="h-3 w-3" />
                                {t("assistant.actions.view_profile")}
                              </Button>
                            </Link>
                            <Link to={`/messages?to=${message.recommendedUser.id}`}>
                              <Button
                                size="sm"
                                className="h-8 gap-1.5 bg-indigo-600 text-xs text-white hover:bg-indigo-500"
                              >
                                <MessageSquare className="h-3 w-3" />
                                {t("assistant.actions.send_dm")}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {message.recommendedContent ? (
                    <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase"
                          >
                            {message.recommendedContent.type}
                          </Badge>
                          <span className="text-xs text-zinc-500">
                            {new Date(
                              message.recommendedContent.createdAt,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-medium text-zinc-100">
                          {message.recommendedContent.title}
                        </h4>
                        <p className="line-clamp-2 text-xs text-zinc-400">
                          {message.recommendedContent.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {message.recommendedContent.views}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {message.recommendedContent.likes}
                          </span>
                        </div>
                        {message.recommendedContent.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {message.recommendedContent.tags
                              .slice(0, 4)
                              .map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="border-white/10 text-[10px] text-zinc-400"
                                >
                                  <Tag className="mr-0.5 h-2.5 w-2.5" />
                                  {tag}
                                </Badge>
                              ))}
                          </div>
                        ) : null}
                        <Link
                          to={`/hub/${message.recommendedContent.type.toLowerCase()}/${message.recommendedContent.id}`}
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-white/10 text-xs hover:bg-white/5"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t("assistant.view_details")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {isReplying ? (
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="max-w-[80%] rounded-2xl border border-white/10 bg-zinc-900/80 px-5 py-3.5 text-sm leading-relaxed text-zinc-300 shadow-sm">
                  {t("assistant.thinking")}
                </div>
              </div>
            ) : null}
          </CardContent>

          <div className="border-t border-white/10 bg-zinc-900/50 p-4 backdrop-blur-md">
            <div className="relative flex items-center">
              <Input
                data-testid="assistant-input"
                placeholder={t("assistant.type_message")}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSend();
                  }
                }}
                className="rounded-xl border-white/10 bg-zinc-900/50 py-6 pr-12 text-base text-zinc-100 focus-visible:ring-indigo-500"
              />
              <Button
                data-testid="assistant-send-btn"
                size="icon"
                onClick={() => void handleSend()}
                disabled={!input.trim() || isReplying}
                className="absolute right-2 h-8 w-8 rounded-lg bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)] hover:bg-indigo-500"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="custom-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
              {[
                t("assistant.suggestion.find_nlp_experts"),
                t("assistant.suggestion.recommend_learning_path"),
                t("assistant.suggestion.show_research_projects"),
                t("assistant.suggestion.find_enterprise_partners"),
                t("assistant.suggestion.recommend_paper"),
              ].map((suggestion) => (
                <Badge
                  key={suggestion}
                  variant="secondary"
                  className="cursor-pointer whitespace-nowrap border border-white/5 hover:bg-zinc-800"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
