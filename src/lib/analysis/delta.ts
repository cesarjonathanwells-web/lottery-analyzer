import type { Draw } from "@/lib/types";
import type { DeltaResult, DeltaDistributionEntry } from "./types";

/**
 * Compute delta (difference) analysis across draws.
 *
 * For each draw, the winning numbers are sorted ascending and the
 * differences between consecutive numbers are computed.
 *
 * @param draws - Array of Draw objects
 * @returns DeltaResult with distribution, per-position averages, and top deltas
 */
export function computeDeltas(draws: Draw[]): DeltaResult {
  if (draws.length === 0) {
    return {
      deltaDistribution: [],
      averageDeltas: [],
      mostCommonDeltas: [],
    };
  }

  // Sort draws by date descending
  const sorted = [...draws].sort(
    (a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime(),
  );

  // Collect all deltas, grouped by position
  const deltasByPosition: number[][] = [];
  const allDeltas: number[] = [];

  for (const draw of sorted) {
    const nums = [...draw.numbers].sort((a, b) => a - b);

    for (let i = 1; i < nums.length; i++) {
      const delta = nums[i] - nums[i - 1];
      allDeltas.push(delta);

      // Position index is i - 1 (0-based gap positions)
      const posIdx = i - 1;
      if (!deltasByPosition[posIdx]) {
        deltasByPosition[posIdx] = [];
      }
      deltasByPosition[posIdx].push(delta);
    }
  }

  // ── Delta Distribution ────────────────────────────────────────────────────
  const deltaCounts = new Map<number, number>();
  for (const d of allDeltas) {
    deltaCounts.set(d, (deltaCounts.get(d) ?? 0) + 1);
  }

  const totalDeltas = allDeltas.length;

  const deltaDistribution: DeltaDistributionEntry[] = [];
  for (const [delta, count] of deltaCounts) {
    deltaDistribution.push({
      delta,
      count,
      percentage:
        totalDeltas > 0 ? Math.round((count / totalDeltas) * 10000) / 100 : 0,
    });
  }

  // Sort by delta value ascending
  deltaDistribution.sort((a, b) => a.delta - b.delta);

  // ── Average Deltas Per Position ───────────────────────────────────────────
  const averageDeltas = deltasByPosition.map((posDeltas) => {
    const sum = posDeltas.reduce((acc, d) => acc + d, 0);
    return Math.round((sum / posDeltas.length) * 100) / 100;
  });

  // ── Most Common Deltas (top 10) ──────────────────────────────────────────
  const sortedByFreq = [...deltaDistribution].sort(
    (a, b) => b.count - a.count,
  );
  const mostCommonDeltas = sortedByFreq.slice(0, 10);

  return {
    deltaDistribution,
    averageDeltas,
    mostCommonDeltas,
  };
}
