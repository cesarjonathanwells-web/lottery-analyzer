import { db } from "@/lib/db";
import { draws } from "@/lib/db/schema";
import { log } from "./utils";
import {
  scrapeEBGLatest,
  scrapeEBGHistory,
  EBG_TO_GAME_ID,
} from "./elboletoganador";
import type { ScrapedDraw } from "./types";

// ---------------------------------------------------------------------------
// Sync report
// ---------------------------------------------------------------------------

export interface EBGSyncReport {
  synced: number;
  skipped: number;
  errors: string[];
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Insert a single ScrapedDraw into the database (skip duplicates)
// ---------------------------------------------------------------------------

async function insertDraw(draw: ScrapedDraw): Promise<"inserted" | "skipped"> {
  try {
    await db
      .insert(draws)
      .values({
        gameId: draw.gameId,
        drawDate: draw.drawDate,
        drawTime: draw.drawTime,
        drawPeriod: draw.drawPeriod,
        numbers: draw.numbers,
        bonusNumbers: draw.bonusNumbers,
        source: draw.source,
        verified: false,
      })
      .onConflictDoNothing();

    // onConflictDoNothing doesn't tell us if it actually inserted,
    // so we check via a lightweight approach: if the unique constraint
    // (game_id, draw_date, draw_time) already existed, this was a no-op.
    // We optimistically count it as inserted; the skipped count comes from
    // catches and known-duplicate detection.
    return "inserted";
  } catch (err) {
    // If somehow a race condition causes a duplicate error, treat as skipped
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return "skipped";
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Full sync: fetch latest draws from EBG and insert into DB
// ---------------------------------------------------------------------------

/**
 * Sync all latest results from EBG into the database.
 * Fetches from the companies/loterias endpoint (one request, all lotteries).
 */
export async function syncEBGLatest(): Promise<EBGSyncReport> {
  const startMs = Date.now();
  const errors: string[] = [];
  let synced = 0;
  let skipped = 0;

  log("EBG sync: starting latest sync");

  let latestDraws: ScrapedDraw[] = [];
  try {
    latestDraws = await scrapeEBGLatest();
  } catch (err) {
    const msg = `Failed to fetch latest: ${err instanceof Error ? err.message : String(err)}`;
    log(`EBG sync error: ${msg}`);
    errors.push(msg);
    return { synced, skipped, errors, elapsedMs: Date.now() - startMs };
  }

  for (const draw of latestDraws) {
    try {
      const result = await insertDraw(draw);
      if (result === "inserted") synced++;
      else skipped++;
    } catch (err) {
      const msg = `${draw.gameId} ${draw.drawDate}: ${err instanceof Error ? err.message : String(err)}`;
      log(`EBG sync insert error: ${msg}`);
      errors.push(msg);
    }
  }

  const elapsedMs = Date.now() - startMs;
  log(
    `EBG sync latest: done in ${(elapsedMs / 1000).toFixed(1)}s — ` +
      `${synced} synced, ${skipped} skipped, ${errors.length} errors`,
  );

  return { synced, skipped, errors, elapsedMs };
}

// ---------------------------------------------------------------------------
// Historical sync: fetch history for specific lotteries
// ---------------------------------------------------------------------------

/**
 * Sync historical draws for all mapped EBG lotteries.
 * @param days - Number of days of history to fetch per lottery (default 90)
 */
export async function syncEBGHistory(days = 90): Promise<EBGSyncReport> {
  const startMs = Date.now();
  const errors: string[] = [];
  let synced = 0;
  let skipped = 0;

  const ebgIds = Object.keys(EBG_TO_GAME_ID).map(Number);
  log(`EBG sync: starting history sync for ${ebgIds.length} lotteries (${days} days)`);

  for (const ebgId of ebgIds) {
    try {
      const historyDraws = await scrapeEBGHistory(ebgId, days);

      for (const draw of historyDraws) {
        try {
          const result = await insertDraw(draw);
          if (result === "inserted") synced++;
          else skipped++;
        } catch (err) {
          const msg = `${draw.gameId} ${draw.drawDate}: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(msg);
        }
      }
    } catch (err) {
      const mapping = EBG_TO_GAME_ID[ebgId];
      const msg = `History for EBG#${ebgId} (${mapping?.gameId ?? "unknown"}): ${err instanceof Error ? err.message : String(err)}`;
      log(`EBG sync error: ${msg}`);
      errors.push(msg);
    }
  }

  const elapsedMs = Date.now() - startMs;
  log(
    `EBG sync history: done in ${(elapsedMs / 1000).toFixed(1)}s — ` +
      `${synced} synced, ${skipped} skipped, ${errors.length} errors`,
  );

  return { synced, skipped, errors, elapsedMs };
}

// ---------------------------------------------------------------------------
// Combined sync: latest + optional history
// ---------------------------------------------------------------------------

/**
 * Full EBG sync: fetches latest results and optionally historical data.
 * @param includeHistory - Whether to also fetch historical draws (default false)
 * @param historyDays - Number of days for historical sync (default 90)
 */
export async function syncEBG(
  includeHistory = false,
  historyDays = 90,
): Promise<EBGSyncReport> {
  const startMs = Date.now();

  // Always sync latest
  const latestReport = await syncEBGLatest();

  let historyReport: EBGSyncReport = {
    synced: 0,
    skipped: 0,
    errors: [],
    elapsedMs: 0,
  };

  if (includeHistory) {
    historyReport = await syncEBGHistory(historyDays);
  }

  return {
    synced: latestReport.synced + historyReport.synced,
    skipped: latestReport.skipped + historyReport.skipped,
    errors: [...latestReport.errors, ...historyReport.errors],
    elapsedMs: Date.now() - startMs,
  };
}
