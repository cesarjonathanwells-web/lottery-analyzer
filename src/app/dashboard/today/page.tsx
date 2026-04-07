"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import { getGameById, GAMES, GAME_GROUPS } from "@/lib/games";
import { AnalysisCard } from "@/components/lottery/analysis-card";
import { NumberBall } from "@/components/lottery/number-ball";
import { ChartWrapper } from "@/components/charts/chart-wrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DayLikeTodayResult } from "@/lib/analysis/day-like-today";
import type { EChartsOption } from "echarts";

// ── Month Names ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const [gameFilter, setGameFilter] = useState<string>("all");

  const queryGameId = gameFilter === "all" ? undefined : gameFilter;

  const { data, isLoading, error } = useQuery<DayLikeTodayResult>({
    queryKey: ["day-like-today", month, day, queryGameId],
    queryFn: async () => {
      const params = new URLSearchParams({
        month: String(month),
        day: String(day),
      });
      if (queryGameId) params.set("game", queryGameId);
      const res = await fetch(`/api/day-like-today?${params}`);
      if (!res.ok) throw new Error("Failed to fetch historical data");
      return res.json();
    },
  });

  // Group draws by year
  const drawsByYear = useMemo(() => {
    if (!data?.draws) return new Map<number, DayLikeTodayResult["draws"]>();
    const map = new Map<number, DayLikeTodayResult["draws"]>();
    for (const draw of data.draws) {
      const yearDraws = map.get(draw.year) ?? [];
      yearDraws.push(draw);
      map.set(draw.year, yearDraws);
    }
    // Sort years descending
    return new Map(
      [...map.entries()].sort(([a], [b]) => b - a),
    );
  }, [data]);

  // Top 10 lucky numbers
  const luckyNumbers = useMemo(() => {
    if (!data?.numberFrequency) return [];
    return data.numberFrequency.slice(0, 10);
  }, [data]);

  // Frequency chart
  const frequencyChart: EChartsOption | null = useMemo(() => {
    if (!data?.numberFrequency || data.numberFrequency.length === 0) return null;

    const top30 = data.numberFrequency.slice(0, 30);

    return {
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = (params as { name: string; data: number }[])[0];
          return `Number ${p.name}: appeared ${p.data} time${p.data !== 1 ? "s" : ""}`;
        },
      },
      xAxis: {
        type: "category",
        data: top30.map((f) => String(f.number)),
        axisLabel: { color: "#94a3b8", fontSize: 11, rotate: 0 },
      },
      yAxis: {
        type: "value",
        name: "Appearances",
        nameTextStyle: { color: "#94a3b8", fontSize: 11 },
        axisLabel: { color: "#94a3b8", fontSize: 11 },
        minInterval: 1,
      },
      series: [
        {
          type: "bar",
          data: top30.map((f) => f.count),
          itemStyle: {
            color: (params: { dataIndex: number }) => {
              if (params.dataIndex < 3) return "#f5a623";
              if (params.dataIndex < 10) return "#3b82f6";
              return "#1e293b";
            },
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 28,
        },
      ],
    } as EChartsOption;
  }, [data]);

  const dateLabel = `${MONTH_NAMES[month - 1]} ${day}${getOrdinalSuffix(day)}`;

  // Day options for the selected month
  const daysInMonth = new Date(2024, month, 0).getDate(); // Use leap year
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
          A Day Like Today
        </h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Historical draws that happened on the same calendar date across all
          years
        </p>
      </div>

      {/* Controls */}
      <AnalysisCard title="Select Date" subtitle="Choose a month and day to look up">
        <div className="flex flex-wrap items-center gap-3">
          {/* Month */}
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Month:
          </label>
          <Select
            value={String(month)}
            onValueChange={(val) => {
              if (!val) return;
              setMonth(Number(val));
              // Clamp day if needed
              const maxDay = new Date(2024, Number(val), 0).getDate();
              if (day > maxDay) setDay(maxDay);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Day */}
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Day:
          </label>
          <Select value={String(day)} onValueChange={(val) => { if (val) setDay(Number(val)); }}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dayOptions.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Game filter */}
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Game:
          </label>
          <Select value={gameFilter} onValueChange={(val) => { if (val) setGameFilter(val); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All games" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Games</SelectItem>
              {GAME_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          {/* Today shortcut */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              setMonth(today.getMonth() + 1);
              setDay(today.getDate());
            }}
            className="text-xs"
          >
            Today
          </Button>
        </div>
      </AnalysisCard>

      {/* Loading */}
      {isLoading && (
        <AnalysisCard title="Loading..." loading={true}>
          <div />
        </AnalysisCard>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]">
          {error instanceof Error ? error.message : "An error occurred"}
        </div>
      )}

      {/* Results */}
      {data && !isLoading && (
        <>
          {/* Summary Header */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[var(--gold)] via-[var(--gold-dim)] to-transparent" />
            <h3 className="text-base font-bold text-[var(--gold)]">
              On {dateLabel} across all years...
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <div className="flex flex-col">
                <span className="text-2xl font-bold tabular-nums text-[var(--foreground)]">
                  {data.totalDraws}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  total draws
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold tabular-nums text-[var(--foreground)]">
                  {drawsByYear.size}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  years with draws
                </span>
              </div>
              {luckyNumbers.length > 0 && (
                <div className="flex flex-col">
                  <span className="text-2xl font-bold tabular-nums text-[var(--gold)]">
                    {luckyNumbers[0].number}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    most frequent ({luckyNumbers[0].count}x)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Lucky Numbers */}
          {luckyNumbers.length > 0 && (
            <AnalysisCard
              title={`Lucky Numbers for ${dateLabel}`}
              subtitle="Top 10 most frequently drawn numbers on this date"
            >
              <div className="flex flex-wrap gap-4 py-2">
                {luckyNumbers.map((entry, idx) => (
                  <div
                    key={entry.number}
                    className="flex flex-col items-center gap-1"
                  >
                    <NumberBall
                      number={entry.number}
                      size="lg"
                      variant={idx < 3 ? "warm" : idx < 7 ? "default" : "default"}
                    />
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5"
                    >
                      {entry.count}x
                    </Badge>
                  </div>
                ))}
              </div>
            </AnalysisCard>
          )}

          {/* Number Frequency Chart */}
          {frequencyChart && (
            <AnalysisCard
              title="Number Frequency on This Date"
              subtitle={`How often each number appears in draws on ${dateLabel}`}
            >
              <ChartWrapper option={frequencyChart} height="260px" />
            </AnalysisCard>
          )}

          {/* Year-by-Year Timeline */}
          {data.totalDraws > 0 && (
            <AnalysisCard
              title="Year-by-Year Timeline"
              subtitle={`All draws on ${dateLabel}`}
            >
              <div className="flex flex-col gap-4">
                {[...drawsByYear.entries()].map(([year, yearDraws]) => (
                  <div key={year}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-[var(--gold)]">
                        {year}
                      </span>
                      <div className="flex-1 border-t border-[var(--border)]" />
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {yearDraws.length} draw{yearDraws.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 pl-4">
                      {yearDraws.map((draw, i) => {
                        const gameInfo = getGameById(draw.gameId);
                        return (
                          <div
                            key={`${draw.drawDate}-${draw.gameId}-${i}`}
                            className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)]/50 bg-[var(--secondary)]/20 px-3 py-2"
                          >
                            {/* Game badge */}
                            <div className="flex items-center gap-1.5 min-w-[120px]">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: gameInfo?.color ?? "#666",
                                }}
                              />
                              <span className="text-xs font-medium text-[var(--foreground)] truncate">
                                {draw.gameName}
                              </span>
                            </div>

                            {/* Time */}
                            {draw.drawTime && (
                              <span className="text-xs text-[var(--muted-foreground)] min-w-[60px]">
                                {draw.drawTime}
                              </span>
                            )}

                            {/* Numbers */}
                            <div className="flex flex-wrap gap-1">
                              {draw.numbers.map((n, j) => (
                                <NumberBall
                                  key={`${n}-${j}`}
                                  number={n}
                                  size="sm"
                                  variant="default"
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </AnalysisCard>
          )}

          {/* Empty state */}
          {data.totalDraws === 0 && (
            <AnalysisCard title="No Draws Found">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--secondary)]">
                  <span className="text-lg text-[var(--muted-foreground)]">
                    --
                  </span>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  No historical draws found for {dateLabel}.
                  {gameFilter !== "all" && " Try selecting 'All Games'."}
                </p>
              </div>
            </AnalysisCard>
          )}
        </>
      )}
    </div>
  );
}
