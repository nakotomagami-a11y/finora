import { describe, expect, it } from "vitest";
import { connector, MARKET_CONNECTORS, readMarketSettings, settingKey, type MarketConnector } from "@finora/markets";
import { fakeMarketFetch, FIXTURE_TICKERS, FIXTURE_TODAY } from "@finora/markets/fixtures";
import { FetchError, type PoliteFetch } from "@finora/sources";
import { openStore, readMarketSeries, type Store } from "@finora/store";
import { runDueMarketJobs } from "./jobs.ts";
import { connectorProblems, runMarketSource } from "./runner.ts";
import { buildCrashView } from "./view.ts";

const NOW = `${FIXTURE_TODAY}T22:30:00Z`;
const KEYS = { MARKETS_S7_API_KEY: "fixture-key-0001", MARKETS_S3_API_KEY: "fixture-key-0002" };
const settings = (funds: Record<string, string> = {}) => readMarketSettings(new Map(Object.entries(funds).map(([slot, symbol]) => [settingKey.fund(slot as never), symbol])));

/** The polite fetcher's contract: a status of 400 or more is a FetchError. */
function politeOf(fetch = fakeMarketFetch()): PoliteFetch {
  return async (url, init) => {
    const r = await fetch(url, init);
    if (r.status >= 400) throw new FetchError("http_status", `${new URL(url).hostname}: HTTP ${r.status}`, r.status);
    return r;
  };
}

const run = (store: Store, c: MarketConnector, over: Partial<Parameters<typeof runMarketSource>[2]> = {}) =>
  runMarketSource(store, c, { mode: "daily", now: NOW, windowStart: "2024-12-22", keys: KEYS, slots: [], userAgent: "Finora test", fetch: politeOf(), ...over });
const get = (id: string) => connector(id) as MarketConnector;
const rows = (store: Store, view = buildCrashView(store, { settings: settings({ "M02.europe": FIXTURE_TICKERS[3] as string }), keys: KEYS, now: NOW })) => view.tiles.flatMap((t) => t.rows);

describe("market sources hold the licence invariants (R12, R13, R17)", () => {
  it.each(MARKET_CONNECTORS.map((c) => [c.meta.id, c] as const))("%s passes checkSource", (_id, c) => {
    expect(connectorProblems(c)).toEqual([]);
  });

  it("a connector whose licence forbids storage in the main store cannot write a row", async () => {
    const store = openStore({ dataDir: null });
    const bad: MarketConnector = { ...get("crypto-x4-ohlc"), meta: { ...get("crypto-x4-ohlc").meta, storage: "store" } };
    expect(connectorProblems(bad).join()).toMatch(/connector-cache/);
    expect(await run(store, bad)).toEqual({ kind: "skipped", reason: "invalid_source" });
    expect(readMarketSeries(store.db)).toEqual([]);
    expect((store.db.prepare("SELECT count(*) AS n FROM main.syncs").get() as { n: number }).n).toBe(0);
  });

  it.each(["agent-only", "live-no-store"] as const)("a connector of class %s writes no row and opens no sync (S22 review M2)", async (storage) => {
    const store = openStore({ dataDir: null });
    const other = { ...get("crypto-x4-ohlc"), meta: { ...get("crypto-x4-ohlc").meta, storage } } as unknown as MarketConnector;
    expect(await run(store, other)).toEqual({ kind: "skipped", reason: "invalid_source" });
    expect(readMarketSeries(store.db)).toEqual([]);
    expect((store.db.prepare("SELECT count(*) AS n FROM main.syncs").get() as { n: number }).n).toBe(0);
  });
});

describe("the market runner (loaders/markets.md §1.7)", () => {
  it("writes licensed series only to connector-cache.db and open ones to the main store, each with its sync's licence", async () => {
    const store = openStore({ dataDir: null });
    for (const id of ["us-fred-open", "crypto-x4-ohlc"]) expect((await run(store, get(id))).kind).toBe("content");
    const stored = readMarketSeries(store.db);
    expect(stored.filter((s) => s.sourceId === "crypto-x4-ohlc").every((s) => s.where === "cc")).toBe(true);
    expect(stored.filter((s) => s.sourceId === "us-fred-open").every((s) => s.where === "main")).toBe(true);
    const licences = store.db.prepare("SELECT source_id, licence_id, as_of_basis FROM main.syncs ORDER BY id").all();
    expect(licences).toEqual([
      { source_id: "us-fred-open", licence_id: "fred-public-domain", as_of_basis: "max_date_in_data" },
      { source_id: "crypto-x4-ohlc", licence_id: "provider-derived-x4", as_of_basis: "max_date_in_data" },
    ]);
  });

  it("records an unchanged artifact as one unchanged sync, and an older as-of as stale_skipped", async () => {
    const store = openStore({ dataDir: null });
    expect((await run(store, get("us-treasury-debt"))).kind).toBe("content");
    expect((await run(store, get("us-treasury-debt"))).kind).toBe("unchanged");
    const older = politeOf(fakeMarketFetch([{ match: /fiscaldata/, respond: () => ({ status: 200, headers: {}, bytes: new TextEncoder().encode(JSON.stringify({ data: [{ record_date: "2026-11-01", tot_pub_debt_out_amt: "1.00" }] })) }) }]));
    expect((await run(store, get("us-treasury-debt"), { fetch: older })).kind).toBe("stale_skipped");
  });

  it("refuses a window purge above the guard: a half-empty refetch deletes nothing and ends partial", async () => {
    const store = openStore({ dataDir: null });
    await run(store, get("us-fred-open"));
    const before = readMarketSeries(store.db).find((s) => s.seriesKey === "fred:DCOILBRENTEU")?.observations.length ?? 0;
    const thin = fakeMarketFetch([
      {
        match: /DCOILBRENTEU/,
        respond: () => {
          const csv = new TextDecoder().decode(new Uint8Array(0));
          void csv;
          const lines = ["observation_date,DCOILBRENTEU"];
          for (let d = new Date("2025-01-02T00:00:00Z"); d <= new Date(`${FIXTURE_TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 14)) lines.push(`${d.toISOString().slice(0, 10)},70`);
          lines.push(`${FIXTURE_TODAY},70`);
          return { status: 200, headers: {}, bytes: new TextEncoder().encode(lines.join("\n")) };
        },
      },
    ]);
    const outcome = await run(store, get("us-fred-open"), { fetch: politeOf(thin) });
    expect(outcome.kind).toBe("partial");
    const report = JSON.parse((store.db.prepare("SELECT report_json FROM main.syncs WHERE id = ?").get(outcome.kind === "partial" ? outcome.syncId : 0) as { report_json: string }).report_json) as { reason: string; deleted: number };
    expect(report).toMatchObject({ reason: "purge_guard", deleted: 0 });
    expect(readMarketSeries(store.db).find((s) => s.seriesKey === "fred:DCOILBRENTEU")?.observations.length).toBe(before);
  });

  it("names a rejected key, and stores no value from the failed sync", async () => {
    const store = openStore({ dataDir: null });
    const refused = politeOf(fakeMarketFetch([{ match: /tiingo/, respond: () => ({ status: 403, headers: {}, bytes: new Uint8Array() }) }]));
    const outcome = await run(store, get("stocks-s7"), { fetch: refused, slots: [{ slot: "M02.europe", symbol: FIXTURE_TICKERS[3] as string }] });
    expect(outcome).toMatchObject({ kind: "failed", reason: "key_rejected" });
    expect(readMarketSeries(store.db)).toEqual([]);
    const view = rows(store, buildCrashView(store, { settings: settings({ "M02.europe": FIXTURE_TICKERS[3] as string }), keys: KEYS, now: NOW }));
    expect(view.find((r) => r.rowKey === "M02.X.01:europe")?.state).toBe("error");
  });

  it("skips a source whose key is not set, writing no sync", async () => {
    const store = openStore({ dataDir: null });
    expect(await run(store, get("gold-s3"), { keys: {} })).toEqual({ kind: "skipped", reason: "key_missing" });
    expect((store.db.prepare("SELECT count(*) AS n FROM main.syncs").get() as { n: number }).n).toBe(0);
  });
});

describe("the Crash monitor view (architecture §8)", () => {
  it("shows loading on every row of a fresh store, never error; fund slots and keyless tiles say what they need", () => {
    const store = openStore({ dataDir: null });
    const states = rows(store, buildCrashView(store, { settings: settings(), keys: {}, now: NOW }));
    expect(states.filter((r) => r.state === "error")).toEqual([]);
    for (const r of states) expect(["loading", "needs_symbol", "needs_key"]).toContain(r.state);
    expect(states.filter((r) => r.state === "needs_symbol")).toHaveLength(13);
    expect(states.find((r) => r.rowKey === "M05.X.02b:gold_daily")?.state).toBe("needs_key");
  });

  it("fills every row after one pass of the jobs, with sources on every value and the total over two rows only", async () => {
    const store = openStore({ dataDir: null });
    const funds = { "M01.us_total": FIXTURE_TICKERS[0] as string, "M02.europe": FIXTURE_TICKERS[3] as string };
    const results = await runDueMarketJobs({ store, now: () => NOW, settings: () => settings(funds), keys: KEYS, userAgent: "Finora test", fetch: politeOf() });
    expect(results.filter((r) => r.outcome.kind === "failed")).toEqual([]);
    const view = buildCrashView(store, { settings: settings(funds), keys: KEYS, now: NOW });
    const all = view.tiles.flatMap((t) => t.rows);
    const by = (key: string) => all.find((r) => r.rowKey === key);
    expect(by("M07.X.01:brent")).toMatchObject({ state: "ok", peak: { basis: "since" } });
    expect(by("M03.X.01:taiwan")).toMatchObject({ state: "peak_unknown" });
    expect(by("M03.X.01:taiwan")?.drawdownPct).toBeUndefined();
    expect(by("M01.X.02:us_total")).toMatchObject({ state: "ok", symbol: FIXTURE_TICKERS[0] });
    expect(by("M01.X.02:us_large")?.state).toBe("needs_symbol");
    expect(by("M06.X.02:total_crypto")).toMatchObject({ state: "ok", peak: { basis: "all_time" }, valueLostUsd: 1e12 });
    expect(by("M06.X.01b:bitcoin")?.valueLostUsd).toBeGreaterThan(0);
    expect(by("M08.X.01:us_debt")?.ticker?.perSecond).toBeGreaterThan(0);
    expect(view.totalWiped).toMatchObject({ rowItemIds: ["M01.X.01", "M06.X.02"], excludedItemIds: [] });
    for (const r of all.filter((x) => x.value !== undefined)) {
      expect(r.sources.length, r.rowKey).toBeGreaterThan(0);
      for (const s of r.sources) expect(s.licenceId, r.rowKey).toMatch(/\S/);
    }
    expect(by("M06.X.01b:bitcoin")?.sources.some((s) => s.derived)).toBe(true);
  });

  it("keeps per-source daily request counts across a restart and stops at the free limit", async () => {
    const store = openStore({ dataDir: null });
    store.db.prepare("INSERT INTO main.jobs (name, last_run_at, last_status) VALUES (?, ?, ?)").run(`markets:calls:gold-s3:${FIXTURE_TODAY}`, NOW, "25");
    const results = await runDueMarketJobs({ store, now: () => NOW, settings: () => settings(), keys: KEYS, userAgent: "Finora test", fetch: politeOf() });
    expect(results.find((r) => r.sourceId === "gold-s3")?.outcome).toEqual({ kind: "skipped", reason: "daily_limit" });
    const again = await runDueMarketJobs({ store, now: () => NOW, settings: () => settings(), keys: KEYS, userAgent: "Finora test", fetch: politeOf() });
    expect(again).toEqual([]);
  });

  it("leaves out a total-crypto snapshot older than 24 h even before the expiry job runs (S22 review S1)", async () => {
    const store = openStore({ dataDir: null });
    await run(store, get("crypto-c1"), { mode: "latest" });
    await run(store, get("crypto-c3-global"));
    const later = new Date(Date.parse(NOW) + 25 * 3_600_000).toISOString();
    const row = rows(store, buildCrashView(store, { settings: settings(), keys: KEYS, now: later })).find((r) => r.rowKey === "M06.X.02:total_crypto");
    expect(row?.value).toBeUndefined();
    expect((store.db.prepare("SELECT count(*) AS n FROM cc.market_latest").get() as { n: number }).n).toBeGreaterThan(0);
  });

  it("deletes total-crypto snapshots older than 24 h (C1's terms), so the row shows no number", async () => {
    const store = openStore({ dataDir: null });
    const deps = { store, settings: () => settings(), keys: KEYS, userAgent: "Finora test", fetch: politeOf() };
    await runDueMarketJobs({ ...deps, now: () => NOW });
    const later = new Date(Date.parse(NOW) + 25 * 3_600_000).toISOString();
    const offline = politeOf(fakeMarketFetch([{ match: /coingecko/, respond: () => Promise.reject(new FetchError("network", "offline")) }]));
    await runDueMarketJobs({ ...deps, now: () => later, fetch: offline });
    const row = rows(store, buildCrashView(store, { settings: settings(), keys: KEYS, now: later })).find((r) => r.rowKey === "M06.X.02:total_crypto");
    expect(row?.value).toBeUndefined();
  });
});
