export type GameType = "pick3" | "pick4" | "pick5" | "loto" | "mega" | "powerball";
export type Country = "US" | "DO" | "AI";
export type DrawPeriod = "morning" | "midday" | "afternoon" | "evening" | "night";
export type NumberClassification = "hot" | "warm" | "cold";
export type AnalysisType =
  | "frequency"
  | "positional"
  | "gap"
  | "pattern"
  | "pairs"
  | "delta"
  | "chi_square";

export interface Game {
  id: string;
  name: string;
  slug: string;
  country: Country;
  gameType: GameType;
  numberRange: number;
  ballsDrawn: number;
  bonusBalls: number;
  color: string;
  drawSchedule: string;
}

export interface Draw {
  id: string;
  gameId: string;
  drawDate: string;
  drawTime: string | null;
  drawPeriod: DrawPeriod | null;
  numbers: number[];
  bonusNumbers: number[];
  jackpot: number | null;
  source: string;
  verified: boolean;
}

export interface FrequencyResult {
  number: number;
  count: number;
  percentage: number;
  classification: NumberClassification;
  lastSeen: string | null;
  gapCurrent: number;
  gapAverage: number;
}

export interface PatternResult {
  oddEvenRatio: string;
  highLowRatio: string;
  sumRange: { min: number; max: number; avg: number; current: number };
  consecutiveCount: number;
  decadeDistribution: Record<string, number>;
}

export interface PairResult {
  pair: [number, number];
  count: number;
  lastSeen: string | null;
}

export interface WheelConfig {
  poolSize: number;
  pickSize: number;
  guaranteeMatch: number;
  guaranteeIfDrawn: number;
}

export interface WheelResult {
  config: WheelConfig;
  combinations: number[][];
  ticketCount: number;
  coverageDescription: string;
}
