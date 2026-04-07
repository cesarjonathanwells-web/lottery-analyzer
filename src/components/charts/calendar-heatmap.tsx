"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Draw } from "@/lib/types";
import type { EChartsOption } from "echarts";
import { ChartWrapper } from "./chart-wrapper";
import { AnalysisCard } from "@/components/lottery/analysis-card";
import { getGameById } from "@/lib/games";

interface CalendarHeatmapProps {
  gameId: string;
  year?: number;
}

async function fetchDrawsForYear(
  gameId: string,
  _year: number,
): Promise<Draw[]> {
  // Fetch from EBG proxy (returns recent draws, not year-filtered)
  const res = await fetch(
    `/api/proxy?type=results&game=${gameId}&limit=200`,
  );
  if (!res.ok) throw new Error("Failed to fetch draws");
  const json = await res.json();
  return json.draws ?? json.data ?? [];
}

export function CalendarHeatmap({ gameId, year: defaultYear }: CalendarHeatmapProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(defaultYear ?? currentYear);
  const game = getGameById(gameId);

  const { data: draws, isLoading } = useQuery({
    queryKey: ["calendar-draws", gameId, year],
    queryFn: () => fetchDrawsForYear(gameId, year),
    enabled: !!gameId,
  });

  // Build heatmap data: { date -> { count, jackpot, numbers } }
  const { chartData: heatmapData, tooltipMap, maxValue } = useMemo(() => {
    if (!draws) return { chartData: [] as [string, number][], tooltipMap: new Map<string, { count: number; jackpot: number; numbers: string[] }>(), maxValue: 1 };

    const byDate = new Map<
      string,
      { count: number; jackpot: number; numbers: string[] }
    >();

    for (const draw of draws) {
      const existing = byDate.get(draw.drawDate) ?? {
        count: 0,
        jackpot: 0,
        numbers: [],
      };
      existing.count += 1;
      if (draw.jackpot && draw.jackpot > existing.jackpot) {
        existing.jackpot = draw.jackpot;
      }
      const numStr = draw.numbers.join(", ");
      const bonusStr =
        draw.bonusNumbers.length > 0
          ? ` + ${draw.bonusNumbers.join(", ")}`
          : "";
      existing.numbers.push(numStr + bonusStr);
      byDate.set(draw.drawDate, existing);
    }

    const chartData: [string, number][] = [];
    let max = 1;

    for (const [date, info] of byDate.entries()) {
      const value =
        game &&
        (game.gameType === "powerball" || game.gameType === "mega") &&
        info.jackpot > 0
          ? info.jackpot / 1_000_000
          : info.count;
      chartData.push([date, value]);
      if (value > max) max = value;
    }

    return { chartData, tooltipMap: byDate, maxValue: max };
  }, [draws, game]);

  const isMajorLottery =
    game && (game.gameType === "powerball" || game.gameType === "mega");

  const option: EChartsOption = {
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as { data: [string, number] };
        if (!p.data || !Array.isArray(p.data)) return "";
        const [date] = p.data;
        const info = tooltipMap.get(date);
        const dateStr = new Date(date + "T00:00:00").toLocaleDateString(
          "en-US",
          { weekday: "short", month: "short", day: "numeric" },
        );
        let html = `<div style="font-size:12px"><strong>${dateStr}</strong><br/>`;
        if (info) {
          html += `Draws: ${info.count}`;
          if (info.jackpot > 0) {
            html += `<br/>Jackpot: $${(info.jackpot / 1_000_000).toFixed(0)}M`;
          }
          if (info.numbers.length > 0) {
            html += `<br/><span style="color:#94a3b8">${info.numbers.slice(0, 3).join("<br/>")}</span>`;
            if (info.numbers.length > 3)
              html += `<br/><span style="color:#64748b">+${info.numbers.length - 3} more</span>`;
          }
        }
        html += "</div>";
        return html;
      },
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxValue,
      inRange: {
        color: [
          "#111827",
          "#1a2332",
          "#1e3a5f",
          "#2563eb",
          "#3b82f6",
          "#60a5fa",
          "#f5a623",
        ],
      },
    },
    calendar: {
      top: 30,
      left: 40,
      right: 20,
      bottom: 10,
      range: String(year),
      cellSize: ["auto", 14],
      splitLine: {
        show: true,
        lineStyle: { color: "rgba(255,255,255,0.06)", width: 1 },
      },
      itemStyle: {
        color: "#111827",
        borderColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
      },
      yearLabel: { show: false },
      dayLabel: {
        color: "#64748b",
        fontSize: 10,
        nameMap: ["S", "M", "T", "W", "T", "F", "S"],
      },
      monthLabel: {
        color: "#94a3b8",
        fontSize: 11,
      },
    },
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        data: heatmapData,
      },
    ],
  };

  const years = Array.from(
    { length: currentYear - 2019 },
    (_, i) => currentYear - i,
  );

  return (
    <AnalysisCard
      title="Draw Calendar"
      subtitle={
        isMajorLottery
          ? `Jackpot heatmap for ${year}`
          : `Draw activity for ${year}`
      }
      loading={isLoading}
    >
      {/* Year selector */}
      <div className="mb-3 flex items-center gap-2">
        {years.slice(0, 6).map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              y === year
                ? "bg-[var(--gold)]/15 text-[var(--gold)]"
                : "text-[var(--muted-foreground)] hover:bg-white/[0.04] hover:text-[var(--foreground)]"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      <ChartWrapper option={option} height="180px" />
    </AnalysisCard>
  );
}
