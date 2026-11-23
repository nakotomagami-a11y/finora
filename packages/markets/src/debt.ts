// The US national debt ticker (loaders/markets.md §1.4 step 10). The official figure is daily; the
// ticker is an estimate that runs forward from it at last year's average rate.
import { addDays } from "./settings.ts";
import type { StoredObs } from "./calc.ts";

/** Close of business in Washington, as an approximation: the figure is "as of" this moment. */
export const DEBT_ANCHOR_UTC = "21:00:00Z";

export type DebtTicker = { total: number; anchor: string; perSecond: number; yearAgoDate: string };

export function debtTicker(observations: readonly StoredObs[]): DebtTicker | null {
  const obs = [...observations].sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = obs.at(-1);
  if (!latest) return null;
  const cutoff = addDays(latest.date, -365);
  const yearAgo = [...obs].reverse().find((o) => o.date <= cutoff);
  if (!yearAgo) return null;
  const anchor = `${latest.date}T${DEBT_ANCHOR_UTC}`;
  const seconds = (Date.parse(anchor) - Date.parse(`${yearAgo.date}T${DEBT_ANCHOR_UTC}`)) / 1000;
  return { total: latest.value, anchor, perSecond: (latest.value - yearAgo.value) / seconds, yearAgoDate: yearAgo.date };
}

/** The earlier figure may be at most this many days before the latest, or there is no 30-day change (qa NIT). */
export const DEBT_CHANGE_MAX_LOOKBACK_DAYS = 45;

/**
 * The debt card's "Change in 30 days" (DESIGN.md §12): the latest official figure minus the last one on or
 * before 30 days earlier, if that one is within 45 days. Both are published figures, so this is a fact, not
 * the ticker's estimate.
 */
export function debtChange(observations: readonly StoredObs[], days = 30): { valueUsd: number; from: string; to: string } | null {
  const obs = [...observations].sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = obs.at(-1);
  if (!latest) return null;
  const cutoff = addDays(latest.date, -days);
  const before = [...obs].reverse().find((o) => o.date <= cutoff);
  if (before && before.date < addDays(latest.date, -DEBT_CHANGE_MAX_LOOKBACK_DAYS)) return null;
  return before ? { valueUsd: latest.value - before.value, from: before.date, to: latest.date } : null;
}

/** What the client shows at `now`: the official total plus the estimated change since its anchor. */
export function tickerValue(ticker: DebtTicker, now: string): number {
  return ticker.total + ticker.perSecond * Math.max(0, (Date.parse(now) - Date.parse(ticker.anchor)) / 1000);
}
