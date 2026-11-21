import { formatNumber, type Locale } from "@finora/i18n";
import type { Usage } from "@finora/api-contract";

export { formatDate, formatDateTime, formatNumber, formatRelative, formatTime } from "@finora/i18n";

/**
 * Standard tokens as the screens write them: `150k`, `2.9M`, `3.3M`, `85k`. Whole numbers below a thousand, one
 * decimal at most above, the decimal mark of the locale. The suffixes are the same in every locale.
 */
export function formatTokens(locale: Locale, tokens: number): string {
  const whole = Math.max(0, Math.trunc(tokens));
  if (whole >= 1_000_000) return `${formatNumber(locale, Math.floor(whole / 100_000) / 10, { maximumFractionDigits: 1 })}M`;
  if (whole >= 1000) return `${formatNumber(locale, Math.floor(whole / 100) / 10, { maximumFractionDigits: 1 })}k`;
  return formatNumber(locale, whole);
}

/**
 * The share of the cap in whole percent, rounded down so a run never looks further along than it is. While a run is
 * in progress the share counts what is held as well as what is spent (`(used + held) / cap`); once it has settled it
 * is `used / cap`. An empty cap is 0, never a division by zero, and a share above the cap stops at 100.
 */
export function usageShare(usage: Pick<Usage, "used" | "held" | "cap">, settled: boolean): number {
  if (usage.cap <= 0) return 0;
  const spent = settled ? usage.used : usage.used + usage.held;
  return Math.min(100, Math.floor((spent * 100) / usage.cap));
}

/** The solid part and the lighter band of the meter, in whole percent: `used` is solid, `held` sits after it. */
export function meterParts(usage: Pick<Usage, "used" | "held" | "cap">, settled: boolean): { solid: number; band: number } {
  if (usage.cap <= 0) return { solid: 0, band: 0 };
  const solid = Math.min(100, Math.floor((usage.used * 100) / usage.cap));
  const total = usageShare(usage, settled);
  return { solid, band: Math.max(0, total - solid) };
}

/** `18%`, with the percent sign placed the way the locale writes it. */
export function formatShare(locale: Locale, percent: number): string {
  return formatNumber(locale, percent / 100, { style: "percent", maximumFractionDigits: 0 });
}
