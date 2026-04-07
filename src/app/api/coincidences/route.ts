import { type NextRequest } from "next/server";
import { fetchRecentDraws } from "@/lib/ebg-client";
import { findCoincidences } from "@/lib/analysis/coincidences";
import { findRepeatedNumbers } from "@/lib/analysis/repeated";

/**
 * POST /api/coincidences
 * Body: { gameId, referenceNumbers, minMatches? }
 *
 * Returns CoincidenceResult
 *
 * Now fetches draws from EBG API and passes them to pure analysis functions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { gameId, referenceNumbers, minMatches } = body;

    if (!gameId || typeof gameId !== "string") {
      return Response.json(
        { error: "Missing or invalid required field: gameId" },
        { status: 400 },
      );
    }

    if (
      !referenceNumbers ||
      !Array.isArray(referenceNumbers) ||
      referenceNumbers.length === 0
    ) {
      return Response.json(
        { error: "referenceNumbers must be a non-empty array of numbers" },
        { status: 400 },
      );
    }

    // Validate each number
    for (const n of referenceNumbers) {
      if (typeof n !== "number" || !Number.isFinite(n)) {
        return Response.json(
          { error: `Invalid number in referenceNumbers: ${n}` },
          { status: 400 },
        );
      }
    }

    const parsedMinMatches = minMatches ? Number(minMatches) : undefined;
    if (parsedMinMatches !== undefined && (isNaN(parsedMinMatches) || parsedMinMatches < 1)) {
      return Response.json(
        { error: "minMatches must be a positive integer" },
        { status: 400 },
      );
    }

    // Fetch draws from EBG
    const draws = await fetchRecentDraws(gameId, 365);

    const result = findCoincidences({
      draws,
      referenceNumbers,
      minMatches: parsedMinMatches,
    });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const isNotFound =
      message.includes("not found") || message.includes("No draws");
    return Response.json({ error: message }, { status: isNotFound ? 404 : 500 });
  }
}

/**
 * GET /api/coincidences/repeated?game=powerball&lookback=50&reversed=false
 *
 * Returns RepeatedResult — numbers that appear in consecutive draws.
 * Note: This is bundled here to keep route count manageable.
 *
 * Now fetches draws from EBG API and passes them to pure analysis functions.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const gameId = searchParams.get("game");

  if (!gameId) {
    return Response.json(
      { error: "Missing required query parameter: game" },
      { status: 400 },
    );
  }

  const lookback = searchParams.get("lookback");
  const reversed = searchParams.get("reversed");

  const lookbackDraws = lookback ? parseInt(lookback, 10) : 50;
  if (isNaN(lookbackDraws) || lookbackDraws < 1) {
    return Response.json(
      { error: "lookback must be a positive integer" },
      { status: 400 },
    );
  }

  const includeReversed = reversed === "true";

  try {
    // Fetch draws from EBG (get more than lookback to ensure coverage)
    const draws = await fetchRecentDraws(gameId, Math.max(lookbackDraws * 2, 180));

    const result = findRepeatedNumbers(
      draws,
      lookbackDraws,
      includeReversed,
    );

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const isNotFound =
      message.includes("not found") || message.includes("No draws");
    return Response.json({ error: message }, { status: isNotFound ? 404 : 500 });
  }
}
