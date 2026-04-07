import { NextRequest, NextResponse } from "next/server";
import { fetchRecentDraws, isSupported } from "@/lib/ebg-client";
import { searchNumbers, type SearchParams } from "@/lib/search/engine";
import { GAMES } from "@/lib/games";
import type { Draw } from "@/lib/types";

/**
 * POST /api/search
 *
 * Now fetches draws from EBG API and searches in memory.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const {
      numbers,
      gameIds = [],
      mode = "quiniela",
      position = 0,
      reversed = false,
      dateFilters,
      limit = 20,
      offset = 0,
    } = body as SearchParams & { limit?: number; offset?: number };

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return NextResponse.json(
        { error: "At least one number is required" },
        { status: 400 },
      );
    }

    // Validate numbers are actual numbers
    const validNumbers = numbers
      .map(Number)
      .filter((n) => !isNaN(n) && n >= 0);

    if (validNumbers.length === 0) {
      return NextResponse.json(
        { error: "No valid numbers provided" },
        { status: 400 },
      );
    }

    // Validate mode
    if (!["quiniela", "pale", "tripleta"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid search mode" },
        { status: 400 },
      );
    }

    // Validate position
    if (![0, 1, 2, 3].includes(position)) {
      return NextResponse.json(
        { error: "Invalid position (must be 0-3)" },
        { status: 400 },
      );
    }

    // Mode-specific validation
    if (mode === "pale" && validNumbers.length < 2) {
      return NextResponse.json(
        { error: "Pale mode requires at least 2 numbers" },
        { status: 400 },
      );
    }

    if (mode === "tripleta" && validNumbers.length < 3) {
      return NextResponse.json(
        { error: "Tripleta mode requires at least 3 numbers" },
        { status: 400 },
      );
    }

    // Fetch draws from EBG for all relevant games
    let allDraws: Draw[] = [];

    const targetGameIds =
      gameIds.length > 0
        ? gameIds.filter((id: string) => isSupported(id))
        : GAMES.filter((g) => isSupported(g.id)).map((g) => g.id);

    const results = await Promise.allSettled(
      targetGameIds.map((gid: string) => fetchRecentDraws(gid, 365)),
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        allDraws.push(...result.value);
      }
    }

    const params: SearchParams = {
      numbers: validNumbers,
      gameIds: Array.isArray(gameIds) ? gameIds : [],
      mode,
      position: position as SearchParams["position"],
      reversed: Boolean(reversed),
      dateFilters,
      limit: Math.min(Math.max(1, limit), 100),
      offset: Math.max(0, offset),
    };

    const response = searchNumbers(allDraws, params);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Search API Error]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
