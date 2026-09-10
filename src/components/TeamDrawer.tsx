"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, TrendingUp, Users, Wine, X } from "lucide-react";
import type { TeamSummary } from "@/lib/serialize";

interface TeamDrawerProps {
  team: TeamSummary | null;
  currentWeek: number;
  onClose: () => void;
  onInsertTeam: (t: TeamSummary) => void;
}

interface TeamDetail extends TeamSummary {
  roster: Array<{
    id: number;
    name: string;
    position: string;
    slot: string;
    proTeamAbbr: string;
    injuryStatus: string;
    points: number;
  }>;
  opponent?: { id: number; name: string; color: string } | null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-0.5 font-mono text-[0.95rem] font-semibold text-ink">{value}</p>
    </div>
  );
}

export function TeamDrawer({ team, currentWeek, onClose, onInsertTeam }: TeamDrawerProps) {
  const [result, setResult] = useState<{
    teamName: string;
    detail: TeamDetail | null;
  } | null>(null);

  useEffect(() => {
    if (!team) return;

    let cancelled = false;
    const teamName = team.name;
    fetch(`/api/league/team?name=${encodeURIComponent(team.name)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setResult({ teamName, detail: d?.team ?? null });
      })
      .catch(() => {
        if (!cancelled) setResult({ teamName, detail: null });
      });
    return () => {
      cancelled = true;
    };
  }, [team]);

  if (!team) return null;

  const detail = result?.teamName === team.name ? result.detail : null;
  const loading = result?.teamName !== team.name;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="animate-fade-up absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col border-l border-line bg-panel shadow-2xl">
        <div className="flex items-start gap-3 border-b border-line p-5">
          <span
            className="mt-1 grid size-11 shrink-0 place-items-center rounded-xl text-ink"
            style={{ background: `linear-gradient(135deg, ${team.color}, #3a1320)` }}
          >
            <Wine className="size-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold leading-tight">{team.name}</h2>
            <p className="text-[0.75rem] text-faint">
              {team.ownerName} · {team.abbrev}
            </p>
          </div>
          <button
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Record" value={`${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}`} />
            <Stat label="Points for" value={team.pointsFor.toFixed(0)} />
            <Stat label="Waiver" value={team.waiverRank > 0 ? `#${team.waiverRank}` : "—"} />
          </div>

          {detail?.opponent && (
            <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-wine/40 bg-wine/[0.08] px-3.5 py-3">
              <span className="size-2.5 rounded-full" style={{ background: detail.opponent.color }} />
              <p className="text-[0.8rem] text-ink">
                Week {currentWeek}: <span className="font-semibold">{detail.opponent.name}</span>
              </p>
            </div>
          )}

          <div className="mb-2.5 mt-5 flex items-center gap-1.5">
            <Users className="size-3.5 text-wine-bright" />
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-faint">
              Roster
            </p>
            {team.streakType && (
              <span className="ml-auto inline-flex items-center gap-1 text-[0.7rem] text-muted">
                <TrendingUp className="size-3" />
                {team.streakType} {team.streakLength}
              </span>
            )}
          </div>

          {loading && (
            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded-lg bg-white/[0.04]"
                  style={{ animationDelay: `${i * 0.06}s` }}
                />
              ))}
            </div>
          )}

          {detail?.roster && (
            <div className="overflow-hidden rounded-xl border border-line">
              {detail.roster.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-3.5 py-2.5 ${
                    i > 0 ? "border-t border-line/60" : ""
                  } ${p.slot === "BN" ? "opacity-60" : ""} ${p.slot === "IR" ? "opacity-45" : ""}`}
                >
                  <span className="w-10 shrink-0 rounded bg-white/[0.05] px-1 py-0.5 text-center font-mono text-[0.62rem] font-semibold text-muted">
                    {p.slot}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.82rem] font-medium text-ink">
                      {p.name}
                    </span>
                    <span className="text-[0.68rem] text-faint">
                      {p.position} · {p.proTeamAbbr || "FA"}
                      {p.injuryStatus && p.injuryStatus !== "ACTIVE" && (
                        <span className="ml-1.5 rounded bg-wine/20 px-1 py-0.5 text-[0.6rem] font-semibold text-wine-bright">
                          {p.injuryStatus}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[0.75rem] text-muted">
                    {p.points.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-line p-4">
          <button
            onClick={() => {
              onInsertTeam(team);
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wine to-[#7c2436] px-4 py-3 text-sm font-semibold text-ink shadow-[0_6px_20px_rgba(168,50,71,0.35)] transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Ask about {team.name}
            <ArrowUpRight className="size-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}
