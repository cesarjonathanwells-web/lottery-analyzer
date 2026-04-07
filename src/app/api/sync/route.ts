import { NextRequest } from "next/server";
import { syncEBG } from "@/lib/scrapers/ebg-sync";
import type { EBGSyncReport } from "@/lib/scrapers/ebg-sync";

interface SyncResponse {
  success: boolean;
  report?: EBGSyncReport;
  error?: string;
}

/**
 * POST /api/sync
 *
 * Triggers a full sync from EBG API to our database.
 *
 * Body (optional JSON):
 *   { includeHistory?: boolean, historyDays?: number }
 *
 * - includeHistory: false (default) = sync only latest results
 *                   true = also fetch historical draws per lottery
 * - historyDays: number of days for historical sync (default 90)
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    let body: { includeHistory?: boolean; historyDays?: number } = {};
    try {
      body = await request.json();
    } catch {
      // No body or invalid JSON is fine — use defaults
    }

    const includeHistory = body.includeHistory ?? false;
    const historyDays = body.historyDays ?? 90;

    const report = await syncEBG(includeHistory, historyDays);

    const response: SyncResponse = {
      success: report.errors.length === 0,
      report,
    };

    return Response.json(response);
  } catch (err) {
    const response: SyncResponse = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
    return Response.json(response, { status: 500 });
  }
}
