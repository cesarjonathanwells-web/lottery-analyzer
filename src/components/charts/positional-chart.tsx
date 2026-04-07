"use client";

import { useMemo } from "react";
import type { FrequencyResult } from "@/lib/types";
import { ChartWrapper } from "./chart-wrapper";
import type { EChartsOption } from "echarts";

interface PositionalChartProps {
  /** Frequency data grouped by position: positions[0] = frequencies for 1st position, etc. */
  positions: FrequencyResult[][];
  loading?: boolean;
}

function buildPositionOption(
  frequencies: FrequencyResult[],
  positionLabel: string,
): EChartsOption {
  const sorted = [...frequencies].sort((a, b) => a.number - b.number);

  // Find max and min frequency for highlighting
  let maxFreq = 0;
  let minFreq = Infinity;
  let maxNum = 0;
  let minNum = 0;
  for (const f of sorted) {
    if (f.count > maxFreq) {
      maxFreq = f.count;
      maxNum = f.number;
    }
    if (f.count < minFreq) {
      minFreq = f.count;
      minNum = f.number;
    }
  }

  return {
    title: {
      text: positionLabel,
      left: "center",
      top: 0,
      textStyle: {
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: "normal",
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter(params: unknown) {
        const p = Array.isArray(params) ? params[0] : params;
        const item = p as { name: string; value: number; dataIndex: number };
        const freq = sorted[item.dataIndex];
        if (!freq) return "";
        return `<div style="font-size:12px">
          <strong>${positionLabel} - Digit ${freq.number}</strong><br/>
          Count: <b>${freq.count}</b><br/>
          Percentage: <b>${freq.percentage.toFixed(1)}%</b>
        </div>`;
      },
    },
    grid: {
      left: 32,
      right: 8,
      top: 28,
      bottom: 24,
      containLabel: false,
    },
    xAxis: {
      type: "category",
      data: sorted.map((f) => String(f.number)),
      axisLabel: { fontSize: 10, color: "#94a3b8" },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 9, color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
    },
    series: [
      {
        type: "bar",
        data: sorted.map((f) => ({
          value: f.count,
          itemStyle: {
            color:
              f.number === maxNum
                ? "#10b981" // green for most frequent
                : f.number === minNum
                  ? "#ef4444" // red for least frequent
                  : "#3b82f6", // blue default
            borderRadius: [2, 2, 0, 0],
          },
        })),
        barMaxWidth: 20,
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: "rgba(245,166,35,0.3)",
          },
        },
      },
    ],
  };
}

const positionLabels = ["1st Position", "2nd Position", "3rd Position", "4th Position"];

export function PositionalChart({ positions, loading }: PositionalChartProps) {
  const options = useMemo(
    () =>
      positions.map((freqs, i) =>
        buildPositionOption(freqs, positionLabels[i] ?? `Position ${i + 1}`),
      ),
    [positions],
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {positions.map((_, i) => (
          <div
            key={i}
            className="h-[200px] animate-pulse rounded-lg bg-[var(--secondary)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--neon-green)]" />
          Most Frequent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--hot)]" />
          Least Frequent
        </span>
      </div>

      <div
        className={`grid grid-cols-1 gap-4 ${
          positions.length >= 4
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : "sm:grid-cols-3"
        }`}
      >
        {options.map((opt, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
          >
            <ChartWrapper option={opt} height="200px" />
          </div>
        ))}
      </div>
    </div>
  );
}
