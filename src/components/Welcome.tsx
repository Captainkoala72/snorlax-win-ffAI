"use client";

import { ArrowRight, Sparkles, Wine, Zap } from "lucide-react";
import type { ClientLeague, MatchupSummary, TeamSummary } from "@/lib/serialize";
import { LEAGUE_PROMPTS } from "@/lib/prompts";

interface WelcomeProps {
  league: ClientLeague;
  activeTeam: TeamSummary | null;
  isStreaming: boolean;
  onLeaguePrompt: (id: string) => void;
  onTeamPrompt: (id: string) => void;
  onPickTeam: (id: number) => void;
}

function MatchupRow({ m }: { m: MatchupSummary }) {
  const fmt = (n: number) => (n > 0 ? n.toFixed(1) : "—");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:border-wine/40">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ background: m.away.color }} />
        <span className="truncate text-[0.8rem] font-medium text-muted">{m.away.name}</span>
        <span className="ml-auto shrink-0 font-mono text-[0.8rem] text-ink">{fmt(m.away.points)}</span>
      </span>
      <span className="shrink-0 text-[0.6rem] font-semibold uppercase tracking-widest text-faint">
        {m.winner === "UNDECIDED" ? "vs" : "final"}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 font-mono text-[0.8rem] text-ink">{fmt(m.home.points)}</span>
        <span className="truncate text-[0.8rem] font-medium text-muted">{m.home.name}</span>
        <span className="size-2 shrink-0 rounded-full" style={{ background: m.home.color }} />
      </span>
    </div>
  );
}

export function Welcome({
  league,
  activeTeam,
  isStreaming,
  onLeaguePrompt,
  onTeamPrompt,
  onPickTeam,
}: WelcomeProps) {
  const { league: meta, teams, currentMatchups } = league;
  const topTeams = [...teams].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor).slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      {/* Hero */}
      <div className="animate-fade-up text-center">
        <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-wine/40 bg-wine/[0.1] px-3.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-wine-bright">
          <Sparkles className="size-3.5" />
          Muse Spark 1.3 · {meta.season} Season
        </p>
        <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="text-gradient-wine">Wine League</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[0.95rem] leading-relaxed text-muted">
          Your AI fantasy football analyst, wired straight into the league.
          Ask about teams, matchups, trades, waivers, or the latest NFL news —
          the assistant pulls live ESPN data for every answer.
        </p>
      </div>

      {/* Current week strip */}
      {currentMatchups.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: "0.08s" }}>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-faint">
              Week {meta.currentWeek} {currentMatchups[0]?.isPlayoff ? "· Playoffs" : "· Live"}
            </p>
            <p className="text-[0.7rem] text-faint">{meta.scoringType}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {currentMatchups.slice(0, 5).map((m) => (
              <MatchupRow key={m.id} m={m} />
            ))}
          </div>
        </div>
      )}

      {/* League leaders */}
      {topTeams.length > 0 && (
        <div className="animate-fade-up grid grid-cols-1 gap-2 sm:grid-cols-3" style={{ animationDelay: "0.14s" }}>
          {topTeams.map((t, i) => (
            <button
              key={t.id}
              onClick={() => onPickTeam(t.id)}
              className="group flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3.5 py-3 text-left transition-all duration-150 hover:border-wine/50 hover:bg-wine/[0.06]"
              title={`Ask about ${t.name}`}
            >
              <span className="font-display text-lg font-semibold text-gold">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.85rem] font-semibold text-ink">{t.name}</span>
                <span className="block truncate text-[0.7rem] text-faint">
                  {t.wins}-{t.losses}
                  {t.ties > 0 ? `-${t.ties}` : ""} · {t.pointsFor.toFixed(0)} pts
                </span>
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-wine-bright" />
            </button>
          ))}
        </div>
      )}

      {/* Prompt cards */}
      <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <p className="mb-2.5 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-faint">
          Ask the assistant
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LEAGUE_PROMPTS.map((p) => (
            <button
              key={p.id}
              disabled={isStreaming}
              onClick={() => onLeaguePrompt(p.id)}
              className="group flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3.5 text-left transition-all duration-150 hover:border-wine/50 hover:bg-wine/[0.06] disabled:opacity-50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-wine/[0.14] text-wine-bright">
                <p.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-[0.85rem] font-medium text-ink">
                {p.label}
              </span>
              <Zap className="size-3.5 shrink-0 text-faint transition-all duration-150 group-hover:text-gold" />
            </button>
          ))}
        </div>
      </div>

      {/* Team-aware prompt hint */}
      {activeTeam && (
        <div className="animate-pop mx-auto flex items-center gap-2 rounded-full border border-wine/50 bg-wine/[0.12] px-4 py-2 text-[0.8rem] text-ink">
          <Wine className="size-3.5 text-wine-bright" />
          {activeTeam.name} selected — try a team prompt from the sidebar.
        </div>
      )}
    </div>
  );
}
