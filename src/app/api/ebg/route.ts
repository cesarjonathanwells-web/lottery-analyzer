import { NextRequest } from "next/server";
import {
  scrapeEBGLatest,
  scrapeEBGHistory,
  fetchEBGHotNumbers,
  fetchEBGFrequency,
} from "@/lib/scrapers/elboletoganador";

/**
 * GET /api/ebg
 *
 * Proxies and exposes EBG API data.
 *
 * Query params:
 *   ?action=latest              — fetch all latest results
 *   ?action=hot&loteria=X&days=30  — fetch hot numbers for a lottery
 *   ?action=frequency&loteria=X&position=0 — fetch frequency table
 *   ?action=history&loteria=X&days=90      — fetch historical draws
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get("action");

    if (!action) {
      return Response.json(
        {
          success: false,
          error: "Missing 'action' query parameter. Use: latest, hot, frequency, history",
        },
        { status: 400 },
      );
    }

    switch (action) {
      case "latest": {
        const draws = await scrapeEBGLatest();
        return Response.json({ success: true, draws });
      }

      case "hot": {
        const loteriaId = parseInt(searchParams.get("loteria") ?? "", 10);
        if (isNaN(loteriaId)) {
          return Response.json(
            { success: false, error: "Missing or invalid 'loteria' parameter" },
            { status: 400 },
          );
        }
        const days = parseInt(searchParams.get("days") ?? "30", 10);
        const result = await fetchEBGHotNumbers(loteriaId, days);
        return Response.json({ success: true, ...result });
      }

      case "frequency": {
        const loteriaId = parseInt(searchParams.get("loteria") ?? "", 10);
        if (isNaN(loteriaId)) {
          return Response.json(
            { success: false, error: "Missing or invalid 'loteria' parameter" },
            { status: 400 },
          );
        }
        const position = parseInt(searchParams.get("position") ?? "0", 10);
        const result = await fetchEBGFrequency(loteriaId, position);
        return Response.json({ success: true, ...result });
      }

      case "history": {
        const loteriaId = parseInt(searchParams.get("loteria") ?? "", 10);
        if (isNaN(loteriaId)) {
          return Response.json(
            { success: false, error: "Missing or invalid 'loteria' parameter" },
            { status: 400 },
          );
        }
        const days = parseInt(searchParams.get("days") ?? "90", 10);
        const draws = await scrapeEBGHistory(loteriaId, days);
        return Response.json({ success: true, draws });
      }

      default:
        return Response.json(
          {
            success: false,
            error: `Unknown action '${action}'. Use: latest, hot, frequency, history`,
          },
          { status: 400 },
        );
    }
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
