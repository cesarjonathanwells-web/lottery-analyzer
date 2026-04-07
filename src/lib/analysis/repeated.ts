import type { Draw } from "@/lib/types";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RepeatedOccurrence {
  drawDate: string;
  position: number;
}

export interface RepeatedEntry {
  number: number;
  occurrences: RepeatedOccurrence[];
  streak: number; // How many consecutive draws it appeared in
  windowDays: number; // How many days the streak spans
}

export interface RepeatedResult {
  repeated: RepeatedEntry[];
  drawsAnalyzed: number;
}

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Find numbers that appear in consecutive draws or repeat within a short window.
 * Popular in Dominican lottery culture: "the number is running hot".
 *
 * @param draws            - Pre-fetched draws, sorted by date descending (newest first)
 * @param lookbackDraws    - How many recent draws to analyze (default 50)
 * @param includeReversed  - If true, 12 also counts as 21 (digit reversal matching)
 */
export function findRepeatedNumbers(
  draws: Draw[],
  lookbackDraws: number = 50,
  includeReversed: boolean = false,
): RepeatedResult {
  // Take only the lookback window (draws should already be sorted newest first)
  const rows = draws.slice(0, lookbackDraws);

  if (rows.length === 0) {
    return { repeated: [], drawsAnalyzed: 0 };
  }

  // Track every number's appearances across recent draws (draw index order)
  // rows[0] is most recent draw
  const numberAppearances = new Map<
    number,
    { drawIndex: number; drawDate: string; position: number }[]
  >();

  for (let drawIdx = 0; drawIdx < rows.length; drawIdx++) {
    const row = rows[drawIdx];
    const numbers = row.numbers;

    // Collect all numbers to track (including reversed if requested)
    const numbersToTrack = new Set(numbers);

    if (includeReversed) {
      for (const n of numbers) {
        if (n >= 10 && n <= 99) {
          const reversed = parseInt(
            String(n).split("").reverse().join(""),
            10,
          );
          numbersToTrack.add(reversed);
        }
      }
    }

    for (let pos = 0; pos < numbers.length; pos++) {
      const num = numbers[pos];
      if (!numberAppearances.has(num)) {
        numberAppearances.set(num, []);
      }
      numberAppearances.get(num)!.push({
        drawIndex: drawIdx,
        drawDate: row.drawDate,
        position: pos + 1, // 1-based position
      });

      // If reversed matching, also record under the reversed number
      if (includeReversed && num >= 10 && num <= 99) {
        const reversed = parseInt(
          String(num).split("").reverse().join(""),
          10,
        );
        if (reversed !== num) {
          if (!numberAppearances.has(reversed)) {
            numberAppearances.set(reversed, []);
          }
          numberAppearances.get(reversed)!.push({
            drawIndex: drawIdx,
            drawDate: row.drawDate,
            position: pos + 1,
          });
        }
      }
    }
  }

  // Find numbers with consecutive draw appearances (streak >= 2)
  const repeated: RepeatedEntry[] = [];

  for (const [number, appearances] of numberAppearances) {
    if (appearances.length < 2) continue;

    // Sort by draw index ascending (oldest first in the lookback window)
    const sorted = [...appearances].sort((a, b) => a.drawIndex - b.drawIndex);

    // Find the longest consecutive streak
    let maxStreak = 1;
    let currentStreak = 1;
    let streakStart = 0;
    let bestStreakStart = 0;

    for (let i = 1; i < sorted.length; i++) {
      // Consecutive means the draw indices differ by 1
      if (sorted[i].drawIndex - sorted[i - 1].drawIndex === 1) {
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          bestStreakStart = streakStart;
        }
      } else {
        currentStreak = 1;
        streakStart = i;
      }
    }

    if (maxStreak < 2) continue;

    // Get the streak window
    const streakEntries = sorted.slice(
      bestStreakStart,
      bestStreakStart + maxStreak,
    );
    const firstDate = new Date(streakEntries[0].drawDate + "T00:00:00");
    const lastDate = new Date(
      streakEntries[streakEntries.length - 1].drawDate + "T00:00:00",
    );
    const windowDays = Math.round(
      (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    repeated.push({
      number,
      occurrences: sorted.map((a) => ({
        drawDate: a.drawDate,
        position: a.position,
      })),
      streak: maxStreak,
      windowDays: Math.max(windowDays, 0),
    });
  }

  // Sort by streak descending, then by number of total occurrences descending
  repeated.sort((a, b) => {
    if (b.streak !== a.streak) return b.streak - a.streak;
    return b.occurrences.length - a.occurrences.length;
  });

  return { repeated, drawsAnalyzed: rows.length };
}
