"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReasoningEffort } from "@/lib/env";
import type { ClientLeague, TeamSummary } from "@/lib/serialize";
import { LEAGUE_PROMPTS, TEAM_PROMPTS } from "@/lib/prompts";
import { parseSse, type UiMessage, type UiToolCall } from "@/lib/chat-ui";
import { readChats, writeChats, chatStorageKey, type LocalChat } from "@/lib/local-chats";
import { Sidebar } from "./Sidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { Welcome } from "./Welcome";
import { Composer } from "./Composer";
import { TeamDrawer } from "./TeamDrawer";

export function FantasyAssistantApp({ initial }: { initial: ClientLeague }) {
  const [league, setLeague] = useState<ClientLeague>(initial);
  const [sessions, setSessions] = useState<LocalChat[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [effort, setEffort] = useState<ReasoningEffort>("max");
  const [webSearch, setWebSearch] = useState(true);
  const [input, setInput] = useState("");
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerTeamId, setDrawerTeamId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [storageWarning, setStorageWarning] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const chatsRef = useRef<LocalChat[]>([]);
  const storageKey = chatStorageKey(initial.league.id, initial.league.season);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);

  const activeTeam = league.teams.find((t) => t.id === activeTeamId) ?? null;
  const drawerTeam = league.teams.find((t) => t.id === drawerTeamId) ?? null;

  useEffect(() => {
    try {
      const saved = readChats(localStorage, storageKey);
      chatsRef.current = saved;
      // Hydrate browser-only external storage after server rendering.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessions(saved);
    } catch {
      setStorageWarning("Browser storage is unavailable. Chats will last only until this page closes.");
    }
    setStorageReady(true);
  }, [storageKey]);

  const saveChats = useCallback((chats: LocalChat[]) => {
    chatsRef.current = chats;
    setSessions(chats);
    try {
      writeChats(localStorage, storageKey, chats);
      setStorageWarning("");
    } catch {
      setStorageWarning("Could not save chats in this browser. Storage may be full or disabled; this chat remains available until the page closes.");
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady || isStreaming || activeSessionId === null || messages.length === 0) return;
    const previous = chatsRef.current.find((s) => s.id === activeSessionId);
    if (!previous) return;
    saveChats([{ ...previous, messages, updatedAt: new Date().toISOString() }, ...chatsRef.current.filter((s) => s.id !== activeSessionId)]);
  }, [messages, isStreaming, activeSessionId, storageReady, saveChats]);

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

  const selectSession = useCallback((id: number) => {
    if (isStreaming) return;
    const chat = chatsRef.current.find((s) => s.id === id);
    if (!chat) return;
    setMessages(chat.messages);
    setActiveSessionId(id);
    setSessionTitle(chat.title);
    setSidebarOpen(false);
  }, [isStreaming]);

  const deleteSession = useCallback((id: number) => {
    if (isStreaming) return;
    saveChats(chatsRef.current.filter((s) => s.id !== id));
    if (activeSessionId === id) newChat();
  }, [isStreaming, saveChats, activeSessionId, newChat]);

  const refreshLeague = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/league?refresh=1", { cache: "no-store" });
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
      if (!text || isStreaming || !storageReady) return;
      setIsStreaming(true);
      setInput("");
      setSidebarOpen(false);
      nearBottomRef.current = true;

      const now = new Date().toISOString();
      const id = activeSessionId ?? Math.max(Date.now(), ...chatsRef.current.map((s) => s.id + 1));
      const title = sessionTitle || text.replace(/\s+/g, " ").slice(0, 48);
      setActiveSessionId(id);
      setSessionTitle(title);
      saveChats([{ id, title, createdAt: chatsRef.current.find((s) => s.id === id)?.createdAt ?? now, updatedAt: now,
        messages: [...messages, { key: crypto.randomUUID(), role: "user", content: text }],
      }, ...chatsRef.current.filter((s) => s.id !== id)]);

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
            history: messages.filter((m) => !m.error && !m.streaming && (m.role === "user" || m.role === "assistant")).map(({ role, content }) => ({ role, content })),
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
      }
    },
    [input, isStreaming, activeSessionId, effort, webSearch, storageReady, sessionTitle, messages, saveChats],
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

        {storageWarning && <p role="status" className="px-4 py-2 text-sm text-gold">{storageWarning}</p>}
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
          canSend={storageReady && input.trim().length > 0}
          effort={effort}
          webSearch={webSearch}
          activeTeam={activeTeam}
          teams={league.teams}
          leagueStatus={league.league.status}
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
