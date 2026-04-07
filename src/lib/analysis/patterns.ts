import { standardDeviation, mean } from "simple-statistics";
import type { Draw } from "@/lib/types";
import type { ExtendedPatternResult } from "./types";

/**
 * Analyse structural patterns across a set of draws.
 *
 * - Odd/even distribution
 * - High/low distribution (split at midpoint of range)
 * - Sum statistics (min, max, avg, stdDev, current draw sum)
 * - Consecutive number frequency
 * - Decade distribution (1-10, 11-20, etc.)
 *
 * @param draws       - Array of Draw objects (should be pre-filtered)
 * @param numberRange - Maximum possible number
 * @param minNumber   - Minimum number (default 1; use 0 for Pick games)
 * @returns ExtendedPatternResult
 */
export function computePatterns(
  draws: Draw[],
  numberRange: number,
  minNumber: number = 1,
): ExtendedPatternResult {
  if (draws.length === 0) {
    return emptyPatternResult();
  }

  // Sort by date descending
  const sorted = [...draws].sort(
    (a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime(),
  );

  const midpoint = Math.ceil((numberRange + minNumber) / 2);

  // ── Odd/Even and High/Low ─────────────────────────────────────────────────
  let totalOdd = 0;
  let totalEven = 0;
  let totalHigh = 0;
  let totalLow = 0;

  for (const draw of sorted) {
    for (const num of draw.numbers) {
      if (num % 2 === 0) totalEven++;
      else totalOdd++;

      if (num >= midpoint) totalHigh++;
      else totalLow++;
    }
  }

  const oddEvenRatio = `${totalOdd}:${totalEven}`;
  const highLowRatio = `${totalHigh}:${totalLow}`;

  // ── Sum Statistics ────────────────────────────────────────────────────────
  const sums = sorted.map((d) =>
    d.numbers.reduce((acc, n) => acc + n, 0),
  );

  const currentSum = sums[0] ?? 0;
  const sumMin = Math.min(...sums);
  const sumMax = Math.max(...sums);
  const sumAvg = mean(sums);
  const sumStdDev = sums.length > 1 ? standardDeviation(sums) : 0;

  // ── Consecutive Numbers ───────────────────────────────────────────────────
  let drawsWithConsecutive = 0;
  let totalConsecutiveCount = 0;

  for (const draw of sorted) {
    const nums = [...draw.numbers].sort((a, b) => a - b);
    let hasConsecutive = false;
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] === 1) {
        totalConsecutiveCount++;
        hasConsecutive = true;
      }
    }
    if (hasConsecutive) drawsWithConsecutive++;
  }

  // ── Decade Distribution ───────────────────────────────────────────────────
  const decadeDistribution: Record<string, number> = {};

  // Build decade buckets based on the number range
  const decadeSize = 10;
  for (
    let start = Math.floor(minNumber / decadeSize) * decadeSize;
    start <= numberRange;
    start += decadeSize
  ) {
    const bucketStart = Math.max(start, minNumber);
    const bucketEnd = Math.min(start + decadeSize - 1, numberRange);
    // Only create the bucket if it has at least one valid number
    if (bucketStart <= bucketEnd) {
      decadeDistribution[`${bucketStart}-${bucketEnd}`] = 0;
    }
  }

  // Normalise buckets for Pick games (0-9): just one bucket "0-9"
  if (minNumber === 0 && numberRange <= 9) {
    const key = `${minNumber}-${numberRange}`;
    // Clear and use a single bucket
    for (const k of Object.keys(decadeDistribution)) delete decadeDistribution[k];
    decadeDistribution[key] = 0;
  }

  for (const draw of sorted) {
    for (const num of draw.numbers) {
      // Find which bucket this number falls into
      for (const key of Object.keys(decadeDistribution)) {
        const [lo, hi] = key.split("-").map(Number);
        if (num >= lo && num <= hi) {
          decadeDistribution[key]++;
          break;
        }
      }
    }
  }

  return {
    oddEvenRatio,
    highLowRatio,
    sumRange: {
      min: sumMin,
      max: sumMax,
      avg: Math.round(sumAvg * 100) / 100,
      current: currentSum,
    },
    consecutiveCount: totalConsecutiveCount,
    decadeDistribution,
    sumStats: {
      min: sumMin,
      max: sumMax,
      avg: Math.round(sumAvg * 100) / 100,
      stdDev: Math.round(sumStdDev * 100) / 100,
      current: currentSum,
    },
    consecutiveDetails: {
      drawsWithConsecutive,
      totalDraws: sorted.length,
      percentage:
        Math.round((drawsWithConsecutive / sorted.length) * 10000) / 100,
    },
  };
}

function emptyPatternResult(): ExtendedPatternResult {
  return {
    oddEvenRatio: "0:0",
    highLowRatio: "0:0",
    sumRange: { min: 0, max: 0, avg: 0, current: 0 },
    consecutiveCount: 0,
    decadeDistribution: {},
    sumStats: { min: 0, max: 0, avg: 0, stdDev: 0, current: 0 },
    consecutiveDetails: {
      drawsWithConsecutive: 0,
      totalDraws: 0,
      percentage: 0,
    },
  };
}
