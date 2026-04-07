import type {
  FrequencyResult,
  PatternResult,
  PairResult,
  AnalysisType,
} from "@/lib/types";

// ── Gap Analysis ──────────────────────────────────────────────────────────────
export interface GapResult {
  number: number;
  currentGap: number; // draws since last seen
  averageGap: number;
  maxGap: number;
  lastSeenDate: string | null;
}

// ── Delta Analysis ────────────────────────────────────────────────────────────
export interface DeltaDistributionEntry {
  delta: number;
  count: number;
  percentage: number;
}

export interface DeltaResult {
  /** Frequency of each delta value across all draws */
  deltaDistribution: DeltaDistributionEntry[];
  /** Average delta for each position (1st gap, 2nd gap, etc.) */
  averageDeltas: number[];
  /** Top 10 most frequent deltas */
  mostCommonDeltas: DeltaDistributionEntry[];
}

// ── Chi-Square Analysis ───────────────────────────────────────────────────────
export interface ChiSquareResult {
  chiSquareStatistic: number;
  degreesOfFreedom: number;
  pValue: number;
  isRandom: boolean; // p > 0.05
  interpretation: string;
}

// ── Pattern Analysis (extended) ───────────────────────────────────────────────
export interface ExtendedPatternResult extends PatternResult {
  sumStats: {
    min: number;
    max: number;
    avg: number;
    stdDev: number;
    current: number;
  };
  consecutiveDetails: {
    drawsWithConsecutive: number;
    totalDraws: number;
    percentage: number;
  };
}

// ── Unified Analysis Result ───────────────────────────────────────────────────
export type AnalysisPayload =
  | { type: "frequency"; data: FrequencyResult[] }
  | { type: "gap"; data: GapResult[] }
  | { type: "pattern"; data: ExtendedPatternResult }
  | { type: "pairs"; data: PairResult[] }
  | { type: "delta"; data: DeltaResult }
  | { type: "chi_square"; data: ChiSquareResult };

export interface AnalysisResult {
  gameId: string;
  analysisType: AnalysisType;
  drawCount: number;
  computedAt: string; // ISO timestamp
  payload: AnalysisPayload;
}

// ── Analysis Options ──────────────────────────────────────────────────────────
export interface AnalysisOptions {
  drawCount?: number; // limit to last N draws
  topN?: number; // for pairs: how many to return
}
