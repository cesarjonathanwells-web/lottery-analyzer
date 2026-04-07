import { fetchJson } from "./http";
import { log } from "./utils";
import type { ScrapedDraw, SodaGameDef } from "./types";

/**
 * SODA API game definitions for data.ny.gov datasets.
 */
export const SODA_GAMES: SodaGameDef[] = [
  {
    gameId: "powerball",
    endpoint: "https://data.ny.gov/resource/d6yy-54nr.json",
    dateField: "draw_date",
    numbersField: "winning_numbers",
    bonusField: undefined, // bonus is last number in winning_numbers string
    gameName: "Powerball",
  },
  {
    gameId: "mega-millions",
    endpoint: "https://data.ny.gov/resource/5xaw-6ayf.json",
    dateField: "draw_date",
    numbersField: "winning_numbers",
    bonusField: undefined, // bonus (Mega Ball) is last number in winning_numbers string
    gameName: "Mega Millions",
  },
  {
    gameId: "ny-lotto",
    endpoint: "https://data.ny.gov/resource/6nbc-h7bj.json",
    dateField: "draw_date",
    numbersField: "winning_numbers",
    bonusField: "bonus",
    gameName: "NY Lotto",
  },
  {
    gameId: "take-5",
    endpoint: "https://data.ny.gov/resource/dg63-4siq.json",
    dateField: "draw_date",
    numbersField: "winning_numbers",
    bonusField: undefined,
    gameName: "Take 5",
  },
];

interface SodaRow {
  [key: string]: string | undefined;
}

/**
 * Parse a SODA winning_numbers string into main numbers and bonus numbers.
 *
 * Powerball/Mega Millions: "01 02 03 04 05 06" -- last number is the bonus ball.
 * NY Lotto: "01 02 03 04 05 06" + separate "bonus" field.
 * Take 5: "01 02 03 04 05" -- no bonus.
 */
function parseWinningNumbers(
  raw: string,
  gameDef: SodaGameDef,
  row: SodaRow,
): { numbers: number[]; bonusNumbers: number[] } {
  const parts = raw.trim().split(/\s+/);
  const allNums = parts.map((p) => parseInt(p, 10)).filter((n) => !isNaN(n));

  // Games where the bonus ball is appended to the winning_numbers string
  if (
    (gameDef.gameId === "powerball" || gameDef.gameId === "mega-millions") &&
    allNums.length > 5
  ) {
    return {
      numbers: allNums.slice(0, allNums.length - 1),
      bonusNumbers: [allNums[allNums.length - 1]],
    };
  }

  // Games with a separate bonus field
  if (gameDef.bonusField && row[gameDef.bonusField]) {
    const bonus = parseInt(row[gameDef.bonusField] ?? "", 10);
    return {
      numbers: allNums,
      bonusNumbers: isNaN(bonus) ? [] : [bonus],
    };
  }

  return { numbers: allNums, bonusNumbers: [] };
}

/** Parse SODA date format (ISO or "YYYY-MM-DDT00:00:00.000") to YYYY-MM-DD. */
function parseSodaDate(raw: string): string {
  return raw.slice(0, 10);
}

export interface SodaFetchOptions {
  /** Maximum rows to fetch per request. Default 1000. */
  limit?: number;
  /** Offset for pagination. Default 0. */
  offset?: number;
  /** ISO date string (YYYY-MM-DD). Only fetch draws on or after this date. */
  sinceDate?: string;
}

/**
 * Fetch draws from a single SODA game endpoint.
 */
export async function fetchSodaGame(
  gameDef: SodaGameDef,
  options: SodaFetchOptions = {},
): Promise<ScrapedDraw[]> {
  const { limit = 1000, offset = 0, sinceDate } = options;

  let url = `${gameDef.endpoint}?$limit=${limit}&$offset=${offset}&$order=${gameDef.dateField} DESC`;

  if (sinceDate) {
    url += `&$where=${gameDef.dateField}>='${sinceDate}T00:00:00.000'`;
  }

  log(`SODA: fetching ${gameDef.gameName} (limit=${limit}, offset=${offset})`);

  const rows = await fetchJson<SodaRow[]>(url);

  const results: ScrapedDraw[] = [];

  for (const row of rows) {
    const dateRaw = row[gameDef.dateField];
    const numbersRaw = row[gameDef.numbersField];

    if (!dateRaw || !numbersRaw) continue;

    const drawDate = parseSodaDate(dateRaw);
    const { numbers, bonusNumbers } = parseWinningNumbers(
      numbersRaw,
      gameDef,
      row,
    );

    if (numbers.length === 0) continue;

    results.push({
      gameId: gameDef.gameId,
      drawDate,
      drawTime: null,
      drawPeriod: null,
      numbers,
      bonusNumbers,
      source: "data.ny.gov",
    });
  }

  log(`SODA: ${gameDef.gameName} returned ${results.length} draws`);
  return results;
}

/**
 * Fetch all pages of a SODA game dataset (auto-paginate).
 */
export async function fetchAllSodaGame(
  gameDef: SodaGameDef,
  options: Omit<SodaFetchOptions, "offset"> = {},
): Promise<ScrapedDraw[]> {
  const pageSize = options.limit ?? 1000;
  const all: ScrapedDraw[] = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await fetchSodaGame(gameDef, {
      ...options,
      limit: pageSize,
      offset,
    });
    all.push(...page);

    if (page.length < pageSize) break; // Last page
    offset += pageSize;
  }

  return all;
}

/**
 * Scrape all SODA games (Powerball, Mega Millions, NY Lotto, Take 5).
 * By default fetches only the most recent page (1000 rows) per game.
 */
export async function scrapeSoda(
  options: SodaFetchOptions = {},
): Promise<ScrapedDraw[]> {
  const results: ScrapedDraw[] = [];

  for (const gameDef of SODA_GAMES) {
    try {
      const draws = await fetchSodaGame(gameDef, options);
      results.push(...draws);
    } catch (err) {
      log(
        `SODA "${gameDef.gameName}" error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return results;
}

export default scrapeSoda;
