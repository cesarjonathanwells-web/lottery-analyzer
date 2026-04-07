"use client";

import { useMemo } from "react";
import type { ExtendedPatternResult } from "@/lib/analysis/types";
import { ChartWrapper } from "./chart-wrapper";
import type { EChartsOption } from "echarts";

interface PatternRadarProps {
  pattern: ExtendedPatternResult;
  loading?: boolean;
}

function parseRatio(ratio: string): [number, number] {
  const parts = ratio.split("/").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0];
}

export function PatternRadar({ pattern, loading }: PatternRadarProps) {
  const { radarOption, summaryStats } = useMemo(() => {
    const [odd, even] = parseRatio(pattern.oddEvenRatio);
    const [high, low] = parseRatio(pattern.highLowRatio);
    const total = odd + even || 1;

    const oddPct = (odd / total) * 100;
    const evenPct = (even / total) * 100;
    const highPct = (high / total) * 100;
    const lowPct = (low / total) * 100;

    // Normalize sum to 0-100 scale based on the range
    const sumStats = pattern.sumStats ?? pattern.sumRange;
    const sumRange = sumStats.max - sumStats.min || 1;
    const sumNormalized = ((sumStats.current - sumStats.min) / sumRange) * 100;

    const option: EChartsOption = {
      legend: {
        data: ["Current Draw", "Ideal Balanced"],
        bottom: 0,
        textStyle: { color: "#94a3b8", fontSize: 11 },
        itemWidth: 14,
        itemHeight: 10,
      },
      radar: {
        indicator: [
          { name: "Odd %", max: 100 },
          { name: "Even %", max: 100 },
          { name: "High %", max: 100 },
          { name: "Low %", max: 100 },
          { name: "Avg Sum", max: 100 },
        ],
        shape: "polygon",
        splitNumber: 4,
        axisName: {
          color: "#94a3b8",
          fontSize: 11,
        },
        splitArea: {
          areaStyle: {
            color: [
              "rgba(30,41,59,0.3)",
              "rgba(30,41,59,0.2)",
              "rgba(30,41,59,0.1)",
              "rgba(30,41,59,0.05)",
            ],
          },
        },
        splitLine: {
          lineStyle: { color: "rgba(255,255,255,0.08)" },
        },
        axisLine: {
          lineStyle: { color: "rgba(255,255,255,0.08)" },
        },
      },
      series: [
        {
          type: "radar",
          data: [
            {
              name: "Current Draw",
              value: [oddPct, evenPct, highPct, lowPct, sumNormalized],
              areaStyle: {
                color: "rgba(245,166,35,0.25)",
              },
              lineStyle: { color: "#f5a623", width: 2 },
              itemStyle: { color: "#f5a623" },
              symbol: "circle",
              symbolSize: 6,
            },
            {
              name: "Ideal Balanced",
              value: [50, 50, 50, 50, 50],
              areaStyle: { opacity: 0 },
              lineStyle: {
                color: "#3b82f6",
                width: 2,
                type: "dashed",
              },
              itemStyle: { color: "#3b82f6" },
              symbol: "circle",
              symbolSize: 4,
            },
          ],
        },
      ],
    };

    const stats = {
      oddEven: pattern.oddEvenRatio,
      highLow: pattern.highLowRatio,
      sum: sumStats.current,
      avgSum: sumStats.avg,
      consecutive: pattern.consecutiveCount,
    };

    return { radarOption: option, summaryStats: stats };
  }, [pattern]);

  return (
    <div className="flex flex-col gap-4">
      <ChartWrapper option={radarOption} height="340px" loading={loading} />

      {/* Summary stats below the radar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            Odd/Even
          </p>
          <p className="font-mono text-sm font-semibold text-[var(--foreground)]">
            {summaryStats.oddEven}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            High/Low
          </p>
          <p className="font-mono text-sm font-semibold text-[var(--foreground)]">
            {summaryStats.highLow}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            Sum
          </p>
          <p className="font-mono text-sm font-semibold text-[var(--foreground)]">
            {summaryStats.sum}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            Avg Sum
          </p>
          <p className="font-mono text-sm font-semibold text-[var(--foreground)]">
            {summaryStats.avgSum.toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
}
