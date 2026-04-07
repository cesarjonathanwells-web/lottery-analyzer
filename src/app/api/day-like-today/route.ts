import { type NextRequest } from "next/server";
import { fetchRecentDraws, isSupported } from "@/lib/ebg-client";
import { findDayLikeToday } from "@/lib/analysis/day-like-today";
import { GAMES } from "@/lib/games";
import type { Draw } from "@/lib/types";

/**
 * GET /api/day-like-today?month=4&day=7&game=optional
 *
 * Returns DayLikeTodayResult
 *
 * Now fetches draws from EBG API for supported games and filters by date in memory.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const monthStr = searchParams.get("month");
  const dayStr = searchParams.get("day");
  const gameId = searchParams.get("game") || undefined;

  if (!monthStr || !dayStr) {
    return Response.json(
      { error: "Missing required query parameters: month, day" },
      { status: 400 },
    );
  }

  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(month) || month < 1 || month > 12) {
    return Response.json(
      { error: "month must be between 1 and 12" },
      { status: 400 },
    );
  }

  if (isNaN(day) || day < 1 || day > 31) {
    return Response.json(
      { error: "day must be between 1 and 31" },
      { status: 400 },
    );
  }

  try {
    let allDraws: Draw[] = [];

    if (gameId) {
      // Fetch draws for a specific game
      if (!isSupported(gameId)) {
        return Response.json(
          { error: `Game '${gameId}' is not supported by EBG API` },
          { status: 400 },
        );
      }
      allDraws = await fetchRecentDraws(gameId, 365);
    } else {
      // Fetch draws across all supported games
      const supportedGames = GAMES.filter((g) => isSupported(g.id));
      const results = await Promise.allSettled(
        supportedGames.map((g) => fetchRecentDraws(g.id, 365)),
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          allDraws.push(...result.value);
        }
      }
    }

    const result = findDayLikeToday(allDraws, month, day, gameId);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
