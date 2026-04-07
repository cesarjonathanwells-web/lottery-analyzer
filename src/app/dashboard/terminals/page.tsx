"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import { getGameById } from "@/lib/games";
import type { TerminalResult } from "@/lib/analysis/terminals";

import { AnalysisCard } from "@/components/lottery/analysis-card";
import { ChartWrapper } from "@/components/charts/chart-wrapper";

// ── Fetcher ─────────────────────────────────────────────────────────────────

async function fetchTerminals(
  gameId: string,
  draws?: number,
): Promise<TerminalResult> {
  const sp = new URLSearchParams({ type: "terminals", game: gameId });
  if (draws) sp.set("draws", String(draws));
  const res = await fetch(`/api/tables?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch terminals");
  return res.json();
}

// ── Color helper ────────────────────────────────────────────────────────────

const TERMINAL_PALETTE = [
  "#ef4444", "#f97316", "#f5a623", "#eab308",
  "#84cc16", "#10b981", "#06b6d4", "#3b82f6",
  "#8b5cf6", "#ec4899",
];

function getHeatStyle(
  count: number,
  maxCount: number,
): { bg: string; textColor: string; label: string } {
  if (maxCount === 0) {
    return { bg: "rgba(59,130,246,0.08)", textColor: "#3b82f6", label: "cold" };
  }
  const ratio = count / maxCount;
  if (ratio >= 0.8) {
    return {
      bg: "rgba(245,166,35,0.25)",
      textColor: "#f5a623",
      label: "hot",
    };
  }
  if (ratio >= 0.5) {
    return {
      bg: "rgba(245,166,35,0.12)",
      textColor: "#e2e8f0",
      label: "warm",
    };
  }
  return {
    bg: "rgba(59,130,246,0.1)",
    textColor: "#3b82f6",
    label: "cold",
  };
}

// ── Draw count options ──────────────────────────────────────────────────────

const DRAW_OPTIONS = [
  { label: "Last 50", value: 50 },
  { label: "Last 100", value: 100 },
  { label: "Last 200", value: 200 },
  { label: "Last 500", value: 500 },
  { label: "All", value: 0 },
];

// ── Empty State ─────────────────────────────────────────────────────────────

function NoData() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--secondary)]">
        <span className="text-lg text-[var(--muted-foreground)]">--</span>
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">
        No terminal data available. Import draws first.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function TerminalsPage() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);
  const [drawLimit, setDrawLimit] = useState(0); // 0 = all

  const { data, isLoading } = useQuery({
    queryKey: ["terminals-page", activeGameId, drawLimit],
    queryFn: () =>
      fetchTerminals(activeGameId, drawLimit > 0 ? drawLimit : undefined),
    enabled: !!activeGameId,
  });

  const maxCount = data
    ? Math.max(...data.terminals.map((t) => t.count), 1)
    : 1;
  const minCount = data
    ? Math.min(...data.terminals.map((t) => t.count))
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
          Terminal Digits
        </h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Frequency of the last digit of each drawn number for{" "}
          {game?.name ?? "the selected game"}
        </p>
      </div>

      {/* Draw count selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          Draws:
        </span>
        {DRAW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDrawLimit(opt.value)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              drawLimit === opt.value
                ? "bg-[var(--gold)]/20 text-[var(--gold)] ring-1 ring-[var(--gold)]/30"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/80 hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Large 10-cell grid */}
      <AnalysisCard
        title="Terminal Distribution"
        subtitle={`${data?.drawsAnalyzed ?? 0} draws analyzed`}
        loading={isLoading}
      >
        {data && data.terminals.some((t) => t.count > 0) ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 lg:grid-cols-10">
            {data.terminals.map((t) => {
              const heat = getHeatStyle(t.count, maxCount);
              return (
                <div
                  key={t.digit}
                  className="group relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border border-[var(--border)] p-4 transition-all hover:scale-[1.02]"
                  style={{ background: heat.bg }}
                >
                  {/* Hot/cold badge */}
                  <span
                    className="absolute right-2 top-2 text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: heat.textColor }}
                  >
                    {heat.label}
                  </span>

                  {/* Digit */}
                  <span
                    className="text-4xl font-black font-mono"
                    style={{ color: heat.textColor }}
                  >
                    {t.digit}
                  </span>

                  {/* Count */}
                  <span className="text-lg font-bold font-mono text-[var(--foreground)]">
                    {t.count}
                  </span>

                  {/* Percentage */}
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {t.percentage.toFixed(1)}%
                  </span>

                  {/* Last seen */}
                  {t.lastSeen && (
                    <span className="text-[10px] text-[var(--muted-foreground)]/60">
                      Last: {t.lastSeen}
                    </span>
                  )}

                  {/* Bottom bar indicator */}
                  <div
                    className="mt-1 h-1 w-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${heat.textColor} ${(t.count / maxCount) * 100}%, transparent ${(t.count / maxCount) * 100}%)`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          !isLoading && <NoData />
        )}
      </AnalysisCard>

      {/* Historical bar chart showing terminal frequency */}
      <AnalysisCard
        title="Terminal Frequency Chart"
        subtitle="Comparative bar chart of all terminal digits"
        loading={isLoading}
      >
        {data && data.terminals.some((t) => t.count > 0) ? (
          <ChartWrapper
            height="350px"
            option={{
              tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
              },
              grid: { left: 48, right: 16, top: 16, bottom: 40 },
              xAxis: {
                type: "category",
                data: data.terminals.map((t) => String(t.digit)),
                axisLabel: {
                  color: "#e2e8f0",
                  fontSize: 14,
                  fontWeight: "bold",
                  fontFamily: "monospace",
                },
              },
              yAxis: {
                type: "value",
                axisLabel: { color: "#94a3b8" },
              },
              series: [
                {
                  type: "bar",
                  data: data.terminals.map((t) => ({
                    value: t.count,
                    itemStyle: {
                      color: TERMINAL_PALETTE[t.digit],
                      borderRadius: [4, 4, 0, 0],
                    },
                  })),
                  barMaxWidth: 40,
                  label: {
                    show: true,
                    position: "top",
                    color: "#94a3b8",
                    fontSize: 11,
                    fontFamily: "monospace",
                  },
                },
              ],
            }}
          />
        ) : (
          !isLoading && <NoData />
        )}
      </AnalysisCard>

      {/* Donut chart */}
      <AnalysisCard
        title="Terminal Proportions"
        subtitle="Donut visualization of terminal digit share"
        loading={isLoading}
      >
        {data && data.terminals.some((t) => t.count > 0) ? (
          <ChartWrapper
            height="380px"
            option={{
              tooltip: {
                trigger: "item",
                formatter: "Terminal {b}: {c} ({d}%)",
              },
              legend: {
                bottom: 0,
                left: "center",
                textStyle: { color: "#94a3b8", fontSize: 11 },
              },
              series: [
                {
                  type: "pie",
                  radius: ["40%", "65%"],
                  center: ["50%", "45%"],
                  avoidLabelOverlap: true,
                  itemStyle: {
                    borderRadius: 6,
                    borderColor: "#111827",
                    borderWidth: 2,
                  },
                  label: {
                    color: "#e2e8f0",
                    fontSize: 13,
                    fontWeight: "bold",
                    formatter: "{b}",
                  },
                  emphasis: {
                    label: {
                      fontSize: 16,
                      fontWeight: "bold",
                    },
                    itemStyle: {
                      shadowBlur: 10,
                      shadowOffsetX: 0,
                      shadowColor: "rgba(0, 0, 0, 0.5)",
                    },
                  },
                  data: data.terminals.map((t) => ({
                    value: t.count,
                    name: String(t.digit),
                    itemStyle: { color: TERMINAL_PALETTE[t.digit] },
                  })),
                },
              ],
            }}
          />
        ) : (
          !isLoading && <NoData />
        )}
      </AnalysisCard>

      {/* By-position breakdown */}
      {data && data.byPosition.length > 0 && (
        <AnalysisCard
          title="Terminals by Position"
          subtitle="Terminal digit frequency at each ball position"
          loading={isLoading}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                  <th className="px-3 py-2 font-medium">Position</th>
                  {Array.from({ length: 10 }, (_, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-center font-mono font-medium"
                      style={{ color: TERMINAL_PALETTE[i] }}
                    >
                      {i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.byPosition.map((pos) => {
                  const posMax = Math.max(
                    ...pos.terminals.map((t) => t.count),
                    1,
                  );
                  return (
                    <tr
                      key={pos.position}
                      className="border-b border-[var(--border)]/50 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-[var(--gold)]">
                        Ball #{pos.position}
                      </td>
                      {pos.terminals.map((t) => {
                        const heat = posMax > 0 ? t.count / posMax : 0;
                        return (
                          <td
                            key={t.digit}
                            className="px-3 py-2 text-center font-mono text-xs"
                            style={{
                              color:
                                heat >= 0.8
                                  ? "#f5a623"
                                  : heat >= 0.5
                                    ? "#e2e8f0"
                                    : "#64748b",
                              fontWeight: heat >= 0.8 ? 700 : 400,
                            }}
                          >
                            {t.count}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AnalysisCard>
      )}
    </div>
  );
}
