import "server-only";
// Crash monitor service (S22): opens the store, runs the market jobs in the background and answers the
// crash endpoint from what is stored. The endpoint never calls an upstream source.
import { CrashResponse } from "@finora/api-contract";
import { FUND_SLOTS, readMarketSettings, settingKey, type Fetch } from "@finora/markets";
import { FetchError, type PoliteFetch } from "@finora/sources";
import { openStore, type Store } from "@finora/store";
import pkg from "../../package.json" with { type: "json" };
import { getDataDir } from "../data-dir.ts";
import { getEnv, marketKeys } from "../env.ts";
import { markClientPoll, runDueMarketJobs, startMarketJobs } from "../markets/jobs.ts";
import { buildCrashView } from "../markets/view.ts";

let store: Store | undefined;
let stopJobs: (() => void) | undefined;

/** The fixture world's "today" (markets fixtures, FIXTURE_TODAY), at the evening after the closes. */
const FIXTURE_NOW = "2026-11-18T22:30:00Z";
/** Fixture-only key values, so the demo shows the key-gated rows filled. */
const DEMO_KEYS = { MARKETS_S7_API_KEY: "fixture-demo-key", MARKETS_S3_API_KEY: "fixture-demo-key" };

/** The polite fetcher's contract over a fixture fetch: a status of 400 or more is a FetchError. */
function politePolicy(fetch: Fetch): PoliteFetch {
  return async (url, init) => {
    const r = await fetch(url, init);
    if (r.status >= 400) throw new FetchError("http_status", `${new URL(url).hostname}: HTTP ${r.status}`, r.status);
    return r;
  };
}

/** Tests and the demo profile hand in their own store (an in-memory or fixture store). */
export function useMarketsStore(s: Store): void {
  store = s;
}

function getStore(): Store {
  store ??= openStore({ dataDir: getDataDir() });
  return store;
}

export function settingsOf(s: Store) {
  const rows = s.db.prepare("SELECT key, value FROM user.settings WHERE key LIKE 'markets.%'").all() as { key: string; value: string }[];
  return readMarketSettings(new Map(rows.map((r) => [r.key, r.value])));
}

/**
 * Starts the market jobs once; demo and test runs never fetch. Called on the first crash request for now: starting
 * them in boot() pulls the store into the edge instrumentation bundle, so S25 moves this behind a Node-runtime guard.
 */
export function startMarkets(): void {
  const env = getEnv();
  if (stopJobs || env.NODE_ENV === "test") return;
  if (env.FINORA_DEMO === "1") {
    // Demo: one pass of the real connectors over synthetic fixtures, into an in-memory store. No network.
    // The fixtures load only here, so a normal build never runs them (S22 review NIT).
    const demo = openStore({ dataDir: null });
    useMarketsStore(demo);
    stopJobs = () => undefined;
    void import("@finora/markets/fixtures").then(({ fakeMarketFetch, FIXTURE_TICKERS }) => {
      const put = demo.db.prepare("INSERT INTO user.settings (key, value) VALUES (?, ?)");
      FUND_SLOTS.forEach((slot, i) => put.run(settingKey.fund(slot), FIXTURE_TICKERS[i] as string));
      return runDueMarketJobs({ store: demo, now: () => FIXTURE_NOW, settings: () => settingsOf(demo), keys: DEMO_KEYS, userAgent: "Finora demo", fetch: politePolicy(fakeMarketFetch()) });
    });
    return;
  }
  const s = getStore();
  // The user agent names the source URL: FRED's edge resets requests whose agent carries no (+https://...) part (measured 2026-11-21).
  stopJobs = startMarketJobs({ store: s, now: () => new Date().toISOString(), settings: () => settingsOf(s), keys: marketKeys(env), userAgent: `Finora/${pkg.version} (+${env.FINORA_SOURCE_URL})` });
}

export function getCrash(now?: string, given?: Store): CrashResponse {
  startMarkets();
  const s = given ?? getStore();
  const at = now ?? (getEnv().FINORA_DEMO === "1" ? FIXTURE_NOW : new Date().toISOString());
  markClientPoll(at);
  const keys = getEnv().FINORA_DEMO === "1" ? DEMO_KEYS : marketKeys(getEnv());
  const view = buildCrashView(s, { settings: settingsOf(s), keys, now: at });
  return CrashResponse.parse(view);
}
