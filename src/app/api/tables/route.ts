import { type NextRequest } from "next/server";
import { fetchRecentDraws } from "@/lib/ebg-client";
import { computeHotTable } from "@/lib/analysis/hot-table";
import { computeTerminals } from "@/lib/analysis/terminals";
import { computeSuccession } from "@/lib/analysis/succession";
import { computeWeeklyGrid } from "@/lib/analysis/weekly";

const VALID_TYPES = new Set(["hot", "terminals", "succession", "weekly"]);

/**
 * GET /api/tables?type=hot&game=xxx&days=30&limit=10&position=0
 * GET /api/tables?type=terminals&game=xxx&draws=100
 * GET /api/tables?type=succession&game=xxx&number=42&draws=200
 * GET /api/tables?type=weekly&game=xxx&position=0
 *
 * Now fetches draws from EBG API and passes them to pure analysis functions.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const type = sp.get("type");
  const game = sp.get("game");

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
        error: `Invalid table type: ${type}. Valid types: ${[...VALID_TYPES].join(", ")}`,
      },
      { status: 400 },
    );
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  try {
    switch (type) {
      case "hot": {
        const days = parseInt(sp.get("days") ?? "30", 10);
        const limit = parseInt(sp.get("limit") ?? "10", 10);
        const position = parseInt(sp.get("position") ?? "0", 10);

        if (isNaN(days) || days < 1) {
          return Response.json(
            { error: "days must be a positive integer" },
            { status: 400 },
          );
        }

        // Fetch enough draws to cover the requested window
        const draws = await fetchRecentDraws(game, Math.max(days, 90));
        const result = computeHotTable({
          draws,
          days,
          limit,
          position,
        });
        return Response.json(result);
      }

      case "terminals": {
        const drawsParam = sp.get("draws")
          ? parseInt(sp.get("draws")!, 10)
          : undefined;
        if (sp.get("draws") && (isNaN(drawsParam!) || drawsParam! < 1)) {
          return Response.json(
            { error: "draws must be a positive integer" },
            { status: 400 },
          );
        }
        const draws = await fetchRecentDraws(game, 365);
        const result = computeTerminals(draws, drawsParam);
        return Response.json(result);
      }

      case "succession": {
        const numberParam = sp.get("number");
        if (!numberParam) {
          return Response.json(
            { error: "Missing required query parameter: number" },
            { status: 400 },
          );
        }
        const targetNumber = parseInt(numberParam, 10);
        if (isNaN(targetNumber)) {
          return Response.json(
            { error: "number must be an integer" },
            { status: 400 },
          );
        }
        const drawsParam = sp.get("draws")
          ? parseInt(sp.get("draws")!, 10)
          : undefined;
        const days = drawsParam ? Math.max(drawsParam * 2, 180) : 365;
        const draws = await fetchRecentDraws(game, days);
        const drawList = drawsParam ? draws.slice(0, drawsParam) : draws;
        const result = computeSuccession(drawList, targetNumber);
        return Response.json(result);
      }

      case "weekly": {
        const position = sp.get("position")
          ? parseInt(sp.get("position")!, 10)
          : undefined;
        const draws = await fetchRecentDraws(game, 365);
        const result = computeWeeklyGrid(draws, position);
        return Response.json(result);
      }

      default:
        return Response.json({ error: "Unknown type" }, { status: 400 });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const isNotFound =
      message.includes("not found") || message.includes("No draws");
    return Response.json({ error: message }, { status: isNotFound ? 404 : 500 });
  }
}
