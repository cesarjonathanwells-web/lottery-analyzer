import { NextRequest, NextResponse } from "next/server";
import {
  scrapeAll,
  scrapeGame,
  scrapeAllSoda,
  listAvailableGames,
} from "@/lib/scrapers";
import type { ScrapedDraw } from "@/lib/scrapers";

interface ScrapeResponse {
  success: boolean;
  results: ScrapedDraw[];
  errors: string[];
  elapsedMs?: number;
  availableGames?: string[];
}

/**
 * GET /api/scrape
 * Returns scraper status and available game IDs.
 */
export async function GET(): Promise<NextResponse<ScrapeResponse>> {
  return NextResponse.json({
    success: true,
    results: [],
    errors: [],
    availableGames: listAvailableGames(),
  });
}

/**
 * POST /api/scrape
 * Triggers a scrape run.
 *
 * Query params:
 *   ?game=<gameId>   — scrape a single game (e.g. "anguilla", "powerball")
 *   ?source=soda     — scrape all SODA API games
 *   (no params)      — scrape all web scrapers
 *
 * Body (optional JSON):
 *   { sinceDate?: string, limit?: number }  — passed to SODA scraper
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ScrapeResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const game = searchParams.get("game");
    const source = searchParams.get("source");

    // Parse optional body for SODA options
    let body: { sinceDate?: string; limit?: number } = {};
    try {
      body = await request.json();
    } catch {
      // No body or invalid JSON is fine
    }

    let result;

    if (game) {
      // Scrape a specific game
      result = await scrapeGame(game);
    } else if (source === "soda") {
      // Scrape all SODA API games
      result = await scrapeAllSoda({
        sinceDate: body.sinceDate,
        limit: body.limit,
      });
    } else {
      // Scrape all web scrapers
      result = await scrapeAll();
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      results: result.draws,
      errors: result.errors,
      elapsedMs: result.elapsedMs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        results: [],
        errors: [err instanceof Error ? err.message : String(err)],
      },
      { status: 500 },
    );
  }
}
