// Regression tests for the S04i review (docs/plan/reviews/slices/S04i.md): qa M1-M5, S4, S5, S8,
// S9 and security SEC-1 to SEC-4, each reproduced first.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { balticCheckDigit } from "@finora/domain";
import { openStore } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { fetchOnView, type LiveCachedLoader } from "./live-cache.ts";
import { clearLiveView, liveView } from "./live-views.ts";
import { runSync } from "./pipeline.ts";
import { companies, companyRecord, fakeSource, noNetwork, roleSetRecord } from "./testing/fake-source.ts";
import { count, memoryDb, records, sync, tempDir } from "./test-helpers.ts";
import { runSyncInWorker } from "./worker.ts";

const SENTINEL = "SENTINEL-VALUE-91c2";
const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));
const dir = () => {
  const d = tempDir();
  dirs.push(d);
  return d.path;
};
const eeLt = () => {
  const first10 = ["3000", "1010", "00"].join("");
  return `${first10}${balticCheckDigit(first10)}`;
};

describe("SEC-1: P3 holds for every value, event data included", () => {
  it("drops and counts a personal code in an event's data; the event keeps its other fields", async () => {
    const db = memoryDb();
    const record = companyRecord(1);
    record.events = [{ entityEid: "lv-00000000001", type: "register.insolvency", date: "2026-10-01", itemId: "S09.LV.01", data: { administrator: `Administrator ${eeLt()}`, court: "Example court" } }];
    const outcome = await sync(db, fakeSource({}, { records: [record] }));
    expect(outcome.report?.dropped).toEqual({ personal_code: 1 });
    expect(db.prepare("SELECT data FROM main.events").get()).toEqual({ data: JSON.stringify({ court: "Example court" }) });
  });
});

describe("SEC-2: a report entry is built from known fields, never a value", () => {
  it("strips extra keys from loader drops, maps an unknown prop and a free-text party type away", async () => {
    const db = memoryDb();
    const record = companyRecord(1);
    (record as unknown as { dropped: unknown[] }).dropped = [
      { reason: "hide_item", prop: "name", value: SENTINEL },
      { reason: `free text ${SENTINEL}`, prop: SENTINEL },
    ];
    record.parties = [{ type: `Holder ${SENTINEL}`, entities: [] }];
    const outcome = await sync(db, fakeSource({}, { records: [record] }));
    const stored = JSON.stringify(db.prepare("SELECT report_json FROM main.syncs").all());
    expect(stored).not.toContain(SENTINEL);
    expect(outcome.report?.dropped).toEqual({ hide_item: 1, other: 1, party_not_proven: 1 });
  });
});

describe("SEC-3, qa M2: the lease is kept for the whole sync, and a lost lease stops it", () => {
  it("a fetch longer than the lease TTL keeps the lease: a second sync started meanwhile is refused", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 5) });
    const fetch = loader.fetch.bind(loader);
    loader.fetch = async (ctx) => {
      await new Promise((r) => setTimeout(r, 400));
      return fetch(ctx);
    };
    const first = runSync(db, loader, { fetcher: noNetwork, leaseTtlMs: 120, holder: "a" });
    await new Promise((r) => setTimeout(r, 250));
    expect((await runSync(db, fakeSource({}, { records: [] }), { fetcher: noNetwork, holder: "b" })).kind).toBe("already_running");
    expect((await first).kind).toBe("content");
  });

  it("a lease taken over mid-sync ends the sync partial, lease_lost, with no purge", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 50) });
    await sync(db, loader);
    loader.state.records = companies(1, 45);
    loader.state.asOf = { in_file_field: "2026-11-02" };
    const fetch = loader.fetch.bind(loader);
    loader.fetch = async (ctx) => {
      db.prepare("UPDATE main.leases SET holder = 'someone-else'").run();
      return fetch(ctx);
    };
    expect(await runSync(db, loader, { fetcher: noNetwork, holder: "mine" })).toMatchObject({ kind: "partial", report: { reason: "lease_lost" } });
    expect(records(db)).toBe(50);
    expect(db.prepare("SELECT holder FROM main.leases").get()).toEqual({ holder: "someone-else" });
  });
});

describe("qa M1: a live-no-store view reaches the process that serves it", () => {
  it("a worker sync posts the view back to its parent", async () => {
    const data = dir();
    openStore({ dataDir: data }).close();
    clearLiveView("fake-live");
    const outcome = await runSyncInWorker(new URL("./testing/test-sync-worker.ts", import.meta.url), { dataDir: data, sourceId: "fake-live", userAgent: "test", options: {} });
    expect(outcome.kind).toBe("content");
    expect(liveView("fake-live")?.rows).toHaveLength(4);
  }, 60_000);

  it("without a view held, an unchanged token is not enough: the file is read again", async () => {
    const db = memoryDb();
    const loader = fakeSource({ id: "lv-small-list", storage: "live-no-store" }, { records: companies(1, 3), token: "t1" });
    await sync(db, loader);
    clearLiveView("lv-small-list");
    loader.state.unchanged = true;
    let calls = 0;
    const fetch = loader.fetch.bind(loader);
    loader.fetch = async (ctx) => (calls++ === 0 ? fetch(ctx) : (loader.state.unchanged = false, fetch(ctx)));
    expect((await sync(db, loader)).kind).toBe("content");
    expect(liveView("lv-small-list")?.rows).toHaveLength(3);
  });
});

describe("qa M3: the share-alike store has the purge guard", () => {
  it("an empty or half file leaves the rows; --allow-mass-purge overrides", async () => {
    const db = memoryDb();
    const tax = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        recordKey: `k${i}`,
        hashInput: [String(i)],
        entities: [],
        reports: [{ entityEid: `ee-${String(i).padStart(8, "0")}`, kind: "taxes", periodEnd: "2026-09-30", itemId: "S08.EE.01b", facts: [{ concept: "taxes_paid", value: i }] }],
      }));
    const loader = fakeSource({ id: "ee-tax", country: "ee", storage: "share-alike-store", licence: "cc-by-sa-3.0" }, { records: tax(100) });
    await sync(db, loader);
    for (const [n, day] of [[0, "02"], [50, "03"]] as const) {
      loader.state.records = tax(n);
      loader.state.asOf = { in_file_field: `2026-11-${day}` };
      expect((await sync(db, loader)).report?.reason).toBe("purge_guard");
      expect(count(db, "SELECT COUNT(*) AS n FROM sa.sa_statements")).toBe(100);
    }
    expect((await sync(db, loader, { allowMassPurge: true })).kind).toBe("content");
    expect(count(db, "SELECT COUNT(*) AS n FROM sa.sa_statements")).toBe(50);
  });
});

describe("qa M4: an invalid record never deletes its stored copy", () => {
  it("1 of 100 records fails validation: skipped and counted, not purged", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 100) });
    await sync(db, loader);
    const broken = companies(1, 100);
    (broken[41] as unknown as { entities: unknown }).entities = "not a list";
    loader.state.records = broken;
    loader.state.asOf = { in_file_field: "2026-11-02" };
    const outcome = await sync(db, loader);
    expect(outcome.report).toMatchObject({ deleted: 0, skipped: { invalid_record: 1 } });
    expect(records(db)).toBe(100);
  });
});

describe("qa M5: a stale artifact never replaces the raw cache", () => {
  it("the cache keeps the newer file after a stale one is skipped", async () => {
    const db = memoryDb();
    const cache = dir();
    const loader = fakeSource({}, { records: companies(1, 3), asOf: { in_file_field: "2026-11-10" } });
    await sync(db, loader, { rawCacheDir: cache });
    const newer = readFileSync(join(cache, "fake-register", "000.gz"));
    loader.state.records = companies(1, 2);
    loader.state.asOf = { in_file_field: "2026-11-01" };
    expect((await sync(db, loader, { rawCacheDir: cache })).kind).toBe("stale_skipped");
    expect(readFileSync(join(cache, "fake-register", "000.gz")).equals(newer)).toBe(true);
  });
});

describe("qa S8, S9: explicit deletes and person fields", () => {
  it("refuses an explicit delete unless the source is a change feed", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 10) });
    await sync(db, loader);
    loader.state.records = [...companies(1, 10), { ...companyRecord(3), op: "delete" as const }];
    loader.state.asOf = { in_file_field: "2026-11-02" };
    expect((await sync(db, loader)).report).toMatchObject({ deleted: 0, skipped: { delete_not_allowed: 1 } });
  });

  it("refuses a person record whose key, hash input or line id holds a personal code or a person row id", async () => {
    const db = memoryDb();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
    const bad = [
      { ...roleSetRecord(1, [{ name: "A", role: "board_member", rowId: "1" }]), recordKey: `lv-00000000001:${eeLt()}` },
      { ...roleSetRecord(1, [{ name: "A", role: "board_member", rowId: "1" }]), hashInput: ["p-7-0"] },
      roleSetRecord(1, [{ name: "A", role: "board_member", rowId: ["010190", "12345"].join("-") }]),
    ];
    const outcome = await sync(db, fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records: bad }));
    expect(outcome.report?.skipped).toEqual({ person_field: 3 });
    expect(count(db, "SELECT COUNT(*) AS n FROM main.entities WHERE eid LIKE 'p-%'")).toBe(0);
  });

  it("masks a refused sole-trader id in the hash input, so no row hash covers it", async () => {
    const db = memoryDb();
    const id = ["010190", "12345"].join("");
    const record = companyRecord(9, { legalForm: "lv-ik", extra: [{ prop: "registrationNumber", value: id, itemId: "S01.LV.01" }] });
    record.hashInput = [record.recordKey, id];
    const twin = { ...record, hashInput: [record.recordKey, "[withheld]"] };
    await sync(db, fakeSource({}, { records: [record] }));
    const stored = db.prepare("SELECT row_hash FROM main.records").get() as { row_hash: Uint8Array };
    const db2 = memoryDb();
    await sync(db2, fakeSource({}, { records: [twin] }));
    expect(Buffer.from(stored.row_hash).equals(Buffer.from((db2.prepare("SELECT row_hash FROM main.records").get() as { row_hash: Uint8Array }).row_hash))).toBe(true);
  });
});

describe("SEC-4, qa S4, S5: live-cache views", () => {
  const principals = (names: string[]) => [
    { recordKey: "r1", hashInput: names, entities: [{ eid: "us-ct-FX0001", schema: "Company" as const, country: "us", legalForm: "us-llc", code: "FX0001", statements: [{ prop: "name", value: "Example Holdings LLC", itemId: "S01.US.02" }] }] },
    { recordKey: "r2", hashInput: ["second"], entities: [{ eid: "us-ct-FX0002", schema: "Company" as const, country: "us", legalForm: "us-llc", code: "FX0002", statements: [{ prop: "name", value: "Second Holdings LLC", itemId: "S01.US.02" }] }] },
  ];
  function source(delayMs: number) {
    const base = fakeSource({ id: "us-ct-business", country: "us", storage: "live-cached", items: ["S01.US.02"] });
    return Object.assign(base, {
      async fetchRecord() {
        await new Promise((r) => setTimeout(r, delayMs));
        return [{ dataset: "master", status: "ok" as const, artifacts: [{ name: "r", bytes: new TextEncoder().encode(JSON.stringify({ records: principals(["x"]) })), fetchedAt: "" }] }];
      },
    }) as LiveCachedLoader;
  }

  it("two concurrent views of one record: one fetches, the other serves the store; both datasets' records are kept", async () => {
    const db = memoryDb();
    const loader = source(100);
    const view = () => fetchOnView(db, loader, { recordKey: "FX0001", entityEid: "us-ct-FX0001", datasets: ["master"] }, { fetcher: noNetwork, keys: {}, now: new Date("2026-11-21T10:00:00Z") });
    const results = await Promise.all([view(), view()]);
    expect(results.map((r) => r.master).sort()).toEqual(["cached", "fresh"]);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.records WHERE source_id = 'us-ct-business'")).toBe(2);
    expect(db.isTransaction).toBe(false);
    expect(db.prepare("SELECT kind FROM main.syncs").all()).toEqual([{ kind: "content" }]);
  });
});

describe("qa D2: two workers open and migrate one fresh data dir", () => {
  it("neither fails with a lock", async () => {
    const data = dir();
    const entry = new URL("./testing/test-sync-worker.ts", import.meta.url);
    const job = { dataDir: data, sourceId: "fake-slow", userAgent: "test", options: {} };
    const outcomes = await Promise.all([runSyncInWorker(entry, job), runSyncInWorker(entry, job)]);
    for (const o of outcomes) expect(o.kind).not.toBe("failed");
    expect(existsSync(join(data, "finora.db"))).toBe(true);
  }, 60_000);
});

describe("SEC-12: a worker that cannot run its source ends failed, never running", () => {
  it("an unknown source id is refused inside the worker", async () => {
    const data = dir();
    openStore({ dataDir: data }).close();
    const outcome = await runSyncInWorker(new URL("./testing/test-sync-worker.ts", import.meta.url), { dataDir: data, sourceId: "../../etc", userAgent: "t", options: {} });
    expect(outcome).toMatchObject({ kind: "failed", report: { reason: "unknown_source" } });
  }, 60_000);
});
