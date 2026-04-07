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
    let inserted = 0;
    for (const g of gameData) {
      await db.insert(games).values(g).onConflictDoNothing();
      inserted++;
    }

    // Verify
    const result = await db.select({ count: sql<number>`count(*)` }).from(games);
    const count = result[0]?.count ?? 0;

    return Response.json({ success: true, inserted, totalGames: count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
