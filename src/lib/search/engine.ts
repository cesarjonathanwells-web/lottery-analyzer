import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { draws as drawsTable } from "@/lib/db/schema";
import { getGameById } from "@/lib/games";

// ── Types ───────────────────────────────────────────────────────────────────

export type SearchMode = "quiniela" | "pale" | "tripleta";
export type Position = 0 | 1 | 2 | 3; // 0 = all positions

export interface SearchParams {
  numbers: number[];
  gameIds: string[];
  mode: SearchMode;
  position: Position;
  reversed: boolean;
  dateFilters?: {
    days?: number[];
    months?: string[];
    years?: number[];
  };
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  draw: {
    id: string;
    gameId: string;
    gameName: string;
    drawDate: string;
    drawTime: string | null;
    numbers: number[];
  };
  matchedNumbers: number[];
  matchedPositions: number[];
}

export interface SearchResponse {
  results: SearchResult[];
  totalMatches: number;
  gameBreakdown: Record<string, number>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Reverse the digits of a 2-digit number; single-digit numbers return themselves */
function reverseNumber(n: number): number {
  if (n < 10) return n;
  const s = String(n);
  return parseInt(s.split("").reverse().join(""), 10);
}

/** Expand numbers with their reversed counterparts (deduped) */
function expandWithReversed(numbers: number[]): number[] {
  const set = new Set<number>(numbers);
  for (const n of numbers) {
    set.add(reverseNumber(n));
  }
  return Array.from(set);
}

/** Generate all unique k-combinations from an array */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 1) return arr.map((x) => [x]);
  if (k === arr.length) return [arr];
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i];
    const tailCombos = combinations(arr.slice(i + 1), k - 1);
    for (const tail of tailCombos) {
      result.push([head, ...tail]);
    }
  }
  return result;
}

// ── Match Logic ─────────────────────────────────────────────────────────────

function matchQuiniela(
  drawNumbers: number[],
  searchNumbers: number[],
  position: Position,
): { matched: boolean; matchedNumbers: number[]; matchedPositions: number[] } {
  const matchedNumbers: number[] = [];
  const matchedPositions: number[] = [];

  for (const num of searchNumbers) {
    if (position > 0) {
      // Position is 1-indexed: position 1 = index 0, position 2 = index 1, etc.
      const idx = position - 1;
      if (idx < drawNumbers.length && drawNumbers[idx] === num) {
        matchedNumbers.push(num);
        matchedPositions.push(position);
      }
    } else {
      // Any position
      for (let i = 0; i < drawNumbers.length; i++) {
        if (drawNumbers[i] === num) {
          matchedNumbers.push(num);
          matchedPositions.push(i + 1);
        }
      }
    }
  }

  return {
    matched: matchedNumbers.length > 0,
    matchedNumbers: [...new Set(matchedNumbers)],
    matchedPositions,
  };
}

function matchPale(
  drawNumbers: number[],
  pair: number[],
): { matched: boolean; matchedNumbers: number[]; matchedPositions: number[] } {
  const matchedNumbers: number[] = [];
  const matchedPositions: number[] = [];

  // Both numbers in the pair must appear in the draw
  for (const num of pair) {
    const idx = drawNumbers.indexOf(num);
    if (idx === -1) {
      return { matched: false, matchedNumbers: [], matchedPositions: [] };
    }
    matchedNumbers.push(num);
    matchedPositions.push(idx + 1);
  }

  return { matched: true, matchedNumbers, matchedPositions };
}

function matchTripleta(
  drawNumbers: number[],
  triple: number[],
): { matched: boolean; matchedNumbers: number[]; matchedPositions: number[] } {
  const matchedNumbers: number[] = [];
  const matchedPositions: number[] = [];

  for (const num of triple) {
    const idx = drawNumbers.indexOf(num);
    if (idx === -1) {
      return { matched: false, matchedNumbers: [], matchedPositions: [] };
    }
    matchedNumbers.push(num);
    matchedPositions.push(idx + 1);
  }

  return { matched: true, matchedNumbers, matchedPositions };
}

// ── Date Filter ─────────────────────────────────────────────────────────────

function passesDateFilter(
  drawDate: string,
  filters?: SearchParams["dateFilters"],
): boolean {
  if (!filters) return true;

  const d = new Date(drawDate + "T00:00:00");

  if (filters.days && filters.days.length > 0) {
    if (!filters.days.includes(d.getDate())) return false;
  }

  if (filters.months && filters.months.length > 0) {
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const monthStr = monthNames[d.getMonth()];
    if (!filters.months.includes(monthStr)) return false;
  }

  if (filters.years && filters.years.length > 0) {
    if (!filters.years.includes(d.getFullYear())) return false;
  }

  return true;
}

// ── Main Search Function ────────────────────────────────────────────────────

export async function searchNumbers(
  params: SearchParams,
): Promise<SearchResponse> {
  const {
    numbers,
    gameIds,
    mode,
    position,
    reversed,
    dateFilters,
    limit = 20,
    offset = 0,
  } = params;

  if (numbers.length === 0) {
    return { results: [], totalMatches: 0, gameBreakdown: {} };
  }

  // Expand search numbers if reversed is enabled
  const searchNums = reversed ? expandWithReversed(numbers) : [...numbers];

  // Build base query conditions
  const conditions = [];

  if (gameIds.length > 0) {
    conditions.push(inArray(drawsTable.gameId, gameIds));
  }

  // Use the GIN index: filter draws that contain at least one of the search numbers.
  // For quiniela mode, check array overlap (&&); for pale/tripleta, check containment (@>).
  if (mode === "quiniela") {
    // Any draw containing at least one of the search numbers
    conditions.push(
      sql`${drawsTable.numbers} && ARRAY[${sql.join(
        searchNums.map((n) => sql`${n}`),
        sql`, `,
      )}]::integer[]`,
    );
  } else if (mode === "pale") {
    // For pale, we need draws containing at least 2 of the search numbers.
    // We use overlap first to narrow down, then check in JS.
    conditions.push(
      sql`${drawsTable.numbers} && ARRAY[${sql.join(
        searchNums.map((n) => sql`${n}`),
        sql`, `,
      )}]::integer[]`,
    );
  } else {
    // tripleta: draws containing at least 3 of the search numbers
    conditions.push(
      sql`${drawsTable.numbers} && ARRAY[${sql.join(
        searchNums.map((n) => sql`${n}`),
        sql`, `,
      )}]::integer[]`,
    );
  }

  const whereClause =
    conditions.length === 1 ? conditions[0] : and(...conditions);

  // Fetch candidate rows (we fetch all candidates then filter in JS for precision)
  const rows = await db
    .select()
    .from(drawsTable)
    .where(whereClause)
    .orderBy(desc(drawsTable.drawDate));

  // Generate the combinations to search for based on mode
  let searchCombos: number[][] = [];
  if (mode === "quiniela") {
    searchCombos = searchNums.map((n) => [n]);
  } else if (mode === "pale") {
    searchCombos =
      searchNums.length >= 2
        ? combinations(searchNums, 2)
        : [searchNums];
  } else {
    searchCombos =
      searchNums.length >= 3
        ? combinations(searchNums, 3)
        : [searchNums];
  }

  // Filter & match
  const allResults: SearchResult[] = [];
  const gameBreakdown: Record<string, number> = {};

  for (const row of rows) {
    // Date filter
    if (!passesDateFilter(row.drawDate, dateFilters)) continue;

    const drawNumbers = row.numbers;
    let bestMatch: {
      matchedNumbers: number[];
      matchedPositions: number[];
    } | null = null;

    for (const combo of searchCombos) {
      let result: ReturnType<typeof matchQuiniela>;

      if (mode === "quiniela") {
        result = matchQuiniela(drawNumbers, combo, position);
      } else if (mode === "pale") {
        result = matchPale(drawNumbers, combo);
      } else {
        result = matchTripleta(drawNumbers, combo);
      }

      if (result.matched) {
        // Merge matches (a draw might match multiple combos)
        if (!bestMatch) {
          bestMatch = {
            matchedNumbers: result.matchedNumbers,
            matchedPositions: result.matchedPositions,
          };
        } else {
          bestMatch.matchedNumbers = [
            ...new Set([...bestMatch.matchedNumbers, ...result.matchedNumbers]),
          ];
          bestMatch.matchedPositions = [
            ...new Set([
              ...bestMatch.matchedPositions,
              ...result.matchedPositions,
            ]),
          ];
        }
      }
    }

    if (bestMatch) {
      const game = getGameById(row.gameId);
      const searchResult: SearchResult = {
        draw: {
          id: String(row.id),
          gameId: row.gameId,
          gameName: game?.name ?? row.gameId,
          drawDate: row.drawDate,
          drawTime: row.drawTime,
          numbers: drawNumbers,
        },
        matchedNumbers: bestMatch.matchedNumbers,
        matchedPositions: bestMatch.matchedPositions,
      };
      allResults.push(searchResult);

      // Game breakdown
      const gName = game?.name ?? row.gameId;
      gameBreakdown[gName] = (gameBreakdown[gName] ?? 0) + 1;
    }
  }

  const totalMatches = allResults.length;

  // Apply pagination
  const paginated = allResults.slice(offset, offset + limit);

  return {
    results: paginated,
    totalMatches,
    gameBreakdown,
  };
}

/**
 * Utility: Get the combination descriptions for a set of numbers and mode.
 * Used by the UI to show what will be searched.
 */
export function getSearchCombinations(
  numbers: number[],
  mode: SearchMode,
  reversed: boolean,
): { count: number; descriptions: string[] } {
  const expanded = reversed ? expandWithReversed(numbers) : [...numbers];

  if (mode === "quiniela") {
    return {
      count: expanded.length,
      descriptions: expanded.map((n) => String(n)),
    };
  }

  if (mode === "pale") {
    if (expanded.length < 2) {
      return { count: 0, descriptions: [] };
    }
    const combos = combinations(expanded, 2);
    return {
      count: combos.length,
      descriptions: combos.map((c) => c.join("-")),
    };
  }

  // tripleta
  if (expanded.length < 3) {
    return { count: 0, descriptions: [] };
  }
  const combos = combinations(expanded, 3);
  return {
    count: combos.length,
    descriptions: combos.map((c) => c.join("-")),
  };
}
