/**
 * Pre-computed Wheel Templates
 *
 * Known optimal (or near-optimal) covering designs for common configurations.
 * Templates use sequential numbers 1..n; the mapper replaces them with user's picks.
 *
 * Notation: L(n, k, p, t) = B tickets
 * - n = pool size (how many numbers the user picks)
 * - k = pick size (numbers per ticket)
 * - p = guarantee-if-drawn (if this many of your numbers appear in draw)
 * - t = guarantee match (at least one ticket matches this many)
 */

export interface WheelTemplate {
  id: string;
  name: string;
  description: string;
  poolSize: number; // n
  pickSize: number; // k (numbers per ticket)
  guaranteeMatch: number; // t
  guaranteeIfDrawn: number; // p
  ticketCount: number;
  combinations: number[][]; // Template using sequential numbers 1..n
}

export const WHEEL_TEMPLATES: WheelTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // PICK-6 WHEELS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── L(7, 6, 3, 3) = 4 ──────────────────────────────────────────────────
  {
    id: "p6-7-3if3",
    name: "Pick-6: 7 Numbers, 3-if-3",
    description:
      "Full coverage wheel. If any 3 of your 7 numbers are drawn, at least one ticket matches 3.",
    poolSize: 7,
    pickSize: 6,
    guaranteeMatch: 3,
    guaranteeIfDrawn: 3,
    ticketCount: 4,
    combinations: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 5, 7],
      [1, 2, 3, 4, 6, 7],
      [1, 2, 5, 6, 7, 3],
    ],
  },

  // ── L(8, 6, 4, 3) = 4 ──────────────────────────────────────────────────
  {
    id: "p6-8-3if4",
    name: "Pick-6: 8 Numbers, 3-if-4",
    description:
      "Efficient 8-number wheel. If 4 of your 8 are drawn, guaranteed 3-number match.",
    poolSize: 8,
    pickSize: 6,
    guaranteeMatch: 3,
    guaranteeIfDrawn: 4,
    ticketCount: 4,
    combinations: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 7, 8],
      [1, 2, 5, 6, 7, 8],
      [3, 4, 5, 6, 7, 8],
    ],
  },

  // ── L(9, 6, 4, 3) = 7 ──────────────────────────────────────────────────
  {
    id: "p6-9-3if4",
    name: "Pick-6: 9 Numbers, 3-if-4",
    description:
      "9-number wheel with solid 3-if-4 coverage at just 7 tickets.",
    poolSize: 9,
    pickSize: 6,
    guaranteeMatch: 3,
    guaranteeIfDrawn: 4,
    ticketCount: 7,
    combinations: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 7, 8, 9],
      [1, 4, 5, 7, 8, 9],
      [2, 4, 6, 7, 8, 9],
      [3, 4, 5, 6, 7, 8],
      [1, 2, 5, 6, 8, 9],
      [2, 3, 4, 5, 7, 9],
    ],
  },

  // ── L(10, 6, 4, 3) = 10 ─────────────────────────────────────────────────
  {
    id: "p6-10-3if4",
    name: "Pick-6: 10 Numbers, 3-if-4",
    description:
      "Popular 10-number wheel with 3-if-4 guarantee. Good balance of coverage and cost.",
    poolSize: 10,
    pickSize: 6,
    guaranteeMatch: 3,
    guaranteeIfDrawn: 4,
    ticketCount: 10,
    combinations: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 7, 8, 9],
      [1, 4, 5, 7, 8, 10],
      [2, 4, 6, 7, 9, 10],
      [3, 5, 6, 8, 9, 10],
      [1, 2, 6, 7, 8, 10],
      [1, 3, 4, 5, 9, 10],
      [2, 3, 5, 7, 8, 10],
      [2, 4, 5, 6, 8, 9],
      [3, 4, 6, 7, 9, 10],
    ],
  },

  // ── L(10, 6, 5, 4) = 20 ─────────────────────────────────────────────────
  {
    id: "p6-10-4if5",
    name: "Pick-6: 10 Numbers, 4-if-5",
    description:
      "Premium 10-number wheel. If 5 of your numbers hit, guaranteed 4-number match.",
    poolSize: 10,
    pickSize: 6,
    guaranteeMatch: 4,
    guaranteeIfDrawn: 5,
    ticketCount: 20,
    combinations: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 7, 8],
      [1, 2, 3, 4, 9, 10],
      [1, 2, 5, 6, 7, 8],
      [1, 2, 5, 6, 9, 10],
      [1, 2, 7, 8, 9, 10],
      [3, 4, 5, 6, 7, 8],
      [3, 4, 5, 6, 9, 10],
      [3, 4, 7, 8, 9, 10],
      [5, 6, 7, 8, 9, 10],
      [1, 3, 5, 7, 9, 10],
      [1, 3, 6, 8, 9, 10],
      [1, 4, 5, 8, 9, 10],
      [1, 4, 6, 7, 9, 10],
      [2, 3, 5, 8, 9, 10],
      [2, 3, 6, 7, 9, 10],
      [2, 4, 5, 7, 9, 10],
      [2, 4, 6, 8, 9, 10],
      [1, 3, 5, 7, 8, 10],
      [2, 4, 6, 7, 8, 9],
    ],
  },

  // ── L(12, 6, 4, 3) = 15 ─────────────────────────────────────────────────
  {
    id: "p6-12-3if4",
    name: "Pick-6: 12 Numbers, 3-if-4",
    description:
      "Wide 12-number pool with 3-if-4 guarantee. Great for players with many favorites.",
    poolSize: 12,
    pickSize: 6,
    guaranteeMatch: 3,
    guaranteeIfDrawn: 4,
    ticketCount: 15,
    combinations: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 7, 8, 9],
      [1, 2, 3, 10, 11, 12],
      [4, 5, 6, 7, 8, 9],
      [4, 5, 6, 10, 11, 12],
      [7, 8, 9, 10, 11, 12],
      [1, 4, 7, 10, 11, 12],
      [2, 5, 8, 10, 11, 12],
      [3, 6, 9, 10, 11, 12],
      [1, 5, 9, 7, 8, 12],
      [2, 6, 7, 4, 10, 11],
      [3, 4, 8, 5, 11, 12],
      [1, 6, 8, 10, 5, 9],
      [2, 4, 9, 11, 3, 7],
      [3, 5, 7, 12, 1, 6],
    ],
  },

  // ── L(12, 6, 5, 4) = 41 ─────────────────────────────────────────────────
  {
    id: "p6-12-4if5",
    name: "Pick-6: 12 Numbers, 4-if-5",
    description:
      "Premium 12-number wheel with strong 4-if-5 guarantee. Higher ticket count but powerful coverage.",
    poolSize: 12,
    pickSize: 6,
    guaranteeMatch: 4,
    guaranteeIfDrawn: 5,
    ticketCount: 41,
    combinations: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 7, 8],
      [1, 2, 3, 4, 9, 10],
      [1, 2, 3, 4, 11, 12],
      [1, 2, 5, 6, 7, 8],
      [1, 2, 5, 6, 9, 10],
      [1, 2, 5, 6, 11, 12],
      [1, 2, 7, 8, 9, 10],
      [1, 2, 7, 8, 11, 12],
      [1, 2, 9, 10, 11, 12],
      [3, 4, 5, 6, 7, 8],
      [3, 4, 5, 6, 9, 10],
      [3, 4, 5, 6, 11, 12],
      [3, 4, 7, 8, 9, 10],
      [3, 4, 7, 8, 11, 12],
      [3, 4, 9, 10, 11, 12],
      [5, 6, 7, 8, 9, 10],
      [5, 6, 7, 8, 11, 12],
      [5, 6, 9, 10, 11, 12],
      [7, 8, 9, 10, 11, 12],
      [1, 3, 5, 7, 9, 11],
      [1, 3, 5, 7, 10, 12],
      [1, 3, 5, 8, 9, 12],
      [1, 3, 6, 7, 9, 12],
      [1, 3, 6, 8, 10, 11],
      [1, 4, 5, 7, 10, 11],
      [1, 4, 5, 8, 9, 11],
      [1, 4, 6, 7, 9, 12],
      [1, 4, 6, 8, 10, 12],
      [2, 3, 5, 8, 10, 11],
      [2, 3, 6, 7, 10, 12],
      [2, 3, 6, 8, 9, 11],
      [2, 4, 5, 7, 9, 12],
      [2, 4, 5, 8, 10, 12],
      [2, 4, 6, 7, 11, 12],
      [2, 4, 6, 8, 9, 10],
      [2, 3, 5, 7, 11, 12],
      [1, 3, 6, 8, 9, 12],
      [2, 4, 5, 8, 11, 12],
      [1, 4, 6, 7, 10, 11],
      [2, 3, 6, 7, 9, 10],
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PICK-5 WHEELS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── L(7, 5, 3, 3) = 4 ──────────────────────────────────────────────────
  {
    id: "p5-7-3if3",
    name: "Pick-5: 7 Numbers, 3-if-3",
    description:
      "Full coverage pick-5 wheel. If any 3 of your 7 are drawn, guaranteed 3-match.",
    poolSize: 7,
    pickSize: 5,
    guaranteeMatch: 3,
    guaranteeIfDrawn: 3,
    ticketCount: 4,
    combinations: [
      [1, 2, 3, 4, 5],
      [1, 2, 3, 6, 7],
      [1, 4, 5, 6, 7],
      [2, 3, 4, 5, 7],
    ],
  },

  // ── L(8, 5, 4, 3) = 5 ──────────────────────────────────────────────────
  {
    id: "p5-8-3if4",
    name: "Pick-5: 8 Numbers, 3-if-4",
    description:
      "Efficient 8-number pick-5 wheel. If 4 of your 8 hit, guaranteed 3-match.",
    poolSize: 8,
    pickSize: 5,
    guaranteeMatch: 3,
    guaranteeIfDrawn: 4,
    ticketCount: 5,
    combinations: [
      [1, 2, 3, 4, 5],
      [1, 2, 6, 7, 8],
      [3, 4, 5, 6, 7],
      [1, 3, 5, 7, 8],
      [2, 4, 6, 7, 8],
    ],
  },

  // ── L(10, 5, 4, 3) = 12 ─────────────────────────────────────────────────
  {
    id: "p5-10-3if4",
    name: "Pick-5: 10 Numbers, 3-if-4",
    description:
      "Wide 10-number pick-5 wheel with 3-if-4 guarantee at 12 tickets.",
    poolSize: 10,
    pickSize: 5,
    guaranteeMatch: 3,
    guaranteeIfDrawn: 4,
    ticketCount: 12,
    combinations: [
      [1, 2, 3, 4, 5],
      [1, 2, 6, 7, 8],
      [1, 3, 6, 9, 10],
      [2, 4, 7, 9, 10],
      [3, 5, 8, 9, 10],
      [4, 5, 6, 7, 10],
      [1, 4, 5, 8, 9],
      [2, 3, 5, 7, 9],
      [2, 3, 6, 8, 10],
      [1, 4, 6, 8, 10],
      [3, 4, 7, 8, 10],
      [1, 2, 5, 9, 10],
    ],
  },
];

/** Find templates matching the given parameters. */
export function findMatchingTemplates(
  pickSize: number,
  poolSize?: number,
): WheelTemplate[] {
  return WHEEL_TEMPLATES.filter((tpl) => {
    if (tpl.pickSize !== pickSize) return false;
    if (poolSize !== undefined && tpl.poolSize !== poolSize) return false;
    return true;
  });
}

/** Get a specific template by ID. */
export function getTemplateById(id: string): WheelTemplate | undefined {
  return WHEEL_TEMPLATES.find((tpl) => tpl.id === id);
}
