// Local settings for Crash monitor (loaders/markets.md §1.5). The fund slots went with the keys (H5).

export const PEAK_SINCE_DEFAULT = "2025-01-01";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const settingKey = { peakSince: "markets.peakSince" } as const;

export type MarketSettings = { peakSince: string };

/** Reads the market settings from the raw settings rows; invalid values are ignored, never guessed. */
export function readMarketSettings(rows: ReadonlyMap<string, string>): MarketSettings {
  const since = rows.get(settingKey.peakSince);
  return { peakSince: since && ISO_DATE.test(since) && isRealDate(since) ? since : PEAK_SINCE_DEFAULT };
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
