import type { Draw } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SuccessionResult {
  sequences: {
    number: number;
    nextOccurrences: { number: number; count: number }[];
  }[];
  drawsAnalyzed: number;
}

// ── Implementation ─────────────────────────────────────────────────────────

/**
 * Succession/Sequence analysis: for a given target number, find every draw
 * where it appeared, then check which numbers appeared in the NEXT draw.
 * Count those to find "numbers that follow" patterns.
 *
 * @param draws        - Pre-fetched draws (any sort order, will be sorted internally)
 * @param targetNumber - The number to track
 */
export function computeSuccession(
  draws: Draw[],
  targetNumber: number,
): SuccessionResult {
  if (draws.length < 2) {
    return {
      sequences: [{ number: targetNumber, nextOccurrences: [] }],
      drawsAnalyzed: draws.length,
    };
  }

  // Sort draws by date ascending (oldest first) so "next draw" = index + 1
  const sorted = [...draws].sort(
    (a, b) => new Date(a.drawDate).getTime() - new Date(b.drawDate).getTime(),
  );

  // Find all draws where targetNumber appeared, then look at next draw
  const followCounts = new Map<number, number>();

  for (let i = 0; i < sorted.length - 1; i++) {
    const draw = sorted[i];
    const hasTarget = draw.numbers.includes(targetNumber);

    if (hasTarget) {
      const nextDraw = sorted[i + 1];
      for (const num of nextDraw.numbers) {
        followCounts.set(num, (followCounts.get(num) ?? 0) + 1);
      }
    }
  }

  // Sort by count descending
  const nextOccurrences = [...followCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([number, count]) => ({ number, count }));

  return {
    sequences: [
      {
        number: targetNumber,
        nextOccurrences,
      },
    ],
    drawsAnalyzed: sorted.length,
  };
}
