import { scrapeAnguilla } from "./anguilla";
import { scrapeConectate } from "./conectate";
import { scrapeOcean } from "./ocean";
import { scrapeLotterycoast } from "./lotterycoast";
import { scrapeSoda, SODA_GAMES, fetchSodaGame } from "./soda";
import { scrapeEBGLatest, EBG_TO_GAME_ID } from "./elboletoganador";
import { SCRAPER_CONFIG } from "./scraper-config";
import { log } from "./utils";
import type { ScrapedDraw, ScraperConfig } from "./types";

export type { ScrapedDraw } from "./types";
export { scrapeEBGLatest } from "./elboletoganador";

// ---------------------------------------------------------------------------
// Scraper dispatch: maps source names to their scraper functions.
// Each function receives the ScraperConfig and returns ScrapedDraw[].
// ---------------------------------------------------------------------------

type ScraperFn = (config: ScraperConfig) => Promise<ScrapedDraw[]>;

const SCRAPERS: Record<string, ScraperFn> = {
  anguilla: scrapeAnguilla,
  conectate: scrapeConectate,
  ocean: scrapeOcean,
  lotterycoast: scrapeLotterycoast,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScrapeResult {
  draws: ScrapedDraw[];
  errors: string[];
  elapsedMs: number;
}

/**
 * Run all configured web scrapers (anguilla, conectate, ocean, lotterycoast).
 * One failing scraper does not stop the others.
 */
export async function scrapeAll(): Promise<ScrapeResult> {
  const startMs = Date.now();
  const allDraws: ScrapedDraw[] = [];
  const errors: string[] = [];

  log("scrapeAll: started");

  const promises = SCRAPER_CONFIG.scrapers.map(async (scraperConfig) => {
    const fn = SCRAPERS[scraperConfig.source];
    if (!fn) {
      log(`scrapeAll: no scraper for source "${scraperConfig.source}", skipping ${scraperConfig.lotteryId}`);
      return;
    }

    try {
      const draws = await fn(scraperConfig);
      allDraws.push(...draws);
    } catch (err) {
      const msg = `${scraperConfig.lotteryId}: ${err instanceof Error ? err.message : String(err)}`;
      log(`scrapeAll error: ${msg}`);
      errors.push(msg);
    }
  });

  await Promise.all(promises);

  const elapsedMs = Date.now() - startMs;
  log(`scrapeAll: done in ${(elapsedMs / 1000).toFixed(1)}s — ${allDraws.length} draws, ${errors.length} errors`);

  return { draws: allDraws, errors, elapsedMs };
}

/**
 * Run a scraper for a single game by its lotteryId (e.g. "anguilla", "newyork")
 * or a SODA gameId (e.g. "powerball", "mega-millions").
 */
export async function scrapeGame(gameId: string): Promise<ScrapeResult> {
  const startMs = Date.now();
  const draws: ScrapedDraw[] = [];
  const errors: string[] = [];

  // Check SODA games first
  const sodaDef = SODA_GAMES.find((g) => g.gameId === gameId);
  if (sodaDef) {
    try {
      const sodaDraws = await fetchSodaGame(sodaDef, { limit: 100 });
      draws.push(...sodaDraws);
    } catch (err) {
      errors.push(
        `${gameId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { draws, errors, elapsedMs: Date.now() - startMs };
  }

  // Check web scrapers
  const scraperConfig = SCRAPER_CONFIG.scrapers.find(
    (s) => s.lotteryId === gameId,
  );
  if (!scraperConfig) {
    errors.push(`No scraper configured for game "${gameId}"`);
    return { draws, errors, elapsedMs: Date.now() - startMs };
  }

  const fn = SCRAPERS[scraperConfig.source];
  if (!fn) {
    errors.push(
      `No scraper implementation for source "${scraperConfig.source}"`,
    );
    return { draws, errors, elapsedMs: Date.now() - startMs };
  }

  try {
    const result = await fn(scraperConfig);
    draws.push(...result);
  } catch (err) {
    errors.push(
      `${gameId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { draws, errors, elapsedMs: Date.now() - startMs };
}

/**
 * Scrape all SODA API games (Powerball, Mega Millions, NY Lotto, Take 5).
 */
export async function scrapeAllSoda(
  options: { sinceDate?: string; limit?: number } = {},
): Promise<ScrapeResult> {
  const startMs = Date.now();
  const errors: string[] = [];

  let draws: ScrapedDraw[] = [];
  try {
    draws = await scrapeSoda(options);
  } catch (err) {
    errors.push(
      `SODA: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { draws, errors, elapsedMs: Date.now() - startMs };
}

/**
 * Scrape all latest results from the EBG API (elboletoganador.com).
 * Covers ~49 lotteries in a single request.
 */
export async function scrapeAllEBG(): Promise<ScrapeResult> {
  const startMs = Date.now();
  const errors: string[] = [];

  let draws: ScrapedDraw[] = [];
  try {
    draws = await scrapeEBGLatest();
  } catch (err) {
    errors.push(
      `EBG: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { draws, errors, elapsedMs: Date.now() - startMs };
}

/**
 * List all available game IDs (web scrapers, SODA, and EBG).
 */
export function listAvailableGames(): string[] {
  const webGames = SCRAPER_CONFIG.scrapers.map((s) => s.lotteryId);
  const sodaGames = SODA_GAMES.map((g) => g.gameId);
  const ebgGames = [
    ...new Set(
      Object.values(EBG_TO_GAME_ID).map((m) => m.gameId),
    ),
  ];
  return [...new Set([...webGames, ...sodaGames, ...ebgGames])];
}
