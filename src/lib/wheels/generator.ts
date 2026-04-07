/**
 * Lottery Wheel Generator - Greedy Set Cover Algorithm
 *
 * Implements the covering design approach: L(n, k, p, t) = B
 * Given n pool numbers, generate B tickets of size k such that
 * if p of your numbers are drawn, at least one ticket matches >= t.
 *
 * Uses bitset representation for fast subset operations when pool <= 32.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface WheelParams {
  poolNumbers: number[]; // The user's chosen numbers (e.g., [1,3,7,12,15,22,33,45])
  pickSize: number; // Numbers per ticket (e.g., 6 for Powerball)
  guaranteeMatch: number; // Minimum match guaranteed (t)
  guaranteeIfDrawn: number; // How many of pool must be drawn (p)
}

export interface GeneratedWheel {
  combinations: number[][]; // Each inner array is a ticket
  ticketCount: number;
  guarantee: string; // Human-readable description
  coveragePercent: number; // What % of target subsets are covered
}

// ── Validation ───────────────────────────────────────────────────────────────

const MAX_POOL_SIZE = 20;
const TIMEOUT_MS = 5000;

export function validateParams(params: WheelParams): string | null {
  const { poolNumbers, pickSize, guaranteeMatch, guaranteeIfDrawn } = params;

  if (poolNumbers.length < pickSize) {
    return `Pool size (${poolNumbers.length}) must be >= pick size (${pickSize})`;
  }
  if (poolNumbers.length > MAX_POOL_SIZE) {
    return `Pool size (${poolNumbers.length}) exceeds maximum of ${MAX_POOL_SIZE}`;
  }
  if (guaranteeMatch > pickSize) {
    return `Guarantee match (${guaranteeMatch}) cannot exceed pick size (${pickSize})`;
  }
  if (guaranteeIfDrawn > poolNumbers.length) {
    return `Guarantee-if-drawn (${guaranteeIfDrawn}) cannot exceed pool size (${poolNumbers.length})`;
  }
  if (guaranteeIfDrawn < guaranteeMatch) {
    return `Guarantee-if-drawn (${guaranteeIfDrawn}) must be >= guarantee match (${guaranteeMatch})`;
  }
  if (guaranteeMatch < 1) {
    return "Guarantee match must be at least 1";
  }

  // Check for duplicates
  const unique = new Set(poolNumbers);
  if (unique.size !== poolNumbers.length) {
    return "Pool numbers must be unique";
  }

  return null;
}

// ── Combinatorics Utilities ──────────────────────────────────────────────────

/** Generate all k-subsets of the given array (indices). */
function kSubsets<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  const n = arr.length;
  if (k > n || k < 0) return result;
  if (k === 0) return [[]];

  const indices = Array.from({ length: k }, (_, i) => i);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    result.push(indices.map((i) => arr[i]));
    // Find rightmost index that can be incremented
    let i = k - 1;
    while (i >= 0 && indices[i] === n - k + i) {
      i--;
    }
    if (i < 0) break;
    indices[i]++;
    for (let j = i + 1; j < k; j++) {
      indices[j] = indices[j - 1] + 1;
    }
  }

  return result;
}

/** Convert a subset of indices to a bitmask (for pools <= 32). */
function toBitmask(indices: number[]): number {
  let mask = 0;
  for (const idx of indices) {
    mask |= 1 << idx;
  }
  return mask;
}

/** Count bits set in a 32-bit integer. */
function popcount(n: number): number {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
}

/** Check if mask `a` contains at least `t` bits from mask `b`. */
function hasOverlap(a: number, b: number, t: number): boolean {
  return popcount(a & b) >= t;
}

// ── Core Algorithm ───────────────────────────────────────────────────────────

/**
 * Generate a lottery wheel using the greedy set cover algorithm.
 *
 * The guarantee: if `guaranteeIfDrawn` (p) of your pool numbers appear in
 * the actual draw, then at least one of your tickets will match at least
 * `guaranteeMatch` (t) numbers.
 *
 * Approach:
 * 1. Map poolNumbers to indices 0..n-1 for internal computation
 * 2. Enumerate all "target p-subsets" of the pool indices
 * 3. For each target p-subset, enumerate its t-subsets (the "coverage targets")
 * 4. Enumerate all possible k-subsets (candidate tickets) from pool indices
 * 5. Greedily pick tickets that cover the most uncovered targets
 */
export function generateWheel(params: WheelParams): GeneratedWheel {
  const error = validateParams(params);
  if (error) {
    throw new Error(error);
  }

  const { poolNumbers, pickSize, guaranteeMatch, guaranteeIfDrawn } = params;
  const n = poolNumbers.length;
  const k = pickSize;
  const t = guaranteeMatch;
  const p = guaranteeIfDrawn;

  // Sort pool numbers for consistent output
  const sortedPool = [...poolNumbers].sort((a, b) => a - b);

  // Map to indices 0..n-1
  const indices = Array.from({ length: n }, (_, i) => i);

  // Special case: if pool size === pick size, there's only one ticket
  if (n === k) {
    return {
      combinations: [sortedPool],
      ticketCount: 1,
      guarantee: `Guaranteed ${t}-match if ${p} of your ${n} numbers are drawn`,
      coveragePercent: 100,
    };
  }

  const startTime = Date.now();
  let timedOut = false;

  // ── Step 1: Enumerate all p-subsets of pool indices ──
  const pSubsets = kSubsets(indices, p);

  // ── Step 2: Build target set ──
  // For each p-subset, we need at least one ticket to contain a t-subset of it.
  // We represent each "coverage requirement" as: for p-subset P, at least one
  // ticket must share >= t numbers with P.
  //
  // Using bitmasks for efficiency (pool size <= 20 so we fit in 32 bits).
  const pSubsetMasks = pSubsets.map((ps) => toBitmask(ps));

  // ── Step 3: Enumerate all candidate tickets (k-subsets of indices) ──
  const candidateSubsets = kSubsets(indices, k);
  const candidateMasks = candidateSubsets.map((cs) => toBitmask(cs));

  // ── Step 4: Precompute coverage ──
  // For each candidate ticket, which p-subsets does it "cover"?
  // A ticket covers a p-subset if the ticket shares >= t numbers with it.
  const totalTargets = pSubsetMasks.length;
  const uncovered = new Set<number>();
  for (let i = 0; i < totalTargets; i++) {
    uncovered.add(i);
  }

  // Precompute: for each candidate, which targets it covers
  const candidateCoverage: Set<number>[] = candidateMasks.map((cm) => {
    const covers = new Set<number>();
    for (let ti = 0; ti < totalTargets; ti++) {
      if (hasOverlap(cm, pSubsetMasks[ti], t)) {
        covers.add(ti);
      }
    }
    return covers;
  });

  // ── Step 5: Greedy set cover ──
  const selectedIndices: number[] = [];

  while (uncovered.size > 0) {
    // Check timeout
    if (Date.now() - startTime > TIMEOUT_MS) {
      timedOut = true;
      break;
    }

    // Find candidate that covers the most uncovered targets
    let bestIdx = -1;
    let bestCount = 0;

    for (let ci = 0; ci < candidateMasks.length; ci++) {
      let count = 0;
      for (const ti of uncovered) {
        if (candidateCoverage[ci].has(ti)) {
          count++;
        }
      }
      if (count > bestCount) {
        bestCount = count;
        bestIdx = ci;
      }
    }

    if (bestIdx === -1 || bestCount === 0) {
      // No candidate can cover any remaining target - shouldn't happen with valid params
      break;
    }

    selectedIndices.push(bestIdx);

    // Remove covered targets
    for (const ti of candidateCoverage[bestIdx]) {
      uncovered.delete(ti);
    }
  }

  // ── Step 6: Map back to actual numbers ──
  const combinations = selectedIndices.map((ci) =>
    candidateSubsets[ci].map((idx) => sortedPool[idx]),
  );

  const coveredCount = totalTargets - uncovered.size;
  const coveragePercent =
    totalTargets > 0 ? Math.round((coveredCount / totalTargets) * 10000) / 100 : 100;

  const guarantee = timedOut
    ? `Best-effort ${t}-match if ${p} of your ${n} numbers are drawn (timed out - ${coveragePercent}% coverage)`
    : `Guaranteed ${t}-match if ${p} of your ${n} numbers are drawn`;

  return {
    combinations,
    ticketCount: combinations.length,
    guarantee,
    coveragePercent,
  };
}

// ── Cost Calculator ──────────────────────────────────────────────────────────

export interface WheelCost {
  ticketCount: number;
  costPerTicket: number;
  totalCost: number;
  fullWheelTickets: number;
  fullWheelCost: number;
  savingsPercent: number;
}

/** Compute C(n, k) = n! / (k! * (n-k)!) */
function combinations(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

export function calculateWheelCost(
  ticketCount: number,
  poolSize: number,
  pickSize: number,
  costPerTicket: number = 2,
): WheelCost {
  const fullWheelTickets = combinations(poolSize, pickSize);
  const fullWheelCost = fullWheelTickets * costPerTicket;
  const totalCost = ticketCount * costPerTicket;
  const savingsPercent =
    fullWheelCost > 0
      ? Math.round(((fullWheelCost - totalCost) / fullWheelCost) * 10000) / 100
      : 0;

  return {
    ticketCount,
    costPerTicket,
    totalCost,
    fullWheelTickets,
    fullWheelCost,
    savingsPercent,
  };
}
