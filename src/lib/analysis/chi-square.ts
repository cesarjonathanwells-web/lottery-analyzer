import { gammaln } from "simple-statistics";
import type { Draw } from "@/lib/types";
import type { ChiSquareResult } from "./types";

/**
 * Compute the chi-square goodness-of-fit test for lottery draw randomness.
 *
 * Tests whether the observed frequency of each number deviates significantly
 * from the expected frequency under a fair draw model.
 *
 * Uses the correction factor (M-1)/(M-m) for drawing without replacement,
 * where M = numberRange and m = ballsPerDraw.
 *
 * @param draws        - Array of Draw objects
 * @param numberRange  - Maximum possible number (e.g. 69 for Powerball)
 * @param ballsPerDraw - Number of balls drawn per draw
 * @param minNumber    - Minimum number (default 1; use 0 for Pick games)
 * @returns ChiSquareResult with statistic, p-value, and interpretation
 */
export function computeChiSquare(
  draws: Draw[],
  numberRange: number,
  ballsPerDraw: number,
  minNumber: number = 1,
): ChiSquareResult {
  const totalNumbers = numberRange - minNumber + 1;

  if (draws.length === 0 || totalNumbers <= 1) {
    return {
      chiSquareStatistic: 0,
      degreesOfFreedom: Math.max(totalNumbers - 1, 0),
      pValue: 1,
      isRandom: true,
      interpretation:
        "Insufficient data to perform chi-square test.",
    };
  }

  const drawCount = draws.length;

  // Count observed frequencies
  const observed = new Map<number, number>();
  for (let i = minNumber; i <= numberRange; i++) {
    observed.set(i, 0);
  }

  for (const draw of draws) {
    for (const num of draw.numbers) {
      if (num >= minNumber && num <= numberRange) {
        observed.set(num, (observed.get(num) ?? 0) + 1);
      }
    }
  }

  // Expected frequency for each number under fair draw without replacement
  const expected = (drawCount * ballsPerDraw) / totalNumbers;

  // Correction factor for drawing without replacement
  // C = (M - 1) / (M - m) where M = totalNumbers, m = ballsPerDraw
  const correctionFactor =
    totalNumbers > ballsPerDraw
      ? (totalNumbers - 1) / (totalNumbers - ballsPerDraw)
      : 1;

  // Compute chi-square statistic
  let chiSquare = 0;
  for (let num = minNumber; num <= numberRange; num++) {
    const obs = observed.get(num) ?? 0;
    const diff = obs - expected;
    chiSquare += (diff * diff) / expected;
  }

  // Apply the correction factor
  chiSquare *= correctionFactor;

  const degreesOfFreedom = totalNumbers - 1;

  // Compute p-value using the regularized incomplete gamma function
  const pValue = 1 - chiSquaredCdf(chiSquare, degreesOfFreedom);

  const isRandom = pValue > 0.05;

  let interpretation: string;
  if (pValue > 0.1) {
    interpretation =
      "The distribution appears random. There is no statistically significant deviation from expected frequencies.";
  } else if (pValue > 0.05) {
    interpretation =
      "The distribution is marginally consistent with randomness. Minor deviations exist but are not statistically significant at the 5% level.";
  } else if (pValue > 0.01) {
    interpretation =
      "The distribution shows statistically significant deviation from expected frequencies (p < 0.05). Some numbers appear more or less frequently than expected.";
  } else {
    interpretation =
      "The distribution shows highly significant deviation from expected frequencies (p < 0.01). This could indicate non-random patterns in the data.";
  }

  return {
    chiSquareStatistic: Math.round(chiSquare * 1000) / 1000,
    degreesOfFreedom,
    pValue: Math.round(pValue * 10000) / 10000,
    isRandom,
    interpretation,
  };
}

/**
 * Chi-squared CDF using the regularized lower incomplete gamma function.
 * P(X <= x) for X ~ chi2(k)
 *
 * Uses the series expansion of the lower incomplete gamma function.
 */
function chiSquaredCdf(x: number, k: number): number {
  if (x <= 0) return 0;
  if (k <= 0) return 1;

  // chi2 CDF = regularizedGammaP(k/2, x/2)
  return regularizedGammaP(k / 2, x / 2);
}

/**
 * Regularized lower incomplete gamma function P(a, x) = gamma(a, x) / Gamma(a)
 * Computed via series expansion for small x, continued fraction for large x.
 */
function regularizedGammaP(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;

  // Use series expansion when x < a + 1, continued fraction otherwise
  if (x < a + 1) {
    return gammaPSeries(a, x);
  } else {
    // P(a, x) = 1 - Q(a, x) where Q uses continued fraction
    return 1 - gammaQContinuedFraction(a, x);
  }
}

/**
 * Series expansion for the regularized lower incomplete gamma function.
 */
function gammaPSeries(a: number, x: number): number {
  const lnGammaA = gammaln(a);
  const maxIterations = 200;
  const epsilon = 1e-12;

  let sum = 1 / a;
  let term = 1 / a;

  for (let n = 1; n < maxIterations; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * epsilon) break;
  }

  return sum * Math.exp(-x + a * Math.log(x) - lnGammaA);
}

/**
 * Continued fraction expansion for the regularized upper incomplete gamma function Q(a, x).
 * Uses the modified Lentz algorithm.
 */
function gammaQContinuedFraction(a: number, x: number): number {
  const lnGammaA = gammaln(a);
  const maxIterations = 200;
  const epsilon = 1e-12;
  const tiny = 1e-30;

  // Continued fraction: b0 = x + 1 - a, a1 = 1, b1 = 1
  let f = x + 1 - a;
  if (Math.abs(f) < tiny) f = tiny;
  let c = f;
  let d = 0;

  for (let i = 1; i < maxIterations; i++) {
    const aCoeff = -i * (i - a);
    const bCoeff = x + 2 * i + 1 - a;

    d = bCoeff + aCoeff * d;
    if (Math.abs(d) < tiny) d = tiny;

    c = bCoeff + aCoeff / c;
    if (Math.abs(c) < tiny) c = tiny;

    d = 1 / d;
    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < epsilon) break;
  }

  return Math.exp(-x + a * Math.log(x) - lnGammaA) / f;
}
