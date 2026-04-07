import { fetchJson } from "./http";
import { log } from "./utils";
import type { ScrapedDraw } from "./types";

// ---------------------------------------------------------------------------
// EBG API base URL
// ---------------------------------------------------------------------------

const EBG_BASE = "https://api.elboletoganador.com/api";

// ---------------------------------------------------------------------------
// Rate-limit helper: 2-second delay between requests (~30 req/min)
// ---------------------------------------------------------------------------

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 2_000) {
    await new Promise((r) => setTimeout(r, 2_000 - elapsed));
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// EBG lottery ID -> our game ID mapping
// ---------------------------------------------------------------------------

export interface EBGMapping {
  gameId: string;
  drawTime: string;
  drawPeriod: string | null;
}

export const EBG_TO_GAME_ID: Record<number, EBGMapping> = {
  4: { gameId: "nacional", drawTime: "9:00 PM", drawPeriod: "night" },
  5: { gameId: "leidsa-quiniela", drawTime: "8:55 PM", drawPeriod: "night" },
  6: { gameId: "loteka-quiniela", drawTime: "7:55 PM", drawPeriod: "evening" },
  12: { gameId: "gana-mas", drawTime: "2:30 PM", drawPeriod: "afternoon" },
  13: { gameId: "loto-real", drawTime: "12:55 PM", drawPeriod: "midday" },
  15: { gameId: "lotedom", drawTime: "5:55 PM", drawPeriod: "evening" },
  16: { gameId: "ny-pick3", drawTime: "3:30 PM", drawPeriod: "midday" },
  17: { gameId: "ny-pick3", drawTime: "11:30 PM", drawPeriod: "evening" },
  18: { gameId: "la-primera", drawTime: "8:00 PM", drawPeriod: "night" },
  20: { gameId: "la-primera", drawTime: "12:00 PM", drawPeriod: "midday" },
  21: { gameId: "la-suerte", drawTime: "12:30 PM", drawPeriod: "midday" },
  29: { gameId: "la-suerte", drawTime: "6:00 PM", drawPeriod: "evening" },
  24: { gameId: "powerball", drawTime: "10:59 PM", drawPeriod: "night" },
  26: { gameId: "mega-millions", drawTime: "11:00 PM", drawPeriod: "night" },
  31: { gameId: "fl-pick3", drawTime: "1:30 PM", drawPeriod: "midday" },
  32: { gameId: "fl-pick3", drawTime: "11:00 PM", drawPeriod: "evening" },
  33: { gameId: "king-lottery", drawTime: "12:30 PM", drawPeriod: "midday" },
  34: { gameId: "king-lottery", drawTime: "7:30 PM", drawPeriod: "evening" },
  // Anguilla draws (IDs 36-40, 50-59)
  36: { gameId: "anguilla", drawTime: "10:00 AM", drawPeriod: "morning" },
  37: { gameId: "anguilla", drawTime: "1:00 PM", drawPeriod: "midday" },
  38: { gameId: "anguilla", drawTime: "6:00 PM", drawPeriod: "evening" },
  39: { gameId: "anguilla", drawTime: "9:00 PM", drawPeriod: "night" },
  40: { gameId: "anguilla", drawTime: "10:00 PM", drawPeriod: "night" },
  50: { gameId: "anguilla", drawTime: "10:00 AM", drawPeriod: "morning" },
  51: { gameId: "anguilla", drawTime: "11:00 AM", drawPeriod: "morning" },
  52: { gameId: "anguilla", drawTime: "12:00 PM", drawPeriod: "midday" },
  53: { gameId: "anguilla", drawTime: "1:00 PM", drawPeriod: "midday" },
  54: { gameId: "anguilla", drawTime: "3:00 PM", drawPeriod: "afternoon" },
  55: { gameId: "anguilla", drawTime: "6:00 PM", drawPeriod: "evening" },
  56: { gameId: "anguilla", drawTime: "7:00 PM", drawPeriod: "evening" },
  57: { gameId: "anguilla", drawTime: "8:00 PM", drawPeriod: "night" },
  58: { gameId: "anguilla", drawTime: "9:00 PM", drawPeriod: "night" },
  59: { gameId: "anguilla", drawTime: "10:00 PM", drawPeriod: "night" },
};

// Reverse lookup: our game ID -> EBG lottery IDs
export function getEBGIdsForGame(gameId: string): number[] {
  return Object.entries(EBG_TO_GAME_ID)
    .filter(([, mapping]) => mapping.gameId === gameId)
    .map(([id]) => Number(id));
}

// ---------------------------------------------------------------------------
// EBG API response types
// ---------------------------------------------------------------------------

interface EBGUltimoSorteo {
  premios: string; // "08-76-17"
  fecha_sorteo: string; // "2026-04-06"
  hora: string; // "21:08:20"
}

interface EBGLoteria {
  id: number;
  nombre: string;
  numero_total: number;
  cantidad_premios: number;
  isLoto: boolean;
  hora: string;
  pais: string;
  ultimo_sorteo: EBGUltimoSorteo | null;
}

interface EBGCompaniesResponse {
  loteria: EBGLoteria[];
  loto: EBGLoteria[];
  atrasados: string;
}

interface EBGResultado {
  fecha_sorteo: string;
  loteria_id: number;
  premios: string;
  loteria?: EBGLoteria;
}

interface EBGHotNumbersResponse {
  dias: unknown[];
  numeros: { numero: number; cantidad: number }[];
  resultado: EBGResultado[];
  image: string;
}

interface EBGFrequencyEntry {
  numero: number;
  cantidad: number;
  posicion?: number;
}

interface EBGFrequencyResponse {
  numeros: EBGFrequencyEntry[];
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

/**
 * Parse a premios string like "08-76-17" into number[].
 * Handles both quiniela (3 numbers, 0-99) and loto (5-6 numbers).
 */
function parsePremios(premios: string): number[] {
  if (!premios || typeof premios !== "string") return [];
  return premios
    .split("-")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

/**
 * Convert an EBG lottery entry to a ScrapedDraw.
 * Returns null if the lottery is not in our mapping or has no draw data.
 */
function toScrapedDraw(
  ebgId: number,
  premios: string,
  fechaSorteo: string,
  hora?: string,
): ScrapedDraw | null {
  const mapping = EBG_TO_GAME_ID[ebgId];
  if (!mapping) return null;

  const numbers = parsePremios(premios);
  if (numbers.length === 0) return null;

  // For loto-type games (powerball, mega-millions), the last number(s) may be bonus
  const isLotoGame =
    mapping.gameId === "powerball" || mapping.gameId === "mega-millions";

  let mainNumbers: number[];
  let bonusNumbers: number[];

  if (isLotoGame && numbers.length > 5) {
    mainNumbers = numbers.slice(0, numbers.length - 1);
    bonusNumbers = [numbers[numbers.length - 1]];
  } else {
    mainNumbers = numbers;
    bonusNumbers = [];
  }

  return {
    gameId: mapping.gameId,
    drawDate: fechaSorteo,
    drawTime: hora ? formatEBGTime(hora) : mapping.drawTime,
    drawPeriod: mapping.drawPeriod,
    numbers: mainNumbers,
    bonusNumbers,
    source: "elboletoganador",
  };
}

/**
 * Convert EBG time "HH:MM:SS" (24h) to "H:MM AM/PM" format.
 */
function formatEBGTime(hora: string): string {
  const parts = hora.split(":");
  if (parts.length < 2) return hora;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all latest results from the companies/loterias endpoint.
 * Returns ScrapedDraw[] for all lotteries that map to our game IDs.
 */
export async function scrapeEBGLatest(): Promise<ScrapedDraw[]> {
  await rateLimit();
  log("EBG: fetching latest results from companies/loterias");

  const url = `${EBG_BASE}/companies/loterias`;
  const data = await fetchJson<EBGCompaniesResponse>(url);

  const draws: ScrapedDraw[] = [];
  const allLotteries = [...(data.loteria ?? []), ...(data.loto ?? [])];

  for (const lottery of allLotteries) {
    if (!lottery.ultimo_sorteo) continue;

    const draw = toScrapedDraw(
      lottery.id,
      lottery.ultimo_sorteo.premios,
      lottery.ultimo_sorteo.fecha_sorteo,
      lottery.ultimo_sorteo.hora,
    );

    if (draw) {
      draws.push(draw);
    }
  }

  log(`EBG: latest returned ${draws.length} draws from ${allLotteries.length} lotteries`);
  return draws;
}

/**
 * Fetch historical draws for a specific lottery from tabla/caliente.
 * @param ebgLotteryId - The EBG lottery ID
 * @param days - Number of days of history to fetch (default 30)
 */
export async function scrapeEBGHistory(
  ebgLotteryId: number,
  days = 30,
): Promise<ScrapedDraw[]> {
  await rateLimit();

  const today = new Date().toISOString().slice(0, 10);
  const url =
    `${EBG_BASE}/tabla/caliente?loteria_id=${ebgLotteryId}` +
    `&fecha=${today}&cantidad=10&dias=${days}`;

  log(`EBG: fetching history for lottery ${ebgLotteryId} (${days} days)`);
  const data = await fetchJson<EBGHotNumbersResponse>(url);

  const draws: ScrapedDraw[] = [];
  const resultados = data.resultado ?? [];

  for (const r of resultados) {
    const draw = toScrapedDraw(
      r.loteria_id ?? ebgLotteryId,
      r.premios,
      r.fecha_sorteo,
    );
    if (draw) {
      draws.push(draw);
    }
  }

  log(`EBG: history returned ${draws.length} draws for lottery ${ebgLotteryId}`);
  return draws;
}

/**
 * Fetch hot numbers analysis for a lottery.
 * @param ebgLotteryId - The EBG lottery ID
 * @param days - Number of days to analyze (default 30)
 */
export async function fetchEBGHotNumbers(
  ebgLotteryId: number,
  days = 30,
): Promise<{
  hotNumbers: number[];
  draws: ScrapedDraw[];
}> {
  await rateLimit();

  const today = new Date().toISOString().slice(0, 10);
  const url =
    `${EBG_BASE}/tabla/caliente?loteria_id=${ebgLotteryId}` +
    `&fecha=${today}&cantidad=10&dias=${days}`;

  log(`EBG: fetching hot numbers for lottery ${ebgLotteryId} (${days} days)`);
  const data = await fetchJson<EBGHotNumbersResponse>(url);

  // Hot numbers sorted by frequency (descending)
  const hotNumbers = (data.numeros ?? [])
    .sort((a, b) => b.cantidad - a.cantidad)
    .map((n) => n.numero);

  // Also parse the associated draws
  const draws: ScrapedDraw[] = [];
  for (const r of data.resultado ?? []) {
    const draw = toScrapedDraw(
      r.loteria_id ?? ebgLotteryId,
      r.premios,
      r.fecha_sorteo,
    );
    if (draw) draws.push(draw);
  }

  log(`EBG: hot numbers returned ${hotNumbers.length} numbers, ${draws.length} draws`);
  return { hotNumbers, draws };
}

/**
 * Fetch number frequency table for a lottery.
 * @param ebgLotteryId - The EBG lottery ID
 * @param position - 0=all, 1=primera, 2=segunda, 3=tercera (default 0)
 */
export async function fetchEBGFrequency(
  ebgLotteryId: number,
  position = 0,
): Promise<{
  frequencies: { number: number; count: number; position: number }[];
}> {
  await rateLimit();

  const today = new Date().toISOString().slice(0, 10);
  const url =
    `${EBG_BASE}/tabla/numeros?loteria_id=${ebgLotteryId}` +
    `&posicion=${position}&fecha=${today}`;

  log(`EBG: fetching frequency for lottery ${ebgLotteryId} position=${position}`);
  const data = await fetchJson<EBGFrequencyResponse>(url);

  const frequencies = (data.numeros ?? []).map((n) => ({
    number: n.numero,
    count: n.cantidad,
    position: n.posicion ?? position,
  }));

  log(`EBG: frequency returned ${frequencies.length} entries`);
  return { frequencies };
}
