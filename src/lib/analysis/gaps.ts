import type { Draw } from "@/lib/types";
import type { GapResult } from "./types";

/**
 * Compute gap/skip analysis for every number in the range.
 *
 * For each number, calculates:
 * - currentGap: how many draws since it last appeared
 * - averageGap: mean gap between consecutive appearances
 * - maxGap: longest streak of consecutive draws without the number
 * - lastSeenDate: date string of the most recent draw containing the number
 *
 * @param draws       - Array of Draw objects
 * @param numberRange - Maximum possible number
 * @param minNumber   - Minimum number (default 1; use 0 for Pick games)
 * @returns GapResult[] sorted by number ascending
 */
export function computeGaps(
  draws: Draw[],
  numberRange: number,
  minNumber: number = 1,
): GapResult[] {
  if (draws.length === 0) return [];

  // Sort by date descending (most recent first)
  const sorted = [...draws].sort(
    (a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime(),
  );

  // Track appearance indices for each number (index 0 = most recent draw)
  const appearances = new Map<number, number[]>();
  const lastSeenDates = new Map<number, string>();

  for (let num = minNumber; num <= numberRange; num++) {
    appearances.set(num, []);
  }

  for (let i = 0; i < sorted.length; i++) {
    const draw = sorted[i];
    for (const num of draw.numbers) {
      if (num < minNumber || num > numberRange) continue;
      appearances.get(num)?.push(i);
      if (!lastSeenDates.has(num)) {
        lastSeenDates.set(num, draw.drawDate);
      }
    }
  }

  const totalDraws = sorted.length;
  const results: GapResult[] = [];

  for (let num = minNumber; num <= numberRange; num++) {
    const indices = appearances.get(num) ?? [];

    if (indices.length === 0) {
      // Number never appeared
      results.push({
        number: num,
        currentGap: totalDraws,
        averageGap: totalDraws,
        maxGap: totalDraws,
        lastSeenDate: null,
      });
      continue;
    }

    // currentGap = draws since last seen = index of most recent appearance
    const currentGap = indices[0];

    // Compute gaps between consecutive appearances
    // Also consider the gap from the oldest draw boundary to first appearance
    // and from last appearance to the newest draw boundary
    const gaps: number[] = [];

    // Gap from most recent draw to first appearance
    if (indices[0] > 0) {
      gaps.push(indices[0]);
    }

    // Gaps between consecutive appearances
    for (let i = 1; i < indices.length; i++) {
      const gap = indices[i] - indices[i - 1];
      if (gap > 0) {
        gaps.push(gap);
      }
    }

    // Gap from last appearance to the oldest draw
    const lastIdx = indices[indices.length - 1];
    if (lastIdx < totalDraws - 1) {
      gaps.push(totalDraws - 1 - lastIdx);
    }

    const averageGap =
      gaps.length > 0
        ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length
        : 0;

    const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;

    results.push({
      number: num,
      currentGap,
      averageGap: Math.round(averageGap * 100) / 100,
      maxGap,
      lastSeenDate: lastSeenDates.get(num) ?? null,
    });
  }

  return results;
}
