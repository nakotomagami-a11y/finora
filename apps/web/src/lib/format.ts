import { formatNumber, type Locale } from "@finora/i18n";
import type { Usage } from "@finora/api-contract";

export { formatDate, formatDateTime, formatNumber, formatRelative, formatTime } from "@finora/i18n";

/**
 * How usage is rounded on screen (DESIGN.md §9.4). A number must never make a run look smaller than it is, or an
 * allowance look larger: amounts USED and HELD, and the estimate's typical and worst case, round UP to the digit shown;
 * amounts LEFT round DOWN; caps show as set; a share rounds up to a whole percent, with the two edges below. Meter
 * widths use the exact values. All of it is integer arithmetic on whole standard tokens until the last division.
 */

export type Rounding = "up" | "down";

/** The tokens in tenths of a thousand or of a million, rounded the given way, with its unit. */
function scaled(tokens: number, rounding: Rounding): { tenths: number; unit: "" | "k" | "M" } {
  const whole = Math.max(0, Math.trunc(tokens));
  if (whole < 1000) return { tenths: whole * 10, unit: "" };
  const k = rounding === "up" ? Math.ceil(whole / 100) : Math.floor(whole / 100); // tenths of a thousand
  // 999,950 rounds up to 1000.0k: write it as 1.0M instead of "1000k".
  if (k >= 10_000) return { tenths: rounding === "up" ? Math.ceil(whole / 100_000) : Math.floor(whole / 100_000), unit: "M" };
  return { tenths: k, unit: "k" };
}

/**
 * Standard tokens as the screens write them: `149.1k`, `2.9M`, `85k`. Whole numbers below a thousand, one decimal at
 * most above, the decimal mark of the locale. The suffixes are the same in every locale. `up` is for what was used
 * or held and for estimates; `down` is for what is left. A cap that is a round number reads the same either way.
 */
export function formatTokens(locale: Locale, tokens: number, rounding: Rounding = "up"): string {
  const { tenths, unit } = scaled(tokens, rounding);
  if (unit === "") return formatNumber(locale, tenths / 10);
  return `${formatNumber(locale, tenths / 10, { maximumFractionDigits: 1 })}${unit}`;
}

/** An amount that is left of an allowance: rounded down, so it never reads larger than it is. */
export function formatTokensLeft(locale: Locale, tokens: number): string {
  return formatTokens(locale, tokens, "down");
}

/**
 * An estimate, written as an "about" figure with two significant digits, rounded up: 153,000 reads `160k`, 307,000 reads
 * `310k`, 1,210,000 reads `1.3M`, 150,000 stays `150k` and 995,000 becomes `1M` (DESIGN.md §9.4). For the estimate's typical
 * and worst case and the Investigate button; the catalogue adds the word "about". Measured use keeps `formatTokens`.
 */
export function formatTokensEstimate(locale: Locale, tokens: number): string {
  const whole = Math.max(0, Math.trunc(tokens));
  let step = 1;
  while (whole >= step * 100) step *= 10; // the place of the second significant digit
  return formatTokens(locale, Math.ceil(whole / step) * step, "up");
}

export type Share = {
  /** Whole percent, rounded up; 100 only when the cap is reached. */
  percent: number;
  /** Some use, but less than 1%: the screen says "under 1%" and not a number. */
  underOne: boolean;
};

/**
 * The share of the cap. While a run is in progress it counts what is held as well as what is spent
 * (`(used + held) / cap`); once settled it is `used / cap`. An empty cap is 0. Rounds up to a whole percent, except
 * that non-zero use below 1% is `underOne`, and 99.6% reads 99: 100 means the cap is reached.
 */
export function usageShare(usage: Pick<Usage, "used" | "held" | "cap">, settled: boolean): Share {
  const spent = settled ? usage.used : usage.used + usage.held;
  if (usage.cap <= 0 || spent <= 0) return { percent: 0, underOne: false };
  if (spent >= usage.cap) return { percent: 100, underOne: false };
  const percent = Math.min(99, Math.ceil((spent * 100) / usage.cap));
  return { percent, underOne: spent * 100 < usage.cap };
}

/** The solid part and the lighter band of the meter, in percent of the cap, with their exact values. */
export function meterParts(usage: Pick<Usage, "used" | "held" | "cap">, settled: boolean): { solid: number; band: number } {
  if (usage.cap <= 0) return { solid: 0, band: 0 };
  const solid = Math.min(100, (usage.used * 100) / usage.cap);
  const total = Math.min(100, ((settled ? usage.used : usage.used + usage.held) * 100) / usage.cap);
  return { solid, band: Math.max(0, total - solid) };
}

/** `18%`, with the percent sign placed the way the locale writes it. */
export function formatShare(locale: Locale, percent: number): string {
  return formatNumber(locale, percent / 100, { style: "percent", maximumFractionDigits: 0 });
}

/** A share as the screens write it: `28%`, or the given words ("under 1%", from the catalogue) for use below one percent. */
export function describeShare(locale: Locale, share: Share, underOneText: string): string {
  return share.underOne ? underOneText : formatShare(locale, share.percent);
}
