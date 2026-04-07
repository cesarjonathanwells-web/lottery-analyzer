"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Draw } from "@/lib/types";
import type { EChartsOption } from "echarts";
import { ChartWrapper } from "./chart-wrapper";
import { AnalysisCard } from "@/components/lottery/analysis-card";

interface JackpotChartProps {
  gameId: string;
}

async function fetchDrawsWithJackpot(gameId: string): Promise<Draw[]> {
  const res = await fetch(`/api/results?game=${gameId}&limit=200`);
  if (!res.ok) throw new Error("Failed to fetch draws");
  const json = await res.json();
  return json.draws ?? [];
}

function formatJackpot(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function JackpotChart({ gameId }: JackpotChartProps) {
  const { data: draws, isLoading } = useQuery({
    queryKey: ["jackpot-draws", gameId],
    queryFn: () => fetchDrawsWithJackpot(gameId),
    enabled: !!gameId,
  });

  const { chartData, resetPoints, currentJackpot } = useMemo(() => {
    if (!draws || draws.length === 0) {
      return { chartData: [], resetPoints: [], currentJackpot: 0 };
    }

    // Reverse to chronological order
    const chronological = [...draws].reverse();

    const data: [string, number, string][] = [];
    const resets: { name: string; coord: [string, number] }[] = [];
    let prevJackpot: number | null = null;

    for (const draw of chronological) {
      const jackpot = draw.jackpot ?? 0;
      const nums = draw.numbers.join(", ");
      const bonus =
        draw.bonusNumbers.length > 0
          ? ` + ${draw.bonusNumbers.join(", ")}`
          : "";

      data.push([draw.drawDate, jackpot, `${nums}${bonus}`]);

      // Detect jackpot reset (significant drop = someone won)
      if (prevJackpot !== null && jackpot < prevJackpot * 0.5 && prevJackpot > 0) {
        resets.push({
          name: "Won!",
          coord: [draw.drawDate, jackpot],
        });
      }

      prevJackpot = jackpot;
    }

    const current = chronological[chronological.length - 1]?.jackpot ?? 0;

    return { chartData: data, resetPoints: resets, currentJackpot: current };
  }, [draws]);

  const hasJackpotData = chartData.some((d) => d[1] > 0);

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const p = params as Array<{
          data: [string, number, string];
          marker: string;
        }>;
        if (!p || !p[0]) return "";
        const [date, jackpot, numbers] = p[0].data;
        const dateStr = new Date(date + "T00:00:00").toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric", year: "numeric" },
        );
        return `
          <div style="font-size:12px">
            <strong>${dateStr}</strong><br/>
            Jackpot: <span style="color:#f5a623;font-weight:600">${formatJackpot(jackpot)}</span><br/>
            <span style="color:#94a3b8">${numbers}</span>
          </div>
        `;
      },
    },
    grid: {
      left: 64,
      right: 24,
      top: 32,
      bottom: 60,
    },
    xAxis: {
      type: "category",
      data: chartData.map((d) => d[0]),
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        formatter: (val: string) => {
          const d = new Date(val + "T00:00:00");
          return `${d.getMonth() + 1}/${d.getDate()}`;
        },
        rotate: 0,
      },
      boundaryGap: false,
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        formatter: (val: number) => formatJackpot(val),
      },
      splitLine: {
        lineStyle: { color: "rgba(255,255,255,0.04)" },
      },
    },
    dataZoom: [
      {
        type: "inside",
        start: 0,
        end: 100,
      },
      {
        type: "slider",
        start: 0,
        end: 100,
        height: 20,
        bottom: 8,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "#111827",
        fillerColor: "rgba(245,166,35,0.1)",
        handleStyle: { color: "#f5a623" },
        textStyle: { color: "#64748b", fontSize: 10 },
        dataBackground: {
          lineStyle: { color: "rgba(245,166,35,0.3)" },
          areaStyle: { color: "rgba(245,166,35,0.05)" },
        },
      },
    ],
    series: [
      {
        type: "line",
        data: chartData,
        smooth: true,
        showSymbol: false,
        lineStyle: {
          color: "#f5a623",
          width: 2,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(245,166,35,0.3)" },
              { offset: 0.6, color: "rgba(245,166,35,0.08)" },
              { offset: 1, color: "rgba(245,166,35,0)" },
            ],
          },
        },
        markPoint: {
          symbol: "circle",
          symbolSize: 10,
          itemStyle: {
            color: "#ef4444",
            borderColor: "#fff",
            borderWidth: 1,
          },
          label: {
            show: true,
            formatter: "Won!",
            color: "#ef4444",
            fontSize: 10,
            position: "top",
            distance: 8,
          },
          data: resetPoints,
        },
      },
    ],
  };

  if (!hasJackpotData) {
    return (
      <AnalysisCard title="Jackpot Tracker" subtitle="No jackpot data available for this game">
        <div className="flex h-[200px] items-center justify-center text-sm text-[var(--muted-foreground)]">
          Jackpot data is only available for Powerball and Mega Millions
        </div>
      </AnalysisCard>
    );
  }

  return (
    <AnalysisCard
      title="Jackpot Tracker"
      subtitle={
        currentJackpot > 0
          ? `Current: ${formatJackpot(currentJackpot)}`
          : "Jackpot progression over time"
      }
      loading={isLoading}
    >
      {/* Current jackpot highlight */}
      {currentJackpot > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="jackpot-pulse inline-block h-2.5 w-2.5 rounded-full bg-[var(--gold)]" />
          <span className="font-mono text-xl font-bold text-[var(--gold)]">
            {formatJackpot(currentJackpot)}
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            est. jackpot
          </span>
        </div>
      )}

      <ChartWrapper option={option} height="300px" />
    </AnalysisCard>
  );
}
