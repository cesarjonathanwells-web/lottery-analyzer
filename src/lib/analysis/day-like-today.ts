import type { Draw } from "@/lib/types";
import { GAMES } from "@/lib/games";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DayLikeTodayDraw {
  year: number;
  gameId: string;
  gameName: string;
  drawDate: string;
  numbers: number[];
  drawTime: string | null;
}

export interface DayLikeTodayResult {
  date: { month: number; day: number };
  draws: DayLikeTodayDraw[];
  numberFrequency: { number: number; count: number }[];
  totalDraws: number;
}

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Find all draws that happened on a given month+day across all years.
 * Optionally filter by a specific game. Computes number frequency for that date.
 *
 * @param allDraws - All draws to search through (pre-fetched from EBG)
 * @param month    - Target month (1-12)
 * @param day      - Target day (1-31)
 * @param gameId   - Optional game filter
 */
export function findDayLikeToday(
  allDraws: Draw[],
  month: number,
  day: number,
  gameId?: string,
): DayLikeTodayResult {
  // Build game name lookup from static registry
  const gameNameMap = new Map(GAMES.map((g) => [g.id, g.name]));

  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");

  // Filter draws by month and day (and optionally game)
  const filtered = allDraws.filter((draw) => {
    // Parse date: expected format "YYYY-MM-DD"
    const parts = draw.drawDate.split("-");
    if (parts.length < 3) return false;
    const drawMonth = parts[1];
    const drawDay = parts[2];

    if (drawMonth !== monthStr || drawDay !== dayStr) return false;
    if (gameId && draw.gameId !== gameId) return false;

    return true;
  });

  // Sort by date descending
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime(),
  );

  // Map to result format
  const draws: DayLikeTodayDraw[] = sorted.map((draw) => {
    const dateObj = new Date(draw.drawDate + "T00:00:00");
    return {
      year: dateObj.getFullYear(),
      gameId: draw.gameId,
      gameName: gameNameMap.get(draw.gameId) ?? draw.gameId,
      drawDate: draw.drawDate,
      numbers: draw.numbers,
      drawTime: draw.drawTime,
    };
  });

  // Compute number frequency across all draws on this date
  const freqMap = new Map<number, number>();
  for (const draw of draws) {
    for (const num of draw.numbers) {
      freqMap.set(num, (freqMap.get(num) || 0) + 1);
    }
  }

  const numberFrequency = Array.from(freqMap.entries())
    .map(([number, count]) => ({ number, count }))
    .sort((a, b) => b.count - a.count);

  return {
    date: { month, day },
    draws,
    numberFrequency,
    totalDraws: draws.length,
  };
}
