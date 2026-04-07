import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

const gameData = [
  { id: "anguilla", name: "Anguilla", country: "AI", gameType: "pick3", numberRange: 99, ballsDrawn: 3, bonusBalls: 0, color: "#d4693a", drawSchedule: "Daily" },
  { id: "leidsa-quiniela", name: "Leidsa Quiniela", country: "DO", gameType: "pick3", numberRange: 99, ballsDrawn: 3, bonusBalls: 0, color: "#1a5276", drawSchedule: "Daily" },
  { id: "loteka-quiniela", name: "Loteka Quiniela", country: "DO", gameType: "pick3", numberRange: 99, ballsDrawn: 3, bonusBalls: 0, color: "#6c3483", drawSchedule: "Daily" },
  { id: "nacional", name: "Nacional", country: "DO", gameType: "pick3", numberRange: 99, ballsDrawn: 3, bonusBalls: 0, color: "#1e8449", drawSchedule: "Daily" },
  { id: "loto-real", name: "Loto Real", country: "DO", gameType: "pick3", numberRange: 99, ballsDrawn: 3, bonusBalls: 0, color: "#cb4335", drawSchedule: "Daily" },
  { id: "la-primera", name: "La Primera", country: "DO", gameType: "pick3", numberRange: 99, ballsDrawn: 3, bonusBalls: 0, color: "#d68910", drawSchedule: "Daily" },
  { id: "la-suerte", name: "La Suerte", country: "DO", gameType: "pick3", numberRange: 99, ballsDrawn: 3, bonusBalls: 0, color: "#2e86c1", drawSchedule: "Daily" },
  { id: "lotedom", name: "LoteDom", country: "DO", gameType: "pick3", numberRange: 99, ballsDrawn: 3, bonusBalls: 0, color: "#a04000", drawSchedule: "Daily" },
  { id: "king-lottery", name: "King Lottery", country: "DO", gameType: "pick3", numberRange: 99, ballsDrawn: 3, bonusBalls: 0, color: "#7d3c98", drawSchedule: "Daily" },
  { id: "gold-ocean", name: "Gold Ocean", country: "DO", gameType: "pick3", numberRange: 99, ballsDrawn: 3, bonusBalls: 0, color: "#148f77", drawSchedule: "Daily" },
  { id: "ny-pick3", name: "New York Pick 3", country: "US", gameType: "pick3", numberRange: 9, ballsDrawn: 3, bonusBalls: 0, color: "#2c3e50", drawSchedule: "Daily midday & evening" },
  { id: "ny-pick4", name: "New York Pick 4", country: "US", gameType: "pick4", numberRange: 9, ballsDrawn: 4, bonusBalls: 0, color: "#2c3e50", drawSchedule: "Daily midday & evening" },
  { id: "fl-pick3", name: "Florida Pick 3", country: "US", gameType: "pick3", numberRange: 9, ballsDrawn: 3, bonusBalls: 0, color: "#e67e22", drawSchedule: "Daily midday & evening" },
  { id: "fl-pick4", name: "Florida Pick 4", country: "US", gameType: "pick4", numberRange: 9, ballsDrawn: 4, bonusBalls: 0, color: "#e67e22", drawSchedule: "Daily midday & evening" },
  { id: "powerball", name: "Powerball", country: "US", gameType: "powerball", numberRange: 69, ballsDrawn: 5, bonusBalls: 1, color: "#e74c3c", drawSchedule: "Mon, Wed, Sat 10:59 PM ET" },
  { id: "mega-millions", name: "Mega Millions", country: "US", gameType: "mega", numberRange: 70, ballsDrawn: 5, bonusBalls: 1, color: "#f39c12", drawSchedule: "Tue, Fri 11:00 PM ET" },
];

export async function POST() {
  try {
    // Create tables if they don't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        game_type TEXT NOT NULL,
        number_range INTEGER NOT NULL,
        balls_drawn INTEGER NOT NULL,
        bonus_balls INTEGER DEFAULT 0,
        color TEXT NOT NULL,
        draw_schedule TEXT
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS draws (
        id SERIAL PRIMARY KEY,
        game_id TEXT NOT NULL REFERENCES games(id),
        draw_date DATE NOT NULL,
        draw_time TEXT,
        draw_period TEXT,
        numbers INTEGER[] NOT NULL,
        bonus_numbers INTEGER[] DEFAULT '{}',
        jackpot BIGINT,
        source TEXT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analysis_cache (
        id SERIAL PRIMARY KEY,
        game_id TEXT NOT NULL REFERENCES games(id),
        analysis_type TEXT NOT NULL,
        params_hash TEXT NOT NULL,
        result JSONB NOT NULL,
        computed_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wheel_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        pool_size INTEGER,
        pick_size INTEGER,
        guarantee_match INTEGER,
        guarantee_if_drawn INTEGER,
        combinations JSONB NOT NULL,
        source TEXT
      )
    `);

    // Create indexes
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS draws_game_date_time_idx ON draws(game_id, draw_date, draw_time)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS draws_game_date_idx ON draws(game_id, draw_date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS analysis_cache_lookup_idx ON analysis_cache(game_id, analysis_type, params_hash)`);

    // Seed games
    let inserted = 0;
    for (const g of gameData) {
      await db.insert(games).values(g).onConflictDoNothing();
      inserted++;
    }

    const result = await db.select({ count: sql<number>`count(*)` }).from(games);
    const count = result[0]?.count ?? 0;

    return Response.json({ success: true, inserted, totalGames: count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : "";
    return Response.json({ success: false, error: message, stack }, { status: 500 });
  }
}
