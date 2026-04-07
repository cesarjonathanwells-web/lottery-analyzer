export interface ScrapedDraw {
  gameId: string;
  drawDate: string; // YYYY-MM-DD
  drawTime: string | null;
  drawPeriod: string | null;
  numbers: number[];
  bonusNumbers: number[];
  source: string;
}

/** Config for a single draw within a scraper (mirrors scraper-config.json shape). */
export interface DrawConfig {
  time: string;
  sundayTime?: string;
  skipSunday?: boolean;
  gameName?: string;
  pick3Name?: string;
  pick4Name?: string;
  drawLabel?: string;
  session?: string;
}

/** Top-level scraper config for a lottery (mirrors scraper-config.json shape). */
export interface ScraperConfig {
  lotteryId: string;
  source: string;
  state?: string;
  format?: string;
  pageUrl?: string;
  draws: DrawConfig[];
}

/** Full scraper-config.json shape. */
export interface ScraperConfigFile {
  timezone: string;
  defaultTimeoutMinutes: number;
  pollIntervalSeconds: number;
  verifyMinutes: number;
  scrapers: ScraperConfig[];
}

/** Result from a single scraper execution before normalization to ScrapedDraw. */
export interface RawScrapeResult {
  numbers: string[] | null;
  date: string | null;
  closed: boolean;
  parts?: string[][];
}

/** SODA API game definition. */
export interface SodaGameDef {
  gameId: string;
  endpoint: string;
  dateField: string;
  numbersField: string;
  bonusField?: string;
  gameName: string;
}
