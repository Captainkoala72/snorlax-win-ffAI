"use client";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { ArrowUp, Globe, Loader2, SendHorizonal, Sparkles, Wine, X } from "lucide-react";
import type { TeamSummary } from "@/lib/serialize";
import type { ReasoningEffort } from "@/lib/env";
import { TEAM_PROMPTS } from "@/lib/prompts";

interface ComposerProps {
  input: string;
  setInput: (v: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  isStreaming: boolean;
  canSend: boolean;
  effort: ReasoningEffort;
  webSearch: boolean;
  activeTeam: TeamSummary | null;
  teams: TeamSummary[];
  currentWeek: number;
  leagueStatus: string;
  onSend: () => void;
  onInsertTeam: (t: TeamSummary) => void;
  onClearActiveTeam: () => void;
}

function TeamChip({
  team,
  onInsert,
}: {
  team: TeamSummary;
  onInsert: (t: TeamSummary) => void;
}) {
  return (
    <button
      onClick={() => onInsert(team)}
      className="group flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] py-1 pl-2 pr-2.5 text-[0.72rem] font-medium text-muted transition-all duration-150 hover:border-wine/50 hover:text-ink"
      title={`Insert ${team.name}`}
    >
      <span className="size-2 rounded-full" style={{ background: team.color }} />
      <span className="max-w-[110px] truncate">{team.name}</span>
    </button>
  );
}

export function Composer(props: ComposerProps) {
  const {
    input,
    setInput,
    textareaRef,
    isStreaming,
    canSend,
    effort,
    webSearch,
    activeTeam,
    teams,
    currentWeek,
    onSend,
    onInsertTeam,
    onClearActiveTeam,
  } = props;

  const [showAllTeams, setShowAllTeams] = useState(false);

  // Auto-resize the textarea up to a cap.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input, textareaRef]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend && !isStreaming) onSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value);

  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="relative z-20 border-t border-line bg-base/80 px-4 pb-5 pt-3 backdrop-blur-md sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        {/* Active team + quick actions */}
        {activeTeam && (
          <div className="animate-fade-in mb-2 flex flex-wrap items-center gap-1.5">
            <button
              onClick={onClearActiveTeam}
              className="group flex items-center gap-1.5 rounded-lg border border-wine/60 bg-wine/[0.14] py-1 pl-2.5 pr-1.5 text-[0.72rem] font-semibold text-ink transition-colors hover:border-wine-bright"
              title="Clear selected team"
            >
              <Wine className="size-3 text-wine-bright" />
              <span className="max-w-[160px] truncate">{activeTeam.name}</span>
              <X className="size-3 text-muted group-hover:text-ink" />
            </button>
            {TEAM_PROMPTS.map((p) => (
              <QuickAction
                key={`q-${p.id}`}
                label={p.label}
                disabled={isStreaming}
                onClick={() => {
                  if (!activeTeam || isStreaming) return;
                  const ta = textareaRef.current;
                  const text = p.build(activeTeam, currentWeek);
                  if (!ta) {
                    onInsertTeam(activeTeam);
                    return;
                  }
                  const start = ta.selectionStart ?? input.length;
                  const end = ta.selectionEnd ?? input.length;
                  const next = input.slice(0, start) + text + " " + input.slice(end);
                  setInput(next);
                  requestAnimationFrame(() => {
                    ta.focus();
                    const pos = start + text.length + 1;
                    ta.setSelectionRange(pos, pos);
                  });
                }}
              />
            ))}
          </div>
        )}

        {/* Input panel */}
        <div
          className={`rounded-2xl border bg-panel/80 backdrop-blur transition-all duration-200 ${
            isStreaming ? "border-gold/40" : "border-line focus-within:border-wine/70"
          }`}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              activeTeam
                ? `Ask about ${activeTeam.name}…`
                : "Ask about teams, matchups, trades, or the latest NFL news…"
            }
            className="max-h-[200px] w-full resize-none bg-transparent px-4 pb-1.5 pt-3.5 text-[0.92rem] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
          />

          <div className="flex items-center gap-2 px-3 pb-2.5">
            <button
              onClick={() => setShowAllTeams((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2 py-1.5 text-[0.7rem] font-medium text-muted transition-colors hover:border-wine/50 hover:text-ink"
              title="Insert a team name"
            >
              <Wine className="size-3.5 text-wine-bright" />
              Teams
            </button>

            <div className="flex items-center gap-1.5 text-[0.68rem] text-faint">
              <Sparkles className="size-3 text-wine-bright" />
              <span className="hidden sm:inline">
                {effort}
                {webSearch && (
                  <>
                    {" · "}
                    <Globe className="inline size-3 align-[-1px]" /> search
                  </>
                )}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-[0.65rem] text-faint sm:inline">
                {isStreaming ? "Thinking…" : "Enter ↵ to send"}
              </span>
              <button
                onClick={onSend}
                disabled={!canSend || isStreaming}
                aria-label="Send message"
                className={`focus-ring grid size-9 place-items-center rounded-xl transition-all duration-200 ${
                  canSend && !isStreaming
                    ? "bg-gradient-to-br from-wine to-[#7c2436] text-ink shadow-[0_6px_18px_rgba(168,50,71,0.4)] hover:brightness-110 active:scale-95"
                    : "cursor-not-allowed bg-white/[0.05] text-faint"
                }`}
              >
                {isStreaming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : canSend ? (
                  <SendHorizonal className="size-4" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </div>
          </div>

          {showAllTeams && (
            <div className="border-t border-line p-3">
              <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-faint">
                Click to insert a team
              </p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {sorted.map((t) => (
                  <TeamChip key={t.id} team={t} onInsert={(team) => { onInsertTeam(team); setShowAllTeams(false); }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-2.5 text-center text-[0.65rem] text-faint">
          Degenerates With Integrity Fantasy Assistant · glm-5.3-flash · {props.leagueStatus === "demo" ? "Sample data" : props.leagueStatus === "ok" ? "Live ESPN data" : "ESPN offline"} ·{" "}
          <span className="text-muted">{teams.length} teams</span>
        </p>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-lg border border-wine/40 bg-wine/[0.08] px-2.5 py-1 text-[0.7rem] font-medium text-wine-bright transition-all duration-150 hover:border-wine-bright hover:bg-wine/[0.16] disabled:opacity-50"
    >
      {label}
    </button>
  );
}
