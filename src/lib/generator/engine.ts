import type { FrequencyResult } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

export type Strategy =
  | "balanced"
  | "hot_bias"
  | "cold_bias"
  | "delta"
  | "random";

export interface GeneratorConfig {
  gameId: string;
  strategy: Strategy;
  count: number; // How many sets to generate
  // Pattern filters
  oddEvenBalance?: boolean; // Enforce near-balanced odd/even
  sumRange?: { min: number; max: number }; // Enforce sum within range
  noConsecutive?: boolean; // Avoid consecutive numbers
  decadeSpread?: boolean; // Ensure spread across decades
  // Exclusions
  excludeNumbers?: number[];
  mustInclude?: number[]; // Key numbers that must appear in every set
}

export interface GeneratedSet {
  numbers: number[];
  bonusNumber?: number;
  score: number; // 0-100 quality score
  breakdown: {
    oddEven: string; // e.g., "3/3"
    highLow: string; // e.g., "4/2"
    sum: number;
    consecutives: number;
    decadeSpread: number; // how many decades covered
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Seeded-ish weighted random selection without replacement */
function weightedSample(
  pool: { number: number; weight: number }[],
  count: number,
): number[] {
  const remaining = [...pool];
  const selected: number[] = [];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (let j = 0; j < remaining.length; j++) {
      r -= remaining[j].weight;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    selected.push(remaining[idx].number);
    remaining.splice(idx, 1);
  }

  return selected.sort((a, b) => a - b);
}

/** Count consecutive number pairs in a sorted array */
function countConsecutives(nums: number[]): number {
  let count = 0;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] - nums[i - 1] === 1) count++;
  }
  return count;
}

/** Count unique decades covered (0-9, 10-19, 20-29, ...) */
function countDecades(nums: number[]): number {
  const decades = new Set(nums.map((n) => Math.floor(n / 10)));
  return decades.size;
}

/** Compute odd/even split string */
function oddEvenSplit(nums: number[]): string {
  const odd = nums.filter((n) => n % 2 !== 0).length;
  return `${odd}/${nums.length - odd}`;
}

/** Compute high/low split string relative to midpoint */
function highLowSplit(nums: number[], maxNumber: number): string {
  const mid = Math.ceil(maxNumber / 2);
  const high = nums.filter((n) => n > mid).length;
  return `${high}/${nums.length - high}`;
}

// ── Score computation ────────────────────────────────────────────────────────

function scoreSet(
  nums: number[],
  config: GeneratorConfig,
  numberRange: number,
): { score: number; breakdown: GeneratedSet["breakdown"] } {
  const sum = nums.reduce((s, n) => s + n, 0);
  const consecutives = countConsecutives(nums);
  const decades = countDecades(nums);
  const oe = oddEvenSplit(nums);
  const hl = highLowSplit(nums, numberRange);

  let score = 100;
  const totalFilters = 4; // max filters
  let failedFilters = 0;

  // Odd/even balance: expect within 1 of balanced
  if (config.oddEvenBalance !== false) {
    const odd = nums.filter((n) => n % 2 !== 0).length;
    const balanced = Math.floor(nums.length / 2);
    if (Math.abs(odd - balanced) > 1) {
      failedFilters++;
    }
  }

  // Sum range
  if (config.sumRange) {
    if (sum < config.sumRange.min || sum > config.sumRange.max) {
      failedFilters++;
    }
  }

  // No consecutives
  if (config.noConsecutive) {
    if (consecutives > 0) {
      failedFilters++;
    }
  }

  // Decade spread: at least 3 decades for 5+ ball games
  if (config.decadeSpread !== false) {
    const minDecades = Math.min(3, Math.ceil(nums.length / 2));
    if (decades < minDecades) {
      failedFilters++;
    }
  }

  // Score: deduct proportionally for each failed filter
  score = Math.round(100 * (1 - failedFilters / totalFilters));
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    breakdown: {
      oddEven: oe,
      highLow: hl,
      sum,
      consecutives,
      decadeSpread: decades,
    },
  };
}

// ── Strategy Implementations ─────────────────────────────────────────────────

function buildBalancedWeights(
  frequencies: FrequencyResult[],
  numberRange: number,
  excludeSet: Set<number>,
): { number: number; weight: number }[] {
  // Weight each number proportionally to how close it is to expected frequency
  const counts = frequencies.map((f) => f.count);
  const avg = counts.reduce((s, c) => s + c, 0) / counts.length || 1;

  return frequencies
    .filter((f) => !excludeSet.has(f.number))
    .map((f) => {
      // Numbers near expected frequency get highest weight
      const deviation = Math.abs(f.count - avg);
      const weight = Math.max(0.1, 1 / (1 + deviation / avg));
      return { number: f.number, weight };
    });
}

function buildHotBiasWeights(
  frequencies: FrequencyResult[],
  excludeSet: Set<number>,
): { number: number; weight: number }[] {
  return frequencies
    .filter((f) => !excludeSet.has(f.number))
    .map((f) => {
      let weight = 1;
      if (f.classification === "hot") weight = 3;
      else if (f.classification === "warm") weight = 2;
      else weight = 1;
      return { number: f.number, weight };
    });
}

function buildColdBiasWeights(
  frequencies: FrequencyResult[],
  excludeSet: Set<number>,
): { number: number; weight: number }[] {
  return frequencies
    .filter((f) => !excludeSet.has(f.number))
    .map((f) => {
      let weight = 1;
      if (f.classification === "cold") weight = 3;
      else if (f.classification === "warm") weight = 2;
      else weight = 1;
      return { number: f.number, weight };
    });
}

function generateDeltaSet(
  numberRange: number,
  ballsDrawn: number,
  excludeSet: Set<number>,
  mustInclude: number[],
): number[] | null {
  // Delta system: pick a starting number, then add small deltas
  // Small deltas are more common in real lottery draws
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const nums: number[] = [...mustInclude];

    if (nums.length === 0) {
      // Pick a starting number in the lower third
      const start = Math.floor(Math.random() * Math.ceil(numberRange / 3)) + 1;
      nums.push(start);
    }

    while (nums.length < ballsDrawn) {
      // Generate a delta: weighted toward small values (1-5 highest probability)
      const deltaWeights = [
        { delta: 1, weight: 8 },
        { delta: 2, weight: 7 },
        { delta: 3, weight: 6 },
        { delta: 4, weight: 5 },
        { delta: 5, weight: 5 },
        { delta: 6, weight: 4 },
        { delta: 7, weight: 3 },
        { delta: 8, weight: 3 },
        { delta: 9, weight: 2 },
        { delta: 10, weight: 2 },
        { delta: 11, weight: 1 },
        { delta: 12, weight: 1 },
        { delta: 13, weight: 1 },
        { delta: 14, weight: 1 },
        { delta: 15, weight: 1 },
      ];

      const totalWeight = deltaWeights.reduce((s, d) => s + d.weight, 0);
      let r = Math.random() * totalWeight;
      let delta = 1;
      for (const dw of deltaWeights) {
        r -= dw.weight;
        if (r <= 0) {
          delta = dw.delta;
          break;
        }
      }

      const lastNum = nums[nums.length - 1];
      const candidate = lastNum + delta;

      if (candidate > numberRange) break;
      if (excludeSet.has(candidate) || nums.includes(candidate)) continue;

      nums.push(candidate);
    }

    if (nums.length === ballsDrawn) {
      const sorted = [...nums].sort((a, b) => a - b);
      // Validate all in range and no duplicates
      const unique = new Set(sorted);
      if (
        unique.size === ballsDrawn &&
        sorted[0] >= 1 &&
        sorted[sorted.length - 1] <= numberRange
      ) {
        return sorted;
      }
    }
  }

  return null;
}

function buildRandomWeights(
  numberRange: number,
  minNumber: number,
  excludeSet: Set<number>,
): { number: number; weight: number }[] {
  const pool: { number: number; weight: number }[] = [];
  for (let i = minNumber; i <= numberRange; i++) {
    if (!excludeSet.has(i)) {
      pool.push({ number: i, weight: 1 });
    }
  }
  return pool;
}

// ── Filter validation ────────────────────────────────────────────────────────

function passesFilters(
  nums: number[],
  config: GeneratorConfig,
  numberRange: number,
): boolean {
  // Odd/even balance
  if (config.oddEvenBalance !== false) {
    const odd = nums.filter((n) => n % 2 !== 0).length;
    const balanced = Math.floor(nums.length / 2);
    if (Math.abs(odd - balanced) > 1) return false;
  }

  // Sum range
  if (config.sumRange) {
    const sum = nums.reduce((s, n) => s + n, 0);
    if (sum < config.sumRange.min || sum > config.sumRange.max) return false;
  }

  // No consecutives
  if (config.noConsecutive) {
    if (countConsecutives(nums) > 0) return false;
  }

  // Decade spread
  if (config.decadeSpread !== false) {
    const minDecades = Math.min(3, Math.ceil(nums.length / 2));
    if (countDecades(nums) < minDecades) return false;
  }

  // Must include
  if (config.mustInclude && config.mustInclude.length > 0) {
    for (const n of config.mustInclude) {
      if (!nums.includes(n)) return false;
    }
  }

  return true;
}

// ── Main Generator ───────────────────────────────────────────────────────────

export function generateNumbers(
  config: GeneratorConfig,
  frequencies: FrequencyResult[],
  numberRange: number,
  ballsDrawn: number,
  bonusBalls: number,
  bonusRange?: number,
): GeneratedSet[] {
  const results: GeneratedSet[] = [];
  const excludeSet = new Set(config.excludeNumbers ?? []);
  const mustInclude = (config.mustInclude ?? []).filter(
    (n) => !excludeSet.has(n),
  );
  const actualBonusRange = bonusRange ?? numberRange;
  const maxAttempts = 1000;
  const minNumber = 1;

  for (let setIdx = 0; setIdx < config.count; setIdx++) {
    let bestCandidate: number[] | null = null;
    let bestScore = -1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let candidate: number[];

      if (config.strategy === "delta") {
        const result = generateDeltaSet(
          numberRange,
          ballsDrawn,
          excludeSet,
          mustInclude,
        );
        if (!result) continue;
        candidate = result;
      } else {
        // Build weighted pool based on strategy
        let pool: { number: number; weight: number }[];

        switch (config.strategy) {
          case "balanced":
            pool = buildBalancedWeights(frequencies, numberRange, excludeSet);
            break;
          case "hot_bias":
            pool = buildHotBiasWeights(frequencies, excludeSet);
            break;
          case "cold_bias":
            pool = buildColdBiasWeights(frequencies, excludeSet);
            break;
          case "random":
          default:
            pool = buildRandomWeights(numberRange, minNumber, excludeSet);
            break;
        }

        // If mustInclude, remove them from pool and reduce pick count
        const mustSet = new Set(mustInclude);
        const filteredPool = pool.filter((p) => !mustSet.has(p.number));
        const remaining = ballsDrawn - mustInclude.length;

        if (remaining < 0) continue;
        if (remaining === 0) {
          candidate = [...mustInclude].sort((a, b) => a - b);
        } else {
          const picked = weightedSample(filteredPool, remaining);
          candidate = [...mustInclude, ...picked].sort((a, b) => a - b);
        }
      }

      if (candidate.length !== ballsDrawn) continue;

      // Check filters
      if (passesFilters(candidate, config, numberRange)) {
        const { score, breakdown } = scoreSet(candidate, config, numberRange);

        // Generate bonus number if needed
        let bonusNumber: number | undefined;
        if (bonusBalls > 0) {
          const bonusExclude = new Set(excludeSet);
          // Bonus is drawn from a separate pool, so main numbers don't exclude it
          bonusNumber =
            Math.floor(Math.random() * actualBonusRange) + 1;
          // Make sure bonus isn't excluded
          let bonusAttempts = 0;
          while (bonusExclude.has(bonusNumber) && bonusAttempts < 100) {
            bonusNumber =
              Math.floor(Math.random() * actualBonusRange) + 1;
            bonusAttempts++;
          }
        }

        results.push({
          numbers: candidate,
          bonusNumber,
          score,
          breakdown,
        });
        bestCandidate = null; // reset since we found a valid one
        break;
      }

      // Track best-effort
      const { score, breakdown } = scoreSet(candidate, config, numberRange);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    // If we exhausted attempts, use best-effort
    if (bestCandidate && results.length <= setIdx) {
      let bonusNumber: number | undefined;
      if (bonusBalls > 0) {
        bonusNumber =
          Math.floor(Math.random() * actualBonusRange) + 1;
      }

      const { score, breakdown } = scoreSet(
        bestCandidate,
        config,
        numberRange,
      );
      results.push({
        numbers: bestCandidate,
        bonusNumber,
        score,
        breakdown,
      });
    }
  }

  return results;
}
