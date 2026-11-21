// Synthetic market series for tests and the demo (loaders/markets.md §1.8). Every value is made up:
// a seeded walk with a planted peak on 2025-07-15 and a drawdown of exactly −23.4% on the fixture
// "today", 2026-11-18. No real price is ever committed.
import { addDays } from "../settings.ts";

export const FIXTURE_TODAY = "2026-11-18";
export const FIXTURE_PEAK_DATE = "2025-07-15";
export const FIXTURE_DRAWDOWN = -0.234;
export const FIXTURE_TICKERS = Array.from({ length: 13 }, (_, i) => `ZZFX${String(i + 1).padStart(2, "0")}`);

export type Calendar = "weekdays" | "all" | "month_end" | "quarter_end";

/** A small deterministic generator (mulberry32), so a seed always gives the same world. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dates(calendar: Calendar, from: string, to: string): string[] {
  const out: string[] = [];
  if (calendar === "month_end" || calendar === "quarter_end") {
    const step = calendar === "month_end" ? 1 : 3;
    const start = new Date(`${from}T00:00:00Z`);
    let m = calendar === "quarter_end" ? Math.floor(start.getUTCMonth() / 3) * 3 : start.getUTCMonth();
    for (let y = start.getUTCFullYear(); ; ) {
      const end = new Date(Date.UTC(y, m + step, 0)).toISOString().slice(0, 10);
      if (end > to) break;
      if (end >= from) out.push(end);
      m += step;
      if (m >= 12) {
        m -= 12;
        y++;
      }
    }
    return out;
  }
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (calendar === "all" || (w !== 0 && w !== 6)) out.push(d);
  }
  return out;
}

/**
 * A series that rises to `peak` on the planted peak date (or the nearest date after it) and ends
 * at peak × (1 + drawdown) on the last date. Every other value stays below the peak.
 */
export function plantedSeries(options: { seed: number; calendar: Calendar; from: string; to?: string; peak: number; drawdown?: number }): { date: string; value: number }[] {
  const to = options.to ?? FIXTURE_TODAY;
  const all = dates(options.calendar, options.from, to);
  const peakIndex = Math.max(0, all.findIndex((d) => d >= FIXTURE_PEAK_DATE));
  const last = all.length - 1;
  const end = options.peak * (1 + (options.drawdown ?? FIXTURE_DRAWDOWN));
  const start = options.peak * 0.8;
  const random = rng(options.seed);
  return all.map((date, i) => {
    if (i === peakIndex) return { date, value: options.peak };
    if (i === last) return { date, value: round(end) };
    const base = i < peakIndex ? start + ((options.peak - start) * i) / Math.max(1, peakIndex) : options.peak + ((end - options.peak) * (i - peakIndex)) / Math.max(1, last - peakIndex);
    const noisy = base * (1 + (random() - 0.5) * 0.01);
    return { date, value: round(Math.min(noisy, options.peak * 0.999)) };
  });
}

const round = (v: number) => Math.round(v * 100) / 100;
