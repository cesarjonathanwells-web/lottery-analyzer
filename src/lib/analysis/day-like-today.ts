import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { draws as drawsTable, games as gamesTable } from "@/lib/db/schema";
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
 */
export async function findDayLikeToday(
  month: number,
  day: number,
  gameId?: string,
): Promise<DayLikeTodayResult> {
  // Build game name lookup from static registry
  const gameNameMap = new Map(GAMES.map((g) => [g.id, g.name]));

  // Use SQL extraction to match month and day from the draw_date column
  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");

  // Build conditions: match month and day from the date column
  const conditions = [
    sql`EXTRACT(MONTH FROM ${drawsTable.drawDate}::date) = ${month}`,
    sql`EXTRACT(DAY FROM ${drawsTable.drawDate}::date) = ${day}`,
  ];

  if (gameId) {
    conditions.push(sql`${drawsTable.gameId} = ${gameId}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const rows = await db
    .select()
    .from(drawsTable)
    .where(whereClause)
    .orderBy(desc(drawsTable.drawDate));

  // Map rows to result format
  const draws: DayLikeTodayDraw[] = rows.map((row) => {
    const dateObj = new Date(row.drawDate + "T00:00:00");
    return {
      year: dateObj.getFullYear(),
      gameId: row.gameId,
      gameName: gameNameMap.get(row.gameId) ?? row.gameId,
      drawDate: row.drawDate,
      numbers: row.numbers,
      drawTime: row.drawTime,
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
