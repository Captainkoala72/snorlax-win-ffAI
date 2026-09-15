"use client";

import {
  AlertTriangle,
  Beer,
  Check,
  ChevronRight,
  Copy,
  Database,
  Globe,
  Loader2,
  Newspaper,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import type { UiMessage, UiToolCall } from "@/lib/chat-ui";
import { toolSummary } from "@/lib/ai/tools";
import { Markdown } from "./Markdown";

const TOOL_ICONS: Record<string, typeof Database> = {
  get_league_overview: Trophy,
  list_teams: Database,
  get_team: Beer,
  get_matchups: Database,
  get_standings: Trophy,
  get_player_news: Newspaper,
  search_web: Globe,
};

function ToolChip({ tool }: { tool: UiToolCall }) {
  const Icon = TOOL_ICONS[tool.name] ?? Database;
  const label = toolSummary(tool.name, tool.args ?? {});
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[0.7rem] font-medium transition-colors ${
        tool.status === "error"
          ? "border-wine/50 bg-wine/[0.12] text-wine-bright"
          : tool.status === "running"
            ? "border-gold/40 bg-gold/[0.08] text-gold"
            : "border-line bg-white/[0.03] text-muted"
      }`}
    >
      {tool.status === "running" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : tool.status === "error" ? (
        <AlertTriangle className="size-3" />
      ) : (
        <Icon className="size-3" />
      )}
      <span className="truncate">{label}</span>
      {tool.status === "ok" && <Check className="size-3 shrink-0 text-emerald-400" />}
    </span>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse-soft rounded-full bg-wine-bright"
          style={{ animationDelay: `${i * 0.22}s` }}
        />
      ))}
    </span>
  );
}

function AssistantMessage({ message }: { message: UiMessage }) {
  const hasContent = message.content.length > 0;
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = message.content;
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      const copiedWithFallback = document.execCommand("copy");
      fallback.remove();
      if (!copiedWithFallback) return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="animate-fade-up flex gap-3.5">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-wine to-wine-deep shadow-[0_4px_16px_rgba(168,50,71,0.3)]">
        <Beer className="size-4 text-ink" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {message.toolCalls.map((tc) => (
              <ToolChip key={tc.id} tool={tc} />
            ))}
          </div>
        )}
        {hasContent ? (
          <Markdown>{message.content}</Markdown>
        ) : message.streaming ? (
          <TypingDots />
        ) : message.error ? (
          <p className="flex items-start gap-2 text-[0.85rem] text-wine-bright">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {message.content || "The assistant could not respond."}
          </p>
        ) : null}
        {message.streaming && hasContent && (
          <span className="ml-1 inline-block size-3.5 animate-blink rounded-sm bg-wine-bright align-middle" />
        )}
        {hasContent && !message.streaming && (
          <button
            type="button"
            onClick={copyText}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-white/[0.03] px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-muted transition-colors hover:border-wine/60 hover:text-ink"
            aria-label="Copy assistant response"
          >
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy text"}
          </button>
        )}
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: UiMessage }) {
  return (
    <div className="animate-fade-up flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-wine/40 bg-gradient-to-br from-wine/[0.28] to-wine-deep/[0.25] px-4 py-3 text-[0.9rem] leading-relaxed text-ink shadow-[0_6px_24px_rgba(94,26,38,0.25)] sm:max-w-[75%]">
        {message.content}
      </div>
    </div>
  );
}

export function MessageList({ messages }: { messages: UiMessage[] }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-8 sm:px-6">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserMessage key={m.key} message={m} />
        ) : (
          <AssistantMessage key={m.key} message={m} />
        ),
      )}
      <div className="flex items-center gap-1.5 px-11 text-[0.65rem] text-faint">
        <ChevronRight className="size-3" />
        Degenerates With Integrity Fantasy Assistant AI can make mistakes — verify critical lineup calls.
      </div>
    </div>
  );
}
