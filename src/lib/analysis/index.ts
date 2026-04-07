import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { draws as drawsTable, games, analysisCache } from "@/lib/db/schema";
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
export type * from "./types";

/** Cache TTL in milliseconds (1 hour) */
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Generate a stable hash for the analysis parameters.
 * Uses a simple string-based approach since parameters are small.
 */
function paramsHash(options: AnalysisOptions): string {
  const canonical = JSON.stringify({
    drawCount: options.drawCount ?? "all",
    topN: options.topN ?? "default",
  });
  // Simple hash: sum of char codes * prime, stringified
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    hash = (hash * 31 + canonical.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Fetch draws from the database for a given game.
 *
 * @param gameId    - The game slug/id
 * @param limit     - Max draws to return (undefined = all)
 * @returns Draw[] sorted by drawDate descending
 */
export async function fetchDraws(
  gameId: string,
  limit?: number,
): Promise<Draw[]> {
  const query = db
    .select()
    .from(drawsTable)
    .where(eq(drawsTable.gameId, gameId))
    .orderBy(desc(drawsTable.drawDate));

  const rows = limit ? await query.limit(limit) : await query;

  return rows.map((r) => ({
    id: String(r.id),
    gameId: r.gameId,
    drawDate: r.drawDate,
    drawTime: r.drawTime,
    drawPeriod: r.drawPeriod as Draw["drawPeriod"],
    numbers: r.numbers,
    bonusNumbers: r.bonusNumbers ?? [],
    jackpot: r.jackpot,
    source: r.source,
    verified: r.verified ?? false,
  }));
}

/**
 * Fetch draws within a date range, with optional pagination.
 */
export async function fetchDrawsPaginated(
  gameId: string,
  options: {
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
  },
): Promise<{ draws: Draw[]; total: number }> {
  const conditions = [eq(drawsTable.gameId, gameId)];

  if (options.from) {
    conditions.push(gte(drawsTable.drawDate, options.from));
  }
  if (options.to) {
    conditions.push(lte(drawsTable.drawDate, options.to));
  }

  const whereClause =
    conditions.length === 1 ? conditions[0] : and(...conditions);

  // Get total count
  const allRows = await db
    .select({ id: drawsTable.id })
    .from(drawsTable)
    .where(whereClause);
  const total = allRows.length;

  // Get paginated results
  let query = db
    .select()
    .from(drawsTable)
    .where(whereClause)
    .orderBy(desc(drawsTable.drawDate));

  if (options.offset) {
    query = query.offset(options.offset) as typeof query;
  }
  if (options.limit) {
    query = query.limit(options.limit) as typeof query;
  }

  const rows = await query;

  const draws: Draw[] = rows.map((r) => ({
    id: String(r.id),
    gameId: r.gameId,
    drawDate: r.drawDate,
    drawTime: r.drawTime,
    drawPeriod: r.drawPeriod as Draw["drawPeriod"],
    numbers: r.numbers,
    bonusNumbers: r.bonusNumbers ?? [],
    jackpot: r.jackpot,
    source: r.source,
    verified: r.verified ?? false,
  }));

  return { draws, total };
}

/**
 * Fetch a game's configuration by its id/slug.
 */
export async function fetchGame(gameId: string): Promise<Game | null> {
  const rows = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    slug: r.id,
    country: r.country as Game["country"],
    gameType: r.gameType as Game["gameType"],
    numberRange: r.numberRange,
    ballsDrawn: r.ballsDrawn,
    bonusBalls: r.bonusBalls ?? 0,
    color: r.color,
    drawSchedule: r.drawSchedule ?? "",
  };
}

/**
 * Check the analysis cache for a valid (non-expired) entry.
 */
async function getCachedResult(
  gameId: string,
  analysisType: AnalysisType,
  hash: string,
): Promise<AnalysisResult | null> {
  const rows = await db
    .select()
    .from(analysisCache)
    .where(
      and(
        eq(analysisCache.gameId, gameId),
        eq(analysisCache.analysisType, analysisType),
        eq(analysisCache.paramsHash, hash),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;

  const cached = rows[0];
  if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
    return null; // expired
  }

  return cached.result as AnalysisResult;
}

/**
 * Store an analysis result in the cache.
 */
async function setCachedResult(
  gameId: string,
  analysisType: AnalysisType,
  hash: string,
  result: AnalysisResult,
): Promise<void> {
  // Upsert: delete old entry if exists, then insert
  await db
    .delete(analysisCache)
    .where(
      and(
        eq(analysisCache.gameId, gameId),
        eq(analysisCache.analysisType, analysisType),
        eq(analysisCache.paramsHash, hash),
      ),
    );

  await db.insert(analysisCache).values({
    gameId,
    analysisType,
    paramsHash: hash,
    result,
    computedAt: new Date(),
    expiresAt: new Date(Date.now() + CACHE_TTL_MS),
  });
}

/**
 * Run the appropriate analysis, checking cache first.
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
  const hash = paramsHash(options);

  // Check cache
  const cached = await getCachedResult(gameId, analysisType, hash);
  if (cached) return cached;

  // Fetch game config
  const game = await fetchGame(gameId);
  if (!game) {
    throw new Error(`Game not found: ${gameId}`);
  }

  // Fetch draws
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

  // Cache the result
  await setCachedResult(gameId, analysisType, hash, result);

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
