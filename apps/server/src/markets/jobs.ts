import "server-only";
// Runs the Crash monitor jobs that are due (loaders/markets.md §1.6). Last runs and per-source daily
// request counts live in main.jobs, so they survive a restart (council session 2, CFO note).
import { connector, dueJobs, FREE_LIMITS, JOBS, providerLicences, requestsPerRun, windowStart, type JobId, type MarketSettings, type Providers } from "@finora/markets";
import type { Licence, PoliteFetch } from "@finora/sources";
import { expireMarketLatest, type Store } from "@finora/store";
import { runMarketSource, type MarketRunOutcome } from "./runner.ts";

export type MarketJobsDeps = {
  store: Store;
  now: () => string;
  settings: () => MarketSettings;
  /** The user's local provider file, parsed (H4); empty when there is none. */
  providers: Providers;
  userAgent: string;
  fetch?: PoliteFetch;
};

const RUN = (id: JobId) => `markets:${id}`;
const CALLS = (sourceId: string, day: string) => `markets:calls:${sourceId}:${day}`;

/** When a client last polled the crash endpoint; set by the route. In memory: a restart simply idles. */
let lastClientPoll: string | null = null;
export function markClientPoll(at: string): void {
  lastClientPoll = at;
}

function lastRuns(store: Store): Map<JobId, string> {
  const rows = store.db.prepare("SELECT name, last_run_at FROM main.jobs WHERE name LIKE 'markets:%' AND name NOT LIKE 'markets:calls:%'").all() as { name: string; last_run_at: string | null }[];
  return new Map(rows.filter((r) => r.last_run_at).map((r) => [r.name.slice("markets:".length) as JobId, r.last_run_at as string]));
}

function callsToday(store: Store, sourceId: string, day: string): number {
  const row = store.db.prepare("SELECT last_status FROM main.jobs WHERE name = ?").get(CALLS(sourceId, day)) as { last_status: string | null } | undefined;
  return Number(row?.last_status ?? 0);
}

function addCalls(store: Store, sourceId: string, day: string, n: number, at: string): void {
  store.db
    .prepare(`INSERT INTO main.jobs (name, last_run_at, last_status) VALUES (?, ?, ?) ON CONFLICT (name) DO UPDATE SET last_run_at = excluded.last_run_at, last_status = CAST(CAST(main.jobs.last_status AS INTEGER) + ? AS TEXT)`)
    .run(CALLS(sourceId, day), at, String(n), n);
}

/** Runs every due job once, in schedule order. Returns what each source run did. */
export async function runDueMarketJobs(deps: MarketJobsDeps): Promise<{ job: JobId; sourceId: string; outcome: MarketRunOutcome }[]> {
  const now = deps.now();
  const day = now.slice(0, 10);
  const settings = deps.settings();
  const licences: Record<string, Licence> = Object.fromEntries(providerLicences(deps.providers).map((l) => [l.id, l]));
  const results: { job: JobId; sourceId: string; outcome: MarketRunOutcome }[] = [];
  for (const id of dueJobs(now, lastRuns(deps.store), lastClientPoll)) {
    const job = JOBS.find((j) => j.id === id);
    if (!job) continue;
    if (id === "c1-expire") expireMarketLatest(deps.store.db, "cc", "crypto-c1", new Date(Date.parse(now) - 24 * 3_600_000).toISOString());
    for (const run of job.runs) {
      // A source whose provider the local file doesn't configure has no connector, so it is never fetched.
      const c = connector(run.sourceId, deps.providers);
      if (!c) continue;
      const cost = requestsPerRun(run.sourceId, run.mode);
      const limit = FREE_LIMITS[run.sourceId]?.perDay;
      if (limit !== undefined && callsToday(deps.store, run.sourceId, day) + cost > limit) {
        results.push({ job: id, sourceId: run.sourceId, outcome: { kind: "skipped", reason: "daily_limit" } });
        continue;
      }
      const outcome = await runMarketSource(deps.store, c, {
        mode: run.mode,
        now,
        windowStart: windowStart(settings.peakSince),
        licences,
        userAgent: deps.userAgent,
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
      });
      if (outcome.kind !== "skipped") addCalls(deps.store, run.sourceId, day, cost, now);
      results.push({ job: id, sourceId: run.sourceId, outcome });
    }
    deps.store.db
      .prepare("INSERT INTO main.jobs (name, last_run_at, last_status) VALUES (?, ?, 'done') ON CONFLICT (name) DO UPDATE SET last_run_at = excluded.last_run_at, last_status = 'done'")
      .run(RUN(id), now);
  }
  // Counters older than two days are not needed by any limit.
  deps.store.db.prepare("DELETE FROM main.jobs WHERE name LIKE 'markets:calls:%' AND substr(name, -10) < ?").run(new Date(Date.parse(now) - 2 * 86_400_000).toISOString().slice(0, 10));
  return results;
}

/** Polls the schedule once a minute; one pass at a time. Returns a stop function. */
export function startMarketJobs(deps: MarketJobsDeps): () => void {
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    void runDueMarketJobs(deps).finally(() => {
      running = false;
    });
  };
  tick();
  const timer = setInterval(tick, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
