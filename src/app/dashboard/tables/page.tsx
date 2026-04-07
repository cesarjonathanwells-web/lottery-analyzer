"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import { getGameById } from "@/lib/games";
import type { HotTableResult } from "@/lib/analysis/hot-table";
import type { TerminalResult } from "@/lib/analysis/terminals";
import type { SuccessionResult } from "@/lib/analysis/succession";
import type { WeeklyGridResult } from "@/lib/analysis/weekly";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnalysisCard } from "@/components/lottery/analysis-card";
import { NumberBall } from "@/components/lottery/number-ball";
import { ChartWrapper } from "@/components/charts/chart-wrapper";
import { Input } from "@/components/ui/input";

// ── Fetchers ────────────────────────────────────────────────────────────────

function buildUrl(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) sp.set(k, String(v));
  }
  return `/api/tables?${sp.toString()}`;
}

// ── Selector Button ─────────────────────────────────────────────────────────

function PillSelector<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && (
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {label}
        </span>
      )}
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
            value === opt.value
              ? "bg-[var(--gold)]/20 text-[var(--gold)] ring-1 ring-[var(--gold)]/30"
              : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/80 hover:text-[var(--foreground)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────

function NoData({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--secondary)]">
        <span className="text-lg text-[var(--muted-foreground)]">--</span>
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">
        {message ?? "No data available. Import draws first."}
      </p>
    </div>
  );
}

// ── Day abbreviations ────────────────────────────────────────────────────────

const DAY_ABBREV: Record<string, string> = {
  Domingo: "Dom",
  Lunes: "Lun",
  Martes: "Mar",
  "Miércoles": "Mié",
  Jueves: "Jue",
  Viernes: "Vie",
  "Sábado": "Sáb",
};

// ── Window options ──────────────────────────────────────────────────────────

const WINDOW_OPTIONS = [
  { label: "7d", value: 7 },
  { label: "15d", value: 15 },
  { label: "30d", value: 30 },
  { label: "60d", value: 60 },
  { label: "90d", value: 90 },
  { label: "180d", value: 180 },
  { label: "365d", value: 365 },
];

const POSITION_OPTIONS = [
  { label: "All", value: 0 },
  { label: "1st", value: 1 },
  { label: "2nd", value: 2 },
  { label: "3rd", value: 3 },
];

// ═══════════════════════════════════════════════════════════════════════════
// HOT NUMBERS TAB
// ═══════════════════════════════════════════════════════════════════════════

function HotNumbersTab() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);

  const [days, setDays] = useState(30);
  const [position, setPosition] = useState(0);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["tables", "hot", activeGameId, days, limit, position],
    queryFn: async () => {
      const res = await fetch(
        buildUrl({ type: "hot", game: activeGameId, days, limit, position }),
      );
      if (!res.ok) throw new Error("Failed to fetch hot numbers");
      return res.json() as Promise<HotTableResult>;
    },
    enabled: !!activeGameId,
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-4">
        <PillSelector
          label="Window:"
          options={WINDOW_OPTIONS}
          value={days}
          onChange={setDays}
        />
        <PillSelector
          label="Position:"
          options={POSITION_OPTIONS}
          value={position}
          onChange={setPosition}
        />
      </div>

      <AnalysisCard
        title="Hot Numbers"
        subtitle={`Top ${limit} most frequent numbers in the last ${days} days for ${game?.name ?? "selected game"} (${data?.drawsAnalyzed ?? 0} draws)`}
        loading={isLoading}
      >
        {data && data.hotNumbers.length > 0 ? (
          <div className="flex flex-col gap-6">
            {/* Number balls row */}
            <div className="flex flex-wrap gap-3">
              {data.hotNumbers.slice(0, 10).map((h, idx) => (
                <div key={h.number} className="flex flex-col items-center gap-1">
                  <NumberBall
                    number={h.number}
                    size="lg"
                    variant={idx < 3 ? "hot" : idx < 7 ? "warm" : "default"}
                  />
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    {h.count}x
                  </span>
                </div>
              ))}
            </div>

            {/* ECharts horizontal bar chart */}
            <ChartWrapper
              height="400px"
              option={{
                tooltip: {
                  trigger: "axis",
                  axisPointer: { type: "shadow" },
                },
                grid: { left: 60, right: 24, top: 16, bottom: 24 },
                xAxis: {
                  type: "value",
                  axisLabel: { color: "#94a3b8" },
                },
                yAxis: {
                  type: "category",
                  data: [...data.hotNumbers]
                    .reverse()
                    .map((h) => String(h.number)),
                  axisLabel: { color: "#e2e8f0", fontSize: 12, fontFamily: "monospace" },
                },
                series: [
                  {
                    type: "bar",
                    data: [...data.hotNumbers].reverse().map((h) => h.count),
                    itemStyle: {
                      color: {
                        type: "linear",
                        x: 0, y: 0, x2: 1, y2: 0,
                        colorStops: [
                          { offset: 0, color: "#f5a623" },
                          { offset: 1, color: "#ef4444" },
                        ],
                      },
                      borderRadius: [0, 4, 4, 0],
                    },
                    barMaxWidth: 20,
                  },
                ],
              }}
            />

            {/* Full ranking table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Number</th>
                    <th className="px-3 py-2 font-medium text-right">Count</th>
                    <th className="px-3 py-2 font-medium text-right">%</th>
                    <th className="px-3 py-2 font-medium text-right">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hotNumbers.map((h, idx) => (
                    <tr
                      key={h.number}
                      className="border-b border-[var(--border)]/50 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-[var(--muted-foreground)]">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <NumberBall
                          number={h.number}
                          size="sm"
                          variant={idx < 3 ? "hot" : idx < 7 ? "warm" : "default"}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--foreground)]">
                        {h.count}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--muted-foreground)]">
                        {h.percentage.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-[var(--muted-foreground)]">
                        {h.lastSeen}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cold numbers section */}
            {data.coldNumbers.length > 0 && (
              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--cold)]">
                  Cold Numbers
                </h4>
                <div className="flex flex-wrap gap-2">
                  {data.coldNumbers.slice(0, 10).map((c) => (
                    <div key={c.number} className="flex flex-col items-center gap-1">
                      <NumberBall number={c.number} size="sm" variant="cold" />
                      <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                        {c.count}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          !isLoading && <NoData />
        )}
      </AnalysisCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMINALS TAB
// ═══════════════════════════════════════════════════════════════════════════

function TerminalsTab() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);

  const { data, isLoading } = useQuery({
    queryKey: ["tables", "terminals", activeGameId],
    queryFn: async () => {
      const res = await fetch(
        buildUrl({ type: "terminals", game: activeGameId }),
      );
      if (!res.ok) throw new Error("Failed to fetch terminals");
      return res.json() as Promise<TerminalResult>;
    },
    enabled: !!activeGameId,
  });

  // Find max count for heat coloring
  const maxCount = data
    ? Math.max(...data.terminals.map((t) => t.count), 1)
    : 1;

  return (
    <AnalysisCard
      title="Terminal Digit Analysis"
      subtitle={`Last digit (terminal) frequency for ${game?.name ?? "selected game"} (${data?.drawsAnalyzed ?? 0} draws)`}
      loading={isLoading}
    >
      {data && data.terminals.some((t) => t.count > 0) ? (
        <div className="flex flex-col gap-6">
          {/* Donut chart */}
          <ChartWrapper
            height="320px"
            option={{
              tooltip: {
                trigger: "item",
                formatter: "{b}: {c} ({d}%)",
              },
              series: [
                {
                  type: "pie",
                  radius: ["45%", "70%"],
                  center: ["50%", "50%"],
                  avoidLabelOverlap: true,
                  itemStyle: {
                    borderRadius: 6,
                    borderColor: "#111827",
                    borderWidth: 2,
                  },
                  label: {
                    color: "#e2e8f0",
                    fontSize: 12,
                    formatter: "{b}\n{d}%",
                  },
                  data: data.terminals.map((t) => ({
                    value: t.count,
                    name: String(t.digit),
                    itemStyle: {
                      color: terminalColor(t.digit),
                    },
                  })),
                },
              ],
            }}
          />

          {/* 10-cell grid */}
          <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
            {data.terminals.map((t) => {
              const intensity = maxCount > 0 ? t.count / maxCount : 0;
              return (
                <div
                  key={t.digit}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--border)] p-3 transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${
                      intensity > 0.6
                        ? `rgba(245,166,35,${intensity * 0.3})`
                        : `rgba(59,130,246,${(1 - intensity) * 0.15})`
                    }, transparent)`,
                  }}
                >
                  <span className="text-2xl font-bold font-mono text-[var(--foreground)]">
                    {t.digit}
                  </span>
                  <span className="text-sm font-mono text-[var(--gold)]">
                    {t.count}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {t.percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* By-position breakdown */}
          {data.byPosition.length > 0 && (
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                By Position
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">Pos</th>
                      {Array.from({ length: 10 }, (_, i) => (
                        <th
                          key={i}
                          className="px-2 py-2 text-center font-mono font-medium"
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
                          className="border-b border-[var(--border)]/50"
                        >
                          <td className="px-2 py-2 font-mono text-xs text-[var(--gold)]">
                            #{pos.position}
                          </td>
                          {pos.terminals.map((t) => {
                            const heat = posMax > 0 ? t.count / posMax : 0;
                            return (
                              <td
                                key={t.digit}
                                className="px-2 py-2 text-center font-mono text-xs"
                                style={{
                                  color:
                                    heat > 0.6
                                      ? "#f5a623"
                                      : heat > 0.3
                                        ? "#e2e8f0"
                                        : "#94a3b8",
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
            </div>
          )}
        </div>
      ) : (
        !isLoading && <NoData />
      )}
    </AnalysisCard>
  );
}

function terminalColor(digit: number): string {
  const palette = [
    "#ef4444", "#f97316", "#f5a623", "#eab308",
    "#84cc16", "#10b981", "#06b6d4", "#3b82f6",
    "#8b5cf6", "#ec4899",
  ];
  return palette[digit % palette.length];
}

// ═══════════════════════════════════════════════════════════════════════════
// SUCCESSION TAB
// ═══════════════════════════════════════════════════════════════════════════

function SuccessionTab() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);

  const [targetInput, setTargetInput] = useState("");
  const [targetNumber, setTargetNumber] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tables", "succession", activeGameId, targetNumber],
    queryFn: async () => {
      const res = await fetch(
        buildUrl({
          type: "succession",
          game: activeGameId,
          number: targetNumber!,
        }),
      );
      if (!res.ok) throw new Error("Failed to fetch succession");
      return res.json() as Promise<SuccessionResult>;
    },
    enabled: !!activeGameId && targetNumber !== null,
  });

  function handleSearch() {
    const num = parseInt(targetInput, 10);
    if (!isNaN(num)) {
      setTargetNumber(num);
    }
  }

  const sequence = data?.sequences?.[0];

  return (
    <AnalysisCard
      title="Succession Analysis"
      subtitle={`What numbers follow number ${targetNumber ?? "X"} in the next draw? (${game?.name ?? "selected game"})`}
      loading={isLoading && targetNumber !== null}
    >
      <div className="flex flex-col gap-6">
        {/* Input controls */}
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              Target Number
            </label>
            <Input
              type="number"
              min={0}
              max={game?.numberRange ?? 99}
              placeholder="e.g. 42"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-28 bg-[var(--secondary)] text-[var(--foreground)]"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="h-8 rounded-md bg-[var(--gold)] px-4 text-xs font-semibold text-[var(--primary-foreground)] transition-all hover:brightness-110 active:scale-95"
          >
            Analyze
          </button>
        </div>

        {/* Results */}
        {sequence && sequence.nextOccurrences.length > 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Numbers that appeared in the draw after{" "}
              <span className="font-mono text-[var(--gold)]">
                {sequence.number}
              </span>{" "}
              ({data?.drawsAnalyzed ?? 0} draws analyzed):
            </p>

            {/* Top 10 as numbered list with balls */}
            <div className="flex flex-col gap-2">
              {sequence.nextOccurrences.slice(0, 10).map((occ, idx) => (
                <div
                  key={occ.number}
                  className="flex items-center gap-3 rounded-md border border-[var(--border)]/50 bg-[var(--secondary)]/30 px-3 py-2"
                >
                  <span className="w-6 text-right font-mono text-xs text-[var(--muted-foreground)]">
                    {idx + 1}.
                  </span>
                  <NumberBall
                    number={occ.number}
                    size="sm"
                    variant={idx < 3 ? "hot" : "default"}
                  />
                  <div className="flex flex-1 items-center gap-2">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--hot)]"
                      style={{
                        width: `${(occ.count / sequence.nextOccurrences[0].count) * 100}%`,
                        maxWidth: "200px",
                      }}
                    />
                    <span className="font-mono text-xs text-[var(--foreground)]">
                      {occ.count}x
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : targetNumber !== null && !isLoading ? (
          <NoData message={`Number ${targetNumber} was not found or has no succession data.`} />
        ) : (
          !targetNumber && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                Enter a number above to see which numbers follow it most
                frequently.
              </p>
            </div>
          )
        )}
      </div>
    </AnalysisCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY GRID TAB
// ═══════════════════════════════════════════════════════════════════════════

function WeeklyGridTab() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);
  const [position, setPosition] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["tables", "weekly", activeGameId, position],
    queryFn: async () => {
      const res = await fetch(
        buildUrl({
          type: "weekly",
          game: activeGameId,
          position: position > 0 ? position : undefined,
        }),
      );
      if (!res.ok) throw new Error("Failed to fetch weekly grid");
      return res.json() as Promise<WeeklyGridResult>;
    },
    enabled: !!activeGameId,
  });

  // Build heatmap data for ECharts
  const heatmapData = buildHeatmapData(data);

  return (
    <div className="flex flex-col gap-4">
      <PillSelector
        label="Position:"
        options={POSITION_OPTIONS}
        value={position}
        onChange={setPosition}
      />

      <AnalysisCard
        title="Weekly Grid"
        subtitle={`Number frequency by day of week for ${game?.name ?? "selected game"} (${data?.drawsAnalyzed ?? 0} draws)`}
        loading={isLoading}
      >
        {data && data.grid.some((g) => g.numbers.length > 0) ? (
          <div className="flex flex-col gap-6">
            {/* 7-column grid: top 5 per day */}
            <div className="grid grid-cols-7 gap-2">
              {data.grid.map((day) => (
                <div key={day.dayOfWeek} className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--gold)]">
                    {DAY_ABBREV[day.dayOfWeek] ?? day.dayOfWeek.slice(0, 3)}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {day.totalDraws} draws
                  </span>
                  <div className="flex flex-col items-center gap-1.5">
                    {day.numbers.slice(0, 5).map((n, idx) => (
                      <div key={n.number} className="flex flex-col items-center">
                        <NumberBall
                          number={n.number}
                          size="sm"
                          variant={idx === 0 ? "hot" : idx < 3 ? "warm" : "default"}
                        />
                        <span className="text-[9px] font-mono text-[var(--muted-foreground)]">
                          {n.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* ECharts heatmap */}
            {heatmapData.data.length > 0 && (
              <ChartWrapper
                height="400px"
                option={{
                  tooltip: {
                    position: "top",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter: ((params: any) => {
                      const val = params.value as [number, number, number];
                      const [dayIdx, numIdx, count] = val;
                      const dayName = heatmapData.days[dayIdx];
                      const num = heatmapData.numbers[numIdx];
                      return `${dayName}: #${num} = ${count}x`;
                    }) as unknown as string,
                  },
                  grid: {
                    left: 60,
                    right: 40,
                    top: 16,
                    bottom: 50,
                  },
                  xAxis: {
                    type: "category",
                    data: heatmapData.days,
                    axisLabel: { color: "#94a3b8", fontSize: 11 },
                    splitArea: { show: true },
                  },
                  yAxis: {
                    type: "category",
                    data: heatmapData.numbers.map(String),
                    axisLabel: { color: "#94a3b8", fontSize: 10, fontFamily: "monospace" },
                  },
                  visualMap: {
                    min: 0,
                    max: heatmapData.max,
                    calculable: true,
                    orient: "horizontal",
                    left: "center",
                    bottom: 0,
                    inRange: {
                      color: [
                        "#1e293b",
                        "#1e3a5f",
                        "#2563eb",
                        "#f5a623",
                        "#ef4444",
                      ],
                    },
                    textStyle: { color: "#94a3b8" },
                  },
                  series: [
                    {
                      type: "heatmap",
                      data: heatmapData.data,
                      label: { show: false },
                      emphasis: {
                        itemStyle: {
                          shadowBlur: 10,
                          shadowColor: "rgba(0, 0, 0, 0.5)",
                        },
                      },
                    },
                  ],
                }}
              />
            )}
          </div>
        ) : (
          !isLoading && <NoData />
        )}
      </AnalysisCard>
    </div>
  );
}

function buildHeatmapData(data: WeeklyGridResult | undefined) {
  if (!data) return { days: [], numbers: [], data: [], max: 0 };

  const days = data.grid.map(
    (g) => DAY_ABBREV[g.dayOfWeek] ?? g.dayOfWeek.slice(0, 3),
  );

  // Collect unique numbers that appear in top 10 for any day
  const numSet = new Set<number>();
  for (const day of data.grid) {
    for (const n of day.numbers.slice(0, 10)) {
      numSet.add(n.number);
    }
  }
  const numbers = [...numSet].sort((a, b) => a - b).slice(0, 20);

  // Build heatmap entries: [dayIndex, numberIndex, count]
  const heatmapEntries: [number, number, number][] = [];
  let max = 0;

  for (let dayIdx = 0; dayIdx < data.grid.length; dayIdx++) {
    const numMap = new Map(
      data.grid[dayIdx].numbers.map((n) => [n.number, n.count]),
    );
    for (let numIdx = 0; numIdx < numbers.length; numIdx++) {
      const count = numMap.get(numbers[numIdx]) ?? 0;
      heatmapEntries.push([dayIdx, numIdx, count]);
      if (count > max) max = count;
    }
  }

  return { days, numbers, data: heatmapEntries, max };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function TablesPage() {
  const game = getGameById(useGameStore((s) => s.activeGameId));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
          Analysis Tables
        </h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Advanced statistical tables for {game?.name ?? "the selected game"}
        </p>
      </div>

      <Tabs defaultValue="hot">
        <TabsList
          variant="line"
          className="w-full flex-wrap justify-start gap-0"
        >
          <TabsTrigger value="hot">Hot Numbers</TabsTrigger>
          <TabsTrigger value="terminals">Terminals</TabsTrigger>
          <TabsTrigger value="succession">Succession</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Grid</TabsTrigger>
        </TabsList>

        <TabsContent value="hot">
          <HotNumbersTab />
        </TabsContent>

        <TabsContent value="terminals">
          <TerminalsTab />
        </TabsContent>

        <TabsContent value="succession">
          <SuccessionTab />
        </TabsContent>

        <TabsContent value="weekly">
          <WeeklyGridTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
