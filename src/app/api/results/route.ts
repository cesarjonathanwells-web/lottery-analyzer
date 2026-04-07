import { type NextRequest } from "next/server";
import { fetchDrawsPaginated } from "@/lib/analysis";

/**
 * GET /api/results?game=powerball&limit=50&offset=0&from=2024-01-01&to=2024-12-31
 *
 * Query parameters:
 * - game   (required) — game slug, e.g. "powerball"
 * - limit  (optional) — page size (default 50, max 200)
 * - offset (optional) — skip N results (default 0)
 * - from   (optional) — start date filter (YYYY-MM-DD)
 * - to     (optional) — end date filter (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const game = searchParams.get("game");
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // ── Validation ────────────────────────────────────────────────────────────
  if (!game) {
    return Response.json(
      { error: "Missing required query parameter: game" },
      { status: 400 },
    );
  }

  const limit = limitParam ? parseInt(limitParam, 10) : 50;
  if (isNaN(limit) || limit < 1 || limit > 200) {
    return Response.json(
      { error: "limit must be an integer between 1 and 200" },
      { status: 400 },
    );
  }

  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  if (isNaN(offset) || offset < 0) {
    return Response.json(
      { error: "offset must be a non-negative integer" },
      { status: 400 },
    );
  }

  // Validate date formats if provided
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (from && !dateRegex.test(from)) {
    return Response.json(
      { error: "from must be in YYYY-MM-DD format" },
      { status: 400 },
    );
  }
  if (to && !dateRegex.test(to)) {
    return Response.json(
      { error: "to must be in YYYY-MM-DD format" },
      { status: 400 },
    );
  }

  // ── Fetch Results ─────────────────────────────────────────────────────────
  try {
    const { draws, total } = await fetchDrawsPaginated(game, {
      limit,
      offset,
      from: from ?? undefined,
      to: to ?? undefined,
    });

    return Response.json({
      game,
      draws,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + draws.length < total,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    return Response.json({ error: message }, { status: 500 });
  }
}
