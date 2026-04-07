import type { FrequencyResult, Draw, DrawPeriod } from "@/lib/types";

// ---------------------------------------------------------------------------
// EBG API Base
// ---------------------------------------------------------------------------

const EBG_BASE = "https://api.elboletoganador.com/api";

// ---------------------------------------------------------------------------
// Game ID -> EBG Lottery ID mapping
// For games with multiple EBG IDs (multiple draw times), we use the first one
// as the "primary" for fetching frequency/hot data.
// ---------------------------------------------------------------------------

const GAME_TO_EBG: Record<string, number> = {
  nacional: 4,
  "leidsa-quiniela": 5,
  "loteka-quiniela": 6,
  "gana-mas": 12,
  "loto-real": 13,
  lotedom: 15,
  "ny-pick3": 16,
  "la-primera": 18,
  "la-suerte": 21,
  powerball: 24,
  "mega-millions": 26,
  "fl-pick3": 31,
  "king-lottery": 33,
  anguilla: 36,
};

// Draw period mapping by EBG lottery ID
const EBG_DRAW_INFO: Record<
  number,
  { drawTime: string; drawPeriod: DrawPeriod }
> = {
  4: { drawTime: "9:00 PM", drawPeriod: "night" },
  5: { drawTime: "8:55 PM", drawPeriod: "night" },
  6: { drawTime: "7:55 PM", drawPeriod: "evening" },
  12: { drawTime: "2:30 PM", drawPeriod: "afternoon" },
  13: { drawTime: "12:55 PM", drawPeriod: "midday" },
  15: { drawTime: "5:55 PM", drawPeriod: "evening" },
  16: { drawTime: "3:30 PM", drawPeriod: "midday" },
  18: { drawTime: "8:00 PM", drawPeriod: "night" },
  21: { drawTime: "12:30 PM", drawPeriod: "midday" },
  24: { drawTime: "10:59 PM", drawPeriod: "night" },
  26: { drawTime: "11:00 PM", drawPeriod: "night" },
  31: { drawTime: "1:30 PM", drawPeriod: "midday" },
  33: { drawTime: "12:30 PM", drawPeriod: "midday" },
  36: { drawTime: "10:00 AM", drawPeriod: "morning" },
};

// ---------------------------------------------------------------------------
// EBG API response types
// ---------------------------------------------------------------------------

interface EBGUltimoSorteo {
  premios: string;
  fecha_sorteo: string;
  hora: string;
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
}

interface EBGResultado {
  fecha_sorteo: string;
  loteria_id: number;
  premios: string;
}

interface EBGHotNumbersResponse {
  dias: unknown[];
  numeros: { numero: number; cantidad: number }[];
  resultado: EBGResultado[];
}

// ---------------------------------------------------------------------------
// In-memory LRU cache (simple Map-based with TTL)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 60_000; // 60 seconds
const MAX_CACHE_SIZE = 100;
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  // Evict oldest entries if cache is too large
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Fetch helper with caching
// ---------------------------------------------------------------------------

async function fetchEBG<T>(url: string, cacheKey: string): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`EBG API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as T;
  setCache(cacheKey, data);
  return data;
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

function parsePremios(premios: string): number[] {
  if (!premios || typeof premios !== "string") return [];
  return premios
    .split("-")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

function splitMainAndBonus(
  gameId: string,
  numbers: number[],
): { main: number[]; bonus: number[] } {
  const isLotoGame = gameId === "powerball" || gameId === "mega-millions";
  if (isLotoGame && numbers.length > 5) {
    return {
      main: numbers.slice(0, numbers.length - 1),
      bonus: [numbers[numbers.length - 1]],
    };
  }
  return { main: numbers, bonus: [] };
}

// ---------------------------------------------------------------------------
// Public: resolve EBG lottery ID from our game ID
// ---------------------------------------------------------------------------

export function getEbgId(gameId: string): number | null {
  return GAME_TO_EBG[gameId] ?? null;
}

export function isSupported(gameId: string): boolean {
  return gameId in GAME_TO_EBG;
}

// ---------------------------------------------------------------------------
// Public: fetch latest results for all lotteries
// ---------------------------------------------------------------------------

export interface LatestResult {
  gameId: string;
  name: string;
  numbers: number[];
  bonusNumbers: number[];
  drawDate: string;
  drawTime: string;
}

export async function fetchLatestResults(): Promise<LatestResult[]> {
  const cacheKey = "latest-all";
  const data = await fetchEBG<EBGCompaniesResponse>(
    `${EBG_BASE}/companies/loterias`,
    cacheKey,
  );

  const results: LatestResult[] = [];
  const allLotteries = [...(data.loteria ?? []), ...(data.loto ?? [])];

  // Reverse lookup: EBG ID -> game ID
  const ebgToGame: Record<number, string> = {};
  for (const [gid, ebgId] of Object.entries(GAME_TO_EBG)) {
    ebgToGame[ebgId] = gid;
  }

  for (const lottery of allLotteries) {
    const gameId = ebgToGame[lottery.id];
    if (!gameId || !lottery.ultimo_sorteo) continue;

    const numbers = parsePremios(lottery.ultimo_sorteo.premios);
    if (numbers.length === 0) continue;

    const { main, bonus } = splitMainAndBonus(gameId, numbers);

    results.push({
      gameId,
      name: lottery.nombre,
      numbers: main,
      bonusNumbers: bonus,
      drawDate: lottery.ultimo_sorteo.fecha_sorteo,
      drawTime: lottery.hora ?? "",
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public: fetch hot numbers / frequency data -> FrequencyResult[]
// ---------------------------------------------------------------------------

export async function fetchHotNumbers(
  gameId: string,
  days = 90,
): Promise<FrequencyResult[]> {
  const ebgId = getEbgId(gameId);
  if (!ebgId) throw new Error(`Unsupported game: ${gameId}`);

  const today = new Date().toISOString().slice(0, 10);
  const url = `${EBG_BASE}/tabla/caliente?loteria_id=${ebgId}&fecha=${today}&cantidad=10&dias=${days}`;
  const cacheKey = `hot-${gameId}-${days}`;

  const data = await fetchEBG<EBGHotNumbersResponse>(url, cacheKey);

  // Build frequency counts from actual draw results
  const draws = data.resultado ?? [];
  const frequencyMap = new Map<number, { count: number; lastSeen: string; gaps: number[] }>();

  // Process draws in chronological order (oldest first) to compute gaps
  const sortedDraws = [...draws].sort(
    (a, b) => new Date(a.fecha_sorteo).getTime() - new Date(b.fecha_sorteo).getTime(),
  );

  // Track draw index for gap calculation
  let drawIndex = 0;
  const lastSeenAt = new Map<number, number>(); // number -> last draw index

  for (const draw of sortedDraws) {
    const nums = parsePremios(draw.premios);
    const { main } = splitMainAndBonus(gameId, nums);

    for (const num of main) {
      const existing = frequencyMap.get(num) ?? {
        count: 0,
        lastSeen: draw.fecha_sorteo,
        gaps: [],
      };
      existing.count += 1;
      existing.lastSeen = draw.fecha_sorteo;

      // Gap since last time this number appeared
      const prevIdx = lastSeenAt.get(num);
      if (prevIdx !== undefined) {
        existing.gaps.push(drawIndex - prevIdx);
      }

      frequencyMap.set(num, existing);
      lastSeenAt.set(num, drawIndex);
    }
    drawIndex++;
  }

  const totalDraws = sortedDraws.length;

  // Also incorporate the EBG hot numbers data for numbers that didn't appear in draws
  for (const hot of data.numeros ?? []) {
    if (!frequencyMap.has(hot.numero)) {
      frequencyMap.set(hot.numero, {
        count: hot.cantidad,
        lastSeen: null as unknown as string,
        gaps: [],
      });
    }
  }

  // Convert to FrequencyResult[]
  const results: FrequencyResult[] = [];

  for (const [num, info] of frequencyMap.entries()) {
    const percentage = totalDraws > 0 ? (info.count / totalDraws) * 100 : 0;
    const gapAvg =
      info.gaps.length > 0
        ? info.gaps.reduce((a, b) => a + b, 0) / info.gaps.length
        : totalDraws;
    const lastIdx = lastSeenAt.get(num);
    const gapCurrent =
      lastIdx !== undefined ? drawIndex - 1 - lastIdx : totalDraws;

    results.push({
      number: num,
      count: info.count,
      percentage: Math.round(percentage * 10) / 10,
      classification: "warm", // will be recalculated below
      lastSeen: info.lastSeen || null,
      gapCurrent,
      gapAverage: Math.round(gapAvg * 10) / 10,
    });
  }

  // Classify: top 33% = hot, bottom 33% = cold, middle = warm
  const sorted = [...results].sort((a, b) => b.count - a.count);
  const hotThreshold = Math.ceil(sorted.length / 3);
  const coldThreshold = sorted.length - hotThreshold;

  for (let i = 0; i < sorted.length; i++) {
    if (i < hotThreshold) {
      sorted[i].classification = "hot";
    } else if (i >= coldThreshold) {
      sorted[i].classification = "cold";
    } else {
      sorted[i].classification = "warm";
    }
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Public: fetch recent draws -> Draw[]
// ---------------------------------------------------------------------------

export async function fetchRecentDraws(
  gameId: string,
  days = 90,
): Promise<Draw[]> {
  const ebgId = getEbgId(gameId);
  if (!ebgId) throw new Error(`Unsupported game: ${gameId}`);

  const today = new Date().toISOString().slice(0, 10);
  const url = `${EBG_BASE}/tabla/caliente?loteria_id=${ebgId}&fecha=${today}&cantidad=10&dias=${days}`;
  const cacheKey = `draws-${gameId}-${days}`;

  const data = await fetchEBG<EBGHotNumbersResponse>(url, cacheKey);

  const drawInfo = EBG_DRAW_INFO[ebgId] ?? {
    drawTime: null,
    drawPeriod: null,
  };

  const draws: Draw[] = [];
  const resultados = data.resultado ?? [];

  for (let i = 0; i < resultados.length; i++) {
    const r = resultados[i];
    const nums = parsePremios(r.premios);
    if (nums.length === 0) continue;

    const { main, bonus } = splitMainAndBonus(gameId, nums);

    draws.push({
      id: `${gameId}-${r.fecha_sorteo}-${i}`,
      gameId,
      drawDate: r.fecha_sorteo,
      drawTime: drawInfo.drawTime,
      drawPeriod: drawInfo.drawPeriod,
      numbers: main,
      bonusNumbers: bonus,
      jackpot: null,
      source: "elboletoganador",
      verified: true,
    });
  }

  // Sort newest first
  draws.sort(
    (a, b) =>
      new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime(),
  );

  return draws;
}

// ---------------------------------------------------------------------------
// Public: fetch all lotteries info
// ---------------------------------------------------------------------------

export interface LotteryInfo {
  ebgId: number;
  gameId: string | null;
  name: string;
  latestDraw: string | null;
  latestNumbers: number[];
}

export async function fetchAllLotteries(): Promise<LotteryInfo[]> {
  const data = await fetchEBG<EBGCompaniesResponse>(
    `${EBG_BASE}/companies/loterias`,
    "all-lotteries",
  );

  const ebgToGame: Record<number, string> = {};
  for (const [gid, ebgId] of Object.entries(GAME_TO_EBG)) {
    ebgToGame[ebgId] = gid;
  }

  const allLotteries = [...(data.loteria ?? []), ...(data.loto ?? [])];

  return allLotteries.map((l) => ({
    ebgId: l.id,
    gameId: ebgToGame[l.id] ?? null,
    name: l.nombre,
    latestDraw: l.ultimo_sorteo?.fecha_sorteo ?? null,
    latestNumbers: l.ultimo_sorteo
      ? parsePremios(l.ultimo_sorteo.premios)
      : [],
  }));
}
