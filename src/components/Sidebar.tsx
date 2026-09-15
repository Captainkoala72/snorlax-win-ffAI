"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CalendarRange,
  FlaskConical,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wine,
  X,
} from "lucide-react";
import type { ClientLeague, TeamSummary } from "@/lib/serialize";
import type { SessionSummary } from "@/lib/chat-ui";
import { TEAM_PROMPTS } from "@/lib/prompts";

interface SidebarProps {
  league: ClientLeague;
  sessions: SessionSummary[];
  activeSessionId: number | null;
  activeTeamId: number | null;
  isStreaming: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelectSession: (id: number) => void;
  onDeleteSession: (id: number) => void;
  onInsertTeam: (team: TeamSummary) => void;
  onTeamPrompt: (promptId: string) => void;
  onOpenDrawer: (teamId: number) => void;
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-1 pt-2">
      <div className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-wine to-wine-deep shadow-[0_8px_24px_rgba(168,50,71,0.35)]">
        <Wine className="size-5 text-ink" strokeWidth={1.8} />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-gold ring-2 ring-base" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-[1.05rem] font-semibold leading-tight tracking-tight text-ink">
          Degenerates With Integrity Fantasy Assistant
        </p>
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-faint">
          AI Fantasy Assistant
        </p>
      </div>
    </div>
  );
}

function LeagueStatusCard({ league }: { league: ClientLeague }) {
  const s = league.league;
  if (s.status === "demo") {
    return (
      <div className="rounded-xl border border-gold/25 bg-gold/[0.06] p-3">
        <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-gold">
          <FlaskConical className="size-3.5" /> Sample league
        </p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
          {s.errorMessage ??
            "Set LEAGUE_ID, ESPN_SWID and ESPN_S2 to connect your real ESPN league."}
        </p>
      </div>
    );
  }
  if (s.status === "auth_error" || s.status === "error" || s.status === "not_found") {
    return (
      <div className="rounded-xl border border-wine/40 bg-wine/[0.08] p-3">
        <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-wine-bright">
          <AlertTriangle className="size-3.5" /> League offline
        </p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
          {s.errorMessage ?? "ESPN data could not be loaded."}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
      </span>
      <p className="text-[0.72rem] text-muted">
        {s.name} · Season {s.season} ·{" "}
        <span className="text-ink">Week {s.currentWeek}</span>
      </p>
    </div>
  );
}

function SidebarBody(props: SidebarProps) {
  const {
    league,
    sessions,
    activeSessionId,
    activeTeamId,
    isStreaming,
    onNewChat,
    onSelectSession,
    onDeleteSession,
    onInsertTeam,
    onTeamPrompt,
    onOpenDrawer,
  } = props;

  const teams = [...league.teams].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
  const activeTeam = league.teams.find((t) => t.id === activeTeamId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <Brand />

      <div className="mt-4 px-3">
        <button
          onClick={onNewChat}
          disabled={isStreaming}
          className="focus-ring group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wine to-[#7c2436] px-3 py-2.5 text-sm font-semibold text-ink shadow-[0_6px_20px_rgba(168,50,71,0.3)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4 transition-transform duration-200 group-hover:rotate-90" />
          New chat
        </button>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {sessions.length > 0 && (
          <section>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-faint">
              <MessageSquare className="size-3" /> Recent
            </p>
            <div className="flex flex-col gap-0.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[0.8rem] transition-colors duration-150 ${
                    activeSessionId === s.id
                      ? "bg-white/[0.07] text-ink"
                      : "text-muted hover:bg-white/[0.04] hover:text-ink"
                  }`}
                  onClick={() => onSelectSession(s.id)}
                >
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  <button
                    aria-label="Delete session"
                    className="hidden size-5 shrink-0 place-items-center rounded text-faint hover:text-wine-bright group-hover:grid"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-faint">
            <Users className="size-3" /> League teams
            <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[0.6rem] font-medium text-muted">
              {league.teams.length}
            </span>
          </p>
          {league.teams.length === 0 ? (
            <p className="px-1 text-[0.75rem] text-faint">No teams loaded.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {teams.map((t) => {
                const isActive = t.id === activeTeamId;
                return (
                  <div
                    key={t.id}
                    className={`group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-150 ${
                      isActive ? "bg-wine/[0.16] ring-1 ring-wine/50" : "hover:bg-white/[0.04]"
                    }`}
                    onClick={() => onInsertTeam(t)}
                    title={`Click to insert "${t.name}" into the chat`}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full ring-2 ring-white/10"
                      style={{ background: t.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[0.82rem] font-medium transition-colors ${
                          isActive ? "text-ink" : "text-muted group-hover:text-ink"
                        }`}
                      >
                        {t.name}
                      </span>
                      <span className="block truncate text-[0.68rem] text-faint">
                        {t.ownerName}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[0.68rem] ${
                        t.wins > t.losses
                          ? "bg-emerald-400/10 text-emerald-300"
                          : t.wins < t.losses
                            ? "bg-white/[0.05] text-faint"
                            : "bg-white/[0.05] text-muted"
                      }`}
                    >
                      {t.wins}-{t.losses}
                      {t.ties > 0 ? `-${t.ties}` : ""}
                    </span>
                    <button
                      aria-label={`View ${t.name} details`}
                      className="hidden size-5 shrink-0 place-items-center rounded text-faint hover:text-gold group-hover:grid"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDrawer(t.id);
                      }}
                    >
                      <ArrowUpRight className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-faint">
            <Sparkles className="size-3" /> Quick prompts
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {TEAM_PROMPTS.map((p) => {
              const disabled = !activeTeam || isStreaming;
              return (
                <button
                  key={p.id}
                  disabled={disabled}
                  onClick={() => onTeamPrompt(p.id)}
                  className={`focus-ring group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all duration-150 ${
                    disabled
                      ? "cursor-not-allowed border-line/50 opacity-45"
                      : "border-line bg-white/[0.02] hover:border-wine/60 hover:bg-wine/[0.1]"
                  }`}
                  title={activeTeam ? `${p.label} for ${activeTeam.name}` : "Click a team first"}
                >
                  <p.icon className="size-3.5 shrink-0 text-wine-bright" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.78rem] font-medium text-ink">{p.label}</span>
                    <span className="block truncate text-[0.66rem] text-faint">
                      {activeTeam ? `${p.hint} · ${activeTeam.name}` : "Select a team first"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="border-t border-line p-3">
        <LeagueStatusCard league={league} />
        <div className="mt-2.5 flex items-center gap-1.5 px-1 text-[0.65rem] text-faint">
          <CalendarRange className="size-3" />
          <span>
            GLM-5.3-Flash · {league.league.scoringType} ·{" "}
            {league.league.pointsPerReception === 1
              ? "PPR"
              : league.league.pointsPerReception === 0.5
                ? "Half PPR"
                : league.league.pointsPerReception === 0
                  ? "Standard"
                  : "Custom scoring"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-[300px] shrink-0 border-r border-line bg-panel/70 backdrop-blur-sm lg:block">
        <SidebarBody {...props} />
      </aside>

      {/* Mobile drawer */}
      {props.mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={props.onCloseMobile}
          />
          <aside className="animate-fade-up absolute left-0 top-0 h-full w-[86vw] max-w-[320px] border-r border-line bg-panel shadow-2xl">
            <button
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 grid size-8 place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-ink"
              onClick={props.onCloseMobile}
            >
              <X className="size-4" />
            </button>
            <SidebarBody {...props} />
          </aside>
        </div>
      )}
    </>
  );
}


