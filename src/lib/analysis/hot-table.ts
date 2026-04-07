import type { Draw } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface HotTableParams {
  draws: Draw[];
  days: number; // Window size: 7, 15, 30, 60, 90, 180, 365
  limit: number; // Top N numbers to show
  position?: number; // 0=all, 1=first, 2=second, 3=third
}

export interface HotTableResult {
  hotNumbers: {
    number: number;
    count: number;
    percentage: number;
    lastSeen: string;
  }[];
  coldNumbers: {
    number: number;
    count: number;
    lastSeen: string;
  }[];
  drawsAnalyzed: number;
  dateRange: { from: string; to: string };
}

// ── Implementation ─────────────────────────────────────────────────────────

export function computeHotTable(
  params: HotTableParams,
): HotTableResult {
  const { draws, days, limit, position = 0 } = params;

  // Calculate date boundary
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - days);
  const fromDateStr = fromDate.toISOString().split("T")[0];

  // Filter draws within the window
  const drawList = draws.filter((d) => d.drawDate >= fromDateStr);

  // Sort by date descending
  drawList.sort(
    (a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime(),
  );

  if (drawList.length === 0) {
    return {
      hotNumbers: [],
      coldNumbers: [],
      drawsAnalyzed: 0,
      dateRange: { from: fromDateStr, to: now.toISOString().split("T")[0] },
    };
  }

  // Count occurrences per number
  const counts = new Map<number, number>();
  const lastSeen = new Map<number, string>();

  for (const draw of drawList) {
    const nums =
      position > 0 && position <= draw.numbers.length
        ? [draw.numbers[position - 1]]
        : draw.numbers;

    for (const num of nums) {
      counts.set(num, (counts.get(num) ?? 0) + 1);
      if (!lastSeen.has(num)) {
        lastSeen.set(num, draw.drawDate);
      }
    }
  }

  // Sort by count descending
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const drawsAnalyzed = drawList.length;

  // Hot = top N
  const hotNumbers = sorted.slice(0, limit).map(([number, count]) => ({
    number,
    count,
    percentage: drawsAnalyzed > 0 ? (count / drawsAnalyzed) * 100 : 0,
    lastSeen: lastSeen.get(number) ?? "",
  }));

  // Cold = bottom N (numbers that appeared least, or not at all)
  const coldSorted = [...sorted].reverse();
  const coldNumbers = coldSorted.slice(0, limit).map(([number, count]) => ({
    number,
    count,
    lastSeen: lastSeen.get(number) ?? "",
  }));

  const dates = drawList.map((d) => d.drawDate);

  return {
    hotNumbers,
    coldNumbers,
    drawsAnalyzed,
    dateRange: {
      from: dates[dates.length - 1],
      to: dates[0],
    },
  };
}
