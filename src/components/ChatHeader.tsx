"use client";

import { useEffect, useRef, useState } from "react";
import { Beer, Check, ChevronDown, Globe, Menu, RefreshCw, Sparkles } from "lucide-react";
import type { ClientLeague } from "@/lib/serialize";
import { REASONING_EFFORTS, type ReasoningEffort } from "@/lib/env";

interface ChatHeaderProps {
  league: ClientLeague;
  title: string;
  effort: ReasoningEffort;
  webSearch: boolean;
  isStreaming: boolean;
  refreshing: boolean;
  onEffortChange: (e: ReasoningEffort) => void;
  onWebSearchChange: (v: boolean) => void;
  onOpenSidebar: () => void;
  onRefreshLeague: () => void;
}

function EffortControl({
  effort,
  disabled,
  onChange,
}: {
  effort: ReasoningEffort;
  disabled: boolean;
  onChange: (e: ReasoningEffort) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = REASONING_EFFORTS.find((e) => e.id === effort) ?? REASONING_EFFORTS[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="focus-ring flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-[0.75rem] font-medium text-muted transition-colors hover:border-wine/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        title="Reasoning effort"
      >
        <Sparkles className="size-3.5 text-wine-bright" />
        <span className="hidden sm:inline">Reasoning</span>
        <span className="font-semibold text-ink">{current.label}</span>
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="animate-pop absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-raised/95 shadow-2xl backdrop-blur-xl">
          <p className="border-b border-line px-3.5 pb-2 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-faint">
            GLM-5.3-Flash reasoning effort
          </p>
          {REASONING_EFFORTS.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                onChange(e.id);
                setOpen(false);
              }}
              className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.05] ${
                e.id === effort ? "bg-wine/[0.12]" : ""
              }`}
            >
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                  e.id === effort ? "border-wine-bright bg-wine text-ink" : "border-faint/50"
                }`}
              >
                {e.id === effort && <Check className="size-2.5" />}
              </span>
              <span>
                <span className="block text-[0.8rem] font-semibold text-ink">{e.label}</span>
                <span className="block text-[0.7rem] text-faint">{e.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WebSearchToggle({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`focus-ring flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[0.75rem] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        enabled
          ? "border-wine/60 bg-wine/[0.14] text-ink"
          : "border-line bg-white/[0.03] text-muted hover:text-ink"
      }`}
      title="Let GLM-5.3-Flash search the web for the latest news"
    >
      <Globe className={`size-3.5 ${enabled ? "text-wine-bright" : ""}`} />
      <span className="hidden sm:inline">Web search</span>
      <span
        className={`relative h-4 w-7 rounded-full transition-colors duration-200 ${
          enabled ? "bg-wine" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 size-3 rounded-full bg-ink shadow transition-all duration-200 ${
            enabled ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function ChatHeader(props: ChatHeaderProps) {
  const { league, title, effort, webSearch, isStreaming, refreshing } = props;
  const weekLabel =
    league.league.status === "ok" || league.league.status === "demo"
      ? `Week ${league.league.currentWeek}`
      : "2026";

  return (
    <header className="relative z-30 flex items-center gap-3 border-b border-line bg-base/70 px-4 py-3 backdrop-blur-md sm:px-6">
      <button
        aria-label="Open menu"
        className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.05] hover:text-ink lg:hidden"
        onClick={props.onOpenSidebar}
      >
        <Menu className="size-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="hidden size-8 place-items-center rounded-lg bg-gradient-to-br from-wine to-wine-deep sm:grid">
          <Beer className="size-4 text-ink" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[0.95rem] font-semibold text-ink">{title}</h1>
          <p className="truncate text-[0.68rem] text-faint">
            Degenerates With Integrity Fantasy Assistant · {weekLabel} · glm-5.3-flash
          </p>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          onClick={props.onRefreshLeague}
          disabled={refreshing}
          className="focus-ring grid size-8 place-items-center rounded-lg border border-line bg-white/[0.03] text-muted transition-colors hover:text-ink disabled:opacity-50"
          title="Refresh league data"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
        <WebSearchToggle enabled={webSearch} disabled={isStreaming} onChange={props.onWebSearchChange} />
        <EffortControl effort={effort} disabled={isStreaming} onChange={props.onEffortChange} />
      </div>
    </header>
  );
}
