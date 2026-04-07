import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { draws as drawsTable } from "@/lib/db/schema";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CoincidenceParams {
  gameId: string;
  referenceNumbers: number[];
  minMatches?: number; // default 2
}

export interface CoincidenceMatch {
  draw: {
    id: string;
    drawDate: string;
    drawTime: string | null;
    numbers: number[];
  };
  matchedNumbers: number[];
  matchCount: number;
}

export interface CoincidenceResult {
  matches: CoincidenceMatch[];
  totalDrawsSearched: number;
  distribution: Record<number, number>; // matchCount -> how many draws had that many matches
}

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Find historical draws that share the most numbers with a reference set.
 * For each draw of the same game, count overlapping numbers with referenceNumbers.
 * Returns sorted by matchCount descending, then by drawDate descending.
 */
export async function findCoincidences(
  params: CoincidenceParams,
): Promise<CoincidenceResult> {
  const { gameId, referenceNumbers, minMatches = 2 } = params;

  const refSet = new Set(referenceNumbers);

  // Fetch all draws for this game, sorted by date descending
  const rows = await db
    .select()
    .from(drawsTable)
    .where(eq(drawsTable.gameId, gameId))
    .orderBy(desc(drawsTable.drawDate));

  const totalDrawsSearched = rows.length;
  const distribution: Record<number, number> = {};
  const matches: CoincidenceMatch[] = [];

  for (const row of rows) {
    const drawNumbers = row.numbers;
    const matched = drawNumbers.filter((n) => refSet.has(n));
    const matchCount = matched.length;

    // Track distribution for all match counts > 0
    if (matchCount > 0) {
      distribution[matchCount] = (distribution[matchCount] || 0) + 1;
    }

    if (matchCount >= minMatches) {
      matches.push({
        draw: {
          id: String(row.id),
          drawDate: row.drawDate,
          drawTime: row.drawTime,
          numbers: drawNumbers,
        },
        matchedNumbers: matched,
        matchCount,
      });
    }
  }

  // Sort by matchCount desc, then drawDate desc
  matches.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return b.draw.drawDate.localeCompare(a.draw.drawDate);
  });

  return { matches, totalDrawsSearched, distribution };
}
