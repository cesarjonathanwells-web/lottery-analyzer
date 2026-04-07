import { fetchRecentDraws } from "@/lib/ebg-client";
import { getGameById } from "@/lib/games";
import type { Draw, AnalysisType, Game } from "@/lib/types";
import type { AnalysisResult, AnalysisOptions, AnalysisPayload } from "./types";
import { computeFrequency, classifyNumbers } from "./frequency";
import { computeGaps } from "./gaps";
import { computePatterns } from "./patterns";
import { computePairs } from "./pairs";
import { computeDeltas } from "./delta";
import { computeChiSquare } from "./chi-square";

// Re-export all analysis functions for direct use
export { computeFrequency, classifyNumbers } from "./frequency";
export { computeGaps } from "./gaps";
export { computePatterns } from "./patterns";
export { computePairs } from "./pairs";
export { computeDeltas } from "./delta";
export { computeChiSquare } from "./chi-square";
export { findCoincidences } from "./coincidences";
export { findDayLikeToday } from "./day-like-today";
export { findRepeatedNumbers } from "./repeated";
export type * from "./types";

/**
 * Fetch draws from EBG API for a given game.
 *
 * @param gameId - The game slug/id
 * @param limit  - Max draws to return (undefined = all available)
 * @returns Draw[] sorted by drawDate descending
 */
export async function fetchDraws(
  gameId: string,
  limit?: number,
): Promise<Draw[]> {
  // Fetch enough days to cover the requested limit.
  // Most games draw daily, so days ~= limit. Add a generous buffer.
  const days = limit ? Math.max(180, limit * 2) : 365;
  const draws = await fetchRecentDraws(gameId, days);
  return limit ? draws.slice(0, limit) : draws;
}

/**
 * Fetch a game's configuration by its id/slug.
 * Uses the static GAMES registry instead of DB.
 */
export function fetchGame(gameId: string): Game | null {
  return getGameById(gameId) ?? null;
}

/**
 * Run the appropriate analysis, fetching draws from EBG.
 *
 * @param gameId       - The game slug/id (e.g. "powerball")
 * @param analysisType - Which analysis to run
 * @param options      - Optional: drawCount, topN
 * @returns AnalysisResult
 */
export async function runAnalysis(
  gameId: string,
  analysisType: AnalysisType,
  options: AnalysisOptions = {},
): Promise<AnalysisResult> {
  // Fetch game config from static registry
  const game = fetchGame(gameId);
  if (!game) {
    throw new Error(`Game not found: ${gameId}`);
  }

  // Fetch draws from EBG
  const drawList = await fetchDraws(gameId, options.drawCount);
  if (drawList.length === 0) {
    throw new Error(`No draws found for game: ${gameId}`);
  }

  // Determine the min number (0 for Pick games, 1 for lotteries)
  const minNumber = game.gameType.startsWith("pick") ? 0 : 1;

  // Run the appropriate analysis
  const payload = executeAnalysis(
    analysisType,
    drawList,
    game,
    minNumber,
    options,
  );

  const result: AnalysisResult = {
    gameId,
    analysisType,
    drawCount: drawList.length,
    computedAt: new Date().toISOString(),
    payload,
  };

  return result;
}

/**
 * Execute a specific analysis type on the given draws.
 * This is a pure dispatch function.
 */
function executeAnalysis(
  analysisType: AnalysisType,
  drawList: Draw[],
  game: Game,
  minNumber: number,
  options: AnalysisOptions,
): AnalysisPayload {
  switch (analysisType) {
    case "frequency": {
      const raw = computeFrequency(
        drawList,
        game.numberRange,
        minNumber,
      );
      const classified = classifyNumbers(
        raw,
        drawList.length,
        game.ballsDrawn,
      );
      return { type: "frequency", data: classified };
    }

    case "gap": {
      const data = computeGaps(drawList, game.numberRange, minNumber);
      return { type: "gap", data };
    }

    case "pattern": {
      const data = computePatterns(
        drawList,
        game.numberRange,
        minNumber,
      );
      return { type: "pattern", data };
    }

    case "pairs": {
      const data = computePairs(drawList, options.topN ?? 20);
      return { type: "pairs", data };
    }

    case "delta": {
      const data = computeDeltas(drawList);
      return { type: "delta", data };
    }

    case "chi_square": {
      const data = computeChiSquare(
        drawList,
        game.numberRange,
        game.ballsDrawn,
        minNumber,
      );
      return { type: "chi_square", data };
    }

    case "positional": {
      // Positional analysis uses frequency per position (for Pick games)
      // Falls back to standard frequency for major lotteries
      const raw = computeFrequency(
        drawList,
        game.numberRange,
        minNumber,
      );
      const classified = classifyNumbers(
        raw,
        drawList.length,
        game.ballsDrawn,
      );
      return { type: "frequency", data: classified };
    }

    default: {
      const _exhaustive: never = analysisType;
      throw new Error(`Unknown analysis type: ${_exhaustive}`);
    }
  }
}
