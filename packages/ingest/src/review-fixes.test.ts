// Regression tests for the S04i review (docs/plan/reviews/slices/S04i.md): qa M1-M5, S4, S5, S8,
// S9 and security SEC-1 to SEC-4, each reproduced first.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { balticCheckDigit, isBalticPersonalCode, isFixtureRegisterCode, isValidRegisterCode } from "@finora/domain";
import { DEFAULT_LOADER_CONFIG } from "@finora/sources";
import { openStore, scanStore } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { fetchOnView, type LiveCachedLoader } from "./live-cache.ts";
import { clearLiveView, liveView } from "./live-views.ts";
import { runSync } from "./pipeline.ts";
import { companies, companyRecord, fakeSource, noNetwork, roleSetRecord } from "./testing/fake-source.ts";
import { count, memoryDb, records, sync, tempDir } from "./test-helpers.ts";
import { LIVE_SENTINEL } from "./testing/sentinels.ts";
import { runSyncInWorker } from "./worker.ts";

const SENTINEL = "SENTINEL-VALUE-91c2";
const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));
const dir = () => {
  const d = tempDir();
  dirs.push(d);
  return d.path;
};
/** An EE/LT-format code that does not also pass the LV register check digit (that overlap is ambiguous by design). */
const eeLt = () => {
  for (let i = 0; i < 100; i++) {
    const first10 = `3000101${String(i).padStart(3, "0")}`;
    const code = `${first10}${balticCheckDigit(first10)}`;
    if (isBalticPersonalCode(code) && !isValidRegisterCode("lv", code) && !isFixtureRegisterCode("lv", code)) return code;
  }
  throw new Error("no candidate");
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
  it("a stray key or a free-text reason makes the record invalid; a free-text party type never reaches the report", async () => {
    const db = memoryDb();
    const extraKey = companyRecord(1);
    (extraKey as unknown as { dropped: unknown[] }).dropped = [{ reason: "hide_item", prop: "name", value: SENTINEL }];
    const freeReason = companyRecord(2);
    (freeReason as unknown as { dropped: unknown[] }).dropped = [{ reason: `free text ${SENTINEL}` }];
    const party = companyRecord(3);
    party.parties = [{ type: `Holder ${SENTINEL}`, entities: [] }];
    const outcome = await sync(db, fakeSource({}, { records: [extraKey, freeReason, party] }));
    expect(outcome.report?.skipped).toEqual({ invalid_record: 2 });
    expect(outcome.report?.dropped).toEqual({ party_not_proven: 1 });
    const everything = JSON.stringify(["syncs", "records", "statements", "events", "entities"].map((t) => db.prepare(`SELECT * FROM main.${t}`).all()), (_k, v) =>
      v instanceof Uint8Array ? "bytes" : v,
    );
    expect(everything).not.toContain(SENTINEL);
  });
});

describe("SEC-1 + S9 across every field: one code, refused or counted wherever it is put", () => {
  it("in a record key, a line id, a row reference, a dropped entry, event data and a company's free text", async () => {
    const db = memoryDb();
    const code = eeLt();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
    const inKey = { ...companyRecord(2), recordKey: `ee-${code}` };
    const inLine = roleSetRecord(1, [{ name: "A", role: "board_member", rowId: code }]);
    const inRowRef = { ...companyRecord(3), rowRef: code, dropped: [{ reason: "free_text" as const, prop: "notes" }] };
    const inDropped = companyRecord(4);
    (inDropped as unknown as { dropped: unknown[] }).dropped = [{ reason: "free_text", prop: code }];
    const inEvent = companyRecord(5);
    inEvent.events = [{ entityEid: "lv-00000000005", type: "register.note", date: "2026-10-01", itemId: "S09.LV.01", data: { note: code } }];
    const inText = companyRecord(6, { extra: [{ prop: "notes", value: `Contact ${code}`, itemId: "S01.LV.01" }] });
    const eeText = { ...companyRecord(7), entities: [{ ...companyRecord(7).entities[0]!, eid: "ee-10000007", country: "ee", statements: [{ prop: "name", value: `Example ${code} OÜ`, itemId: "S01.EE.01" }] }], recordKey: "ee-10000007" };
    const outcome = await sync(db, fakeSource({ id: "mixed", items: ["S01.LV.01"] }, { records: [inKey, inLine, inRowRef, inDropped, inEvent, inText, eeText] }));
    expect(outcome.report?.skipped).toEqual({ person_field: 2 });
    expect(outcome.report?.dropped).toEqual({ personal_code: 3, free_text: 2 });
    expect(JSON.stringify(outcome.report)).not.toContain(code);
    expect(scanStore(db, [code])).toEqual([]);
  });
});

describe("legal on S04i: free text refuses any Baltic personal-code format, whatever the record's country", () => {
  it("an EE/LT-format code that also passes the LV register check is refused in an LV company's free text", async () => {
    let code = "";
    for (let i = 0; i < 1000 && !code; i++) {
      const first10 = `3000101${String(i).padStart(3, "0")}`;
      const candidate = `${first10}${balticCheckDigit(first10)}`;
      if (isBalticPersonalCode(candidate) && isValidRegisterCode("lv", candidate)) code = candidate;
    }
    expect(code).not.toBe("");
    const db = memoryDb();
    const record = companyRecord(1, { extra: [{ prop: "notes", value: `Owner ${code}`, itemId: "S01.LV.01" }] });
    record.events = [{ entityEid: "lv-00000000001", type: "register.note", date: "2026-10-01", itemId: "S09.LV.01", data: { note: code } }];
    const outcome = await sync(db, fakeSource({}, { records: [record] }));
    expect(outcome.report?.dropped).toEqual({ personal_code: 2 });
    expect(scanStore(db, [code])).toEqual([]);
  });
});

describe("legal on S04i: a person record's keys get the strict rule; company records keep the country-aware one", () => {
  /** An 11-digit value that passes both the EE/LT personal-code check and the LV register check digit. */
  const overlap = () => {
    for (let i = 0; i < 100000; i++) {
      const first10 = `3800101${String(i).padStart(3, "0")}`;
      const candidate = `${first10}${balticCheckDigit(first10)}`;
      if (isBalticPersonalCode(candidate) && isValidRegisterCode("lv", candidate)) return candidate;
    }
    throw new Error("no candidate");
  };

  it("refuses the overlap value in a person record's key, key suffix or line id", async () => {
    const db = memoryDb();
    const code = overlap();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
    const lines = [{ name: "A", role: "board_member", rowId: "1" }];
    const records = [
      { ...roleSetRecord(1, lines), recordKey: code },
      { ...roleSetRecord(1, lines), recordKey: `lv-00000000001:officers:${code}` },
      roleSetRecord(1, [{ name: "A", role: "board_member", rowId: code }]),
    ];
    const outcome = await sync(db, fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records }));
    expect(outcome.report?.skipped).toEqual({ person_field: 3 });
    expect(scanStore(db, [code])).toEqual([]);
  });

  it("a company-only LV record keyed on a valid LV register code still loads", async () => {
    const db = memoryDb();
    const code = overlap();
    const record = { ...companyRecord(1), recordKey: code };
    expect((await sync(db, fakeSource({ id: "lv-register" }, { records: [record] }))).report?.written).toBe(1);
  });

  it("a reference prop holding something other than a row id is scanned (qa on S04i)", async () => {
    const db = memoryDb();
    const code = eeLt();
    const record = companyRecord(1, { extra: [{ prop: "owner", value: code, itemId: "S01.LV.01" }, { prop: "owner", value: "lv-00000000002", itemId: "S01.LV.01" }] });
    const outcome = await sync(db, fakeSource({}, { records: [record] }));
    expect(outcome.report?.dropped).toEqual({ personal_code: 1 });
    expect(scanStore(db, [code])).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.statements WHERE value = 'lv-00000000002'").get()).toEqual({ n: 1 });
  });

  it("a sanctions eid in a reference is scanned, since its id part comes from the list (qa, legal on S06)", async () => {
    const db = memoryDb();
    const code = eeLt();
    const record = companyRecord(1, { extra: [{ prop: "owner", value: `sanc-x-${code}`, itemId: "S01.LV.01" }, { prop: "owner", value: "sanc-eu-900001", itemId: "S01.LV.01" }] });
    const outcome = await sync(db, fakeSource({}, { records: [record] }));
    expect(outcome.report?.dropped).toEqual({ personal_code: 1 });
    expect(scanStore(db, [code])).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.statements WHERE value = 'sanc-eu-900001'").get()).toEqual({ n: 1 });
  });
});

describe("fencing: the lease is renewed inside every write transaction", () => {
  it("a takeover between two batches stops the sync: nothing further written, nothing purged", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 50) });
    await sync(db, loader);
    loader.state.records = companies(101, 130);
    loader.state.asOf = { in_file_field: "2026-11-02" };
    const parse = loader.parse.bind(loader);
    loader.parse = async function* (raw, ctx) {
      let n = 0;
      for await (const r of parse(raw, ctx)) {
        if (++n === 15) db.prepare("UPDATE main.leases SET holder = 'taken-over'").run();
        yield r;
      }
    };
    const outcome = await runSync(db, loader, { fetcher: noNetwork, holder: "mine", batch: { maxRecords: 10 } });
    expect(outcome).toMatchObject({ kind: "partial", report: { reason: "lease_lost" } });
    expect(records(db)).toBe(70);
  });
});

describe("SEC-3, qa M2: the lease is kept for the whole sync, and a lost lease stops it", () => {
  it("a fetch longer than the lease TTL keeps the lease: a second sync started meanwhile is refused (fake clock)", async () => {
    // The clock moves only when the test moves it, and only after the heartbeat has renewed the
    // lease at the current time, so the rule is proven whatever the machine's load (cto, qa).
    const db = memoryDb();
    let at = Date.parse("2026-11-22T08:00:00.000Z");
    const now = () => new Date(at);
    let release!: () => void;
    const fetched = new Promise<void>((r) => (release = r));
    const loader = fakeSource({}, { records: companies(1, 5) });
    const fetch = loader.fetch.bind(loader);
    loader.fetch = async (ctx) => {
      await fetched;
      return fetch(ctx);
    };
    const ttl = 120;
    const first = runSync(db, loader, { fetcher: noNetwork, leaseTtlMs: ttl, heartbeatMs: 10, holder: "a", now });
    const expiresAt = () => (db.prepare("SELECT expires_at FROM main.leases WHERE resource = 'sync:fake-register'").get() as { expires_at: number } | undefined)?.expires_at ?? 0;
    // Five TTLs of fake time pass while the download is pending, a third of the TTL at a step.
    for (let step = 0; step < 15; step++) {
      at += ttl / 3;
      for (let i = 0; i < 5000 && expiresAt() < at + ttl; i++) await new Promise((r) => setTimeout(r, 2));
      expect(expiresAt()).toBe(at + ttl);
    }
    expect((await runSync(db, fakeSource({}, { records: [] }), { fetcher: noNetwork, holder: "b", now })).kind).toBe("already_running");
    release();
    expect((await first).kind).toBe("content");
  });

  it("a fetch longer than the lease TTL keeps the lease in real time, with a TTL 15x the heartbeat", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 5) });
    const fetch = loader.fetch.bind(loader);
    loader.fetch = async (ctx) => {
      await new Promise((r) => setTimeout(r, 2500));
      return fetch(ctx);
    };
    const first = runSync(db, loader, { fetcher: noNetwork, leaseTtlMs: 1500, heartbeatMs: 100, holder: "a" });
    await new Promise((r) => setTimeout(r, 1800));
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
    clearLiveView("fake-live-sentinel");
    const outcome = await runSyncInWorker(new URL("./testing/test-sync-worker.ts", import.meta.url), {
      dataDir: data,
      sourceId: "fake-live-sentinel",
      userAgent: "test",
      config: DEFAULT_LOADER_CONFIG,
      options: { rawCacheDir: join(data, "raw") },
    });
    expect(outcome.kind).toBe("content");
    expect(liveView("fake-live-sentinel")?.rows.map((r) => r.value)).toEqual([LIVE_SENTINEL]);
    // Legal condition 1: the rows crossed the message channel only. No file under the data dir,
    // the raw cache included, holds the sentinel's bytes.
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    const files = walk(data);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(readFileSync(file).includes(Buffer.from(LIVE_SENTINEL)), file).toBe(false);
    expect(existsSync(join(data, "raw"))).toBe(false);
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
    // The companies are in the register first, so their tax rows are not dropped as unknown (fails closed).
    const register = Array.from({ length: 100 }, (_, i) => ({
      recordKey: `ee-${String(i).padStart(8, "0")}`,
      hashInput: [String(i)],
      entities: [{ eid: `ee-${String(i).padStart(8, "0")}`, schema: "Company" as const, country: "ee", legalForm: "ee-ou", code: String(i).padStart(8, "0"), statements: [{ prop: "name", value: `Example ${i} OÜ`, itemId: "S01.EE.01" }] }],
    }));
    await sync(db, fakeSource({ id: "ee-register", country: "ee", items: ["S01.EE.01"] }, { records: register }));
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

  it("no row hash covers a refused sole-trader id: two different refused ids store the same hash (J2)", async () => {
    const hashWith = async (id: string) => {
      const db = memoryDb();
      const record = companyRecord(9, { legalForm: "lv-ik", extra: [{ prop: "registrationNumber", value: id, itemId: "S01.LV.01" }] });
      record.hashInput = [record.recordKey, id];
      await sync(db, fakeSource({}, { records: [record] }));
      return Buffer.from((db.prepare("SELECT row_hash FROM main.records").get() as { row_hash: Uint8Array }).row_hash).toString("hex");
    };
    expect(await hashWith(["010190", "12345"].join(""))).toBe(await hashWith(["020285", "54321"].join("")));
  });
});

describe("SEC-4, qa S4, S5: live-cache views", () => {
  const principals = (names: string[]) => [
    { recordKey: "r1", hashInput: names, entities: [{ eid: "us-ct-FX0001", schema: "Company" as const, country: "us", legalForm: "us-llc", code: "FX0001", statements: [{ prop: "name", value: "Example Holdings LLC", itemId: "S01.US.02" }] }] },
    { recordKey: "r2", hashInput: ["second"], entities: [{ eid: "us-ct-FX0002", schema: "Company" as const, country: "us", legalForm: "us-llc", code: "FX0002", statements: [{ prop: "name", value: "Second Example Holdings LLC", itemId: "S01.US.02" }] }] },
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
    const job = { dataDir: data, sourceId: "fake-slow", userAgent: "test", config: DEFAULT_LOADER_CONFIG, options: {} };
    const outcomes = await Promise.all([runSyncInWorker(entry, job), runSyncInWorker(entry, job)]);
    for (const o of outcomes) expect(o.kind).not.toBe("failed");
    expect(existsSync(join(data, "finora.db"))).toBe(true);
  }, 60_000);
});

describe("SEC-12: a worker that cannot run its source ends failed, never running", () => {
  it("an unknown source id is refused inside the worker", async () => {
    const data = dir();
    openStore({ dataDir: data }).close();
    const outcome = await runSyncInWorker(new URL("./testing/test-sync-worker.ts", import.meta.url), { dataDir: data, sourceId: "../../etc", userAgent: "t", config: DEFAULT_LOADER_CONFIG, options: {} });
    expect(outcome).toMatchObject({ kind: "failed", report: { reason: "unknown_source" } });
  }, 60_000);
});

describe("qa, legal on S04i: an id-shaped prefix never hides a personal code", () => {
  const overlapCode = () => {
    for (let i = 0; i < 100000; i++) {
      const first10 = `3800101${String(i).padStart(3, "0")}`;
      const candidate = `${first10}${balticCheckDigit(first10)}`;
      if (isBalticPersonalCode(candidate) && isValidRegisterCode("lv", candidate)) return candidate;
    }
    throw new Error("no candidate");
  };

  it("a person record refuses ee-, lt-, us-ca- and lv- prefixed codes in its key and line ids", async () => {
    const db = memoryDb();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
    const code = eeLt();
    const overlap = overlapCode();
    const lines = [{ name: "A", role: "board_member", rowId: "1" }];
    const records = [
      { ...roleSetRecord(1, lines), recordKey: `lv-00000000001:officers:ee-${code}` },
      roleSetRecord(1, [{ name: "A", role: "board_member", rowId: `lt-${code}` }]),
      { ...roleSetRecord(1, lines), recordKey: `lv-00000000001:officers:us-ca-${code}` },
      { ...roleSetRecord(1, lines), recordKey: `lv-00000000001:officers:lv-${overlap}` },
    ];
    const outcome = await sync(db, fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records }));
    expect(outcome.report?.skipped).toEqual({ person_field: 4 });
    expect(scanStore(db, [code, overlap])).toEqual([]);
  });

  it("still lets a role set's key name the company it is about", async () => {
    const db = memoryDb();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
    const outcome = await sync(db, fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records: [roleSetRecord(1, [{ name: "A", role: "board_member", rowId: "1" }])] }));
    expect(outcome.report).toMatchObject({ written: 1, skipped: {} });
  });

  it("a reference that is only id-shaped is scanned and refused; a company the store holds is kept", async () => {
    const db = memoryDb();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(2)] }));
    const lvCode = ["010190", "12345"].join("");
    const code = eeLt();
    const record = companyRecord(1, {
      extra: [
        { prop: "owner", value: `lv-${lvCode}`, itemId: "S01.LV.01" },
        { prop: "owner", value: `us-ca-${code}`, itemId: "S01.LV.01" },
        { prop: "owner", value: "lv-00000000002", itemId: "S01.LV.01" },
      ],
    });
    const outcome = await sync(db, fakeSource({}, { records: [record] }));
    expect(outcome.report?.dropped).toEqual({ personal_code: 2 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.statements WHERE value = 'lv-00000000002'").get()).toEqual({ n: 1 });
    expect(scanStore(db, [lvCode, code])).toEqual([]);
  });
});

