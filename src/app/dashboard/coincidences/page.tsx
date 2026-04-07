"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import { getGameById, GAMES } from "@/lib/games";
import { AnalysisCard } from "@/components/lottery/analysis-card";
import { NumberBall } from "@/components/lottery/number-ball";
import { ChartWrapper } from "@/components/charts/chart-wrapper";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { CoincidenceResult } from "@/lib/analysis/coincidences";
import type { RepeatedResult } from "@/lib/analysis/repeated";
import type { EChartsOption } from "echarts";

// ── Constants ───────────────────────────────────────────────────────────────

const RESULTS_PER_PAGE = 20;

// ── Coincidence Finder ──────────────────────────────────────────────────────

function CoincidenceFinder() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const [selectedGame, setSelectedGame] = useState(activeGameId);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [minMatches, setMinMatches] = useState(2);
  const [page, setPage] = useState(0);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searchParams, setSearchParams] = useState<{
    gameId: string;
    referenceNumbers: number[];
    minMatches: number;
  } | null>(null);

  const game = getGameById(selectedGame);
  const maxNumber = game?.numberRange ?? 99;
  const minNumber = game?.gameType.startsWith("pick") ? 0 : 1;

  // Generate number grid based on game range
  const numberGrid = useMemo(() => {
    const nums: number[] = [];
    for (let i = minNumber; i <= maxNumber; i++) {
      nums.push(i);
    }
    return nums;
  }, [minNumber, maxNumber]);

  const toggleNumber = useCallback(
    (num: number) => {
      setSelectedNumbers((prev) =>
        prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num],
      );
    },
    [],
  );

  const handleManualAdd = useCallback(() => {
    const nums = manualInput
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= minNumber && n <= maxNumber);

    if (nums.length > 0) {
      setSelectedNumbers((prev) => {
        const existing = new Set(prev);
        const newNums = nums.filter((n) => !existing.has(n));
        return [...prev, ...newNums];
      });
      setManualInput("");
    }
  }, [manualInput, minNumber, maxNumber]);

  const handleSearch = useCallback(() => {
    if (selectedNumbers.length === 0) return;
    setSearchParams({
      gameId: selectedGame,
      referenceNumbers: [...selectedNumbers],
      minMatches,
    });
    setSearchTriggered(true);
    setPage(0);
  }, [selectedGame, selectedNumbers, minMatches]);

  // Fetch coincidences
  const { data, isLoading, error } = useQuery<CoincidenceResult>({
    queryKey: ["coincidences", searchParams],
    queryFn: async () => {
      const res = await fetch("/api/coincidences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchParams),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch coincidences");
      }
      return res.json();
    },
    enabled: searchTriggered && searchParams !== null,
  });

  // Paginate results
  const paginatedMatches = useMemo(() => {
    if (!data?.matches) return [];
    return data.matches.slice(
      page * RESULTS_PER_PAGE,
      (page + 1) * RESULTS_PER_PAGE,
    );
  }, [data, page]);

  const totalPages = data
    ? Math.ceil(data.matches.length / RESULTS_PER_PAGE)
    : 0;

  // Distribution chart option
  const distributionChart: EChartsOption | null = useMemo(() => {
    if (!data?.distribution) return null;

    const entries = Object.entries(data.distribution)
      .map(([k, v]) => ({ matchCount: Number(k), count: v }))
      .sort((a, b) => a.matchCount - b.matchCount);

    if (entries.length === 0) return null;

    return {
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = (params as { data: number }[])[0];
          return `${p.data} draws`;
        },
      },
      xAxis: {
        type: "category",
        data: entries.map((e) => `${e.matchCount} match${e.matchCount > 1 ? "es" : ""}`),
        axisLabel: { color: "#94a3b8", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#94a3b8", fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          data: entries.map((e) => e.count),
          itemStyle: {
            color: (params: { dataIndex: number }) => {
              const mc = entries[params.dataIndex]?.matchCount ?? 0;
              if (mc >= 5) return "#f5a623";
              if (mc === 4) return "#10b981";
              if (mc === 3) return "#3b82f6";
              return "#1e293b";
            },
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 40,
        },
      ],
    } as EChartsOption;
  }, [data]);

  // Row background color based on match count
  function getRowBg(matchCount: number): string {
    if (matchCount >= 5) return "bg-[var(--gold)]/10";
    if (matchCount === 4) return "bg-[#10b981]/10";
    if (matchCount === 3) return "bg-[#3b82f6]/10";
    return "";
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
          Draw Coincidence Finder
        </h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Find historical draws that share the most numbers with your reference
          set
        </p>
      </div>

      {/* Controls */}
      <AnalysisCard title="Reference Numbers" subtitle="Select or type the numbers to compare against">
        <div className="flex flex-col gap-4">
          {/* Game Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Game:
            </label>
            <Select
              value={selectedGame}
              onValueChange={(val) => {
                if (val) {
                  setSelectedGame(val);
                  setSelectedNumbers([]);
                }
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select game" />
              </SelectTrigger>
              <SelectContent>
                {GAMES.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Min matches:
            </label>
            <Select
              value={String(minMatches)}
              onValueChange={(val) => { if (val) setMinMatches(Number(val)); }}
            >
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Manual Input */}
          <div className="flex items-center gap-2">
            <Input
              className="max-w-[300px] bg-[var(--secondary)] text-[var(--foreground)]"
              placeholder="Type numbers: 5, 12, 33, 44, 69"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualAdd();
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualAdd}
              className="text-xs"
            >
              Add
            </Button>
          </div>

          {/* Selected Numbers Display */}
          {selectedNumbers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[var(--muted-foreground)] mr-1">
                Selected:
              </span>
              {selectedNumbers.map((n) => (
                <NumberBall
                  key={n}
                  number={n}
                  size="sm"
                  variant="selected"
                  onClick={() => toggleNumber(n)}
                />
              ))}
              <button
                type="button"
                onClick={() => setSelectedNumbers([])}
                className="ml-2 text-xs text-[var(--destructive)] hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Number Grid (show only if range is reasonable) */}
          {maxNumber <= 99 && (
            <div className="flex flex-wrap gap-1.5">
              {numberGrid.map((n) => (
                <NumberBall
                  key={n}
                  number={n}
                  size="sm"
                  variant={selectedNumbers.includes(n) ? "selected" : "default"}
                  onClick={() => toggleNumber(n)}
                />
              ))}
            </div>
          )}

          {/* Search Button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSearch}
              disabled={selectedNumbers.length === 0 || isLoading}
              className="bg-[var(--gold)] text-[var(--primary-foreground)] hover:bg-[var(--gold-dim)]"
            >
              {isLoading ? "Searching..." : "Find Matches"}
            </Button>
            {data && (
              <span className="text-xs text-[var(--muted-foreground)]">
                {data.totalDrawsSearched.toLocaleString()} draws searched
                {" / "}
                {data.matches.length.toLocaleString()} matches found
              </span>
            )}
          </div>
        </div>
      </AnalysisCard>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]">
          {error instanceof Error ? error.message : "An error occurred"}
        </div>
      )}

      {/* Results */}
      {data && data.matches.length > 0 && (
        <>
          {/* Distribution Chart */}
          {distributionChart && (
            <AnalysisCard
              title="Match Distribution"
              subtitle="How many draws had each match count"
            >
              <ChartWrapper option={distributionChart} height="220px" />
            </AnalysisCard>
          )}

          {/* Top Matches Table */}
          <AnalysisCard
            title="Top Matches"
            subtitle={`Showing ${page * RESULTS_PER_PAGE + 1}-${Math.min((page + 1) * RESULTS_PER_PAGE, data.matches.length)} of ${data.matches.length}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--muted-foreground)]">
                      Date
                    </th>
                    <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--muted-foreground)]">
                      Numbers
                    </th>
                    <th className="py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">
                      Matches
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMatches.map((m) => {
                    const matchSet = new Set(m.matchedNumbers);
                    return (
                      <tr
                        key={m.draw.id}
                        className={`border-b border-[var(--border)]/50 transition-colors ${getRowBg(m.matchCount)}`}
                      >
                        <td className="py-2.5 pr-4 text-xs text-[var(--foreground)] whitespace-nowrap">
                          {m.draw.drawDate}
                          {m.draw.drawTime && (
                            <span className="ml-1 text-[var(--muted-foreground)]">
                              {m.draw.drawTime}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {m.draw.numbers.map((n, i) => (
                              <NumberBall
                                key={`${n}-${i}`}
                                number={n}
                                size="sm"
                                variant={matchSet.has(n) ? "warm" : "default"}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <Badge
                            variant={
                              m.matchCount >= 5
                                ? "default"
                                : m.matchCount >= 3
                                  ? "secondary"
                                  : "outline"
                            }
                            className={
                              m.matchCount >= 5
                                ? "bg-[var(--gold)] text-[var(--primary-foreground)]"
                                : ""
                            }
                          >
                            {m.matchCount}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-xs"
                >
                  Previous
                </Button>
                <span className="text-xs text-[var(--muted-foreground)]">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            )}
          </AnalysisCard>
        </>
      )}

      {/* No results state */}
      {data && data.matches.length === 0 && searchTriggered && (
        <AnalysisCard title="No Matches" subtitle="Try adjusting your parameters">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--secondary)]">
              <span className="text-lg text-[var(--muted-foreground)]">--</span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              No draws found with {minMatches}+ matching numbers. Try lowering
              the minimum match threshold or selecting different numbers.
            </p>
          </div>
        </AnalysisCard>
      )}
    </div>
  );
}

// ── Repeated Numbers Section ────────────────────────────────────────────────

function RepeatedNumbersSection() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);
  const [lookback, setLookback] = useState(50);

  const { data, isLoading } = useQuery<RepeatedResult>({
    queryKey: ["repeated", activeGameId, lookback],
    queryFn: async () => {
      const res = await fetch(
        `/api/coincidences?game=${activeGameId}&lookback=${lookback}`,
      );
      if (!res.ok) throw new Error("Failed to fetch repeated numbers");
      return res.json();
    },
    enabled: !!activeGameId,
  });

  // Chart: top 15 repeated numbers by streak
  const streakChart: EChartsOption | null = useMemo(() => {
    if (!data?.repeated || data.repeated.length === 0) return null;

    const top = data.repeated.slice(0, 15);

    return {
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = (params as { name: string; data: number }[])[0];
          return `Number ${p.name}: ${p.data} consecutive draws`;
        },
      },
      xAxis: {
        type: "category",
        data: top.map((r) => String(r.number)),
        axisLabel: { color: "#94a3b8", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        name: "Streak",
        nameTextStyle: { color: "#94a3b8", fontSize: 11 },
        axisLabel: { color: "#94a3b8", fontSize: 11 },
        minInterval: 1,
      },
      series: [
        {
          type: "bar",
          data: top.map((r) => r.streak),
          itemStyle: {
            color: "#ef4444",
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 36,
        },
      ],
    } as EChartsOption;
  }, [data]);

  return (
    <div className="flex flex-col gap-6 mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
            Repeated Numbers
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Numbers appearing in consecutive draws for{" "}
            {game?.name ?? "the selected game"} -- &quot;the number is running hot&quot;
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted-foreground)]">
            Lookback:
          </label>
          <Select
            value={String(lookback)}
            onValueChange={(val) => { if (val) setLookback(Number(val)); }}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[20, 50, 100, 200].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} draws
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Streak Chart */}
      {streakChart && (
        <AnalysisCard
          title="Consecutive Draw Streaks"
          subtitle="Numbers appearing in the most consecutive draws"
          loading={isLoading}
        >
          <ChartWrapper option={streakChart} height="240px" />
        </AnalysisCard>
      )}

      {/* Repeated Numbers Cards */}
      <AnalysisCard
        title="Hot Streak Details"
        subtitle={`${data?.drawsAnalyzed ?? 0} recent draws analyzed`}
        loading={isLoading}
      >
        {data && data.repeated.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.repeated.slice(0, 12).map((entry) => (
              <div
                key={entry.number}
                className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3"
              >
                <NumberBall
                  number={entry.number}
                  size="lg"
                  variant="hot"
                />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {entry.streak} consecutive
                    </span>
                    {entry.windowDays > 0 && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        ({entry.windowDays}d window)
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {entry.occurrences.length} total appearances
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {entry.occurrences.slice(0, 5).map((occ, i) => (
                      <span
                        key={`${occ.drawDate}-${i}`}
                        className="text-[10px] rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[var(--muted-foreground)]"
                      >
                        {occ.drawDate}
                      </span>
                    ))}
                    {entry.occurrences.length > 5 && (
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        +{entry.occurrences.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--secondary)]">
                <span className="text-lg text-[var(--muted-foreground)]">
                  --
                </span>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                No repeated numbers found in the last {lookback} draws.
              </p>
            </div>
          )
        )}
      </AnalysisCard>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CoincidencesPage() {
  return (
    <div className="flex flex-col gap-4">
      <CoincidenceFinder />
      <RepeatedNumbersSection />
    </div>
  );
}
