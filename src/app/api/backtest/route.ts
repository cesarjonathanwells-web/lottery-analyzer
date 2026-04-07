import { type NextRequest } from "next/server";
import { fetchDraws, fetchGame } from "@/lib/analysis";

/**
 * POST /api/backtest
 *
 * Body: { gameId: string, numbers: number[], bonusNumbers?: number[] }
 *
 * Returns: {
 *   gameId, totalDraws, matchDistribution, bestMatch, timeline,
 *   estimatedWins
 * }
 */
export async function POST(request: NextRequest) {
  let body: { gameId?: string; numbers?: number[]; bonusNumbers?: number[] };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { gameId, numbers, bonusNumbers = [] } = body;

  // ── Validation ──────────────────────────────────────────────────────────
  if (!gameId || typeof gameId !== "string") {
    return Response.json(
      { error: "Missing required field: gameId" },
      { status: 400 },
    );
  }

  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
    return Response.json(
      { error: "Missing required field: numbers (non-empty array)" },
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

  // ── Fetch all draws ─────────────────────────────────────────────────────
  let allDraws;
  try {
    allDraws = await fetchDraws(gameId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }

  if (allDraws.length === 0) {
    return Response.json(
      { error: `No draws found for game: ${gameId}` },
      { status: 404 },
    );
  }

  // ── Backtest logic ──────────────────────────────────────────────────────
  const userNumbers = new Set(numbers);
  const userBonus = new Set(bonusNumbers);

  // matchDistribution: how many times user got 0, 1, 2, ... matches
  const matchDistribution: Record<number, number> = {};
  let bestMatchCount = 0;
  let bestMatchDraw = allDraws[0];
  let bestBonusMatch = 0;

  const timeline: { date: string; matches: number; bonusMatches: number }[] =
    [];

  for (const draw of allDraws) {
    // Count main number matches
    let mainMatches = 0;
    for (const n of draw.numbers) {
      if (userNumbers.has(n)) mainMatches++;
    }

    // Count bonus matches
    let bonusMatch = 0;
    for (const bn of draw.bonusNumbers) {
      if (userBonus.has(bn)) bonusMatch++;
    }

    // Update distribution
    matchDistribution[mainMatches] =
      (matchDistribution[mainMatches] ?? 0) + 1;

    // Track best match
    if (
      mainMatches > bestMatchCount ||
      (mainMatches === bestMatchCount && bonusMatch > bestBonusMatch)
    ) {
      bestMatchCount = mainMatches;
      bestBonusMatch = bonusMatch;
      bestMatchDraw = draw;
    }

    timeline.push({
      date: draw.drawDate,
      matches: mainMatches,
      bonusMatches: bonusMatch,
    });
  }

  // Sort timeline chronologically (draws come desc from DB)
  timeline.reverse();

  // ── Prize estimation (simplified tier system) ───────────────────────────
  const estimatedWins = estimatePrizes(
    game.gameType,
    matchDistribution,
    game.ballsDrawn,
  );

  return Response.json({
    gameId,
    totalDraws: allDraws.length,
    matchDistribution,
    bestMatch: {
      draw: bestMatchDraw,
      mainMatches: bestMatchCount,
      bonusMatches: bestBonusMatch,
    },
    timeline,
    estimatedWins,
  });
}

/**
 * Simplified prize tier estimation.
 */
function estimatePrizes(
  gameType: string,
  distribution: Record<number, number>,
  ballsDrawn: number,
): { tier: string; matches: number; count: number; estimatedPrize: string }[] {
  const tiers: {
    tier: string;
    matches: number;
    count: number;
    estimatedPrize: string;
  }[] = [];

  if (gameType === "powerball" || gameType === "mega") {
    const prizeMap: Record<number, { tier: string; prize: string }> = {
      5: { tier: "Jackpot", prize: "Jackpot" },
      4: { tier: "Match 4 + Bonus", prize: "$50,000" },
      3: { tier: "Match 3", prize: "$100" },
      2: { tier: "Match 2", prize: "$7" },
      1: { tier: "Match 1 + Bonus", prize: "$4" },
    };

    for (const [matchStr, info] of Object.entries(prizeMap)) {
      const matches = parseInt(matchStr, 10);
      const count = distribution[matches] ?? 0;
      tiers.push({
        tier: info.tier,
        matches,
        count,
        estimatedPrize: info.prize,
      });
    }
  } else {
    // Generic tiers for Pick games
    for (let m = ballsDrawn; m >= 1; m--) {
      const count = distribution[m] ?? 0;
      tiers.push({
        tier: m === ballsDrawn ? "Exact Match" : `Match ${m}`,
        matches: m,
        count,
        estimatedPrize: m === ballsDrawn ? "Top Prize" : "Partial",
      });
    }
  }

  return tiers;
}
