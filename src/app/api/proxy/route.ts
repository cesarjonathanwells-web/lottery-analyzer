import { NextRequest } from "next/server";
import {
  fetchLatestResults,
  fetchHotNumbers,
  fetchRecentDraws,
  fetchAllLotteries,
  isSupported,
} from "@/lib/ebg-client";

/**
 * GET /api/proxy — Universal EBG proxy
 *
 * Query params:
 *   ?type=latest
 *     Returns all latest results across lotteries.
 *
 *   ?type=frequency&game=nacional
 *     Returns FrequencyResult[] for the given game (hot/cold analysis).
 *
 *   ?type=results&game=nacional&limit=20
 *     Returns Draw[] (recent draws) for the given game.
 *
 *   ?type=hot&game=nacional&days=30
 *     Returns hot/cold numbers (alias for frequency with custom days).
 *
 *   ?type=lotteries
 *     Returns all lottery info from EBG.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");

    if (!type) {
      return Response.json(
        {
          success: false,
          error:
            "Missing 'type' query parameter. Use: latest, frequency, results, hot, lotteries",
        },
        { status: 400 },
      );
    }

    switch (type) {
      // ── Latest results for all games ──────────────────────────────────
      case "latest": {
        const results = await fetchLatestResults();
        return Response.json({ success: true, data: results });
      }

      // ── Frequency analysis (FrequencyResult[]) ────────────────────────
      case "frequency": {
        const gameId = searchParams.get("game");
        if (!gameId) {
          return Response.json(
            { success: false, error: "Missing 'game' parameter" },
            { status: 400 },
          );
        }
        if (!isSupported(gameId)) {
          return Response.json(
            {
              success: false,
              error: `Game '${gameId}' is not supported by EBG API`,
            },
            { status: 400 },
          );
        }
        const days = parseInt(searchParams.get("days") ?? "90", 10);
        const frequencies = await fetchHotNumbers(gameId, days);
        return Response.json({ success: true, data: frequencies });
      }

      // ── Recent draws (Draw[]) ─────────────────────────────────────────
      case "results": {
        const gameId = searchParams.get("game");
        if (!gameId) {
          return Response.json(
            { success: false, error: "Missing 'game' parameter" },
            { status: 400 },
          );
        }
        if (!isSupported(gameId)) {
          return Response.json(
            {
              success: false,
              error: `Game '${gameId}' is not supported by EBG API`,
            },
            { status: 400 },
          );
        }
        const limit = parseInt(searchParams.get("limit") ?? "20", 10);
        // Fetch enough days to cover the requested limit
        // Most games draw daily, so days ~= limit. Add buffer.
        const days = Math.max(90, limit * 2);
        const draws = await fetchRecentDraws(gameId, days);
        // Trim to requested limit
        const trimmed = draws.slice(0, limit);
        return Response.json({ success: true, draws: trimmed, data: trimmed });
      }

      // ── Hot/cold numbers ──────────────────────────────────────────────
      case "hot": {
        const gameId = searchParams.get("game");
        if (!gameId) {
          return Response.json(
            { success: false, error: "Missing 'game' parameter" },
            { status: 400 },
          );
        }
        if (!isSupported(gameId)) {
          return Response.json(
            {
              success: false,
              error: `Game '${gameId}' is not supported by EBG API`,
            },
            { status: 400 },
          );
        }
        const days = parseInt(searchParams.get("days") ?? "30", 10);
        const frequencies = await fetchHotNumbers(gameId, days);
        // Split into hot and cold
        const hot = frequencies
          .filter((f) => f.classification === "hot")
          .map((f) => f.number);
        const cold = frequencies
          .filter((f) => f.classification === "cold")
          .map((f) => f.number);
        return Response.json({
          success: true,
          hot,
          cold,
          frequencies,
        });
      }

      // ── All lotteries info ────────────────────────────────────────────
      case "lotteries": {
        const lotteries = await fetchAllLotteries();
        return Response.json({ success: true, data: lotteries });
      }

      default:
        return Response.json(
          {
            success: false,
            error: `Unknown type '${type}'. Use: latest, frequency, results, hot, lotteries`,
          },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error("[proxy] Error:", err);
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
