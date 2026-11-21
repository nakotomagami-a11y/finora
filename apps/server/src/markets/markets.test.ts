import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CrashResponse } from "@finora/api-contract";
import { isPersonalUseLine } from "@finora/domain";
import { describe, expect, it, vi } from "vitest";
import { connector, marketConnectors, providerLicences, readMarketSettings, type MarketConnector, type Providers } from "@finora/markets";
import { fakeMarketFetch, fixtureHost, fixtureProviders, fixtureProvidersJson, FIXTURE_TODAY } from "@finora/markets/fixtures";
import { FetchError, type Licence, type PoliteFetch } from "@finora/sources";
import { beginSync, openStore, readMarketSeries, writeBackup, type Store } from "@finora/store";
import { markClientPoll, runDueMarketJobs } from "./jobs.ts";
import { connectorProblems, runMarketSource } from "./runner.ts";
import { buildCrashView } from "./view.ts";
import { loadProviders } from "../services/markets.ts";

const NOW = `${FIXTURE_TODAY}T22:30:00Z`;
const PROVIDERS = fixtureProviders();
const LICENCES: Record<string, Licence> = Object.fromEntries(providerLicences(PROVIDERS).map((l) => [l.id, l]));
const settings = () => readMarketSettings(new Map());

/** The polite fetcher's contract: a status of 400 or more is a FetchError. */
function politeOf(fetch = fakeMarketFetch()): PoliteFetch {
  return async (url, init) => {
    const r = await fetch(url, init);
    if (r.status >= 400) throw new FetchError("http_status", `${new URL(url).hostname}: HTTP ${r.status}`, r.status);
    return r;
  };
}

const run = (store: Store, c: MarketConnector, over: Partial<Parameters<typeof runMarketSource>[2]> = {}) =>
  runMarketSource(store, c, { mode: "daily", now: NOW, windowStart: "2024-12-22", licences: LICENCES, userAgent: "Finora test", fetch: politeOf(), ...over });
const get = (id: string) => connector(id, PROVIDERS) as MarketConnector;
const view = (store: Store, providers: Providers = PROVIDERS, now = NOW) => buildCrashView(store, { settings: settings(), providers, now });
const rows = (store: Store, providers: Providers = PROVIDERS, now = NOW) => view(store, providers, now).tiles.flatMap((t) => t.rows);
const jobs = (store: Store, providers: Providers = PROVIDERS, over: Partial<Parameters<typeof runDueMarketJobs>[0]> = {}) =>
  runDueMarketJobs({ store, now: () => NOW, settings, providers, userAgent: "Finora test", fetch: politeOf(), ...over });

describe("market sources hold the licence invariants (R12, R13, R17)", () => {
  it.each(marketConnectors(PROVIDERS).map((c) => [c.meta.id, c] as const))("%s passes checkSource with the licences its provider file registers", (_id, c) => {
    expect(connectorProblems(c, LICENCES)).toEqual([]);
  });

  it("a configured connector whose licence forbids storage in the main store cannot write a row", async () => {
    const store = openStore({ dataDir: null });
    const bad: MarketConnector = { ...get("crypto-x4-ohlc"), meta: { ...get("crypto-x4-ohlc").meta, storage: "store" } };
    expect(connectorProblems(bad, LICENCES).join()).toMatch(/connector-cache/);
    expect(await run(store, bad)).toEqual({ kind: "skipped", reason: "invalid_source" });
    expect(readMarketSeries(store.db)).toEqual([]);
    expect((store.db.prepare("SELECT count(*) AS n FROM main.syncs").get() as { n: number }).n).toBe(0);
  });

  it.each(["agent-only", "live-no-store"] as const)("a connector of class %s writes no row and opens no sync (S22 review M2)", async (storage) => {
    const store = openStore({ dataDir: null });
    const other = { ...get("crypto-x4-ohlc"), meta: { ...get("crypto-x4-ohlc").meta, storage } } as unknown as MarketConnector;
    expect(await run(store, other)).toEqual({ kind: "skipped", reason: "invalid_source" });
    expect(readMarketSeries(store.db)).toEqual([]);
  });

  it("a configured connector whose licence the provider file didn't register writes nothing", async () => {
    const store = openStore({ dataDir: null });
    expect(await run(store, get("crypto-c1"), { licences: {} })).toEqual({ kind: "skipped", reason: "invalid_source" });
    expect(readMarketSeries(store.db)).toEqual([]);
  });
});

describe("the market runner (loaders/markets.md §1.7)", () => {
  it("writes licensed series only to connector-cache.db and open ones to the main store, each with its sync's licence", async () => {
    const store = openStore({ dataDir: null });
    for (const id of ["us-fred-open", "crypto-x4-ohlc"]) expect((await run(store, get(id))).kind).toBe("content");
    const stored = readMarketSeries(store.db);
    expect(stored.filter((s) => s.sourceId === "crypto-x4-ohlc").every((s) => s.where === "cc")).toBe(true);
    expect(stored.filter((s) => s.sourceId === "us-fred-open").every((s) => s.where === "main")).toBe(true);
    expect(store.db.prepare("SELECT source_id, licence_id FROM main.syncs ORDER BY id").all()).toEqual([
      { source_id: "us-fred-open", licence_id: "fred-public-domain" },
      { source_id: "crypto-x4-ohlc", licence_id: "fixture-x4" },
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

  it("fails a sync whose as-of, close or snapshot time is more than a day ahead, and stores nothing (SEC-5)", async () => {
    const store = openStore({ dataDir: null });
    const debtOn = (date: string) => politeOf(fakeMarketFetch([{ match: /fiscaldata/, respond: () => ({ status: 200, headers: {}, bytes: new TextEncoder().encode(JSON.stringify({ data: [{ record_date: date, tot_pub_debt_out_amt: "1.00" }] })) }) }]));
    const ahead = new Date(Date.parse(NOW) + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(await run(store, get("us-treasury-debt"), { fetch: debtOn(ahead) })).toMatchObject({ kind: "failed", reason: "future_date" });
    const snapshot: MarketConnector = { ...get("crypto-c3-global"), parse: () => ({ series: [{ series: { seriesKey: "c3:total_cap_peak", itemId: "M06.X.02", unit: "usd_cap", frequency: "daily_7d" }, latest: { value: 1, observedAt: `${ahead}T00:00:00Z` } }], dropped: [] }) };
    expect(await run(store, snapshot)).toMatchObject({ kind: "failed", reason: "future_date" });
    expect(readMarketSeries(store.db)).toEqual([]);
    // A day of slack: a close dated tomorrow in UTC still loads.
    const tomorrow = new Date(Date.parse(NOW) + 86_400_000).toISOString().slice(0, 10);
    expect((await run(openStore({ dataDir: null }), get("us-treasury-debt"), { fetch: debtOn(tomorrow) })).kind).toBe("content");
  });

  it("closes the sync as failed on an unforeseen error, and logs the error class only (SEC-7)", async () => {
    const store = openStore({ dataDir: null });
    const broken: MarketConnector = { ...get("us-fred-open"), parse: () => ({ series: [{ series: { seriesKey: "fred:DCOILBRENTEU", itemId: "M07.X.01", unit: "usd_per_bbl", frequency: "daily_exchange" }, observations: [{ date: "2026-11-18", value: { raw: "upstream-text" } as unknown as number }] }], dropped: [] }) };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(await run(store, broken)).toMatchObject({ kind: "failed", reason: "internal" });
      const sync = store.db.prepare("SELECT kind, report_json FROM main.syncs").get() as { kind: string; report_json: string };
      expect(sync.kind).toBe("failed");
      expect(JSON.parse(sync.report_json)).toMatchObject({ reason: "internal" });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0]?.[0])).toMatch(/^markets: us-fred-open sync \d+ failed \(\w+\)$/);
      expect(JSON.stringify(spy.mock.calls)).not.toContain("upstream-text");
    } finally {
      spy.mockRestore();
    }
    expect(readMarketSeries(store.db).flatMap((s) => s.observations)).toEqual([]);
  });

  it("closes a sync a crashed run of the same source left running, before it starts its own (N3)", async () => {
    const store = openStore({ dataDir: null });
    const c = get("us-treasury-debt");
    await run(store, c);
    await run(store, get("us-fred-open"));
    const left = beginSync(store.db, { sourceId: c.meta.id, licenceId: c.meta.licence, storage: "store", parserVersion: c.parserVersion, startedAt: NOW });
    const other = beginSync(store.db, { sourceId: "us-fred-open", licenceId: "fred-public-domain", storage: "store", parserVersion: "x", startedAt: NOW });
    await run(store, c);
    const kindOf = (id: number) => store.db.prepare("SELECT kind, report_json FROM main.syncs WHERE id = ?").get(id) as { kind: string; report_json: string };
    expect(kindOf(left).kind).toBe("failed");
    expect(JSON.parse(kindOf(left).report_json)).toEqual({ reason: "interrupted" });
    expect(kindOf(other).kind).toBe("running");
  });

  it("names a refusal, stores no value from the failed sync, and the row then shows an error", async () => {
    const store = openStore({ dataDir: null });
    const refused = politeOf(fakeMarketFetch([{ match: /x4\.provider/, respond: () => ({ status: 403, headers: {}, bytes: new Uint8Array() }) }]));
    expect(await run(store, get("crypto-x4-ohlc"), { fetch: refused })).toMatchObject({ kind: "failed", reason: "key_rejected" });
    expect(readMarketSeries(store.db)).toEqual([]);
    expect(rows(store).find((r) => r.rowKey === "M06.X.01b:bitcoin")?.state).toBe("error");
  });
});

describe("the Crash monitor view (architecture §8)", () => {
  it("shows loading on every row of a fresh store with a provider file, never error", () => {
    const store = openStore({ dataDir: null });
    const states = rows(store);
    expect(states.every((r) => r.state === "loading")).toBe(true);
  });

  it("shows provider rows as not configured, never zero, on a fresh install with no provider file (qa condition 4)", async () => {
    const store = openStore({ dataDir: null });
    await jobs(store, {});
    const all = rows(store, {});
    const crypto = all.filter((r) => r.rowKey.startsWith("M06.") || r.rowKey.startsWith("M03."));
    expect(crypto.map((r) => r.state)).toEqual(["not_configured", "not_configured", "not_configured", "not_configured", "not_configured"]);
    for (const r of crypto) {
      expect(r.value).toBeUndefined();
      expect(r.drawdownPct).toBeUndefined();
    }
    expect(all.find((r) => r.rowKey === "M07.X.01:brent")?.state).toBe("ok");
    expect(view(store, {}).totalWiped).toMatchObject({ rowItemIds: ["M01.X.01"], excludedItemIds: ["M06.X.02"] });
    expect(readMarketSeries(store.db).some((s) => s.where === "cc")).toBe(false);
  });

  it("fills every row after one pass of the jobs, with sources on every value and the total over two rows only", async () => {
    const store = openStore({ dataDir: null });
    const results = await jobs(store);
    expect(results.filter((r) => r.outcome.kind === "failed" || r.outcome.kind === "skipped")).toEqual([]);
    const v = view(store);
    const all = v.tiles.flatMap((t) => t.rows);
    const by = (key: string) => all.find((r) => r.rowKey === key);
    expect(v.tiles.map((t) => t.tileId)).toEqual(["M01", "M03", "M05", "M06", "M07", "M08"]);
    expect(by("M07.X.01:brent")).toMatchObject({ state: "ok", peak: { basis: "since" } });
    expect(by("M03.X.01:japan")).toMatchObject({ state: "ok" });
    expect(by("M03.X.01:taiwan")).toMatchObject({ state: "peak_unknown" });
    expect(by("M06.X.02:total_crypto")).toMatchObject({ state: "ok", peak: { basis: "all_time" }, valueLostUsd: 1e12 });
    expect(by("M06.X.01b:bitcoin")?.valueLostUsd).toBeGreaterThan(0);
    expect(by("M08.X.01:us_debt")?.ticker?.perSecond).toBeGreaterThan(0);
    expect(v.totalWiped).toMatchObject({ rowItemIds: ["M01.X.01", "M06.X.02"], excludedItemIds: [] });
    for (const r of all.filter((x) => x.value !== undefined)) {
      expect(r.sources.length, r.rowKey).toBeGreaterThan(0);
      for (const s of r.sources) expect(s.licenceId, r.rowKey).toMatch(/\S/);
    }
    expect(by("M06.X.01b:bitcoin")?.sources.some((s) => s.derived)).toBe(true);
  });

  it("shows the daily US rows with their personal-use attribution, kept in connector-cache.db only (legal 7066891816)", async () => {
    const store = openStore({ dataDir: null });
    await jobs(store);
    const daily = rows(store).filter((r) => r.itemId === "M01.X.03");
    expect(daily.map((r) => r.rowKey)).toEqual(["M01.X.03:us_large", "M01.X.03:us_broad", "M01.X.03:us_tech"]);
    for (const r of daily) {
      expect(r.state, r.rowKey).toBe("ok");
      expect(isPersonalUseLine(r.attribution ?? ""), r.rowKey).toBe(true);
      expect(r.valueLostUsd, r.rowKey).toBeUndefined();
    }
    expect(readMarketSeries(store.db).filter((s) => s.seriesKey.startsWith("fred-cited:us_")).map((s) => s.where)).toEqual(["cc", "cc", "cc"]);
    expect(CrashResponse.safeParse(view(store)).success).toBe(true);
  });

  it("shows a daily US row as not configured when the provider file lists no series for it, while Japan still loads", async () => {
    const store = openStore({ dataDir: null });
    const cited = PROVIDERS["fred-cited"];
    if (!cited?.series) throw new Error("fixture providers have no cited series");
    const japanOnly: Providers = { ...PROVIDERS, "fred-cited": { ...cited, series: cited.series.filter((s) => s.rowKey.startsWith("M03.")) } };
    await jobs(store, japanOnly);
    const all = rows(store, japanOnly);
    expect(all.filter((r) => r.itemId === "M01.X.03").map((r) => [r.state, r.value, r.attribution])).toEqual([
      ["not_configured", undefined, undefined],
      ["not_configured", undefined, undefined],
      ["not_configured", undefined, undefined],
    ]);
    expect(all.find((r) => r.rowKey === "M03.X.01:japan")?.state).toBe("ok");
  });

  it("refuses a daily US row with a value but no personal-use attribution in the response contract", async () => {
    const store = openStore({ dataDir: null });
    await jobs(store);
    const v = view(store);
    const row = v.tiles.flatMap((t) => t.rows).find((r) => r.rowKey === "M01.X.03:us_large");
    expect(row?.value).toBeDefined();
    for (const attribution of ["via the fixture provider", "Personal use; not for personal use by others", "For personal use only. Fixture owner's copyright, via FRED; 1-day lag. Redistribution permitted."]) {
      if (row) row.attribution = attribution;
      expect(CrashResponse.safeParse(v).success, attribution).toBe(false);
    }
  });

  it("leaves out a total-crypto snapshot older than 24 h even before the expiry job runs (S22 review S1)", async () => {
    const store = openStore({ dataDir: null });
    await run(store, get("crypto-c1"), { mode: "latest" });
    await run(store, get("crypto-c3-global"));
    const later = new Date(Date.parse(NOW) + 25 * 3_600_000).toISOString();
    expect(rows(store, PROVIDERS, later).find((r) => r.rowKey === "M06.X.02:total_crypto")?.value).toBeUndefined();
    expect((store.db.prepare("SELECT count(*) AS n FROM cc.market_latest").get() as { n: number }).n).toBeGreaterThan(0);
  });

  it("keeps per-source daily request counts across a restart, and runs nothing twice", async () => {
    const store = openStore({ dataDir: null });
    await jobs(store);
    expect(await jobs(store)).toEqual([]);
  });

  it("deletes total-crypto snapshots older than 24 h (C1's terms), so the row shows no number", async () => {
    const store = openStore({ dataDir: null });
    await jobs(store);
    const later = new Date(Date.parse(NOW) + 25 * 3_600_000).toISOString();
    const offline = politeOf(fakeMarketFetch([{ match: /c1\.provider/, respond: () => Promise.reject(new FetchError("network", "offline")) }]));
    await jobs(store, PROVIDERS, { now: () => later, fetch: offline });
    expect(rows(store, PROVIDERS, later).find((r) => r.rowKey === "M06.X.02:total_crypto")?.value).toBeUndefined();
  });
});

describe("the client poll that speeds up quote runs (SEC-8)", () => {
  it("counts the app's own page and header-less clients, never a cross-site request", () => {
    expect(markClientPoll(NOW, "cross-site")).toBe(false);
    expect(markClientPoll(NOW, "same-site")).toBe(false);
    expect(markClientPoll(NOW, "same-origin")).toBe(true);
    expect(markClientPoll(NOW, "none")).toBe(true);
    expect(markClientPoll(NOW, null)).toBe(true);
  });
});

describe("loading the provider file (H4)", () => {
  it("is user configuration: a backup never copies it, nor any host it names (architect 7067106700)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "finora-providers-backup-"));
    const store = openStore({ dataDir: dir });
    try {
      writeFileSync(join(dir, "providers.json"), fixtureProvidersJson());
      await jobs(store);
      const out = join(dir, "backups");
      const { path } = writeBackup(store.db, out, new Date(NOW));
      expect(readdirSync(out)).toEqual([path.slice(out.length + 1)]);
      const bytes = readFileSync(path).toString("latin1");
      for (const code of ["x4", "c1", "c3", "o3", "e1", "fredcited"]) expect(bytes, code).not.toContain(fixtureHost(code));
      expect(bytes).not.toContain("Personal use");
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });


  it("reads a valid file, treats a missing one as empty, and a broken one as configuring nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "finora-providers-"));
    try {
      const path = join(dir, "providers.json");
      expect(loadProviders(path)).toEqual({ providers: {}, problems: [] });
      writeFileSync(path, fixtureProvidersJson());
      expect(Object.keys(loadProviders(path).providers).sort()).toEqual(["c1", "c3", "e1", "fred-cited", "o3", "x4"]);
      writeFileSync(path, "{ broken");
      expect(loadProviders(path)).toEqual({ providers: {}, problems: ["file: not JSON"] });
      // Checked before any read (N5): an oversized file and a directory are refused unread.
      writeFileSync(path, " ".repeat(64 * 1024 + 1));
      expect(loadProviders(path)).toEqual({ providers: {}, problems: ["file: too large"] });
      const folder = join(dir, "folder.json");
      mkdirSync(folder);
      expect(loadProviders(folder)).toEqual({ providers: {}, problems: ["file: not a regular file"] });
      // A file licence may not reuse a built-in licence id (N4).
      const json = JSON.parse(fixtureProvidersJson()) as { providers: { x4: { licence: { id: string } } } };
      json.providers.x4.licence.id = "fred-public-domain";
      writeFileSync(path, JSON.stringify(json));
      expect(loadProviders(path).problems).toEqual(["providers.x4.licence.id: already used by a built-in licence or another entry"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
