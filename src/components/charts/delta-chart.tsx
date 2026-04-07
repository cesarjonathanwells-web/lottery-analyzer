"use client";

import { useMemo } from "react";
import type { DeltaResult } from "@/lib/analysis/types";
import { ChartWrapper } from "./chart-wrapper";
import type { EChartsOption } from "echarts";

interface DeltaChartProps {
  delta: DeltaResult;
  loading?: boolean;
}

export function DeltaChart({ delta, loading }: DeltaChartProps) {
  const { chartOption, topDeltas, mostCommonDelta, medianDelta } = useMemo(() => {
    const dist = [...delta.deltaDistribution].sort((a, b) => a.delta - b.delta);

    // Compute cumulative percentage
    const cumulative: number[] = [];
    let runningTotal = 0;
    for (const entry of dist) {
      runningTotal += entry.percentage;
      cumulative.push(Math.min(runningTotal, 100));
    }

    // Most common delta
    const mostCommon = delta.mostCommonDeltas[0];

    // Median delta (50th percentile from cumulative)
    let median = dist[0]?.delta ?? 0;
    for (let i = 0; i < cumulative.length; i++) {
      if (cumulative[i] >= 50) {
        median = dist[i].delta;
        break;
      }
    }

    // Color gradient from electric-blue to gold
    const barColors = dist.map((_, i) => {
      const ratio = dist.length > 1 ? i / (dist.length - 1) : 0;
      // Interpolate from #3b82f6 (electric-blue) to #f5a623 (gold)
      const r = Math.round(59 + (245 - 59) * ratio);
      const g = Math.round(130 + (166 - 130) * ratio);
      const b = Math.round(246 + (35 - 246) * ratio);
      return `rgb(${r},${g},${b})`;
    });

    const option: EChartsOption = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter(params: unknown) {
          const items = params as Array<{
            seriesName: string;
            value: number;
            dataIndex: number;
            marker: string;
          }>;
          const idx = items[0]?.dataIndex ?? 0;
          const entry = dist[idx];
          if (!entry) return "";
          const cum = cumulative[idx]?.toFixed(1) ?? "0";
          return `<div style="font-size:12px">
            <strong>Delta: ${entry.delta}</strong><br/>
            Frequency: <b>${entry.count}</b><br/>
            Percentage: <b>${entry.percentage.toFixed(1)}%</b><br/>
            Cumulative: <b>${cum}%</b>
          </div>`;
        },
      },
      grid: {
        left: 48,
        right: 48,
        top: 36,
        bottom: 48,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        data: dist.map((d) => String(d.delta)),
        axisLabel: {
          fontSize: 11,
          color: "#94a3b8",
          interval: dist.length > 30 ? "auto" : 0,
          rotate: dist.length > 20 ? 45 : 0,
        },
        name: "Delta Value",
        nameTextStyle: { color: "#94a3b8", fontSize: 11 },
        nameLocation: "center",
        nameGap: 35,
      },
      yAxis: [
        {
          type: "value",
          name: "Frequency",
          nameTextStyle: { color: "#94a3b8", fontSize: 11 },
          axisLabel: { color: "#94a3b8", fontSize: 11 },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
        },
        {
          type: "value",
          name: "Cumulative %",
          nameTextStyle: { color: "#94a3b8", fontSize: 11 },
          min: 0,
          max: 100,
          axisLabel: {
            color: "#94a3b8",
            fontSize: 11,
            formatter: "{value}%",
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Frequency",
          type: "bar",
          data: dist.map((d, i) => ({
            value: d.count,
            itemStyle: {
              color: barColors[i],
              borderRadius: [2, 2, 0, 0],
            },
          })),
          barMaxWidth: 20,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(245,166,35,0.3)",
            },
          },
        },
        {
          name: "Cumulative %",
          type: "line",
          yAxisIndex: 1,
          data: cumulative,
          smooth: true,
          symbol: "none",
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
                { offset: 0, color: "rgba(245,166,35,0.15)" },
                { offset: 1, color: "rgba(245,166,35,0)" },
              ],
            },
          },
        },
      ],
      // Annotate most common and median
      markPoint:
        mostCommon
          ? {
              data: [
                {
                  name: "Most Common",
                  coord: [String(mostCommon.delta), mostCommon.count],
                  symbol: "pin",
                  symbolSize: 36,
                  itemStyle: { color: "#f5a623" },
                  label: {
                    formatter: `${mostCommon.delta}`,
                    color: "#0a0e1a",
                    fontSize: 10,
                    fontWeight: "bold",
                  },
                },
              ],
            }
          : undefined,
    };

    // Top 10 deltas for the table below
    const top10 = delta.mostCommonDeltas.slice(0, 10);

    return {
      chartOption: option,
      topDeltas: top10,
      mostCommonDelta: mostCommon?.delta ?? 0,
      medianDelta: median,
    };
  }, [delta]);

  return (
    <div className="flex flex-col gap-4">
      {/* Annotation badges */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-1 text-xs">
          <span className="h-2 w-2 rounded-full bg-[var(--gold)]" />
          Most Common Delta:{" "}
          <span className="font-mono font-semibold text-[var(--gold)]">
            {mostCommonDelta}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-1 text-xs">
          <span className="h-2 w-2 rounded-full bg-[var(--electric-blue)]" />
          Median Delta:{" "}
          <span className="font-mono font-semibold text-[var(--electric-blue)]">
            {medianDelta}
          </span>
        </span>
      </div>

      <ChartWrapper option={chartOption} height="320px" loading={loading} />

      {/* Top 10 deltas table */}
      {topDeltas.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--secondary)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--muted-foreground)]">
                  Rank
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--muted-foreground)]">
                  Delta
                </th>
                <th className="px-3 py-2 text-right font-medium text-[var(--muted-foreground)]">
                  Count
                </th>
                <th className="px-3 py-2 text-right font-medium text-[var(--muted-foreground)]">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody>
              {topDeltas.map((d, i) => (
                <tr
                  key={d.delta}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-3 py-1.5 font-mono text-[var(--muted-foreground)]">
                    {i + 1}
                  </td>
                  <td className="px-3 py-1.5 font-mono font-semibold text-[var(--foreground)]">
                    {d.delta}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[var(--foreground)]">
                    {d.count}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[var(--gold)]">
                    {d.percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
