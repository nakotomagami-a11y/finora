// When each Crash monitor source is fetched (loaders/markets.md §1.6, cto §7, council session 2 CFO
// note: the total-crypto aggregator every 15 min). Pure: the server asks which jobs are due.

export type JobId = "official" | "worldbank" | "x4-quotes" | "c1-quotes" | "crypto-daily" | "crypto-peak" | "stocks" | "gold" | "c1-expire";
export type JobRun = { sourceId: string; mode: "daily" | "latest" };

type Rule = { kind: "slots"; utc: readonly string[] } | { kind: "interval"; connectedMin: number; idleMin: number } | { kind: "new_york"; at: string; weekdaysOnly: boolean };

export type Job = { id: JobId; runs: readonly JobRun[]; rule: Rule };

export const JOBS: readonly Job[] = [
  {
    id: "official",
    runs: [
      { sourceId: "us-treasury-debt", mode: "daily" },
      { sourceId: "us-fred-open", mode: "daily" },
      { sourceId: "us-fred-cited", mode: "daily" },
      { sourceId: "tw-twse-index", mode: "daily" },
    ],
    rule: { kind: "slots", utc: ["01:00", "07:00", "13:00", "19:00"] },
  },
  { id: "worldbank", runs: [{ sourceId: "intl-worldbank-pinksheet", mode: "daily" }], rule: { kind: "slots", utc: ["12:00"] } },
  { id: "x4-quotes", runs: [{ sourceId: "crypto-x4-ohlc", mode: "latest" }], rule: { kind: "interval", connectedMin: 5, idleMin: 60 } },
  { id: "c1-quotes", runs: [{ sourceId: "crypto-c1", mode: "latest" }], rule: { kind: "interval", connectedMin: 15, idleMin: 60 } },
  {
    id: "crypto-daily",
    runs: [
      { sourceId: "crypto-x4-ohlc", mode: "daily" },
      { sourceId: "crypto-c1", mode: "daily" },
      { sourceId: "crypto-o3-btc-height", mode: "daily" },
    ],
    rule: { kind: "interval", connectedMin: 60, idleMin: 60 },
  },
  { id: "crypto-peak", runs: [{ sourceId: "crypto-c3-global", mode: "daily" }], rule: { kind: "slots", utc: ["00:30"] } },
  // The intraday endpoint is pending the key round (loaders/markets.md, stocks-s7), so stocks run once after the close.
  { id: "stocks", runs: [{ sourceId: "stocks-s7", mode: "daily" }], rule: { kind: "new_york", at: "16:30", weekdaysOnly: true } },
  { id: "gold", runs: [{ sourceId: "gold-s3", mode: "daily" }], rule: { kind: "slots", utc: ["22:00"] } },
  // Not a fetch: deletes C1 snapshots older than 24 h (its terms), so it costs no request.
  { id: "c1-expire", runs: [], rule: { kind: "interval", connectedMin: 60, idleMin: 60 } },
];

/** A client counts as connected for 30 min after its last poll of the crash endpoint. */
export const CONNECTED_GRACE_MS = 30 * 60 * 1000;

const ms = (iso: string) => Date.parse(iso);

/** The latest scheduled moment at or before `now` for a rule with fixed times. */
function lastSlot(rule: Rule, now: string): number | null {
  const t = ms(now);
  if (rule.kind === "slots") {
    const day = now.slice(0, 10);
    const today = rule.utc.map((hm) => ms(`${day}T${hm}:00Z`)).filter((s) => s <= t);
    if (today.length) return Math.max(...today);
    const prev = new Date(t - 86_400_000).toISOString().slice(0, 10);
    return Math.max(...rule.utc.map((hm) => ms(`${prev}T${hm}:00Z`)));
  }
  if (rule.kind === "new_york") {
    for (let back = 0; back < 8; back++) {
      const probe = t - back * 86_400_000;
      const { date, weekday } = newYorkDate(probe);
      if (rule.weekdaysOnly && (weekday === 0 || weekday === 6)) continue;
      const slot = newYorkToUtc(date, rule.at);
      if (slot <= t) return slot;
    }
    return null;
  }
  return null;
}

const NY = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });

function newYorkParts(t: number): Record<string, string> {
  return Object.fromEntries(NY.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
}

function newYorkDate(t: number): { date: string; weekday: number } {
  const p = newYorkParts(t);
  return { date: `${p.year}-${p.month}-${p.day}`, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday ?? "") };
}

/** A New York wall-clock time on a date, as UTC epoch ms (handles daylight saving). */
export function newYorkToUtc(date: string, hm: string): number {
  const guess = ms(`${date}T${hm}:00Z`);
  const p = newYorkParts(guess);
  const shown = ms(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
  return guess + (guess - shown);
}

/** Jobs due at `now`, given each job's last run and when a client last polled. A job never run is due (catch-up at boot). */
export function dueJobs(now: string, lastRun: ReadonlyMap<JobId, string>, lastClientPoll: string | null): JobId[] {
  const connected = lastClientPoll !== null && ms(now) - ms(lastClientPoll) <= CONNECTED_GRACE_MS;
  return JOBS.filter((job) => {
    const last = lastRun.get(job.id);
    if (!last) return true;
    if (job.rule.kind === "interval") return ms(now) - ms(last) >= (connected ? job.rule.connectedMin : job.rule.idleMin) * 60_000;
    const slot = lastSlot(job.rule, now);
    return slot !== null && ms(last) < slot;
  }).map((j) => j.id);
}

/** Requests one run of a source costs (pagination and fund slots counted); the budget test uses it. */
export function requestsPerRun(sourceId: string, mode: "daily" | "latest", slotsFilled: number): number {
  switch (sourceId) {
    case "us-fred-open":
      return 3;
    case "intl-worldbank-pinksheet":
      return 2;
    case "stocks-s7":
      return slotsFilled;
    case "crypto-x4-ohlc":
      return 2;
    case "crypto-o3-btc-height":
      return 2;
    case "crypto-c1":
      return mode === "daily" ? 2 : 1;
    default:
      return 1;
  }
}

/** The free limits the schedule must keep to (research/markets.md; "never faster than hourly" for S7). */
export const FREE_LIMITS: Readonly<Record<string, { perDay?: number; perHour?: number; perMonth?: number }>> = {
  "stocks-s7": { perDay: 1000, perHour: 50 },
  "gold-s3": { perDay: 25 },
  "crypto-c1": { perMonth: 10_000 },
  "crypto-c3-global": { perMonth: 20_000 },
  "crypto-x4-ohlc": { perHour: 60_000 },
};
