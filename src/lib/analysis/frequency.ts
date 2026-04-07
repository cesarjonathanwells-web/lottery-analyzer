import { standardDeviation } from "simple-statistics";
import type { Draw, FrequencyResult, NumberClassification } from "@/lib/types";

/**
 * Compute frequency of each number across a set of draws.
 *
 * @param draws    - Array of Draw objects (should already be sorted/filtered as desired)
 * @param numberRange - Maximum possible number (e.g. 69 for Powerball main balls, 9 for Pick-3)
 * @param minNumber - Minimum number in the range (default 1; use 0 for Pick games)
 * @returns FrequencyResult[] sorted by number ascending
 */
export function computeFrequency(
  draws: Draw[],
  numberRange: number,
  minNumber: number = 1,
): FrequencyResult[] {
  const drawCount = draws.length;
  if (drawCount === 0) return [];

  // Sort draws by date descending so index 0 = most recent
  const sorted = [...draws].sort(
    (a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime(),
  );

  // Count occurrences and track gaps
  const counts = new Map<number, number>();
  const lastSeenIndex = new Map<number, number>(); // index in sorted (0 = most recent)
  const lastSeenDate = new Map<number, string>();

  for (let i = minNumber; i <= numberRange; i++) {
    counts.set(i, 0);
  }

  for (let i = 0; i < sorted.length; i++) {
    const draw = sorted[i];
    for (const num of draw.numbers) {
      if (num < minNumber || num > numberRange) continue;
      counts.set(num, (counts.get(num) ?? 0) + 1);
      if (!lastSeenIndex.has(num)) {
        lastSeenIndex.set(num, i);
        lastSeenDate.set(num, draw.drawDate);
      }
    }
  }

  // Build gap data: for each number, compute draws since last seen
  // and average gap between consecutive appearances
  const gapData = computeGapInfo(sorted, numberRange, minNumber);

  const results: FrequencyResult[] = [];

  for (let num = minNumber; num <= numberRange; num++) {
    const count = counts.get(num) ?? 0;
    results.push({
      number: num,
      count,
      percentage: drawCount > 0 ? (count / drawCount) * 100 : 0,
      classification: "warm", // will be set by classifyNumbers
      lastSeen: lastSeenDate.get(num) ?? null,
      gapCurrent: lastSeenIndex.has(num) ? lastSeenIndex.get(num)! : drawCount,
      gapAverage: gapData.get(num) ?? 0,
    });
  }

  return results;
}

/**
 * Classify numbers as hot/warm/cold based on standard deviation from expected frequency.
 *
 * - Expected frequency = (drawCount * ballsPerDraw) / numberRange
 * - Hot = count > expected + 1 stdDev
 * - Cold = count < expected - 1 stdDev
 * - Warm = everything in between
 */
export function classifyNumbers(
  frequencies: FrequencyResult[],
  drawCount: number,
  ballsPerDraw: number,
): FrequencyResult[] {
  if (frequencies.length === 0 || drawCount === 0) return frequencies;

  const numberRange = frequencies.length;
  const expected = (drawCount * ballsPerDraw) / numberRange;
  const counts = frequencies.map((f) => f.count);
  const stdDev = standardDeviation(counts);

  return frequencies.map((f) => {
    let classification: NumberClassification;
    if (f.count > expected + stdDev) {
      classification = "hot";
    } else if (f.count < expected - stdDev) {
      classification = "cold";
    } else {
      classification = "warm";
    }
    return { ...f, classification };
  });
}

/**
 * Internal helper: compute average gap between appearances for each number.
 */
function computeGapInfo(
  sortedDraws: Draw[],
  numberRange: number,
  minNumber: number,
): Map<number, number> {
  // Track draw indices where each number appeared
  const appearances = new Map<number, number[]>();
  for (let i = minNumber; i <= numberRange; i++) {
    appearances.set(i, []);
  }

  for (let i = 0; i < sortedDraws.length; i++) {
    for (const num of sortedDraws[i].numbers) {
      if (num < minNumber || num > numberRange) continue;
      appearances.get(num)?.push(i);
    }
  }

  const avgGaps = new Map<number, number>();

  for (const [num, indices] of appearances) {
    if (indices.length < 2) {
      // If never appeared or appeared once, average gap is effectively the full span
      avgGaps.set(num, indices.length === 0 ? sortedDraws.length : 0);
      continue;
    }
    // Gaps between consecutive appearances
    let totalGap = 0;
    for (let i = 1; i < indices.length; i++) {
      totalGap += indices[i] - indices[i - 1];
    }
    avgGaps.set(num, totalGap / (indices.length - 1));
  }

  return avgGaps;
}
