import { type NextRequest } from "next/server";
import { findDayLikeToday } from "@/lib/analysis/day-like-today";

/**
 * GET /api/day-like-today?month=4&day=7&game=optional
 *
 * Returns DayLikeTodayResult
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
    const result = await findDayLikeToday(month, day, gameId);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
