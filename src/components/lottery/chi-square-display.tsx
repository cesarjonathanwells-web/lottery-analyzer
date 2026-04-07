"use client";

import { useMemo } from "react";
import type { ChiSquareResult } from "@/lib/analysis/types";
import { ChartWrapper } from "@/components/charts/chart-wrapper";
import type { EChartsOption } from "echarts";

interface ChiSquareDisplayProps {
  result: ChiSquareResult;
  loading?: boolean;
}

export function ChiSquareDisplay({ result, loading }: ChiSquareDisplayProps) {
  const gaugeOption = useMemo<EChartsOption>(() => {
    const isRandom = result.isRandom;
    const color = isRandom ? "#10b981" : "#ef4444";
    const bgColor = isRandom
      ? "rgba(16,185,129,0.15)"
      : "rgba(239,68,68,0.15)";

    // Normalize chi-square for display on a 0-100 gauge
    // Use degrees of freedom * 2 as a reasonable max
    const maxVal = Math.max(result.degreesOfFreedom * 3, result.chiSquareStatistic * 1.5);
    const gaugeVal = Math.min((result.chiSquareStatistic / maxVal) * 100, 100);

    return {
      series: [
        {
          type: "gauge",
          center: ["50%", "60%"],
          radius: "90%",
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          splitNumber: 10,
          axisLine: {
            lineStyle: {
              width: 20,
              color: [
                [0.4, "#10b981"],
                [0.7, "#f5a623"],
                [1, "#ef4444"],
              ],
            },
          },
          pointer: {
            icon: "path://M12.8,0.7l12,40.1H0.7L12.8,0.7z",
            length: "55%",
            width: 8,
            offsetCenter: [0, "-10%"],
            itemStyle: {
              color: color,
            },
          },
          axisTick: {
            length: 6,
            lineStyle: {
              color: "rgba(255,255,255,0.15)",
              width: 1,
            },
          },
          splitLine: {
            length: 12,
            lineStyle: {
              color: "rgba(255,255,255,0.15)",
              width: 2,
            },
          },
          axisLabel: { show: false },
          title: {
            offsetCenter: [0, "25%"],
            fontSize: 12,
            color: "#94a3b8",
          },
          detail: {
            fontSize: 28,
            fontWeight: "bold",
            fontFamily: "var(--font-geist-mono, monospace)",
            offsetCenter: [0, "0%"],
            valueAnimation: true,
            formatter: () => result.chiSquareStatistic.toFixed(2),
            color,
          },
          data: [
            {
              value: gaugeVal,
              name: isRandom ? "Random" : "Potential Bias",
            },
          ],
        },
      ],
    };
  }, [result]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-48 w-48 animate-pulse rounded-full bg-[var(--secondary)]" />
      </div>
    );
  }

  const isRandom = result.isRandom;
  const statusColor = isRandom ? "text-[var(--neon-green)]" : "text-[var(--hot)]";
  const statusBg = isRandom
    ? "bg-[var(--neon-green)]/10 border-[var(--neon-green)]/20"
    : "bg-[var(--hot)]/10 border-[var(--hot)]/20";

  return (
    <div className="flex flex-col gap-5">
      {/* Gauge */}
      <ChartWrapper option={gaugeOption} height="260px" />

      {/* Status badge */}
      <div className="flex justify-center">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${statusBg} ${statusColor}`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isRandom ? "bg-[var(--neon-green)]" : "bg-[var(--hot)]"
            }`}
          />
          {isRandom ? "Distribution Appears Random" : "Potential Bias Detected"}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            Chi-Square
          </p>
          <p className="font-mono text-lg font-bold text-[var(--foreground)]">
            {result.chiSquareStatistic.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            Degrees of Freedom
          </p>
          <p className="font-mono text-lg font-bold text-[var(--foreground)]">
            {result.degreesOfFreedom}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            P-Value
          </p>
          <p className={`font-mono text-lg font-bold ${statusColor}`}>
            {result.pValue < 0.001
              ? "< 0.001"
              : result.pValue.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Interpretation */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Interpretation
        </p>
        <p className="text-sm leading-relaxed text-[var(--foreground)]">
          {result.interpretation}
        </p>
      </div>

      {/* What this means */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
          What This Means
        </p>
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          The chi-square test compares observed number frequencies against what
          would be expected if every number had an equal chance of being drawn.
          A p-value greater than 0.05 means there is no statistically
          significant deviation from randomness at the 95% confidence level.
          {!isRandom &&
            " However, a low p-value does not guarantee the game is biased -- it may reflect natural short-term variation in a small sample of draws."}
        </p>
      </div>
    </div>
  );
}
