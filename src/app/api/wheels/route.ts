import { NextRequest, NextResponse } from "next/server";
import {
  generateWheel,
  validateParams,
  WHEEL_TEMPLATES,
} from "@/lib/wheels";

/** GET /api/wheels — Return available wheel templates with metadata. */
export async function GET() {
  const templates = WHEEL_TEMPLATES.map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    poolSize: tpl.poolSize,
    pickSize: tpl.pickSize,
    guaranteeMatch: tpl.guaranteeMatch,
    guaranteeIfDrawn: tpl.guaranteeIfDrawn,
    ticketCount: tpl.ticketCount,
  }));

  return NextResponse.json({ templates });
}

/** POST /api/wheels — Generate a custom wheel. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poolNumbers, pickSize, guaranteeMatch, guaranteeIfDrawn } = body;

    // Validate input types
    if (!Array.isArray(poolNumbers) || !poolNumbers.every((n: unknown) => typeof n === "number")) {
      return NextResponse.json(
        { error: "poolNumbers must be an array of numbers" },
        { status: 400 },
      );
    }
    if (typeof pickSize !== "number" || typeof guaranteeMatch !== "number" || typeof guaranteeIfDrawn !== "number") {
      return NextResponse.json(
        { error: "pickSize, guaranteeMatch, and guaranteeIfDrawn must be numbers" },
        { status: 400 },
      );
    }

    // Validate wheel parameters
    const validationError = validateParams({
      poolNumbers,
      pickSize,
      guaranteeMatch,
      guaranteeIfDrawn,
    });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Generate the wheel
    const wheel = generateWheel({
      poolNumbers,
      pickSize,
      guaranteeMatch,
      guaranteeIfDrawn,
    });

    return NextResponse.json(wheel);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
