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

/** What the client shows at `now`: the official total plus the estimated change since its anchor. */
export function tickerValue(ticker: DebtTicker, now: string): number {
  return ticker.total + ticker.perSecond * Math.max(0, (Date.parse(now) - Date.parse(ticker.anchor)) / 1000);
}
