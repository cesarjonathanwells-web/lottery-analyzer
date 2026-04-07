import {
  pgTable,
  text,
  integer,
  serial,
  date,
  boolean,
  timestamp,
  bigint,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Games ────────────────────────────────────────────────────────────────────
export const games = pgTable("games", {
  id: text("id").primaryKey(), // slug e.g. "powerball", "anguilla"
  name: text("name").notNull(),
  country: text("country").notNull(), // "US" | "DO" | "AI"
  gameType: text("game_type").notNull(), // "pick3" | "pick4" | "pick5" | "loto" | "mega" | "powerball"
  numberRange: integer("number_range").notNull(), // max possible number
  ballsDrawn: integer("balls_drawn").notNull(),
  bonusBalls: integer("bonus_balls").default(0),
  color: text("color").notNull(), // hex colour for UI
  drawSchedule: text("draw_schedule"), // cron-like description
});

// ── Draws ────────────────────────────────────────────────────────────────────
export const draws = pgTable(
  "draws",
  {
    id: serial("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    drawDate: date("draw_date").notNull(),
    drawTime: text("draw_time"), // e.g. "2:30 PM"
    drawPeriod: text("draw_period"), // "morning" | "midday" | "afternoon" | "evening" | "night"
    numbers: integer("numbers").array().notNull(),
    bonusNumbers: integer("bonus_numbers")
      .array()
      .default(sql`'{}'::integer[]`),
    jackpot: bigint("jackpot", { mode: "number" }),
    source: text("source").notNull(),
    verified: boolean("verified").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Prevent duplicate draw entries
    uniqueIndex("draws_game_date_time_idx").on(
      table.gameId,
      table.drawDate,
      table.drawTime,
    ),
    // GIN index for array containment queries  (@> operator)
    index("draws_numbers_gin_idx").using("gin", table.numbers),
    // B-tree for range queries
    index("draws_game_date_idx").on(table.gameId, table.drawDate),
  ],
);

// ── Analysis Cache ───────────────────────────────────────────────────────────
export const analysisCache = pgTable(
  "analysis_cache",
  {
    id: serial("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    analysisType: text("analysis_type").notNull(),
    paramsHash: text("params_hash").notNull(),
    result: jsonb("result").notNull(),
    computedAt: timestamp("computed_at").defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("analysis_cache_lookup_idx").on(
      table.gameId,
      table.analysisType,
      table.paramsHash,
    ),
  ],
);

// ── Wheel Templates ──────────────────────────────────────────────────────────
export const wheelTemplates = pgTable("wheel_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  poolSize: integer("pool_size"), // n
  pickSize: integer("pick_size"), // k
  guaranteeMatch: integer("guarantee_match"), // t
  guaranteeIfDrawn: integer("guarantee_if_drawn"), // p
  combinations: jsonb("combinations").notNull(), // array of number arrays
  source: text("source"), // e.g. "la_jolla_repository"
});

// ── Type Helpers ─────────────────────────────────────────────────────────────
export type GameInsert = typeof games.$inferInsert;
export type GameSelect = typeof games.$inferSelect;

export type DrawInsert = typeof draws.$inferInsert;
export type DrawSelect = typeof draws.$inferSelect;

export type AnalysisCacheInsert = typeof analysisCache.$inferInsert;
export type AnalysisCacheSelect = typeof analysisCache.$inferSelect;

export type WheelTemplateInsert = typeof wheelTemplates.$inferInsert;
export type WheelTemplateSelect = typeof wheelTemplates.$inferSelect;
