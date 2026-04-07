"use client";

import { useMemo } from "react";
import type { GapResult } from "@/lib/analysis/types";
import { ChartWrapper } from "./chart-wrapper";
import type { EChartsOption } from "echarts";

interface GapChartProps {
  gaps: GapResult[];
  loading?: boolean;
}

export function GapChart({ gaps, loading }: GapChartProps) {
  const option = useMemo<EChartsOption>(() => {
    // Sort by current gap descending (most overdue at top)
    const sorted = [...gaps].sort((a, b) => b.currentGap - a.currentGap);

    const numbers = sorted.map((g) => `#${g.number}`);
    const currentGaps = sorted.map((g) => g.currentGap);
    const avgGaps = sorted.map((g) => g.averageGap);

    // Color bars based on overdue status
    const barColors = sorted.map((g) => {
      const ratio = g.averageGap > 0 ? g.currentGap / g.averageGap : 0;
      if (ratio > 1.5) return "#ef4444"; // red - overdue
      if (ratio > 0.8) return "#f5a623"; // yellow/gold - near average
      return "#10b981"; // green - below average
    });

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter(params: unknown) {
          const p = Array.isArray(params) ? params[0] : params;
          const item = p as { dataIndex: number };
          const gap = sorted[item.dataIndex];
          if (!gap) return "";
          const lastSeen = gap.lastSeenDate
            ? new Date(gap.lastSeenDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Never";
          return `<div style="font-size:12px">
            <strong>Number ${gap.number}</strong><br/>
            Current Gap: <b>${gap.currentGap}</b> draws<br/>
            Average Gap: <b>${gap.averageGap.toFixed(1)}</b> draws<br/>
            Max Gap: <b>${gap.maxGap}</b> draws<br/>
            Last Seen: <b>${lastSeen}</b>
          </div>`;
        },
      },
      grid: {
        left: 56,
        right: 24,
        top: 16,
        bottom: 16,
        containLabel: false,
      },
      xAxis: {
        type: "value",
        name: "Gap (draws)",
        nameTextStyle: { color: "#94a3b8", fontSize: 11 },
      },
      yAxis: {
        type: "category",
        data: numbers,
        axisLabel: {
          fontSize: 11,
          color: "#94a3b8",
        },
        inverse: false,
      },
      series: [
        {
          type: "bar",
          data: currentGaps.map((val, i) => ({
            value: val,
            itemStyle: {
              color: barColors[i],
              borderRadius: [0, 3, 3, 0],
            },
          })),
          barMaxWidth: 16,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(245,166,35,0.3)",
            },
          },
        },
        {
          // Average gap reference markers
          type: "scatter",
          data: avgGaps.map((val) => val),
          symbol: "diamond",
          symbolSize: 8,
          itemStyle: {
            color: "#3b82f6",
            borderColor: "#3b82f6",
          },
          tooltip: { show: false },
          z: 10,
        },
      ],
      dataZoom:
        sorted.length > 25
          ? [
              {
                type: "slider",
                yAxisIndex: 0,
                width: 16,
                right: 4,
                borderColor: "rgba(255,255,255,0.08)",
                backgroundColor: "rgba(255,255,255,0.02)",
                fillerColor: "rgba(59,130,246,0.1)",
                handleStyle: { color: "#3b82f6" },
                textStyle: { color: "#94a3b8", fontSize: 10 },
                startValue: 0,
                endValue: 24,
              },
            ]
          : undefined,
    };
  }, [gaps]);

  const height = gaps.length > 25 ? "480px" : `${Math.max(300, gaps.length * 22)}px`;

  return <ChartWrapper option={option} height={height} loading={loading} />;
}
