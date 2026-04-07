import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { getToday, padNumbers, log } from "./utils";
import type { ScrapedDraw, ScraperConfig, DrawConfig } from "./types";

const BASE_URL = "https://enloteria.com/resultados-anguilla-";

const TIME_TO_SLUG: Record<string, string> = {
  "8:00 AM": "8am",
  "9:00 AM": "9am",
  "10:00 AM": "10am",
  "11:00 AM": "11am",
  "12:00 PM": "12pm",
  "1:00 PM": "1pm",
  "2:00 PM": "2pm",
  "3:00 PM": "3pm",
  "4:00 PM": "4pm",
  "5:00 PM": "5pm",
  "6:00 PM": "6pm",
  "7:00 PM": "7pm",
  "8:00 PM": "8pm",
  "9:00 PM": "9pm",
  "10:00 PM": "10pm",
};

interface JsonLdEvent {
  "@type"?: string;
  startDate?: string;
  description?: string;
}

interface JsonLdGraph {
  "@graph"?: JsonLdEvent[];
}

/**
 * Scrape a single Anguilla draw from enloteria.com.
 * Returns null if data not found or not parseable.
 */
async function scrapeDraw(
  scraperConfig: ScraperConfig,
  drawConfig: DrawConfig,
): Promise<ScrapedDraw | null> {
  const slug = TIME_TO_SLUG[drawConfig.time];
  if (!slug) return null;

  const html = await fetchPage(`${BASE_URL}${slug}`);
  if (!html) return null;
  const $ = cheerio.load(html);

  const scriptEl = $('script[type="application/ld+json"]').first();
  if (!scriptEl.length) return null;

  let jsonLd: JsonLdGraph;
  try {
    jsonLd = JSON.parse(scriptEl.html() ?? "{}");
  } catch {
    return null;
  }

  const events = (jsonLd["@graph"] ?? []).filter(
    (e) => e["@type"] === "Event",
  );
  if (events.length === 0) return null;

  // Find today's event first, fall back to most recent
  const today = getToday();
  const todayEvent = events.find(
    (e) => e.startDate && e.startDate.slice(0, 10) === today,
  );
  const latest = todayEvent ?? events[0];

  if (!latest.startDate) return null;
  const date = latest.startDate.slice(0, 10);

  const numMatch = (latest.description ?? "").match(
    /Números ganadores:\s*(.+)\./,
  );
  if (!numMatch) return null;

  const rawNumbers = padNumbers(
    numMatch[1].split(",").map((n: string) => n.trim()),
  );
  if (rawNumbers.length !== 3) return null;

  log(`anguilla "${drawConfig.time}" source date: ${date}`);

  return {
    gameId: scraperConfig.lotteryId,
    drawDate: date,
    drawTime: drawConfig.time,
    drawPeriod: null,
    numbers: rawNumbers.map((n) => parseInt(n, 10)),
    bonusNumbers: [],
    source: "enloteria",
  };
}

/**
 * Scrape all configured Anguilla draws.
 */
export async function scrapeAnguilla(
  config: ScraperConfig,
): Promise<ScrapedDraw[]> {
  const results: ScrapedDraw[] = [];

  for (const drawConfig of config.draws) {
    if (drawConfig.skipSunday) {
      const now = new Date(
        new Date().toLocaleString("en-US", {
          timeZone: "America/New_York",
        }),
      );
      if (now.getDay() === 0) continue;
    }

    try {
      const result = await scrapeDraw(config, drawConfig);
      if (result) results.push(result);
    } catch (err) {
      log(
        `anguilla "${drawConfig.time}" error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return results;
}

export default scrapeAnguilla;
