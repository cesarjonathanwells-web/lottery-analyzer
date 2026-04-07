import type { Draw, PairResult } from "@/lib/types";

/**
 * Compute pair co-occurrence analysis.
 *
 * Counts how often every pair of numbers appears together in the same draw,
 * then returns the top N most frequent pairs.
 *
 * @param draws - Array of Draw objects
 * @param topN  - Number of top pairs to return (default 20)
 * @returns PairResult[] sorted by count descending
 */
export function computePairs(draws: Draw[], topN: number = 20): PairResult[] {
  if (draws.length === 0) return [];

  // Sort draws by date descending for last-seen tracking
  const sorted = [...draws].sort(
    (a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime(),
  );

  // Map: "a,b" -> { count, lastSeen }
  const pairMap = new Map<string, { count: number; lastSeen: string | null }>();

  for (const draw of sorted) {
    const nums = [...draw.numbers].sort((a, b) => a - b);

    // Generate all unique pairs from this draw
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = `${nums[i]},${nums[j]}`;
        const existing = pairMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          pairMap.set(key, {
            count: 1,
            lastSeen: draw.drawDate, // first encounter in desc order = most recent
          });
        }
      }
    }
  }

  // Convert to array and sort by count descending
  const results: PairResult[] = [];

  for (const [key, data] of pairMap) {
    const [a, b] = key.split(",").map(Number);
    results.push({
      pair: [a, b],
      count: data.count,
      lastSeen: data.lastSeen,
    });
  }

  results.sort((a, b) => b.count - a.count);

  return results.slice(0, topN);
}
