import { type NextRequest } from "next/server";
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

        const result = await computeHotTable({
          gameId: game,
          days,
          limit,
          position,
        });
        return Response.json(result);
      }

      case "terminals": {
        const draws = sp.get("draws")
          ? parseInt(sp.get("draws")!, 10)
          : undefined;
        if (sp.get("draws") && (isNaN(draws!) || draws! < 1)) {
          return Response.json(
            { error: "draws must be a positive integer" },
            { status: 400 },
          );
        }
        const result = await computeTerminals(game, draws);
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
        const draws = sp.get("draws")
          ? parseInt(sp.get("draws")!, 10)
          : undefined;
        const result = await computeSuccession(game, targetNumber, draws);
        return Response.json(result);
      }

      case "weekly": {
        const position = sp.get("position")
          ? parseInt(sp.get("position")!, 10)
          : undefined;
        const result = await computeWeeklyGrid(game, position);
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
