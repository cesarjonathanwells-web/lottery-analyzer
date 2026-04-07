import type { Draw } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TerminalResult {
  terminals: {
    digit: number;
    count: number;
    percentage: number;
    lastSeen: string;
  }[];
  byPosition: {
    position: number;
    terminals: { digit: number; count: number }[];
  }[];
  drawsAnalyzed: number;
}

// ── Implementation ─────────────────────────────────────────────────────────

/**
 * Terminal digit analysis: extract the last digit (terminal) of each winning
 * number and count frequency of terminals 0-9.
 *
 * @param draws     - Pre-fetched draws
 * @param drawCount - Optional limit on how many draws to analyze
 */
export function computeTerminals(
  draws: Draw[],
  drawCount?: number,
): TerminalResult {
  const drawList = drawCount ? draws.slice(0, drawCount) : draws;

  if (drawList.length === 0) {
    return {
      terminals: Array.from({ length: 10 }, (_, i) => ({
        digit: i,
        count: 0,
        percentage: 0,
        lastSeen: "",
      })),
      byPosition: [],
      drawsAnalyzed: 0,
    };
  }

  // Global terminal counts
  const terminalCounts = new Array(10).fill(0);
  const terminalLastSeen = new Array<string>(10).fill("");
  let totalTerminals = 0;

  // Per-position terminal counts
  // Determine max number of positions from the data
  const maxPositions = Math.max(...drawList.map((d) => d.numbers.length));
  const positionCounts: number[][] = Array.from(
    { length: maxPositions },
    () => new Array(10).fill(0),
  );

  // Sort draws by date descending (most recent first)
  const sorted = [...drawList].sort(
    (a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime(),
  );

  for (const draw of sorted) {
    for (let pos = 0; pos < draw.numbers.length; pos++) {
      const num = draw.numbers[pos];
      const terminal = num % 10;

      terminalCounts[terminal]++;
      totalTerminals++;

      if (!terminalLastSeen[terminal]) {
        terminalLastSeen[terminal] = draw.drawDate;
      }

      if (pos < maxPositions) {
        positionCounts[pos][terminal]++;
      }
    }
  }

  // Build terminals array
  const terminals = terminalCounts.map((count, digit) => ({
    digit,
    count,
    percentage: totalTerminals > 0 ? (count / totalTerminals) * 100 : 0,
    lastSeen: terminalLastSeen[digit],
  }));

  // Build by-position array
  const byPosition = positionCounts.map((counts, pos) => ({
    position: pos + 1,
    terminals: counts.map((count, digit) => ({ digit, count })),
  }));

  return {
    terminals,
    byPosition,
    drawsAnalyzed: sorted.length,
  };
}
