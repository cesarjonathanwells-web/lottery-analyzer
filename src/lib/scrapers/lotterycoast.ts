import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { hasTimePassed, isToday, cachedFetch, log } from "./utils";
import type { ScrapedDraw, ScraperConfig, DrawConfig } from "./types";

const BASE_URL = "https://lotterycoast.com/lottery-results";

const STATE_URLS: Record<string, string> = {
  ny: `${BASE_URL}/new-york/`,
  fl: `${BASE_URL}/florida/`,
  ga: `${BASE_URL}/georgia/`,
  nj: `${BASE_URL}/new-jersey/`,
  ct: `${BASE_URL}/connecticut/`,
};

interface GameNames {
  pick2?: string;
  pick3?: string;
  pick4?: string;
}

const GAME_MAP: Record<string, Record<string, GameNames>> = {
  ny: {
    midday: { pick3: "Numbers Midday", pick4: "Win 4 Midday" },
    evening: { pick3: "Numbers Evening", pick4: "Win 4 Evening" },
  },
  fl: {
    midday: {
      pick2: "Pick 2 Midday",
      pick3: "Pick 3 Midday",
      pick4: "Pick 4 Midday",
    },
    evening: {
      pick2: "Pick 2 Evening",
      pick3: "Pick 3 Evening",
      pick4: "Pick 4 Evening",
    },
  },
  ga: {
    midday: { pick3: "Cash 3 Midday", pick4: "Cash 4 Midday" },
    evening: { pick3: "Cash 3 Evening", pick4: "Cash 4 Evening" },
    night: { pick3: "Cash 3 Night", pick4: "Cash 4 Night" },
  },
  nj: {
    midday: { pick3: "Pick 3 Midday", pick4: "Pick 4 Midday" },
    evening: { pick3: "Pick 3 Evening", pick4: "Pick 4 Evening" },
  },
  ct: {
    day: { pick3: "Play 3 Day", pick4: "Play 4 Day" },
    night: { pick3: "Play 3 Night", pick4: "Play 4 Night" },
  },
};

const CACHE_TTL = 30_000;

interface GameDigits {
  digits: string[];
  date: string;
}

type StateData = Record<string, GameDigits>;

/**
 * Scrape all game results for a given US state.
 */
async function scrapeState(state: string): Promise<StateData> {
  const url = STATE_URLS[state];
  if (!url) return {};

  return cachedFetch<StateData>(
    `lotterycoast:${state}`,
    CACHE_TTL,
    async () => {
      const html = await fetchPage(url);
      if (!html) return {};
      const $ = cheerio.load(html);
      const results: StateData = {};
      let currentDate = "";

      // Walk DOM in order -- date headers precede their result rows
      $("time[datetime], div.row.my-3").each((_, el) => {
        const $el = $(el);
        if ($el.is("time[datetime]")) {
          currentDate = $el.attr("datetime") ?? "";
        } else {
          const label = $el.find("strong.fs-6").text().trim();
          if (!label) return;
          const digits: string[] = [];
          $el
            .find("span.draw-digit")
            .not(".bg-gradient-warning")
            .each((_, d) => {
              digits.push($(d).text().trim());
            });
          if (digits.length > 0) {
            results[label] = { digits, date: currentDate };
          }
        }
      });

      return results;
    },
  );
}

function getDigits(
  data: StateData,
  name: string,
): string[] | null {
  return data[name] ? data[name].digits : null;
}

function getResultDate(
  data: StateData,
  gameMap: GameNames,
): string | null {
  for (const name of Object.values(gameMap)) {
    if (name && data[name]) return data[name].date;
  }
  return null;
}

interface CombinedNumbers {
  numbers: number[];
  parts: string[][];
}

/**
 * Combine pick2/pick3/pick4 results into a single numbers array.
 * Requires all expected parts to be present before returning (prevents
 * publishing partial results when the source updates games at different times).
 */
function combineNumbers(
  gameMap: GameNames,
  data: StateData,
  format: string,
): CombinedNumbers | null {
  if (format === "florida") {
    const p2 = gameMap.pick2 ? getDigits(data, gameMap.pick2) : null;
    const p3 = gameMap.pick3 ? getDigits(data, gameMap.pick3) : null;
    const p4 = gameMap.pick4 ? getDigits(data, gameMap.pick4) : null;
    // Require all parts before returning
    if (!p2 || !p3 || !p4) return null;
    return {
      numbers: [...p2, ...p3, ...p4].map((d) => parseInt(d, 10)),
      parts: [p2, p3, p4],
    };
  }

  const p3 = gameMap.pick3 ? getDigits(data, gameMap.pick3) : null;
  const p4 = gameMap.pick4 ? getDigits(data, gameMap.pick4) : null;
  // Require both pick3 and pick4 before returning
  if (!p3 || !p4) return null;
  return {
    numbers: [...p3, ...p4].map((d) => parseInt(d, 10)),
    parts: [p3, p4],
  };
}

/**
 * Scrape a single draw from lotterycoast for a US state lottery.
 */
async function scrapeDraw(
  scraperConfig: ScraperConfig,
  drawConfig: DrawConfig,
): Promise<ScrapedDraw | null> {
  const state = scraperConfig.state;
  if (!state) return null;

  const format = scraperConfig.format ?? "pick34";
  const data = await scrapeState(state);

  const session = drawConfig.session;
  if (!session) return null;

  const gameMap = GAME_MAP[state]?.[session];
  if (!gameMap) return null;

  const date = getResultDate(data, gameMap);

  // If today's results exist but draw time hasn't passed, don't return them
  if (
    isToday(date) &&
    drawConfig.time &&
    !hasTimePassed(drawConfig.time)
  ) {
    return null;
  }

  const combined = combineNumbers(gameMap, data, format);
  if (!combined) return null;

  log(`${scraperConfig.lotteryId} "${drawConfig.time}" source date: ${date}`);

  // Determine draw period from session name
  let drawPeriod: string | null = null;
  if (session === "midday" || session === "day") drawPeriod = "midday";
  else if (session === "evening") drawPeriod = "evening";
  else if (session === "night") drawPeriod = "night";

  return {
    gameId: scraperConfig.lotteryId,
    drawDate: date ?? "",
    drawTime: drawConfig.time,
    drawPeriod,
    numbers: combined.numbers,
    bonusNumbers: [],
    source: "lotterycoast",
  };
}

/**
 * Scrape all configured draws for a US state lottery.
 */
export async function scrapeLotterycoast(
  config: ScraperConfig,
): Promise<ScrapedDraw[]> {
  const results: ScrapedDraw[] = [];

  for (const drawConfig of config.draws) {
    try {
      const result = await scrapeDraw(config, drawConfig);
      if (result) results.push(result);
    } catch (err) {
      log(
        `lotterycoast "${config.lotteryId}" error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return results;
}

export default scrapeLotterycoast;
