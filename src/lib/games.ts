import type { Game } from "@/lib/types";

// ── Static game registry (mirrors DB seed) ───────────────────────────────────
// Used client-side for sidebar / selectors so we avoid a round-trip.

export const GAMES: Game[] = [
  // Caribbean / Dominican
  {
    id: "anguilla",
    name: "Anguilla",
    slug: "anguilla",
    country: "AI",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#d4693a",
    drawSchedule: "Daily",
  },
  {
    id: "leidsa-quiniela",
    name: "Leidsa Quiniela",
    slug: "leidsa-quiniela",
    country: "DO",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#1a5276",
    drawSchedule: "Daily",
  },
  {
    id: "loteka-quiniela",
    name: "Loteka Quiniela",
    slug: "loteka-quiniela",
    country: "DO",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#6c3483",
    drawSchedule: "Daily",
  },
  {
    id: "nacional",
    name: "Nacional",
    slug: "nacional",
    country: "DO",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#1e8449",
    drawSchedule: "Daily",
  },
  {
    id: "loto-real",
    name: "Loto Real",
    slug: "loto-real",
    country: "DO",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#cb4335",
    drawSchedule: "Daily",
  },
  {
    id: "la-primera",
    name: "La Primera",
    slug: "la-primera",
    country: "DO",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#d68910",
    drawSchedule: "Daily",
  },
  {
    id: "la-suerte",
    name: "La Suerte",
    slug: "la-suerte",
    country: "DO",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#2e86c1",
    drawSchedule: "Daily",
  },
  {
    id: "lotedom",
    name: "LoteDom",
    slug: "lotedom",
    country: "DO",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#a04000",
    drawSchedule: "Daily",
  },
  {
    id: "gana-mas",
    name: "Gana Mas",
    slug: "gana-mas",
    country: "DO",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#27ae60",
    drawSchedule: "Daily",
  },
  {
    id: "king-lottery",
    name: "King Lottery",
    slug: "king-lottery",
    country: "DO",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#7d3c98",
    drawSchedule: "Daily",
  },
  {
    id: "gold-ocean",
    name: "Gold Ocean",
    slug: "gold-ocean",
    country: "DO",
    gameType: "pick3",
    numberRange: 99,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#148f77",
    drawSchedule: "Daily",
  },

  // US State Pick Games
  {
    id: "ny-pick3",
    name: "New York Pick 3",
    slug: "ny-pick3",
    country: "US",
    gameType: "pick3",
    numberRange: 9,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#2c3e50",
    drawSchedule: "Daily midday & evening",
  },
  {
    id: "ny-pick4",
    name: "New York Pick 4",
    slug: "ny-pick4",
    country: "US",
    gameType: "pick4",
    numberRange: 9,
    ballsDrawn: 4,
    bonusBalls: 0,
    color: "#2c3e50",
    drawSchedule: "Daily midday & evening",
  },
  {
    id: "fl-pick3",
    name: "Florida Pick 3",
    slug: "fl-pick3",
    country: "US",
    gameType: "pick3",
    numberRange: 9,
    ballsDrawn: 3,
    bonusBalls: 0,
    color: "#e67e22",
    drawSchedule: "Daily midday & evening",
  },
  {
    id: "fl-pick4",
    name: "Florida Pick 4",
    slug: "fl-pick4",
    country: "US",
    gameType: "pick4",
    numberRange: 9,
    ballsDrawn: 4,
    bonusBalls: 0,
    color: "#e67e22",
    drawSchedule: "Daily midday & evening",
  },

  // US Major Lotteries
  {
    id: "powerball",
    name: "Powerball",
    slug: "powerball",
    country: "US",
    gameType: "powerball",
    numberRange: 69,
    ballsDrawn: 5,
    bonusBalls: 1,
    color: "#e74c3c",
    drawSchedule: "Mon, Wed, Sat 10:59 PM ET",
  },
  {
    id: "mega-millions",
    name: "Mega Millions",
    slug: "mega-millions",
    country: "US",
    gameType: "mega",
    numberRange: 70,
    ballsDrawn: 5,
    bonusBalls: 1,
    color: "#f39c12",
    drawSchedule: "Tue, Fri 11:00 PM ET",
  },
];

// ── Grouped by region ────────────────────────────────────────────────────────

export interface GameGroup {
  label: string;
  games: Game[];
}

export const GAME_GROUPS: GameGroup[] = [
  {
    label: "Caribbean",
    games: GAMES.filter((g) => g.country === "AI" || g.country === "DO"),
  },
  {
    label: "US State",
    games: GAMES.filter(
      (g) =>
        g.country === "US" &&
        g.gameType !== "powerball" &&
        g.gameType !== "mega",
    ),
  },
  {
    label: "US Major",
    games: GAMES.filter(
      (g) =>
        g.country === "US" &&
        (g.gameType === "powerball" || g.gameType === "mega"),
    ),
  },
];

export function getGameById(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}
