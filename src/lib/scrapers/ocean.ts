import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { getToday, cachedFetch, padNumbers, log } from "./utils";
import type { ScrapedDraw, ScraperConfig, DrawConfig } from "./types";

const PAGE_URL = "https://goldoceanlottery.net";
const DRAW_ORDER = [
  "MAÑANA",
  "MEDIO DIA",
  "MEDIA TARDE",
  "TARDE",
  "NOCHE",
] as const;

const SPANISH_MONTHS: Record<string, string> = {
  ENERO: "01",
  FEBRERO: "02",
  MARZO: "03",
  ABRIL: "04",
  MAYO: "05",
  JUNIO: "06",
  JULIO: "07",
  AGOSTO: "08",
  SEPTIEMBRE: "09",
  OCTUBRE: "10",
  NOVIEMBRE: "11",
  DICIEMBRE: "12",
};

const CACHE_TTL = 30_000;

interface OceanDraw {
  numbers: string[];
  available: boolean;
}

interface OceanPageData {
  draws: Record<string, OceanDraw>;
  date: string;
}

/** Parse the hero date from Gold Ocean page header. Format: "ABRIL 4, 2026" */
function parseHeroDate($: cheerio.CheerioAPI): string {
  const text = $(".go-card-hero h1").text().trim();
  const match = text.match(/^(\w+)\s+(\d+),?\s+(\d{4})$/);
  if (match) {
    const month = SPANISH_MONTHS[match[1].toUpperCase()];
    if (month)
      return `${match[3]}-${month}-${String(match[2]).padStart(2, "0")}`;
  }
  return getToday();
}

/**
 * Fetch all draws from the Gold Ocean page.
 * Uses 30s cache to avoid hammering the server when multiple draws are checked.
 */
async function fetchAll(): Promise<OceanPageData> {
  return cachedFetch<OceanPageData>(
    `ocean:${PAGE_URL}`,
    CACHE_TTL,
    async () => {
      const html = await fetchPage(PAGE_URL);
      if (!html) return { draws: {}, date: getToday() };
      const $ = cheerio.load(html);
      const results: Record<string, OceanDraw> = {};
      const date = parseHeroDate($);

      // Parse NUMEROS section from results card
      const resultsCard = $(".go-card-results");
      const numerosSection = resultsCard.find(".mb-4").first();

      numerosSection.find(".go-result-row").each((_, row) => {
        const $row = $(row);
        const label = $row.find(".go-time-label").text().trim();
        if (!label) return;

        const numbers: string[] = [];
        $row.find(".go-ball--numeros").each((_, ball) => {
          numbers.push($(ball).text().trim());
        });

        const available =
          numbers.length > 0 && !numbers.every((n) => n === "--");
        results[label] = { numbers, available };
      });

      // Parse hero card -- shows the latest completed draw
      const heroCard = $(".go-card-hero");
      if (heroCard.length) {
        const heroNumbers: string[] = [];
        heroCard.find(".go-ball--numeros").each((_, ball) => {
          heroNumbers.push($(ball).text().trim());
        });
        const heroAvailable =
          heroNumbers.length > 0 &&
          !heroNumbers.every((n) => n === "--");

        if (heroAvailable) {
          const heroKey = heroNumbers.join(",");
          const capturedKeys = new Set<string>();
          for (const label of DRAW_ORDER) {
            const r = results[label];
            if (r && r.available) capturedKeys.add(r.numbers.join(","));
          }

          if (!capturedKeys.has(heroKey)) {
            const juegoText = heroCard.find("h2").text().trim();
            const labelMatch = juegoText.match(/JUEGO:\s*(.+)/i);
            const heroLabel =
              labelMatch && labelMatch[1].trim()
                ? labelMatch[1].trim()
                : null;

            if (
              heroLabel &&
              (DRAW_ORDER as readonly string[]).includes(heroLabel)
            ) {
              results[heroLabel] = {
                numbers: heroNumbers,
                available: true,
              };
            } else {
              for (const label of DRAW_ORDER) {
                if (!results[label] || !results[label].available) {
                  results[label] = {
                    numbers: heroNumbers,
                    available: true,
                  };
                  break;
                }
              }
            }
          }
        }
      }

      return { draws: results, date };
    },
  );
}

/**
 * Scrape a single Ocean draw.
 */
async function scrapeDraw(
  scraperConfig: ScraperConfig,
  drawConfig: DrawConfig,
): Promise<ScrapedDraw | null> {
  const { draws, date } = await fetchAll();
  const drawLabel = drawConfig.drawLabel;
  if (!drawLabel) return null;

  const draw = draws[drawLabel];
  if (!draw || !draw.available) return null;

  const paddedNumbers = padNumbers(draw.numbers);
  log(`ocean "${drawLabel}" source date: ${date}`);

  return {
    gameId: scraperConfig.lotteryId,
    drawDate: date,
    drawTime: drawConfig.time,
    drawPeriod: drawLabel.toLowerCase(),
    numbers: paddedNumbers.map((n) => parseInt(n, 10)),
    bonusNumbers: [],
    source: "goldocean",
  };
}

/**
 * Scrape all configured Gold Ocean draws.
 */
export async function scrapeOcean(
  config: ScraperConfig,
): Promise<ScrapedDraw[]> {
  const results: ScrapedDraw[] = [];
  const isSundayNow =
    new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
      }),
    ).getDay() === 0;

  for (const drawConfig of config.draws) {
    if (drawConfig.skipSunday && isSundayNow) continue;

    try {
      const result = await scrapeDraw(config, drawConfig);
      if (result) results.push(result);
    } catch (err) {
      log(
        `ocean "${drawConfig.drawLabel}" error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return results;
}

export default scrapeOcean;
