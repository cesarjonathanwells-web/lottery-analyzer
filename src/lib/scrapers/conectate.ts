import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { getToday, getNowEST, cachedFetch, padNumbers, log } from "./utils";
import type { ScrapedDraw, ScraperConfig, DrawConfig } from "./types";

const PAGE_URL = "https://www.conectate.com.do/loterias/";
const CACHE_TTL = 30_000;

interface GameResult {
  numbers: string[];
  date: string | null;
  closed: boolean;
}

type GameMap = Record<string, GameResult>;

/**
 * Fetch and parse all game blocks from a conectate.com.do page.
 */
async function fetchGames(url: string): Promise<GameMap> {
  return cachedFetch<GameMap>(`conectate:${url}`, CACHE_TTL, async () => {
    const html = await fetchPage(url);
    if (!html) return {};
    const $ = cheerio.load(html);
    const results: GameMap = {};

    $(".game-block").each((_, block) => {
      const $block = $(block);
      const titleEl = $block.find(".game-title span");
      if (!titleEl.length) return;

      const gameName = titleEl.text().trim();
      const dateRaw = $block.find(".session-date").text().trim();
      const closed =
        $block.find(".session-badge").first().text().trim() ===
        "No Sorteo Hoy";

      const numbers: string[] = [];
      $block.find(".game-scores span.score").each((_, s) => {
        const num = $(s).text().trim();
        if (num) numbers.push(num);
      });

      // Convert dd-mm or dd-mm-yyyy to YYYY-MM-DD
      let date: string | null = null;
      if (dateRaw) {
        const parts = dateRaw.split("-").map(Number);
        if (parts.length === 2 && parts[0] && parts[1]) {
          const year = getNowEST().getFullYear();
          date = `${year}-${String(parts[1]).padStart(2, "0")}-${String(parts[0]).padStart(2, "0")}`;
        } else if (
          parts.length === 3 &&
          parts[0] &&
          parts[1] &&
          parts[2]
        ) {
          date = `${parts[2]}-${String(parts[1]).padStart(2, "0")}-${String(parts[0]).padStart(2, "0")}`;
        }
      }

      if (numbers.length > 0 || closed) {
        results[gameName] = { numbers, date, closed };
      }
    });

    return results;
  });
}

/** Fuzzy game-name match. */
function findGame(
  gameName: string,
  allGames: GameMap,
): GameResult | null {
  if (allGames[gameName]) return allGames[gameName];
  const key = Object.keys(allGames).find(
    (k) =>
      k.toLowerCase().includes(gameName.toLowerCase()) ||
      gameName.toLowerCase().includes(k.toLowerCase()),
  );
  return key ? allGames[key] : null;
}

/** Format numbers for pick3 output. */
function formatPick3(numbers: string[]): number[] {
  return padNumbers(numbers.slice(0, 3)).map((n) => parseInt(n, 10));
}

/**
 * Scrape a single draw from conectate.
 */
async function scrapeDraw(
  scraperConfig: ScraperConfig,
  drawConfig: DrawConfig,
): Promise<ScrapedDraw | null> {
  const url = scraperConfig.pageUrl
    ? "https://www.conectate.com.do" + scraperConfig.pageUrl
    : PAGE_URL;

  const allGames = await fetchGames(url);

  // Combined pick3+pick4 mode (e.g. King Lottery)
  if (drawConfig.pick3Name && drawConfig.pick4Name) {
    const p3game = findGame(drawConfig.pick3Name, allGames);
    const p4game = findGame(drawConfig.pick4Name, allGames);

    if (!p3game && !p4game) return null;
    if ((p3game && p3game.closed) || (p4game && p4game.closed)) {
      return null; // Draw not happening today
    }

    const p3 =
      p3game && p3game.numbers.length > 0 ? p3game.numbers : null;
    const p4 =
      p4game && p4game.numbers.length > 0 ? p4game.numbers : null;
    if (!p3 && !p4) return null;

    const numbers: number[] = [];
    if (p3) numbers.push(...p3.map((n) => parseInt(n, 10)));
    if (p4) numbers.push(...p4.map((n) => parseInt(n, 10)));

    const date =
      (p3game && p3game.date) || (p4game && p4game.date) || getToday();

    log(
      `${scraperConfig.lotteryId} "${drawConfig.time}" source date: ${date}`,
    );

    return {
      gameId: scraperConfig.lotteryId,
      drawDate: date,
      drawTime: drawConfig.time,
      drawPeriod: null,
      numbers,
      bonusNumbers: [],
      source: "conectate",
    };
  }

  // Single game mode
  const gameName = drawConfig.gameName;
  if (!gameName) return null;

  const game = findGame(gameName, allGames);
  if (!game) return null;
  if (game.closed) return null;
  if (!game.numbers || game.numbers.length === 0) return null;

  const format = scraperConfig.format ?? "pick3";
  const numbers =
    format === "pick3"
      ? formatPick3(game.numbers)
      : game.numbers.map((n) => parseInt(n, 10));

  log(
    `${scraperConfig.lotteryId} "${gameName}" source date: ${game.date}`,
  );

  return {
    gameId: scraperConfig.lotteryId,
    drawDate: game.date ?? getToday(),
    drawTime: drawConfig.time,
    drawPeriod: null,
    numbers,
    bonusNumbers: [],
    source: "conectate",
  };
}

/**
 * Scrape all configured Conectate draws for a lottery.
 */
export async function scrapeConectate(
  config: ScraperConfig,
): Promise<ScrapedDraw[]> {
  const results: ScrapedDraw[] = [];
  const isSundayNow = getNowEST().getDay() === 0;

  for (const drawConfig of config.draws) {
    if (drawConfig.skipSunday && isSundayNow) continue;

    // Use Sunday time when applicable
    const effectiveConfig: DrawConfig = { ...drawConfig };
    if (isSundayNow && drawConfig.sundayTime) {
      effectiveConfig.time = drawConfig.sundayTime;
    }

    try {
      const result = await scrapeDraw(config, effectiveConfig);
      if (result) results.push(result);
    } catch (err) {
      log(
        `conectate "${config.lotteryId}" error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return results;
}

export default scrapeConectate;
