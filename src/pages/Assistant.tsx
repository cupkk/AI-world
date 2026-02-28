import { formatRole } from "../lib/utils";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useDataStore } from "../store/dataStore";
import { useTranslation } from "../lib/i18n";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Avatar } from "../components/ui/Avatar";
import { BrainCircuit, Send, Sparkles, MessageSquare, User as UserIcon, ExternalLink, Eye, Heart, Tag, History, Plus, ChevronLeft } from "lucide-react";
import { AssistantMessage } from "../types";
import { usePageTitle } from "../lib/usePageTitle";

export function Assistant() {
  const { t } = useTranslation();
  usePageTitle(t("assistant.ai_assistant") || "AI Assistant");
  const { users, contents } = useDataStore();
  const [showHistory, setShowHistory] = useState(false);
  const [conversationHistory] = useState([
    { id: "conv1", title: "Find NLP experts", date: "2025-02-25", preview: "Recommended Alice Chen..." },
    { id: "conv2", title: "Learning resources for ML", date: "2025-02-24", preview: "Here are some great papers..." },
    { id: "conv3", title: "Project collaboration", date: "2025-02-22", preview: "Found research projects..." },
  ]);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "msg1",
      role: "assistant",
      content:
        "Hello! I am your AI-World Assistant. I can help you find experts, recommend learning resources, or draft content. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: AssistantMessage = { id: `msg_${Date.now()}`, role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Mock AI response with recommendation
    setTimeout(() => {
      const q = input.toLowerCase();
      const isExpertQuery = q.includes("expert") || q.includes("nlp") || q.includes("alice") || q.includes("researcher");
      const isProjectQuery = q.includes("project") || q.includes("research") || q.includes("collaboration") || q.includes("join");
      const isLearningQuery = q.includes("learn") || q.includes("course") || q.includes("tutorial") || q.includes("path") || q.includes("study");
      const isContentQuery = q.includes("paper") || q.includes("tool") || q.includes("article") || q.includes("read");
      
      let aiResponse: AssistantMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: "I can certainly help with that. Here is some information based on your request.",
      };

      if (isExpertQuery) {
        const recommendedExpert = users.find(u => u.name === "Alice Chen");
        aiResponse = {
          id: `msg_${Date.now() + 1}`,
          role: "assistant",
          content: "Based on your query, I recommend connecting with Alice Chen. She is a Senior AI Researcher specializing in LLMs and Computer Vision, and is currently working on efficient attention mechanisms.",
          recommendedUser: recommendedExpert,
        };
      } else if (isProjectQuery) {
        const project = contents.find(c => c.type === "PROJECT" && c.status === "PUBLISHED");
        if (project) {
          aiResponse = {
            id: `msg_${Date.now() + 1}`,
            role: "assistant",
            content: `I found a great project opportunity for you: "${project.title}". This could be a perfect fit for collaboration. You can view the details and apply to join.`,
            recommendedContent: project,
          };
        }
      } else if (isLearningQuery) {
        const paper = contents.find(c => c.type === "PAPER" && c.status === "PUBLISHED");
        if (paper) {
          aiResponse = {
            id: `msg_${Date.now() + 1}`,
            role: "assistant",
            content: `For your learning journey, I recommend checking out "${paper.title}". It covers key concepts that will help you grow your skills in this area.`,
            recommendedContent: paper,
          };
        }
      } else if (isContentQuery) {
        const published = contents.filter(c => c.status === "PUBLISHED");
        const pick = published[Math.floor(Math.random() * published.length)];
        if (pick) {
          aiResponse = {
            id: `msg_${Date.now() + 1}`,
            role: "assistant",
            content: `Here's a great piece of content I found: "${pick.title}". It has ${pick.views} views and ${pick.likes} likes from the community.`,
            recommendedContent: pick,
          };
        }
      } else if (q.includes("enterprise") || q.includes("company") || q.includes("hiring")) {
        const enterprise = users.find(u => u.role === "ENTERPRISE_LEADER");
        if (enterprise) {
          aiResponse = {
            id: `msg_${Date.now() + 1}`,
            role: "assistant",
            content: `I found an enterprise leader who might interest you: ${enterprise.name} from ${enterprise.company || "an innovative company"}. They are actively looking for AI talent.`,
            recommendedUser: enterprise,
          };
        }
      }

      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="mx-auto max-w-5xl h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-500/30">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div>
            <h{t("assistant.ai_assistant")}
            </h1>
            <p className="text-zinc-400 text-sm">
              Powered by Gemini - Your personal guide to AI-World
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/10" onClick={() => setShowHistory(!showHistory)}>
          <History className="h-4 w-4" />
          {t("nav.history") || "History"}y className="h-4 w-4" />
          History
        </Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* History Sidebar */}
        {showHistory && (
          <div className="w-64 shrink-0 rounded-xl border border-white/10 bg-zinc-900/50 backdrop-blur-sm flex flex-col">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-200">Chat History</h3>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-indigo-400" onClick={() => {
                setMessages([{ id: "msg1", role: "assistant", content: "Hello! I am your AI-World Assistant. How can I help you today?" }]);
              }}>
                <Plus className="h-3 w-3" /> New
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {conversationHistory.map((conv) => (
                <button key={conv.id} className="w-full text-left rounded-lg p-2.5 hover:bg-zinc-800/50 transition-colors">
                  <p className="text-sm font-medium text-zinc-200 truncate">{conv.title}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{conv.date}</p>
                  <p className="text-xs text-zinc-400 truncate mt-1">{conv.preview}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Chat */}

      <Card className="flex flex-1 flex-col overflow-hidden border-white/10 shadow-xl glass-panel">
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-900/30 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === "user" ? "bg-zinc-800 text-zinc-300 border border-white/10" : "bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]"}`}
              >
                {msg.role === "user" ? (
                  <span className="text-xs font-medium">You</span>
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm flex flex-col gap-3 ${msg.role === "user" ? "bg-zinc-800/80 border border-white/10 text-zinc-100" : "bg-zinc-900/80 border border-white/10 text-zinc-100"}`}
              >
                <p>{msg.content}</p>
                
                {msg.recommendedUser && (
                  <div className="mt-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                    <div className="flex items-start gap-4">
                      <Avatar src={msg.recommendedUser.avatar} fallback={msg.recommendedUser.name.charAt(0)} className="h-12 w-12 border border-white/10" />
                      <div className="flex-1">
                        <h4 className="font-medium text-zinc-100">{msg.recommendedUser.name}</h4>
                        <p className="text-xs text-indigo-400 mb-2">{msg.recommendedUser.title || formatRole(msg.recommendedUser.role)}</p>
                        <p className="text-xs text-zinc-400 line-clamp-2 mb-3">{msg.recommendedUser.bio}</p>
                        <div className="flex flex-wrap gap-2">
                          <Link to={`/u/${msg.recommendedUser.id}`}>
                            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-white/10 hover:bg-white/5">
                              <UserIcon className="h-3 w-3" />
                              View Profile
                            </Button>
                          </Link>
                          <Link to={`/messages?to=${msg.recommendedUser.id}`}>
                            <Button size="sm" className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white">
                              <MessageSquare className="h-3 w-3" />
                              Send DM
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {msg.recommendedContent && (
                  <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] uppercase">{msg.recommendedContent.type}</Badge>
                        <span className="text-xs text-zinc-500">
                          {new Date(msg.recommendedContent.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-medium text-zinc-100">{msg.recommendedContent.title}</h4>
                      <p className="text-xs text-zinc-400 line-clamp-2">{msg.recommendedContent.description}</p>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{msg.recommendedContent.views}</span>
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{msg.recommendedContent.likes}</span>
                      </div>
                      {msg.recommendedContent.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {msg.recommendedContent.tags.slice(0, 4).map(t => (
                            <Badge key={t} variant="outline" className="text-[10px] border-white/10 text-zinc-400">
                              <Tag className="mr-0.5 h-2.5 w-2.5" />{t}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Link to={`/hub/${msg.recommendedContent.type.toLowerCase()}/${msg.recommendedContent.id}`}>
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-white/10 hover:bg-white/5">
                          <ExternalLink className="h-3 w-3" />
                          {t("admin_hub.view") || "View Details"}
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
        <div className="border-t border-white/10 bg-zinc-900/50 p-4 backdrop-blur-md">
          <div className="relative flex items-center">
            <Input
              placeholder={t("assistant.type_message") || "Ask me anything..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="pr-12 py-6 text-base rounded-xl bg-zinc-900/50 border-white/10 focus-visible:ring-indigo-500 text-zinc-100"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim()}
              className="absolute right-2 h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.3)]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {[
              "Find experts in NLP",
              "Recommend a learning path",
              "Show me research projects",
              "Find enterprise partners",
              "Recommend a paper to read",
            ].map((suggestion) => (
              <Badge
                key={suggestion}
                variant="secondary"
                className="cursor-pointer whitespace-nowrap hover:bg-zinc-800 border border-white/5"
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
