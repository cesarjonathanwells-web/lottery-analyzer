"use client";

import { useState, useMemo, useCallback } from "react";
import { useGameStore } from "@/lib/store";
import { getGameById } from "@/lib/games";
import { AnalysisCard } from "@/components/lottery/analysis-card";
import { NumberBall } from "@/components/lottery/number-ball";
import { ChartWrapper } from "@/components/charts/chart-wrapper";
import type { EChartsOption } from "echarts";
import type { Draw } from "@/lib/types";
import { Target } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BacktestResult {
  gameId: string;
  totalDraws: number;
  matchDistribution: Record<number, number>;
  bestMatch: {
    draw: Draw;
    mainMatches: number;
    bonusMatches: number;
  };
  timeline: { date: string; matches: number; bonusMatches: number }[];
  estimatedWins: {
    tier: string;
    matches: number;
    count: number;
    estimatedPrize: string;
  }[];
}

// ── Number Picker Grid ────────────────────────────────────────────────────────

function NumberPicker({
  maxNumber,
  selected,
  maxSelectable,
  onToggle,
  label,
  variant,
}: {
  maxNumber: number;
  selected: Set<number>;
  maxSelectable: number;
  onToggle: (n: number) => void;
  label: string;
  variant: "default" | "bonus";
}) {
  const numbers = Array.from({ length: maxNumber }, (_, i) => i + 1);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {label}
        </span>
        <span className="text-xs text-[var(--muted-foreground)]">
          {selected.size} / {maxSelectable}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {numbers.map((n) => {
          const isSelected = selected.has(n);
          const isDisabled = !isSelected && selected.size >= maxSelectable;
          return (
            <NumberBall
              key={n}
              number={n}
              size="sm"
              variant={
                isSelected
                  ? variant === "bonus"
                    ? "bonus"
                    : "selected"
                  : isDisabled
                    ? "disabled"
                    : "default"
              }
              onClick={() => {
                if (isDisabled) return;
                onToggle(n);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Match Distribution Table ──────────────────────────────────────────────────

function MatchDistributionTable({
  distribution,
  totalDraws,
  maxBalls,
}: {
  distribution: Record<number, number>;
  totalDraws: number;
  maxBalls: number;
}) {
  const rows = Array.from({ length: maxBalls + 1 }, (_, i) => maxBalls - i);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--secondary)]">
            <th className="px-4 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]">
              Matches
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">
              Times
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">
              Rate
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">
              Bar
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((matchCount) => {
            const count = distribution[matchCount] ?? 0;
            const pct = totalDraws > 0 ? (count / totalDraws) * 100 : 0;
            const maxCount = Math.max(
              ...rows.map((r) => distribution[r] ?? 0),
              1,
            );
            const barWidth = (count / maxCount) * 100;

            return (
              <tr
                key={matchCount}
                className="border-b border-[var(--border)] last:border-b-0"
              >
                <td className="px-4 py-2 font-mono text-sm font-medium text-[var(--foreground)]">
                  {matchCount} match{matchCount !== 1 ? "es" : ""}
                </td>
                <td className="px-4 py-2 text-right font-mono text-sm tabular-nums text-[var(--foreground)]">
                  {count.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-[var(--muted-foreground)]">
                  {pct.toFixed(1)}%
                </td>
                <td className="px-4 py-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--secondary)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor:
                          matchCount >= 4
                            ? "var(--gold)"
                            : matchCount >= 2
                              ? "var(--electric-blue)"
                              : "var(--muted-foreground)",
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Timeline Chart ────────────────────────────────────────────────────────────

function MatchTimelineChart({
  timeline,
}: {
  timeline: { date: string; matches: number }[];
}) {
  const option: EChartsOption = useMemo(() => {
    // Downsample if too many points
    const maxPoints = 200;
    const step = Math.max(1, Math.floor(timeline.length / maxPoints));
    const sampled = timeline.filter((_, i) => i % step === 0);

    return {
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = params as Array<{
            data: [string, number];
            marker: string;
          }>;
          if (!p || !p[0]) return "";
          const [date, matches] = p[0].data;
          return `<strong>${date}</strong><br/>Matches: ${matches}`;
        },
      },
      grid: {
        left: 48,
        right: 16,
        top: 16,
        bottom: 48,
      },
      xAxis: {
        type: "category",
        data: sampled.map((d) => d.date),
        axisLabel: {
          fontSize: 10,
          color: "#64748b",
          formatter: (val: string) => {
            const d = new Date(val + "T00:00:00");
            return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
          },
        },
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { fontSize: 10, color: "#64748b" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      },
      series: [
        {
          type: "line",
          data: sampled.map((d) => [d.date, d.matches]),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: "#3b82f6", width: 1.5 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(59,130,246,0.2)" },
                { offset: 1, color: "rgba(59,130,246,0)" },
              ],
            },
          },
          markLine: {
            silent: true,
            lineStyle: { color: "rgba(245,166,35,0.3)", type: "dashed" },
            data: [{ type: "average", name: "Average" }],
            label: {
              color: "#f5a623",
              fontSize: 10,
              formatter: "avg: {c}",
            },
          },
        },
      ],
    };
  }, [timeline]);

  return <ChartWrapper option={option} height="250px" />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BacktestPage() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);

  const [selectedMain, setSelectedMain] = useState<Set<number>>(new Set());
  const [selectedBonus, setSelectedBonus] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine bonus number range
  // Powerball bonus: 1-26, Mega Millions: 1-25, others: same as main
  const bonusRange = useMemo(() => {
    if (!game || game.bonusBalls === 0) return 0;
    if (game.gameType === "powerball") return 26;
    if (game.gameType === "mega") return 25;
    return game.numberRange;
  }, [game]);

  const toggleMain = useCallback(
    (n: number) => {
      setSelectedMain((prev) => {
        const next = new Set(prev);
        if (next.has(n)) {
          next.delete(n);
        } else {
          next.add(n);
        }
        return next;
      });
    },
    [],
  );

  const toggleBonus = useCallback(
    (n: number) => {
      setSelectedBonus((prev) => {
        const next = new Set(prev);
        if (next.has(n)) {
          next.delete(n);
        } else {
          next.add(n);
        }
        return next;
      });
    },
    [],
  );

  const clearAll = useCallback(() => {
    setSelectedMain(new Set());
    setSelectedBonus(new Set());
    setResult(null);
    setError(null);
  }, []);

  // Reset selections when game changes
  const [prevGameId, setPrevGameId] = useState(activeGameId);
  if (activeGameId !== prevGameId) {
    setPrevGameId(activeGameId);
    clearAll();
  }

  const canSubmit =
    game &&
    selectedMain.size === game.ballsDrawn &&
    (game.bonusBalls === 0 || selectedBonus.size === game.bonusBalls);

  const runBacktest = useCallback(async () => {
    if (!game || !canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: activeGameId,
          numbers: Array.from(selectedMain).sort((a, b) => a - b),
          bonusNumbers:
            game.bonusBalls > 0
              ? Array.from(selectedBonus).sort((a, b) => a - b)
              : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Backtest failed");
      }

      const data: BacktestResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [game, canSubmit, activeGameId, selectedMain, selectedBonus]);

  if (!game) {
    return (
      <div className="flex h-64 items-center justify-center text-[var(--muted-foreground)]">
        Select a game to begin backtesting
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-[var(--gold)]" />
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">
            My Numbers Backtest
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            See how your numbers would have performed historically for{" "}
            {game.name}
          </p>
        </div>
      </div>

      {/* Number Picker */}
      <AnalysisCard
        title="Pick Your Numbers"
        subtitle={`Select ${game.ballsDrawn} main number${game.ballsDrawn !== 1 ? "s" : ""} (1-${game.numberRange})${game.bonusBalls > 0 ? ` and ${game.bonusBalls} bonus number${game.bonusBalls !== 1 ? "s" : ""} (1-${bonusRange})` : ""}`}
      >
        <div className="flex flex-col gap-6">
          {/* Main numbers */}
          <NumberPicker
            maxNumber={game.numberRange}
            selected={selectedMain}
            maxSelectable={game.ballsDrawn}
            onToggle={toggleMain}
            label="Main Numbers"
            variant="default"
          />

          {/* Bonus numbers */}
          {game.bonusBalls > 0 && bonusRange > 0 && (
            <NumberPicker
              maxNumber={bonusRange}
              selected={selectedBonus}
              maxSelectable={game.bonusBalls}
              onToggle={toggleBonus}
              label="Bonus Numbers"
              variant="bonus"
            />
          )}

          {/* Selected preview + actions */}
          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
            <span className="text-xs text-[var(--muted-foreground)]">
              Your pick:
            </span>
            {Array.from(selectedMain)
              .sort((a, b) => a - b)
              .map((n) => (
                <NumberBall
                  key={`sel-${n}`}
                  number={n}
                  size="md"
                  variant="selected"
                />
              ))}
            {selectedBonus.size > 0 && (
              <>
                <span className="text-[var(--muted-foreground)]">+</span>
                {Array.from(selectedBonus)
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <NumberBall
                      key={`selb-${n}`}
                      number={n}
                      size="md"
                      variant="bonus"
                    />
                  ))}
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:text-[var(--foreground)]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={runBacktest}
                disabled={!canSubmit || loading}
                className="rounded-lg bg-[var(--gold)] px-6 py-2 text-xs font-bold text-[var(--primary-foreground)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Analyzing..." : "Check My Numbers"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-2 text-xs text-[var(--destructive)]">
              {error}
            </div>
          )}
        </div>
      </AnalysisCard>

      {/* Results */}
      {result && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryCard
              label="Total Draws"
              value={result.totalDraws.toLocaleString()}
              accent="var(--electric-blue)"
            />
            <SummaryCard
              label="Best Match"
              value={`${result.bestMatch.mainMatches}/${game.ballsDrawn}`}
              accent="var(--gold)"
            />
            <SummaryCard
              label="3+ Matches"
              value={String(
                Object.entries(result.matchDistribution)
                  .filter(([k]) => parseInt(k) >= 3)
                  .reduce((sum, [, v]) => sum + v, 0),
              )}
              accent="var(--neon-green)"
            />
            <SummaryCard
              label="Avg Match"
              value={
                result.totalDraws > 0
                  ? (
                      result.timeline.reduce((s, t) => s + t.matches, 0) /
                      result.totalDraws
                    ).toFixed(2)
                  : "0"
              }
              accent="var(--warm)"
            />
          </div>

          {/* Match Distribution */}
          <AnalysisCard
            title="Match Distribution"
            subtitle={`Across ${result.totalDraws.toLocaleString()} draws`}
          >
            <MatchDistributionTable
              distribution={result.matchDistribution}
              totalDraws={result.totalDraws}
              maxBalls={game.ballsDrawn}
            />
          </AnalysisCard>

          {/* Best Match */}
          <AnalysisCard
            title="Best Match Ever"
            subtitle={`${result.bestMatch.mainMatches} main number${result.bestMatch.mainMatches !== 1 ? "s" : ""} matched${result.bestMatch.bonusMatches > 0 ? ` + ${result.bestMatch.bonusMatches} bonus` : ""}`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <span>
                  {new Date(
                    result.bestMatch.draw.drawDate + "T00:00:00",
                  ).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {result.bestMatch.draw.numbers.map((n, i) => {
                  const isMatch = selectedMain.has(n);
                  return (
                    <NumberBall
                      key={i}
                      number={n}
                      size="lg"
                      variant={isMatch ? "warm" : "default"}
                    />
                  );
                })}
                {result.bestMatch.draw.bonusNumbers.length > 0 && (
                  <>
                    <span className="text-[var(--muted-foreground)]">+</span>
                    {result.bestMatch.draw.bonusNumbers.map((n, i) => {
                      const isMatch = selectedBonus.has(n);
                      return (
                        <NumberBall
                          key={`b${i}`}
                          number={n}
                          size="lg"
                          variant={isMatch ? "bonus" : "default"}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </AnalysisCard>

          {/* Prize Estimation */}
          {result.estimatedWins.length > 0 && (
            <AnalysisCard
              title="Estimated Winnings"
              subtitle="Based on simplified prize tiers"
            >
              <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--secondary)]">
                      <th className="px-4 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]">
                        Tier
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">
                        Times
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">
                        Prize
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.estimatedWins.map((w) => (
                      <tr
                        key={w.tier}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="px-4 py-2 text-sm text-[var(--foreground)]">
                          {w.tier}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-sm tabular-nums text-[var(--foreground)]">
                          {w.count}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-medium text-[var(--gold)]">
                          {w.estimatedPrize}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AnalysisCard>
          )}

          {/* Timeline Chart */}
          <AnalysisCard
            title="Match Timeline"
            subtitle="Number of matches per draw over time"
          >
            <MatchTimelineChart timeline={result.timeline} />
          </AnalysisCard>
        </>
      )}
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p
        className="font-mono text-2xl font-bold"
        style={{ color: accent }}
      >
        {value}
      </p>
    </div>
  );
}
