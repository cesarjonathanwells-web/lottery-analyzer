import { type NextRequest } from "next/server";
import { runAnalysis } from "@/lib/analysis";
import type { AnalysisType } from "@/lib/types";

const VALID_TYPES: Set<string> = new Set([
  "frequency",
  "positional",
  "gap",
  "pattern",
  "pairs",
  "delta",
  "chi_square",
]);

/**
 * GET /api/analysis?game=powerball&type=frequency&draws=100&topN=20
 *
 * Query parameters:
 * - game  (required) — game slug, e.g. "powerball"
 * - type  (required) — analysis type: frequency | gap | pattern | pairs | delta | chi_square
 * - draws (optional) — limit to last N draws
 * - topN  (optional) — for pairs analysis, number of top pairs to return
 *
 * Now fetches draws from EBG API instead of a database.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const game = searchParams.get("game");
  const type = searchParams.get("type");
  const drawsParam = searchParams.get("draws");
  const topNParam = searchParams.get("topN");

  // ── Validation ────────────────────────────────────────────────────────────
  if (!game) {
    return Response.json(
      { error: "Missing required query parameter: game" },
      { status: 400 },
    );
  }

  if (!type) {
    return Response.json(
      { error: "Missing required query parameter: type" },
      { status: 400 },
    );
  }

  if (!VALID_TYPES.has(type)) {
    return Response.json(
      {
        error: `Invalid analysis type: ${type}. Valid types: ${[...VALID_TYPES].join(", ")}`,
      },
      { status: 400 },
    );
  }

  const drawCount = drawsParam ? parseInt(drawsParam, 10) : undefined;
  if (drawsParam && (isNaN(drawCount!) || drawCount! < 1)) {
    return Response.json(
      { error: "draws must be a positive integer" },
      { status: 400 },
    );
  }

  const topN = topNParam ? parseInt(topNParam, 10) : undefined;
  if (topNParam && (isNaN(topN!) || topN! < 1)) {
    return Response.json(
      { error: "topN must be a positive integer" },
      { status: 400 },
    );
  }

  // ── Execute Analysis ──────────────────────────────────────────────────────
  try {
    const result = await runAnalysis(game, type as AnalysisType, {
      drawCount,
      topN,
    });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    // Distinguish between user errors (game/draws not found) and server errors
    const isNotFound =
      message.includes("not found") || message.includes("No draws");
    const status = isNotFound ? 404 : 500;

    return Response.json({ error: message }, { status });
  }
}
