"use client";

import { useMemo } from "react";
import type { PairResult } from "@/lib/types";
import { ChartWrapper } from "./chart-wrapper";
import type { EChartsOption } from "echarts";

interface PairHeatmapProps {
  pairs: PairResult[];
  loading?: boolean;
}

export function PairHeatmap({ pairs, loading }: PairHeatmapProps) {
  const option = useMemo<EChartsOption>(() => {
    if (!pairs.length) return {};

    // Collect unique numbers and limit to first 30 if range is large
    const allNumbers = new Set<number>();
    for (const p of pairs) {
      allNumbers.add(p.pair[0]);
      allNumbers.add(p.pair[1]);
    }
    let numbers = [...allNumbers].sort((a, b) => a - b);
    if (numbers.length > 30) {
      numbers = numbers.slice(0, 30);
    }

    const numberSet = new Set(numbers);
    const numLabels = numbers.map(String);
    const numIndex = new Map(numbers.map((n, i) => [n, i]));

    // Build heatmap data: [x, y, value]
    const data: [number, number, number][] = [];
    let maxCount = 0;

    for (const p of pairs) {
      if (!numberSet.has(p.pair[0]) || !numberSet.has(p.pair[1])) continue;
      const x = numIndex.get(p.pair[0])!;
      const y = numIndex.get(p.pair[1])!;
      data.push([x, y, p.count]);
      // Mirror for symmetry
      if (x !== y) {
        data.push([y, x, p.count]);
      }
      if (p.count > maxCount) maxCount = p.count;
    }

    return {
      tooltip: {
        formatter(params: unknown) {
          const p = params as { data: [number, number, number] };
          const [xi, yi, count] = p.data;
          return `<div style="font-size:12px">
            Numbers <b>${numbers[xi]}</b> & <b>${numbers[yi]}</b><br/>
            Appeared together <b>${count}</b> times
          </div>`;
        },
      },
      grid: {
        left: 48,
        right: 56,
        top: 16,
        bottom: 48,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        data: numLabels,
        splitArea: { show: false },
        axisLabel: {
          fontSize: numbers.length > 20 ? 9 : 11,
          rotate: numbers.length > 20 ? 90 : 0,
          color: "#94a3b8",
        },
      },
      yAxis: {
        type: "category",
        data: numLabels,
        splitArea: { show: false },
        axisLabel: {
          fontSize: numbers.length > 20 ? 9 : 11,
          color: "#94a3b8",
        },
      },
      visualMap: {
        min: 0,
        max: maxCount || 1,
        calculable: true,
        orient: "vertical",
        right: 0,
        top: "center",
        inRange: {
          color: ["#1e293b", "#92631a", "#f5a623"],
        },
        textStyle: { color: "#94a3b8", fontSize: 10 },
        itemHeight: 120,
      },
      series: [
        {
          type: "heatmap",
          data,
          emphasis: {
            itemStyle: {
              borderColor: "#f5a623",
              borderWidth: 1,
              shadowBlur: 10,
              shadowColor: "rgba(245,166,35,0.4)",
            },
          },
          itemStyle: {
            borderColor: "rgba(10,14,26,0.6)",
            borderWidth: 1,
          },
        },
      ],
    };
  }, [pairs]);

  return <ChartWrapper option={option} height="420px" loading={loading} />;
}
