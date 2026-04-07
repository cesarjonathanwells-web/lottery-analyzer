"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-load echarts-for-react to keep bundle size down
const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ height: 300 }}>
      <Skeleton className="h-full w-full bg-[var(--secondary)]" />
    </div>
  ),
});

interface ChartWrapperProps {
  option: EChartsOption;
  height?: string;
  loading?: boolean;
}

// Dark theme palette shared by all charts
const darkThemeDefaults: Partial<EChartsOption> = {
  backgroundColor: "transparent",
  textStyle: {
    color: "#94a3b8",
    fontFamily:
      "var(--font-geist-sans, ui-sans-serif, system-ui, -apple-system, sans-serif)",
  },
  legend: {
    textStyle: { color: "#94a3b8" },
  },
  tooltip: {
    backgroundColor: "#1e293b",
    borderColor: "rgba(255,255,255,0.08)",
    textStyle: { color: "#e2e8f0", fontSize: 12 },
  },
  grid: {
    left: 48,
    right: 16,
    top: 24,
    bottom: 48,
    containLabel: false,
  },
  xAxis: {
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    axisTick: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    axisLabel: { color: "#94a3b8", fontSize: 11 },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    axisTick: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    axisLabel: { color: "#94a3b8", fontSize: 11 },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
  },
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function ChartWrapper({ option, height = "300px", loading }: ChartWrapperProps) {
  if (loading) {
    return (
      <Skeleton
        className="w-full bg-[var(--secondary)]"
        style={{ height }}
      />
    );
  }

  const merged = deepMerge(
    darkThemeDefaults as Record<string, unknown>,
    option as Record<string, unknown>,
  ) as EChartsOption;

  return (
    <ReactECharts
      option={merged}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  );
}
