import { formatRole } from "../../lib/utils";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { Input } from "./Input";
import { Button } from "./Button";
import { Avatar } from "./Avatar";
import { Send, Check, X, ShieldAlert, User, Flag, Ban, ArrowLeft } from "lucide-react";
import type { User as UserType, Message, ChatThread } from "../../types";

interface ChatWindowProps {
  thread: ChatThread;
  otherUser: UserType;
  currentUserId: string;
  messages: Message[];
  newMessage: string;
  onNewMessageChange: (val: string) => void;
  onSend: () => void;
  onAccept: () => void;
  onReject: () => void;
  onBack: () => void;
  onBlock?: () => void;
  showBlockConfirm?: boolean;
  onBlockConfirm?: () => void;
  onBlockCancel?: () => void;
}

export function ChatWindow({
  thread,
  otherUser,
  currentUserId,
  messages,
  newMessage,
  onNewMessageChange,
  onSend,
  onAccept,
  onReject,
  onBack,
  onBlock,
  showBlockConfirm,
  onBlockConfirm,
  onBlockCancel,
}: ChatWindowProps) {
  return (
    <>
      <CardHeader className="border-b border-white/10 p-4 flex flex-row items-center gap-4">
        <button
          onClick={onBack}
          className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar src={otherUser.avatar} fallback={otherUser.name.charAt(0)} />
        <div className="flex-1">
          <CardTitle className="text-lg text-zinc-100">{otherUser.name}</CardTitle>
          <p className="text-xs text-zinc-400">
            {otherUser.title || formatRole(otherUser.role)}
            {otherUser.company ? ` at ${otherUser.company}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link to={`/u/${otherUser.id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-zinc-400 hover:text-zinc-100">
              <User className="h-4 w-4" />
              Profile
            </Button>
          </Link>
          {onBlock && (
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-500 hover:text-red-400"
              title="Block User"
              onClick={onBlock}
            >
              <Ban className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-500 hover:text-red-400"
            title="Report User"
            onClick={() => {}}
          >
            <Flag className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {showBlockConfirm && onBlockConfirm && onBlockCancel && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-400">Block {otherUser.name}? You won't see their messages anymore.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onBlockCancel}>Cancel</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={onBlockConfirm}>
              <Ban className="h-3 w-3 mr-1" /> Block
            </Button>
          </div>
        </div>
      )}

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar flex flex-col">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? "bg-indigo-600 text-white rounded-br-sm shadow-[0_0_10px_rgba(79,70,229,0.3)]" : "bg-zinc-800 text-zinc-100 rounded-bl-sm border border-white/5"}`}>
                <p className="text-sm">{msg.content}</p>
                <span className={`mt-1 block text-[10px] ${isMe ? "text-indigo-200" : "text-zinc-500"}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}

        {thread.status === "PENDING" && thread.initiatorId !== currentUserId && (
          <div className="mt-auto pt-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
              <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-amber-400" />
              <h3 className="mb-2 text-lg font-medium text-amber-400">Message Request</h3>
              <p className="mb-6 text-sm text-zinc-300">
                {otherUser.name} wants to connect with you. Accepting this request will allow them to send you messages.
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={onReject}>
                  <X className="mr-2 h-4 w-4" /> Reject
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]" onClick={onAccept}>
                  <Check className="mr-2 h-4 w-4" /> Accept Request
                </Button>
              </div>
            </div>
          </div>
        )}

        {thread.status === "PENDING" && thread.initiatorId === currentUserId && (
          <div className="mt-auto pt-4 text-center text-sm text-zinc-500">
            Waiting for {otherUser.name} to accept your message request.
          </div>
        )}
      </CardContent>

      {thread.status === "ACCEPTED" && (
        <div className="border-t border-white/10 p-4 flex items-center gap-2 bg-zinc-900/50">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => onNewMessageChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            className="flex-1"
          />
          <Button size="icon" onClick={onSend} disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
