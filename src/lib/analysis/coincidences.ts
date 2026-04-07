import type { Draw } from "@/lib/types";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CoincidenceParams {
  draws: Draw[];
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
 * For each draw, count overlapping numbers with referenceNumbers.
 * Returns sorted by matchCount descending, then by drawDate descending.
 */
export function findCoincidences(
  params: CoincidenceParams,
): CoincidenceResult {
  const { draws, referenceNumbers, minMatches = 2 } = params;

  const refSet = new Set(referenceNumbers);

  const totalDrawsSearched = draws.length;
  const distribution: Record<number, number> = {};
  const matches: CoincidenceMatch[] = [];

  for (const draw of draws) {
    const drawNumbers = draw.numbers;
    const matched = drawNumbers.filter((n) => refSet.has(n));
    const matchCount = matched.length;

    // Track distribution for all match counts > 0
    if (matchCount > 0) {
      distribution[matchCount] = (distribution[matchCount] || 0) + 1;
    }

    if (matchCount >= minMatches) {
      matches.push({
        draw: {
          id: draw.id,
          drawDate: draw.drawDate,
          drawTime: draw.drawTime,
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
