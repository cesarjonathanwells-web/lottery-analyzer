import { type NextRequest } from "next/server";
import { fetchDraws, fetchGame } from "@/lib/analysis";

/**
 * GET /api/live?game=powerball
 *
 * Server-Sent Events endpoint for live draw updates.
 * Checks for new draws every 30 seconds and pushes updates.
 *
 * Events:
 *   - status:      { message, nextDraw, gameId, gameName }
 *   - draw_update: { gameId, numbers, bonusNumbers, drawDate, drawTime, status }
 */
export async function GET(request: NextRequest) {
  const gameId = request.nextUrl.searchParams.get("game");

  if (!gameId) {
    return Response.json(
      { error: "Missing required query parameter: game" },
      { status: 400 },
    );
  }

  const game = await fetchGame(gameId);
  if (!game) {
    return Response.json(
      { error: `Game not found: ${gameId}` },
      { status: 404 },
    );
  }

  // Capture validated values for use in closures
  const validGameId: string = gameId;
  const gameName: string = game.name;

  const encoder = new TextEncoder();
  let aborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send an SSE event
      function send(event: string, data: unknown) {
        if (aborted) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          aborted = true;
        }
      }

      // Compute a rough "next draw" time based on schedule text
      function computeNextDraw(): string {
        const now = new Date();
        // Default: next hour rounded up
        const next = new Date(now);
        next.setMinutes(0, 0, 0);
        next.setHours(next.getHours() + 1);
        return next.toISOString();
      }

      // Fetch latest draw to establish baseline
      let lastKnownDrawId: string | null = null;
      try {
        const latestDraws = await fetchDraws(validGameId, 1);
        if (latestDraws.length > 0) {
          lastKnownDrawId = latestDraws[0].id;
        }
      } catch {
        // DB may be unavailable; we'll keep polling
      }

      // Send initial status event
      send("status", {
        message: "Connected. Waiting for next draw...",
        nextDraw: computeNextDraw(),
        gameId: validGameId,
        gameName,
      });

      // Poll every 30 seconds for new draws
      const POLL_INTERVAL_MS = 30_000;

      async function poll() {
        if (aborted) return;

        try {
          const latestDraws = await fetchDraws(validGameId, 1);

          if (latestDraws.length > 0 && latestDraws[0].id !== lastKnownDrawId) {
            const draw = latestDraws[0];
            lastKnownDrawId = draw.id;

            send("draw_update", {
              gameId: draw.gameId,
              numbers: draw.numbers,
              bonusNumbers: draw.bonusNumbers,
              drawDate: draw.drawDate,
              drawTime: draw.drawTime,
              jackpot: draw.jackpot,
              status: "completed",
            });
          } else {
            // Heartbeat status so the connection stays alive
            send("status", {
              message: "Waiting for next draw...",
              nextDraw: computeNextDraw(),
              gameId: validGameId,
              gameName,
            });
          }
        } catch {
          send("status", {
            message: "Checking for updates...",
            nextDraw: computeNextDraw(),
            gameId: validGameId,
            gameName,
          });
        }

        if (!aborted) {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      }

      // Start polling loop
      setTimeout(poll, POLL_INTERVAL_MS);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        aborted = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
