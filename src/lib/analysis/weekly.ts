import type { Draw } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WeeklyGridResult {
  grid: {
    dayOfWeek: string; // "Lunes", "Martes", etc.
    numbers: { number: number; count: number }[];
    totalDraws: number;
  }[];
  drawsAnalyzed: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

// ── Implementation ─────────────────────────────────────────────────────────

/**
 * Weekly grid analysis: show which numbers appear most on each day of the week.
 *
 * @param draws    - Pre-fetched draws
 * @param position - Optional position filter (1-based). 0 or undefined = all positions.
 */
export function computeWeeklyGrid(
  draws: Draw[],
  position?: number,
): WeeklyGridResult {
  if (draws.length === 0) {
    return {
      grid: DAY_NAMES.map((dayOfWeek) => ({
        dayOfWeek,
        numbers: [],
        totalDraws: 0,
      })),
      drawsAnalyzed: 0,
    };
  }

  // Group draws by day of week
  // dayIndex: 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayData: {
    counts: Map<number, number>;
    totalDraws: number;
  }[] = Array.from({ length: 7 }, () => ({
    counts: new Map(),
    totalDraws: 0,
  }));

  for (const draw of draws) {
    const date = new Date(draw.drawDate + "T12:00:00"); // noon to avoid timezone issues
    const dayIndex = date.getDay();

    dayData[dayIndex].totalDraws++;

    const nums =
      position && position > 0 && position <= draw.numbers.length
        ? [draw.numbers[position - 1]]
        : draw.numbers;

    for (const num of nums) {
      const current = dayData[dayIndex].counts.get(num) ?? 0;
      dayData[dayIndex].counts.set(num, current + 1);
    }
  }

  // Build grid: for each day, sort numbers by frequency
  const grid = DAY_NAMES.map((dayOfWeek, dayIndex) => {
    const { counts, totalDraws } = dayData[dayIndex];
    const numbers = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([number, count]) => ({ number, count }));

    return {
      dayOfWeek,
      numbers,
      totalDraws,
    };
  });

  return {
    grid,
    drawsAnalyzed: draws.length,
  };
}
