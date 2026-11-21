// Local settings for Crash monitor (loaders/markets.md §1.5, P12). Fund tickers live only in the
// user's own settings table, never in the repo: no slot has a default.

export const PEAK_SINCE_DEFAULT = "2025-01-01";

export const FUND_SLOTS = [
  "M01.us_total",
  "M01.us_large",
  "M01.us_tech",
  "M02.europe",
  "M03.japan",
  "M03.korea",
  "M03.taiwan",
  "M03.hong_kong",
  "M03.china",
  "M03.india",
  "M03.australia",
  "M04.canada",
  "M04.brazil",
] as const;
export type FundSlot = (typeof FUND_SLOTS)[number];

export const SYMBOL = /^[A-Z0-9.\-]{1,10}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const settingKey = {
  peakSince: "markets.peakSince",
  fund: (slot: FundSlot) => `markets.fund.${slot}`,
} as const;

export type MarketSettings = { peakSince: string; funds: Partial<Record<FundSlot, string>> };

/** Reads the market settings from the raw settings rows; invalid values are ignored, never guessed. */
export function readMarketSettings(rows: ReadonlyMap<string, string>): MarketSettings {
  const since = rows.get(settingKey.peakSince);
  const funds: Partial<Record<FundSlot, string>> = {};
  for (const slot of FUND_SLOTS) {
    const symbol = rows.get(settingKey.fund(slot));
    if (symbol && SYMBOL.test(symbol)) funds[slot] = symbol;
  }
  return { peakSince: since && ISO_DATE.test(since) && isRealDate(since) ? since : PEAK_SINCE_DEFAULT, funds };
}

export function validateSymbol(value: string): { ok: true; symbol: string } | { ok: false; reason: "invalid_symbol" } {
  const symbol = value.trim().toUpperCase();
  return SYMBOL.test(symbol) ? { ok: true, symbol } : { ok: false, reason: "invalid_symbol" };
}

function isRealDate(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Observations are kept from 10 days before the peak date, so the window start has a previous close. */
export function windowStart(peakSince: string): string {
  return addDays(peakSince, -10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
