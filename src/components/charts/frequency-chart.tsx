"use client";

import { useMemo } from "react";
import type { FrequencyResult } from "@/lib/types";
import { ChartWrapper } from "./chart-wrapper";
import type { EChartsOption } from "echarts";

interface FrequencyChartProps {
  frequencies: FrequencyResult[];
  loading?: boolean;
}

const classificationColors: Record<string, string> = {
  hot: "#ef4444",
  warm: "#f5a623",
  cold: "#3b82f6",
};

export function FrequencyChart({ frequencies, loading }: FrequencyChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const sorted = [...frequencies].sort((a, b) => a.number - b.number);

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter(params: unknown) {
          const p = Array.isArray(params) ? params[0] : params;
          const item = p as { name: string; value: number; dataIndex: number };
          const freq = sorted[item.dataIndex];
          if (!freq) return "";
          return `<div style="font-size:12px">
            <strong>Number ${freq.number}</strong><br/>
            Count: <b>${freq.count}</b><br/>
            Percentage: <b>${freq.percentage.toFixed(1)}%</b><br/>
            Classification: <b style="color:${classificationColors[freq.classification]}">${freq.classification}</b>
          </div>`;
        },
      },
      xAxis: {
        type: "category",
        data: sorted.map((f) => String(f.number)),
        axisLabel: {
          interval: 0,
          rotate: sorted.length > 30 ? 90 : 0,
          fontSize: sorted.length > 50 ? 9 : 11,
        },
      },
      yAxis: {
        type: "value",
        name: "Frequency",
        nameTextStyle: { color: "#94a3b8", fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          data: sorted.map((f) => ({
            value: f.count,
            itemStyle: {
              color: classificationColors[f.classification] ?? "#3b82f6",
              borderRadius: [2, 2, 0, 0],
            },
          })),
          barMaxWidth: 18,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(245,166,35,0.3)",
            },
          },
        },
      ],
      dataZoom:
        sorted.length > 40
          ? [
              {
                type: "slider",
                height: 20,
                bottom: 4,
                borderColor: "rgba(255,255,255,0.08)",
                backgroundColor: "rgba(255,255,255,0.02)",
                dataBackground: {
                  lineStyle: { color: "rgba(255,255,255,0.08)" },
                  areaStyle: { color: "rgba(59,130,246,0.08)" },
                },
                fillerColor: "rgba(59,130,246,0.1)",
                handleStyle: { color: "#3b82f6" },
                textStyle: { color: "#94a3b8", fontSize: 10 },
              },
            ]
          : undefined,
    };
  }, [frequencies]);

  return (
    <ChartWrapper
      option={option}
      height={frequencies.length > 40 ? "360px" : "300px"}
      loading={loading}
    />
  );
}
