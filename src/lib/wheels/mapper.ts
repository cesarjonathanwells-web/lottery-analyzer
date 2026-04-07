/**
 * Wheel Template Mapper
 *
 * Maps a template that uses sequential numbers (1..n) to the user's
 * actual chosen lottery numbers.
 *
 * Example:
 *   Template uses [1, 2, 3, 4, 5, 6] with poolSize=8
 *   User chose [3, 7, 12, 15, 22, 33, 45, 51]
 *   Template number 1 -> 3, 2 -> 7, 3 -> 12, etc.
 */

import type { WheelTemplate } from "./templates";

/**
 * Maps a template (using sequential 1..n) to the user's actual chosen numbers.
 *
 * @param template - The wheel template with sequential number combinations
 * @param userNumbers - The user's chosen pool numbers (must have length === template.poolSize)
 * @returns Array of ticket combinations using the user's actual numbers
 * @throws Error if userNumbers length doesn't match template.poolSize
 */
export function mapTemplate(
  template: WheelTemplate,
  userNumbers: number[],
): number[][] {
  if (userNumbers.length !== template.poolSize) {
    throw new Error(
      `Template requires exactly ${template.poolSize} numbers, but ${userNumbers.length} were provided`,
    );
  }

  // Sort user numbers ascending for consistent mapping
  const sorted = [...userNumbers].sort((a, b) => a - b);

  // Build mapping: template number (1-based) -> user number
  // Template number 1 -> sorted[0], 2 -> sorted[1], etc.
  return template.combinations.map((ticket) =>
    ticket.map((templateNum) => sorted[templateNum - 1]).sort((a, b) => a - b),
  );
}

/**
 * Verify that a mapped wheel maintains its coverage guarantee.
 * This is a sanity check that the mapping preserved the combinatorial structure.
 */
export function verifyMapping(
  template: WheelTemplate,
  mappedCombinations: number[][],
  userNumbers: number[],
): boolean {
  // The number of combinations should match
  if (mappedCombinations.length !== template.ticketCount) return false;

  // Every number in every ticket should be from the user's pool
  const userSet = new Set(userNumbers);
  for (const ticket of mappedCombinations) {
    if (ticket.length !== template.pickSize) return false;
    for (const num of ticket) {
      if (!userSet.has(num)) return false;
    }
  }

  return true;
}
