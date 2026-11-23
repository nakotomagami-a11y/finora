// cto's fix 7 on S05 (WAL checkpoints outside the write transactions) with legal's purge conditions
// (secure_delete on every connection, an FTS merge when search rows of an unsearchable entity go, a
// TRUNCATE checkpoint after every delete) and qa's tests. Every byte scan reads the store files while
// the store is open, so the -wal and -shm files are read too, and every value is fictional.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParsedRecord, RawArtifact } from "@finora/sources";
import { acquireLease, beginSync, checkpoint, maintenanceDue, openStore, releaseLease, runMaintenance, runRetention, startIdleMaintenance, upsertSource, writeRecord, type CheckpointResult, type Store } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { fetchOnView, type DatasetAnswer, type LiveCachedLoader } from "./live-cache.ts";
import { nextCheckpointFrames, runSync } from "./pipeline.ts";
import { companies, fakeSource, noNetwork, roleSetRecord } from "./testing/fake-source.ts";
import { tempDir } from "./test-helpers.ts";

const stores: Store[] = [];
const dirs: { remove(): void }[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
  dirs.splice(0).forEach((d) => d.remove());
});

function onDisk(): { store: Store; dir: string } {
  const d = tempDir();
  dirs.push(d);
  const store = openStore({ dataDir: d.path });
  stores.push(store);
  return { store, dir: d.path };
}
const dbFiles = (dir: string) => readdirSync(dir).filter((n) => /\.db(-wal|-shm)?$/.test(n)).map((n) => join(dir, n));
/** The store files holding the text, as written or in the search index's lower case. */
const scan = (dir: string, text: string) => {
  const files = dbFiles(dir);
  expect(files.some((f) => f.endsWith("finora.db-wal")), "the scan reads the -wal file").toBe(true);
  return files.filter((f) => [text, text.toLowerCase()].some((t) => readFileSync(f).includes(Buffer.from(t)))).map((f) => f.slice(dir.length + 1));
};
const walBytes = (dir: string) => statSync(join(dir, "finora.db-wal")).size;

let clock = Date.parse("2026-11-23T06:00:00.000Z");
const run = (store: Store, loader: Parameters<typeof runSync>[1], options: Partial<Parameters<typeof runSync>[2]> = {}) => {
  clock += 3_600_000;
  const at = new Date(clock);
  return runSync(store.db, loader, { fetcher: noNetwork, now: () => at, ...options });
};
const register = (name: string, legalForm = "lv-sia"): ParsedRecord => ({
  recordKey: "lv-00000000001",
  hashInput: [name, legalForm],
  entities: [{ eid: "lv-00000000001", schema: "Company", country: "lv", legalForm, status: "active", code: "00000000001", statements: [{ prop: "name", value: name, itemId: "S01.LV.01" }] }],
});
const officers = (name: string) => roleSetRecord(1, [{ name, role: "board_member", rowId: "101" }]);

describe("fix 7: the connections", () => {
  it("every connection has secure_delete on in every schema it attaches and no automatic checkpoint; the sync connection attaches main and sa only", () => {
    for (const sync of [false, true]) {
      const store = openStore({ dataDir: null, sync });
      stores.push(store);
      const attached = (store.db.prepare("PRAGMA database_list").all() as { name: string }[]).map((r) => r.name).filter((n) => n !== "temp");
      expect(attached, `sync=${sync}`).toEqual(sync ? ["main", "sa"] : ["main", "user", "sa", "cc"]);
      for (const schema of attached) expect(store.db.prepare(`PRAGMA ${schema}.secure_delete`).get(), `${schema} sync=${sync}`).toEqual({ secure_delete: 1 });
      expect(store.db.prepare("PRAGMA wal_autocheckpoint").get()).toEqual({ wal_autocheckpoint: 0 });
    }
  });
});

describe("fix 7: the sync checkpoints between its transactions and reports both", () => {
  it("times every write transaction and its own PASSIVE checkpoints, then truncates the WAL", async () => {
    const { store, dir } = onDisk();
    const outcome = await run(store, fakeSource({}, { records: companies(1, 3000) }), { batch: { maxRecords: 100 }, checkpoint: { frames: 64 } });
    const t = outcome.report?.timings;
    expect(t?.transactions).toBeGreaterThan(10);
    expect(t?.checkpoints).toBeGreaterThan(0);
    expect(t!.p95Ms).toBeLessThanOrEqual(t!.maxMs);
    expect(outcome.report?.maintenance?.map((m) => m.kind)).toEqual(["wal_truncate"]);
    // Truncated, then only the sync's own row and its lease were written after it: a few pages.
    expect(walBytes(dir)).toBeLessThan(64 * 1024);
  });
});

describe("legal's purge rule: no deleted person value survives in the store files", () => {
  it("a rewrite that replaces a person's name leaves no trace of the old one (main, -wal, -shm)", async () => {
    const { store, dir } = onDisk();
    await run(store, fakeSource({ id: "lv-register" }, { records: [register("Example Company SIA")] }));
    const lines = fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records: [officers("Zorvexa Oldname")] });
    await run(store, lines);
    // The control: the scan sees a stored value.
    expect(scan(dir, "Zorvexa Oldname").length).toBeGreaterThan(0);
    lines.state.records = [officers("Quillmont Newname")];
    lines.state.asOf = { in_file_field: "2026-11-02" };
    await run(store, lines);
    expect(scan(dir, "Zorvexa Oldname")).toEqual([]);
    expect(scan(dir, "Quillmont Newname")).toContain("finora.db");
  });

  it("a company reclassified as a sole trader leaves no former search term once merged; without the merge one stays", async () => {
    const { store, dir } = onDisk();
    const source = fakeSource({ id: "lv-register" }, { records: [register("Example Zorvexa SIA")] });
    await run(store, source);
    source.state.records = [register("IK Quillmont", "lv-ik")];
    source.state.asOf = { in_file_field: "2026-11-02" };
    const outcome = await run(store, source);
    expect(outcome.report?.maintenance?.map((m) => m.kind)).toEqual(["fts_merge", "wal_truncate"]);
    expect(maintenanceDue(store.db)).toEqual([]);
    expect(scan(dir, "Zorvexa")).toEqual([]);

    // cto's finding, the control: the same delete with its merge skipped leaves the term in the index.
    const other = onDisk();
    upsertSource(other.store.db, { id: "lv-register", storage: "store" }, "2026-11-23T08:00:00.000Z");
    const syncId = beginSync(other.store.db, { sourceId: "lv-register", licenceId: "cc0-1.0", storage: "store", parserVersion: "x", startedAt: "2026-11-23T08:00:00.000Z" });
    for (let i = 2; i < 400; i++) writeRecord(other.store.db, { syncId, sourceId: "lv-register", recordKey: `k${i}`, hashInput: [`${i}`], entities: companies(i, i)[0]!.entities });
    writeRecord(other.store.db, { syncId, sourceId: "lv-register", recordKey: "lv-00000000001", hashInput: ["a"], entities: register("Example Zorvexa SIA").entities });
    writeRecord(other.store.db, { syncId, sourceId: "lv-register", recordKey: "lv-00000000001", hashInput: ["b"], deferSearch: true, entities: register("IK Quillmont", "lv-ik").entities });
    // The rewrite owes the TRUNCATE too (K1).
    expect(maintenanceDue(other.store.db)).toEqual(["fts_merge", "wal_truncate"]);
    other.store.db.exec("DELETE FROM main.maintenance_due");
    checkpoint(other.store.db, "TRUNCATE");
    expect(scan(other.dir, "Zorvexa")).toContain("finora.db");
  });

  it("a TTL purge of person rows, then the maintenance owed, leaves no trace", async () => {
    const { store, dir } = onDisk();
    await run(store, fakeSource({ id: "lv-register" }, { records: [register("Example Company SIA")] }));
    await run(store, fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records: [officers("Zorvexa Ttlname")] }));
    expect(scan(dir, "Zorvexa Ttlname").length).toBeGreaterThan(0);
    store.db.exec("BEGIN IMMEDIATE");
    const purged = runRetention(store.db, { now: new Date(clock + 40 * 86_400_000).toISOString(), personTtlDays: 30 });
    store.db.exec("COMMIT");
    expect(purged.personStatements).toBeGreaterThan(0);
    expect(maintenanceDue(store.db)).toContain("wal_truncate");
    runMaintenance(store.db);
    expect(scan(dir, "Zorvexa Ttlname")).toEqual([]);
  });

  it("a role set gone from the file (role_ended) leaves no trace of its person", async () => {
    const { store, dir } = onDisk();
    await run(store, fakeSource({ id: "lv-register" }, { records: [register("Example Company SIA")] }));
    const lines = fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records: [officers("Zorvexa Endedname"), roleSetRecord(2, [{ name: "Quillmont Staying", role: "board_member", rowId: "201" }])] });
    await run(store, lines);
    lines.state.records = [roleSetRecord(2, [{ name: "Quillmont Staying", role: "board_member", rowId: "201" }])];
    lines.state.asOf = { in_file_field: "2026-11-02" };
    const outcome = await run(store, lines);
    expect(outcome.report?.deleted).toBe(1);
    expect(scan(dir, "Zorvexa Endedname")).toEqual([]);
  });

  it("a live-cached principal withdrawn on re-fetch leaves no trace", async () => {
    const { store, dir } = onDisk();
    const eid = "us-ct-FX0001";
    const json = (records: ParsedRecord[]): RawArtifact[] => [{ name: "r.json", bytes: new TextEncoder().encode(JSON.stringify({ records })), fetchedAt: "" }];
    const principals = (names: string[]): ParsedRecord => ({
      recordKey: "principals",
      hashInput: names,
      entities: names.flatMap((name, i) => [
        { eid: `p-7-${i}`, schema: "Person" as const, country: "us", statements: [{ prop: "name", value: name, itemId: "S03.US.03", line: i }] },
        { eid: `rel-7-${i}`, schema: "Directorship" as const, country: "us", statements: [{ prop: "organization", value: eid, itemId: "S03.US.03", line: i }, { prop: "director", value: `p-7-${i}`, itemId: "S03.US.03", line: i }, { prop: "role", value: "principal", itemId: "S03.US.03", line: i }] },
      ]),
    });
    const master: ParsedRecord = { recordKey: "master", hashInput: ["active"], entities: [{ eid, schema: "Company", country: "us", legalForm: "us-llc", status: "active", code: "FX0001", statements: [{ prop: "name", value: "Example Holdings LLC", itemId: "S01.US.02" }] }] };
    const answers: DatasetAnswer[] = [
      { dataset: "master", status: "ok", artifacts: json([master]) },
      { dataset: "principals", status: "ok", artifacts: json([principals(["Quillmont Staying", "Zorvexa Withdrawn"])]) },
    ];
    const loader: LiveCachedLoader = Object.assign(fakeSource({ id: "us-ct-business", country: "us", storage: "live-cached", cacheTtl: { refetchHours: 24, purgeUnviewedDays: 30 }, items: ["S01.US.02", "S03.US.03"] }), {
      async fetchRecord() {
        return answers;
      },
    });
    const view = (hours: number) => fetchOnView(store.db, loader, { recordKey: "FX0001", entityEid: eid, datasets: ["master", "principals"] }, { fetcher: noNetwork, keys: {}, now: new Date(clock + hours * 3_600_000) });
    await view(0);
    expect(scan(dir, "Zorvexa Withdrawn").length).toBeGreaterThan(0);
    answers[1] = { dataset: "principals", status: "ok", artifacts: json([principals(["Quillmont Staying"])]) };
    await view(25);
    expect(scan(dir, "Zorvexa Withdrawn")).toEqual([]);
  });
});

describe("the maintenance owed (qa's checks; K1, K3 and the idle tick)", () => {
  it("K1: a rewrite owes the TRUNCATE from its own transaction, so a sync killed after it leaves it owed", async () => {
    const { store } = onDisk();
    await run(store, fakeSource({ id: "lv-register" }, { records: [register("Example Company SIA")] }));
    expect(maintenanceDue(store.db)).toEqual([]);
    const syncId = beginSync(store.db, { sourceId: "lv-register", licenceId: "cc0-1.0", storage: "store", parserVersion: "x", startedAt: "2026-11-23T09:00:00.000Z" });
    store.db.exec("BEGIN IMMEDIATE");
    writeRecord(store.db, { syncId, sourceId: "lv-register", recordKey: "lv-00000000001", hashInput: ["changed"], entities: register("Example Company Renamed SIA").entities });
    store.db.exec("COMMIT");
    // No sync end ran: the mark is already a row.
    expect(maintenanceDue(store.db)).toEqual(["wal_truncate"]);
  });

  it("the idle tick never runs beside a live sync; once the lease is gone it does", () => {
    const { store } = onDisk();
    const ticks: number[] = [];
    acquireLease(store.db, "sync:lv-register", "someone", 60_000);
    let stop = startIdleMaintenance(store.db, { intervalMs: 3_600_000, onStep: (_s, passive) => ticks.push(passive.log) });
    stop();
    expect(ticks).toEqual([]);
    releaseLease(store.db, { resource: "sync:lv-register", holder: "someone", expiresAt: 0 });
    stop = startIdleMaintenance(store.db, { intervalMs: 3_600_000, onStep: (_s, passive) => ticks.push(passive.log) });
    stop();
    expect(ticks).toHaveLength(1);
  });


  it("a sync with no such delete runs no merge", async () => {
    const { store } = onDisk();
    const outcome = await run(store, fakeSource({}, { records: companies(1, 20) }));
    expect(outcome.report?.maintenance?.map((m) => m.kind)).toEqual(["wal_truncate"]);
  });

  it("a merge a killed sync owed is run by the next sync of any source", async () => {
    const { store } = onDisk();
    await run(store, fakeSource({ id: "lv-register" }, { records: [register("Example Zorvexa SIA")] }));
    // Cut off after the delete, before the sync's end: the mark is a row, so it survives.
    const syncId = beginSync(store.db, { sourceId: "lv-register", licenceId: "cc0-1.0", storage: "store", parserVersion: "x", startedAt: "2026-11-23T09:00:00.000Z" });
    writeRecord(store.db, { syncId, sourceId: "lv-register", recordKey: "lv-00000000001", hashInput: ["b"], deferSearch: true, entities: register("IK Quillmont", "lv-ik").entities });
    // The rewrite owes the TRUNCATE too (K1).
    expect(maintenanceDue(store.db)).toEqual(["fts_merge", "wal_truncate"]);
    const next = await run(store, fakeSource({ id: "another-source" }, { records: companies(5, 6) }));
    expect(next.report?.maintenance?.map((m) => m.kind)).toEqual(["fts_merge", "wal_truncate"]);
    expect(maintenanceDue(store.db)).toEqual([]);
  });

  it("a TRUNCATE a reader blocks is reported busy, stays owed, and completes once the reader ends", async () => {
    const { store, dir } = onDisk();
    await run(store, fakeSource({ id: "lv-register" }, { records: [register("Example Company SIA")] }));
    const lines = fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records: [officers("Zorvexa Heldname")] });
    await run(store, lines);
    const reader = openStore({ dataDir: dir });
    stores.push(reader);
    reader.db.exec("BEGIN");
    reader.db.prepare("SELECT COUNT(*) AS n FROM main.entities").get();
    lines.state.records = [officers("Quillmont Newname")];
    lines.state.asOf = { in_file_field: "2026-11-02" };
    const outcome = await run(store, lines);
    expect(outcome.report?.maintenance).toContainEqual(expect.objectContaining({ kind: "wal_truncate", busy: true }));
    expect(maintenanceDue(store.db)).toEqual(["wal_truncate"]);
    reader.db.exec("COMMIT");
    const retried = runMaintenance(store.db);
    expect(retried).toEqual([expect.objectContaining({ kind: "wal_truncate" })]);
    expect(retried[0]?.busy).toBeUndefined();
    expect(maintenanceDue(store.db)).toEqual([]);
    // Truncated, then the owed mark's delete wrote its table's page (K3): a few KB, no record data.
    expect(walBytes(dir)).toBeLessThan(64 * 1024);
    expect(scan(dir, "Zorvexa Heldname")).toEqual([]);
  });
});

describe("time-sized checkpoints (cto, council)", () => {
  it("halve after a checkpoint over 1 s down to the floor, double after one under 250 ms up to the start", () => {
    const seq: number[] = [];
    let frames = 16_384;
    for (const ms of [1200, 1200, 1200, 1200, 1200, 1200, 500, 100, 100, 100, 100]) seq.push((frames = nextCheckpointFrames(frames, ms, 2048, 16_384)));
    expect(seq).toEqual([8192, 4096, 2048, 2048, 2048, 2048, 2048, 4096, 8192, 16_384, 16_384]);
  });

  it("a slow-disk shim: the sync follows the threshold sequence, and a checkpoint at the floor of 5 s or more is over_limit", async () => {
    const { store } = onDisk();
    const times = [1200, 1200, 6000, 6000, 100, 100, 100];
    let i = 0;
    const slow = (): CheckpointResult => ({ ms: times[Math.min(i++, times.length - 1)]!, busy: false, log: 100_000, checkpointed: 100_000 });
    const outcome = await run(store, fakeSource({}, { records: companies(1, 2000) }), { batch: { maxRecords: 50 }, checkpoint: { frames: 64, floorFrames: 16, run: slow } });
    const t = outcome.report!.timings!;
    expect(t.checkpointFrames.slice(0, 7)).toEqual([32, 16, 16, 16, 32, 64, 64]);
    expect(t.checkpointsOverLimit).toBe(2);
    expect(t.checkpointMaxMs).toBe(6000);
  });
});

describe("cto's and qa's WAL tests", () => {
  const fill = (store: Store, megabytes: number) => {
    store.db.exec("CREATE TABLE IF NOT EXISTS main.scratch (b BLOB) STRICT");
    const insert = store.db.prepare("INSERT INTO main.scratch (b) VALUES (?)");
    store.db.exec("BEGIN IMMEDIATE");
    for (let i = 0; i < megabytes * 16; i++) insert.run(new Uint8Array(65_536).fill(i % 251));
    store.db.exec("COMMIT");
  };

  it("a user's commit after a sync left 60 MB in the WAL takes under 50 ms and runs no checkpoint", () => {
    const { store, dir } = onDisk();
    const sync = openStore({ dataDir: dir, sync: true });
    stores.push(sync);
    fill(sync, 60);
    const before = walBytes(dir);
    expect(before).toBeGreaterThan(60 * 1024 * 1024);
    const start = performance.now();
    store.db.prepare("INSERT INTO main.scratch (b) VALUES (?)").run(new Uint8Array(16));
    expect(performance.now() - start).toBeLessThan(50);
    // No checkpoint ran inside it: the 60 MB are still waiting in the WAL.
    expect(checkpoint(store.db, "PASSIVE").log).toBeGreaterThan(15_000);
  });

  it("between syncs, the idle maintenance keeps the WAL bounded while users write", () => {
    const { store, dir } = onDisk();
    const steps: number[] = [];
    const stop = startIdleMaintenance(store.db, { intervalMs: 3_600_000, onStep: (_s, passive) => steps.push(passive.log) });
    const sizes: number[] = [];
    // Each idle tick checkpoints what the writes left; the next writes reuse the WAL from its start.
    for (let round = 0; round < 6; round++) {
      fill(store, 4);
      checkpoint(store.db, "PASSIVE");
      sizes.push(walBytes(dir));
    }
    stop();
    expect(steps.length).toBe(1);
    expect(Math.max(...sizes)).toBeLessThan(6 * 1024 * 1024);
  });
});

// The council's S12 gate, met by cto's layout rule (7087614308) and landing with S05: during back-to-back
// sync batches and the sync's checkpoints, a user's write is never "database is locked".
describe("a user's write during a sync (two connections)", () => {
  const userWrites = async (syncStore: Store, user: Store) => {
    user.db.exec("PRAGMA busy_timeout = 1500");
    const write = user.db.prepare("INSERT INTO user.settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value");
    const times: number[] = [];
    let locked = 0;
    let n = 0;
    const timer = setInterval(() => {
      const start = performance.now();
      try {
        write.run("watchlist", String(n++));
        times.push(performance.now() - start);
      } catch (error) {
        if (String(error).includes("locked")) locked++;
        else throw error;
      }
    }, 5);
    // A loader whose parse yields to the timers between records, inside the open batch transactions.
    const loader = fakeSource({}, { records: companies(1, 1500) });
    const parse = loader.parse.bind(loader);
    loader.parse = async function* (raw, ctx) {
      let k = 0;
      for await (const r of parse(raw, ctx)) {
        if (++k % 25 === 0) await new Promise((resolve) => setTimeout(resolve, 1));
        yield r;
      }
    };
    await runSync(syncStore.db, loader, { fetcher: noNetwork, batch: { maxRecords: 200, maxMs: 2000 }, checkpoint: { frames: 256 } });
    clearInterval(timer);
    times.sort((a, b) => a - b);
    return { writes: times.length, p95: times[Math.ceil(times.length * 0.95) - 1] ?? 0, max: times.at(-1) ?? 0, locked };
  };

  it("with the sync connection attaching main and sa only, user writes stay fast and never fail locked", async () => {
    const { store: user, dir } = onDisk();
    const sync = openStore({ dataDir: dir, sync: true });
    stores.push(sync);
    const r = await userWrites(sync, user);
    expect(r.writes).toBeGreaterThan(20);
    expect(r.locked).toBe(0);
    expect(r.p95).toBeLessThan(250);
    expect(r.max).toBeLessThan(1500);
  }, 120_000);

  it("the control: a sync on a connection that attaches user makes the user's writes fail locked", async () => {
    const { store: user, dir } = onDisk();
    const allAttached = openStore({ dataDir: dir });
    stores.push(allAttached);
    const r = await userWrites(allAttached, user);
    expect(r.locked).toBeGreaterThan(0);
  }, 120_000);
});

describe("no write path hashes the loader's raw input (qa on live-cache.ts, J2)", () => {
  it("a live-cached record's unproven party, renamed alone, writes nothing; proven, the change is written", async () => {
    const eid = "us-ct-FX0001";
    const json = (records: ParsedRecord[]): RawArtifact[] => [{ name: "r.json", bytes: new TextEncoder().encode(JSON.stringify({ records })), fetchedAt: "" }];
    const master = (holder: string, type: string): ParsedRecord => ({
      recordKey: "master",
      hashInput: ["active", holder],
      entities: [{ eid, schema: "Company", country: "us", legalForm: "us-llc", status: "active", code: "FX0001", statements: [{ prop: "name", value: "Example Holdings LLC", itemId: "S01.US.02" }] }],
      parties: [{ type, entities: [{ eid: "org-00000000000000000077", schema: "Organization", country: "intl", statements: [{ prop: "name", value: holder, itemId: "S01.US.02" }] }] }],
    });
    const hashAfterRename = async (type: string) => {
      const { store } = onDisk();
      const answers: DatasetAnswer[] = [{ dataset: "master", status: "ok", artifacts: json([master("Zorvexa Holder A", type)]) }];
      const loader: LiveCachedLoader = Object.assign(fakeSource({ id: "us-ct-business", country: "us", storage: "live-cached", cacheTtl: { refetchHours: 24, purgeUnviewedDays: 30 }, items: ["S01.US.02"] }), {
        async fetchRecord() {
          return answers;
        },
      });
      const view = (hours: number) => fetchOnView(store.db, loader, { recordKey: "FX0001", entityEid: eid, datasets: ["master"] }, { fetcher: noNetwork, keys: {}, now: new Date(clock + hours * 3_600_000), companyPartyTypes: ["LEGAL_ENTITY"] });
      const hash = () => Buffer.from((store.db.prepare("SELECT row_hash FROM main.records WHERE source_id = 'us-ct-business'").get() as { row_hash: Uint8Array }).row_hash).toString("hex");
      await view(0);
      const before = hash();
      answers[0] = { dataset: "master", status: "ok", artifacts: json([master("Zorvexa Holder B", type)]) };
      await view(25);
      return before === hash();
    };
    expect(await hashAfterRename("JOINT_OWNERS")).toBe(true);
    expect(await hashAfterRename("LEGAL_ENTITY")).toBe(false);
  });
});

describe("the sync-only open (item 6 on S05)", () => {
  const attached = (store: Store) => (store.db.prepare("PRAGMA database_list").all() as { name: string }[]).map((r) => r.name).filter((n) => n !== "temp");

  it("refuses a fresh data dir with store_not_migrated, and creates nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "finora-syncopen-"));
    try {
      expect(() => openStore({ dataDir: dir, sync: true })).toThrow(expect.objectContaining({ code: "store_not_migrated" }));
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("opens after the full open, with main and sa only, also after a full sync", async () => {
    const { dir } = onDisk();
    const sync = openStore({ dataDir: dir, sync: true });
    stores.push(sync);
    expect(attached(sync)).toEqual(["main", "sa"]);
    await runSync(sync.db, fakeSource({}, { records: companies(1, 50) }), { fetcher: noNetwork });
    expect(attached(sync)).toEqual(["main", "sa"]);
  });

  it("refuses a store whose recorded versions are behind this build's", () => {
    const { store, dir } = onDisk();
    store.db.prepare("UPDATE main.store_meta SET value = ? WHERE key = 'migrated'").run(JSON.stringify({ main: 1, user: 1, sa: 1, cc: 1 }));
    expect(() => openStore({ dataDir: dir, sync: true })).toThrow(expect.objectContaining({ code: "store_not_migrated" }));
  });
});

describe("K5, option (a): a company rename owes no FTS merge (qa's check)", () => {
  it("a fictional company renamed with no former-name statement leaves no fts_merge mark", async () => {
    const { store } = onDisk();
    const source = fakeSource({ id: "lv-register" }, { records: [register("Example Zorvexa SIA")] });
    await run(store, source);
    source.state.records = [register("Example Quillmont SIA")];
    source.state.asOf = { in_file_field: "2026-11-02" };
    const outcome = await run(store, source);
    expect(outcome.kind).toBe("content");
    expect(outcome.report?.maintenance?.map((m) => m.kind)).toEqual(["wal_truncate"]);
  });
});
