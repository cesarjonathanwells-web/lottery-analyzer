import { type NextRequest } from "next/server";
import {
  generateNumbers,
  type GeneratorConfig,
  type Strategy,
} from "@/lib/generator/engine";
import { runAnalysis, fetchGame } from "@/lib/analysis";
import type { FrequencyResult } from "@/lib/types";

const VALID_STRATEGIES: Set<string> = new Set([
  "balanced",
  "hot_bias",
  "cold_bias",
  "delta",
  "random",
]);

/**
 * POST /api/generate
 *
 * Body: GeneratorConfig
 * Returns: GeneratedSet[]
 */
export async function POST(request: NextRequest) {
  let body: GeneratorConfig;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!body.gameId) {
    return Response.json(
      { error: "Missing required field: gameId" },
      { status: 400 },
    );
  }

  if (!body.strategy || !VALID_STRATEGIES.has(body.strategy)) {
    return Response.json(
      {
        error: `Invalid strategy: ${body.strategy}. Valid: ${[...VALID_STRATEGIES].join(", ")}`,
      },
      { status: 400 },
    );
  }

  if (!body.count || body.count < 1 || body.count > 10) {
    return Response.json(
      { error: "count must be between 1 and 10" },
      { status: 400 },
    );
  }

  // ── Fetch game config ───────────────────────────────────────────────────────
  const game = await fetchGame(body.gameId);
  if (!game) {
    return Response.json(
      { error: `Game not found: ${body.gameId}` },
      { status: 404 },
    );
  }

  // ── Fetch frequency data ────────────────────────────────────────────────────
  let frequencies: FrequencyResult[] = [];

  try {
    const analysisResult = await runAnalysis(body.gameId, "frequency");
    if (analysisResult.payload.type === "frequency") {
      frequencies = analysisResult.payload.data;
    }
  } catch {
    // If no draws exist, we can still generate random numbers
    // Build a synthetic frequency list with equal counts
    const minNumber = game.gameType.startsWith("pick") ? 0 : 1;
    frequencies = [];
    for (let i = minNumber; i <= game.numberRange; i++) {
      frequencies.push({
        number: i,
        count: 1,
        percentage: 0,
        classification: "warm",
        lastSeen: null,
        gapCurrent: 0,
        gapAverage: 0,
      });
    }
  }

  // ── Determine bonus range ───────────────────────────────────────────────────
  // Powerball bonus range is 26, Mega Millions is 25
  let bonusRange: number | undefined;
  if (game.gameType === "powerball") {
    bonusRange = 26;
  } else if (game.gameType === "mega") {
    bonusRange = 25;
  }

  // ── Generate ────────────────────────────────────────────────────────────────
  try {
    const sets = generateNumbers(
      body,
      frequencies,
      game.numberRange,
      game.ballsDrawn,
      game.bonusBalls,
      bonusRange,
    );

    return Response.json({
      gameId: game.id,
      gameName: game.name,
      strategy: body.strategy,
      sets,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
