"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReasoningEffort } from "@/lib/env";
import type { ClientLeague, TeamSummary } from "@/lib/serialize";
import { LEAGUE_PROMPTS, TEAM_PROMPTS } from "@/lib/prompts";
import { parseSse, safeParseJson, type SessionSummary, type UiMessage, type UiToolCall } from "@/lib/chat-ui";
import { Sidebar } from "./Sidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { Welcome } from "./Welcome";
import { Composer } from "./Composer";
import { TeamDrawer } from "./TeamDrawer";

export function WineLeagueApp({ initial }: { initial: ClientLeague }) {
  const [league, setLeague] = useState<ClientLeague>(initial);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [effort, setEffort] = useState<ReasoningEffort>("xhigh");
  const [webSearch, setWebSearch] = useState(true);
  const [input, setInput] = useState("");
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerTeamId, setDrawerTeamId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);

  const activeTeam = league.teams.find((t) => t.id === activeTeamId) ?? null;
  const drawerTeam = league.teams.find((t) => t.id === drawerTeamId) ?? null;

  const refreshSessions = useCallback(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(Array.isArray(d.sessions) ? d.sessions : []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Auto-scroll while streaming (only if the user is near the bottom).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }, []);

  const insertText = useCallback(
    (snippet: string) => {
      const ta = textareaRef.current;
      if (!ta) {
        setInput((prev) => prev + snippet);
        return;
      }
      const start = ta.selectionStart ?? input.length;
      const end = ta.selectionEnd ?? input.length;
      const next = input.slice(0, start) + snippet + input.slice(end);
      setInput(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + snippet.length;
        ta.setSelectionRange(pos, pos);
      });
    },
    [input],
  );

  const insertTeam = useCallback(
    (team: TeamSummary) => {
      setActiveTeamId(team.id);
      insertText(`${team.name} `);
    },
    [insertText],
  );

  const runTeamPrompt = useCallback(
    (promptId: string) => {
      if (!activeTeam) return;
      const p = TEAM_PROMPTS.find((x) => x.id === promptId);
      if (!p) return;
      insertText(p.build(activeTeam, league.league.currentWeek));
      setSidebarOpen(false);
    },
    [activeTeam, league.league.currentWeek, insertText],
  );

  const runLeaguePrompt = useCallback(
    (promptId: string) => {
      const p = LEAGUE_PROMPTS.find((x) => x.id === promptId);
      if (!p) return;
      insertText(p.build(league.league.currentWeek, league.league.finalWeek));
    },
    [league.league.currentWeek, league.league.finalWeek, insertText],
  );

  const newChat = useCallback(() => {
    if (isStreaming) return;
    setActiveSessionId(null);
    setSessionTitle("");
    setMessages([]);
    setSidebarOpen(false);
  }, [isStreaming]);

  const selectSession = useCallback(
    async (id: number) => {
      if (isStreaming) return;
      try {
        const res = await fetch(`/api/sessions/${id}`);
        if (!res.ok) return;
        const d = await res.json();
        const msgs: UiMessage[] = [];
        for (const m of d.messages ?? []) {
          const data = m?.data;
          if (!data || typeof data !== "object") continue;
          if (data.role === "user" && typeof data.content === "string") {
            msgs.push({ key: `m-${m.id}`, role: "user", content: data.content });
          } else if (data.role === "assistant") {
            const toolCalls: UiToolCall[] = Array.isArray(data.tool_calls)
              ? data.tool_calls.map((tc: any, i: number) => ({
                  id: tc?.id ?? `tc-${i}`,
                  name: tc?.function?.name ?? "tool",
                  args: safeParseJson(tc?.function?.arguments),
                  status: "ok" as const,
                }))
              : [];
            msgs.push({
              key: `m-${m.id}`,
              role: "assistant",
              content: typeof data.content === "string" ? data.content : "",
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            });
          }
          // tool rows are represented through their parent assistant message
        }
        setMessages(msgs);
        setActiveSessionId(id);
        setSessionTitle(d.session?.title ?? "");
        setSidebarOpen(false);
      } catch {
        // session load failed silently
      }
    },
    [isStreaming],
  );

  const deleteSession = useCallback(
    async (id: number) => {
      try {
        await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      } catch {
        // best effort
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) newChat();
    },
    [activeSessionId, newChat],
  );

  const refreshLeague = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/league", { cache: "no-store" });
      if (res.ok) setLeague(await res.json());
    } catch {
      // keep stale data
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || isStreaming) return;
      setIsStreaming(true);
      setInput("");
      setSidebarOpen(false);
      nearBottomRef.current = true;

      const assistantKey = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { key: `u-${Date.now()}`, role: "user", content: text },
        { key: assistantKey, role: "assistant", content: "", streaming: true, toolCalls: [] },
      ]);

      const patch = (fn: (m: UiMessage) => UiMessage) =>
        setMessages((prev) => prev.map((m) => (m.key === assistantKey ? fn(m) : m)));

      let failed = false;
      let failureReason = "";

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId ?? undefined,
            message: text,
            reasoningEffort: effort,
            webSearch,
          }),
        });
        if (!res.ok || !res.body) {
          failureReason = `The assistant could not be reached (HTTP ${res.status}).`;
          failed = true;
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let gotDone = false;

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let sep: number;
            while ((sep = buffer.indexOf("\n\n")) >= 0) {
              const chunk = buffer.slice(0, sep);
              buffer = buffer.slice(sep + 2);
              const { event, data } = parseSse(chunk);
              if (!data) continue;
              switch (event) {
                case "start":
                  if (typeof data.sessionId === "number") {
                    setActiveSessionId(data.sessionId);
                  }
                  break;
                case "delta":
                  if (typeof data.delta === "string" && data.delta) {
                    patch((m) => ({ ...m, content: m.content + data.delta }));
                  }
                  break;
                case "tool": {
                  const tc: UiToolCall = {
                    id: String(data.id ?? `t-${Date.now()}`),
                    name: String(data.name ?? "tool"),
                    args: data.args ?? {},
                    status: "running",
                  };
                  patch((m) => ({ ...m, toolCalls: [...(m.toolCalls ?? []), tc] }));
                  break;
                }
                case "tool-result":
                  patch((m) => ({
                    ...m,
                    toolCalls: (m.toolCalls ?? []).map((tc) =>
                      tc.id === String(data.id)
                        ? { ...tc, status: data.ok ? "ok" : "error", summary: data.summary }
                        : tc,
                    ),
                  }));
                  break;
                case "done":
                  gotDone = true;
                  break;
                case "error":
                  failed = true;
                  failureReason = String(data.message ?? "Something went wrong.");
                  break;
              }
            }
          }

          if (!gotDone && !failed) {
            failed = true;
            failureReason = "The response stream ended unexpectedly. Please try again.";
          }
        }
      } catch (err) {
        failed = true;
        failureReason = err instanceof Error ? err.message : "Network error. Please try again.";
      } finally {
        patch((m) => ({
          ...m,
          streaming: false,
          error: failed,
          content: failed ? (m.content ? `${m.content}\n\n${failureReason}` : failureReason) : m.content,
        }));
        setIsStreaming(false);
        refreshSessions();
      }
    },
    [input, isStreaming, activeSessionId, effort, webSearch, refreshSessions],
  );

  return (
    <div className="noise relative flex h-dvh w-full overflow-hidden">
      <Sidebar
        league={league}
        sessions={sessions}
        activeSessionId={activeSessionId}
        activeTeamId={activeTeamId}
        isStreaming={isStreaming}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        onNewChat={newChat}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onInsertTeam={insertTeam}
        onTeamPrompt={runTeamPrompt}
        onOpenDrawer={(id) => setDrawerTeamId(id)}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <ChatHeader
          league={league}
          title={messages.length > 0 ? sessionTitle || "AI Fantasy Assistant" : "AI Fantasy Assistant"}
          effort={effort}
          webSearch={webSearch}
          isStreaming={isStreaming}
          refreshing={refreshing}
          onEffortChange={setEffort}
          onWebSearchChange={setWebSearch}
          onOpenSidebar={() => setSidebarOpen(true)}
          onRefreshLeague={refreshLeague}
        />

        <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <Welcome
              league={league}
              activeTeam={activeTeam}
              isStreaming={isStreaming}
              onLeaguePrompt={runLeaguePrompt}
              onTeamPrompt={runTeamPrompt}
              onPickTeam={(id) => {
                const t = league.teams.find((x) => x.id === id);
                if (t) insertTeam(t);
              }}
            />
          ) : (
            <MessageList messages={messages} />
          )}
        </div>

        <Composer
          input={input}
          setInput={setInput}
          textareaRef={textareaRef}
          isStreaming={isStreaming}
          canSend={input.trim().length > 0}
          effort={effort}
          webSearch={webSearch}
          activeTeam={activeTeam}
          teams={league.teams}
          currentWeek={league.league.currentWeek}
          onSend={() => send()}
          onInsertTeam={insertTeam}
          onClearActiveTeam={() => setActiveTeamId(null)}
        />
      </main>

      <TeamDrawer
        team={drawerTeam}
        currentWeek={league.league.currentWeek}
        onClose={() => setDrawerTeamId(null)}
        onInsertTeam={(t) => {
          insertTeam(t);
          setDrawerTeamId(null);
        }}
      />
    </div>
  );
}
