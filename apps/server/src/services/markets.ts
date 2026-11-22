import "server-only";
// Crash monitor service (S22): opens the store, reads the user's local provider file (H4), runs the
// market jobs in the background and answers the crash endpoint from what is stored. The endpoint never
// calls an upstream source. The provider file's contents never reach a log, an error or a response.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CrashResponse } from "@finora/api-contract";
import { parseProviders, PROVIDERS_MAX_BYTES, readMarketSettings, type Fetch, type Providers } from "@finora/markets";
import { FetchError, LICENCES, type PoliteFetch } from "@finora/sources";
import { openStore, startIdleMaintenance, type Store } from "@finora/store";
import pkg from "../../package.json" with { type: "json" };
import { getDataDir } from "../data-dir.ts";
import { getEnv } from "../env.ts";
import { markClientPoll, runDueMarketJobs, startMarketJobs } from "../markets/jobs.ts";
import { buildCrashView } from "../markets/view.ts";

let store: Store | undefined;
let stopJobs: (() => void) | undefined;
let providers: Providers | undefined;
/** Schema problems of the provider file, as paths only, for the Settings status (S24s). */
let providerProblems: string[] = [];

/** The fixture world's "today" (markets fixtures, FIXTURE_TODAY), at the evening after the closes. */
const FIXTURE_NOW = "2026-11-18T22:30:00Z";

/** The polite fetcher's contract over a fixture fetch: a status of 400 or more is a FetchError. */
function politePolicy(fetch: Fetch): PoliteFetch {
  return async (url, init) => {
    const r = await fetch(url, init);
    if (r.status >= 400) throw new FetchError("http_status", `${new URL(url).hostname}: HTTP ${r.status}`, r.status);
    return r;
  };
}

/** Tests and the demo profile hand in their own store and provider file. */
export function useMarketsStore(s: Store, p: Providers = {}): void {
  store = s;
  providers = p;
}

function getStore(): Store {
  if (!store) {
    store = openStore({ dataDir: getDataDir() });
    // The app's long-lived connection checkpoints nothing in its commits (wal_autocheckpoint = 0):
    // at start and on an idle timer, a PASSIVE checkpoint bounds the WAL between syncs, and any merge
    // or TRUNCATE a sync left owed runs (cto's fix 7, legal).
    startIdleMaintenance(store.db);
  }
  return store;
}

/** The user's provider file, read once: a missing or broken file configures nothing (qa 7066883380, condition 1). */
export function loadProviders(path: string): { providers: Providers; problems: string[] } {
  try {
    // Checked before reading (N5): a directory, a device or an oversized file is never read.
    const stat = statSync(path, { throwIfNoEntry: false });
    if (!stat) return { providers: {}, problems: [] };
    if (!stat.isFile()) return { providers: {}, problems: ["file: not a regular file"] };
    if (stat.size > PROVIDERS_MAX_BYTES) return { providers: {}, problems: ["file: too large"] };
    return parseProviders(readFileSync(path, "utf8"), { reservedLicenceIds: Object.keys(LICENCES) });
  } catch {
    return { providers: {}, problems: ["file: unreadable"] };
  }
}

function getProviders(): Providers {
  if (!providers) {
    const env = getEnv();
    const loaded = loadProviders(env.FINORA_PROVIDERS_FILE ?? join(getDataDir(), "providers.json"));
    providers = loaded.providers;
    providerProblems = loaded.problems;
    // A count only: the problems name paths, and the file itself is never logged (architect 7067106700).
    if (loaded.problems.length) console.warn(`markets: provider file refused (${loaded.problems.length} problems); its rows read not configured`);
  }
  return providers;
}

export function providerFileProblems(): readonly string[] {
  return providerProblems;
}

export function settingsOf(s: Store) {
  const rows = s.db.prepare("SELECT key, value FROM user.settings WHERE key LIKE 'markets.%'").all() as { key: string; value: string }[];
  return readMarketSettings(new Map(rows.map((r) => [r.key, r.value])));
}

/** Starts the market jobs once, from boot() (instrumentation runs it in the Node.js runtime only); test runs never fetch. */
export function startMarkets(): void {
  const env = getEnv();
  if (stopJobs || env.NODE_ENV === "test") return;
  if (env.FINORA_DEMO === "1") {
    // Demo: one pass of the real connectors over synthetic fixtures and placeholder providers, into an
    // in-memory store. No network. The fixtures load only here, so a normal build never runs them.
    const demo = openStore({ dataDir: null });
    stopJobs = () => undefined;
    void import("@finora/markets/fixtures").then(({ fakeMarketFetch, fixtureProviders }) => {
      useMarketsStore(demo, fixtureProviders());
      return runDueMarketJobs({ store: demo, now: () => FIXTURE_NOW, settings: () => settingsOf(demo), providers: fixtureProviders(), userAgent: "Finora demo", fetch: politePolicy(fakeMarketFetch()) });
    }).catch((error: unknown) => console.error(`markets: demo pass failed (${error instanceof Error ? error.name : "unknown"})`));
    return;
  }
  const s = getStore();
  const p = getProviders();
  // The user agent names the source URL: FRED's edge resets requests whose agent carries no (+https://...) part (measured 2026-11-21).
  stopJobs = startMarketJobs({ store: s, now: () => new Date().toISOString(), settings: () => settingsOf(s), providers: p, userAgent: `Finora/${pkg.version} (+${env.FINORA_SOURCE_URL})` });
}

export function getCrash(opts: { now?: string; store?: Store; fetchSite?: string | null } = {}): CrashResponse {
  const s = opts.store ?? getStore();
  const at = opts.now ?? (getEnv().FINORA_DEMO === "1" ? FIXTURE_NOW : new Date().toISOString());
  markClientPoll(at, opts.fetchSite ?? null);
  const view = buildCrashView(s, { settings: settingsOf(s), providers: getProviders(), now: at });
  return CrashResponse.parse(view);
}
