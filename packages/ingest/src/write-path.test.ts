// cto's write-path fixes on S05 (one write path, 7075394106) and the agreed proof that no person
// value outlives a sync in the connection (qa 7082809281, legal 7082812770, cto 7082802021).
import { DatabaseSync } from "node:sqlite";
import { balticCheckDigit, normalizeText } from "@finora/domain";
import { lvUrOfficersLoader, lvUrRegister, type SourceLoader } from "@finora/sources";
import { LV_BIRTH_DATE_CANARY, lvMaskedCodeCanary, lvOfficersCsv, lvRegisterCsv } from "@finora/sources/testing";
import { beginSync, openStore, rebuildSearch, searchCompanies, upsertSource, writeRecord } from "@finora/store";
import { cachedStatements, statementCacheSize } from "@finora/store/testing";
import { describe, expect, it } from "vitest";
import { nextBatchSize, runSync } from "./pipeline.ts";
import { companies, companyRecord, fakeSource, noNetwork } from "./testing/fake-source.ts";
import { count, records } from "./test-helpers.ts";

const fromFile = (loader: SourceLoader, name: string, bytes: () => Uint8Array): SourceLoader => ({ ...loader, fetch: async (ctx) => ({ artifacts: [{ name, bytes: bytes(), fetchedAt: ctx.now }] }) });

describe("fix 1: the batch is sized from the last one's rate", () => {
  it("keeps about 250 records at 1 ms each, grows on a fast disk, shrinks on a slow one, within 50 and the cap", () => {
    expect(nextBatchSize(1000, 250, 1000)).toBe(250);
    expect(nextBatchSize(5000, 250, 10)).toBe(5000);
    expect(nextBatchSize(100, 250, 5000)).toBe(50);
    expect(nextBatchSize(10, 250, 1, 10)).toBe(10);
  });
});

describe("F3: the caller's batch cap is bounded", () => {
  it("is at most 5,000, and a cap that is not finite falls back to 5,000; the control, 100, commits more often", async () => {
    const commits = async (maxRecords: number) => {
      const { db } = openStore({ dataDir: null });
      const exec = db.exec.bind(db);
      let n = 0;
      db.exec = (sql: string) => {
        if (sql === "COMMIT") n++;
        return exec(sql);
      };
      await runSync(db, fakeSource({}, { records: companies(1, 5100) }), { fetcher: noNetwork, batch: { maxRecords, maxMs: 60_000 } });
      return n;
    };
    const standard = await commits(5000);
    expect(await commits(20_000)).toBe(standard);
    expect(await commits(Number.NaN)).toBe(standard);
    expect(await commits(100)).toBeGreaterThan(standard);
  }, 120_000);
});

describe("fix 3: search rows are written in one pass at the sync's end", () => {
  it("leaves no mark after a sync, and every company is searchable", async () => {
    const { db } = openStore({ dataDir: null });
    await runSync(db, fakeSource({}, { records: companies(1, 30) }), { fetcher: noNetwork });
    expect(count(db, "SELECT COUNT(*) AS n FROM main.search_dirty")).toBe(0);
    expect(searchCompanies(db, "example company", { limit: 100 }).length).toBe(30);
  });

  it("a sync cut off after committed batches leaves its marks, and the next sync writes them (qa condition 1)", async () => {
    const { db } = openStore({ dataDir: null });
    const loader = fakeSource({}, { records: companies(1, 40) });
    const parse = loader.parse.bind(loader);
    loader.parse = async function* (raw, ctx) {
      let n = 0;
      for await (const r of parse(raw, ctx)) {
        if (++n === 25) db.prepare("UPDATE main.leases SET holder = 'taken-over'").run();
        yield r;
      }
    };
    const cut = await runSync(db, loader, { fetcher: noNetwork, holder: "mine", batch: { maxRecords: 10 } });
    expect(cut.report?.reason).toBe("lease_lost");
    const committed = records(db);
    expect(committed).toBeGreaterThan(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.search_dirty")).toBe(committed);
    expect(searchCompanies(db, "example company", { limit: 100 })).toEqual([]);
    db.prepare("DELETE FROM main.leases").run();
    await runSync(db, fakeSource({ id: "another-source" }, { records: [] }), { fetcher: noNetwork });
    expect(count(db, "SELECT COUNT(*) AS n FROM main.search_dirty")).toBe(0);
    expect(searchCompanies(db, "example company", { limit: 100 }).length).toBe(committed);
  });
});

describe("the deferred pass never leaves a natural person searchable (qa MUST, legal on 8661a89; L2, L3)", () => {
  const name = ["Deferred", "Rewrite", "Example"].join(" ");
  const setup = () => {
    const { db } = openStore({ dataDir: null });
    upsertSource(db, { id: "fake-register", storage: "store" }, "2026-11-22T08:00:00.000Z");
    const syncId = beginSync(db, { sourceId: "fake-register", licenceId: "cc0-1.0", storage: "store", parserVersion: "x", startedAt: "2026-11-22T08:00:00.000Z" });
    const write = (legalForm: string, deferSearch: boolean, key = "k1") =>
      writeRecord(db, {
        syncId,
        sourceId: "fake-register",
        recordKey: key,
        hashInput: [legalForm],
        deferSearch,
        entities: [{ eid: "lv-00000000001", schema: "Company", country: "lv", legalForm, code: "00000000001", statements: [{ prop: "name", value: name, itemId: "S01.LV.01" }] }],
      });
    return { db, write };
  };

  it("a company rewritten as a sole trader is gone from name search before the pass; by code it stays", () => {
    const { db, write } = setup();
    write("lv-sia", false);
    expect(searchCompanies(db, name).length).toBe(1);
    write("lv-ik", true);
    expect(searchCompanies(db, name)).toEqual([]);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.entities_fts")).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.entities_trigram")).toBe(0);
    expect(searchCompanies(db, "00000000001").map((h) => h.match)).toEqual(["code"]);
    rebuildSearch(db);
    expect(searchCompanies(db, name)).toEqual([]);
  });

  it("the control: a company rewritten as a company keeps its rows until the pass, then has fresh ones", () => {
    const { db, write } = setup();
    write("lv-sia", false);
    write("lv-as", true);
    expect(searchCompanies(db, name).length).toBe(1);
    rebuildSearch(db);
    expect(searchCompanies(db, name).length).toBe(1);
  });

  it("the second layer: a name row left for a natural person is never a hit", () => {
    const { db, write } = setup();
    write("lv-ik", false);
    const id = (db.prepare("SELECT id FROM main.entities WHERE eid = 'lv-00000000001'").get() as { id: number }).id;
    db.prepare("INSERT INTO main.entities_fts (rowid, search_text) VALUES (?, ?)").run(id, name.toLowerCase());
    db.prepare("INSERT INTO main.entities_trigram (rowid, search_text) VALUES (?, ?)").run(id, name.toLowerCase());
    expect(searchCompanies(db, name)).toEqual([]);
    expect(searchCompanies(db, "00000000001").length).toBe(1);
  });

  it("the second layer: a name row left for a Person row or a sanctions list entry is never a hit", () => {
    const { db } = setup();
    const syncId = beginSync(db, { sourceId: "fake-register", licenceId: "cc0-1.0", storage: "store", parserVersion: "x", startedAt: "2026-11-22T08:00:00.000Z" });
    writeRecord(db, {
      syncId,
      sourceId: "fake-register",
      recordKey: "k2",
      hashInput: ["k2"],
      entities: [
        { eid: "p-9-1", schema: "Person", country: "lv", statements: [{ prop: "name", value: name, itemId: "S01.LV.01" }] },
        { eid: "sanc-eu-9", schema: "Organization", country: "intl", statements: [{ prop: "name", value: name, itemId: "S01.LV.01" }] },
      ],
    });
    for (const eid of ["p-9-1", "sanc-eu-9"]) {
      const id = (db.prepare("SELECT id FROM main.entities WHERE eid = ?").get(eid) as { id: number }).id;
      db.prepare("INSERT INTO main.entities_fts (rowid, search_text) VALUES (?, ?)").run(id, name.toLowerCase());
    }
    expect(searchCompanies(db, name)).toEqual([]);
  });

  it("the pass skips an entity that is gone and drops its mark, without failing the sync (qa SHOULD)", () => {
    const { db, write } = setup();
    write("lv-sia", true);
    const id = (db.prepare("SELECT id FROM main.entities WHERE eid = 'lv-00000000001'").get() as { id: number }).id;
    db.exec("PRAGMA foreign_keys = OFF");
    db.prepare("DELETE FROM main.entities WHERE id = ?").run(id);
    db.exec("PRAGMA foreign_keys = ON");
    expect(() => rebuildSearch(db)).not.toThrow();
    expect(count(db, "SELECT COUNT(*) AS n FROM main.search_dirty")).toBe(0);
  });
});

describe("fix 6: the hash is compared before the snapshot", () => {
  it("still writes the history event when only a tracked attribute changed (qa condition 4)", async () => {
    const { db } = openStore({ dataDir: null });
    const loader = fakeSource({}, { records: [companyRecord(1)] });
    await runSync(db, loader, { fetcher: noNetwork });
    loader.state.records = [companyRecord(1, { status: "liquidation" })];
    loader.state.asOf = { in_file_field: "2026-11-02" };
    const changed = await runSync(db, loader, { fetcher: noNetwork });
    expect(changed.report?.written).toBe(1);
    expect(changed.report?.events).toBeGreaterThan(0);
  });
});

describe("the statement cache keeps nothing past the sync (legal, qa, cto)", () => {
  it("lives only on the sync connection; an in-process connection gets none", async () => {
    const plain = openStore({ dataDir: null });
    await runSync(plain.db, fakeSource({}, { records: companies(1, 5) }), { fetcher: noNetwork });
    expect(statementCacheSize(plain.db)).toBe(0);
    plain.close();
  });

  it("is empty after every outcome: content, unchanged, partial, failed and lease_lost", async () => {
    const store = openStore({ dataDir: null, sync: true });
    const { db } = store;
    const loader = fakeSource({}, { records: companies(1, 100) });
    const outcomes: string[] = [];
    const run = async (l: SourceLoader, extra = {}) => {
      const o = await runSync(db, l, { fetcher: noNetwork, ...extra });
      outcomes.push(o.report?.reason ?? o.kind);
      expect(statementCacheSize(db), o.kind).toBe(0);
    };
    await run(loader);
    await run(loader);
    loader.state.records = companies(1, 10);
    loader.state.asOf = { in_file_field: "2026-11-02" };
    await run(loader);
    const broken = fakeSource({ id: "broken" }, { records: companies(200, 210), throwAfter: 3 });
    await run(broken);
    const lost = fakeSource({ id: "lost" }, { records: companies(300, 330) });
    const fetch = lost.fetch.bind(lost);
    lost.fetch = async (ctx) => {
      const r = await fetch(ctx);
      db.prepare("UPDATE main.leases SET holder = 'someone-else'").run();
      return r;
    };
    await run(lost);
    expect(outcomes).toEqual(["content", "unchanged", "purge_guard", "parse_error", "lease_lost"]);
    store.close();
  });

  it("a cached statement shows its bound value until the connection closes, then is finalized", () => {
    const store = openStore({ dataDir: null, sync: true });
    const { db } = store;
    const sentinel = ["statement", "cache", "sentinel"].join("-");
    upsertSource(db, { id: "fake-register", storage: "store" }, "2026-11-22T08:00:00.000Z");
    const syncId = beginSync(db, { sourceId: "fake-register", licenceId: "cc0-1.0", storage: "store", parserVersion: "x", startedAt: "2026-11-22T08:00:00.000Z" });
    writeRecord(db, {
      syncId,
      sourceId: "fake-register",
      recordKey: "k1",
      hashInput: [sentinel],
      entities: [{ eid: "lv-00000000001", schema: "Company", country: "lv", legalForm: "lv-sia", statements: [{ prop: "name", value: sentinel, itemId: "S01.LV.01" }] }],
    });
    const statements = cachedStatements(db);
    expect(statements.length).toBeGreaterThan(0);
    // The positive control: the check can see a bound value while the connection is open.
    expect(statements.some((st) => st.expandedSQL.includes(sentinel))).toBe(true);
    store.close();
    // Closing the connection finalizes every statement: none can be read any more.
    for (const st of statements) expect(() => st.expandedSQL).toThrow();
  });

  it("never binds a refused value: a planted personal code, a role_counts name, a birth date (bind recorder)", async () => {
    // Every bind as text: strings, buffers decoded, named-parameter objects by value, numbers;
    // and every SQL text run through exec (H3 in the S05 security re-check).
    const bound: unknown[] = [];
    const record = (value: unknown): void => {
      if (value instanceof Uint8Array) bound.push(new TextDecoder().decode(value));
      else if (value !== null && typeof value === "object") for (const v of Object.values(value)) record(v);
      else if (typeof value === "string") bound.push(value);
      else if (typeof value === "number" || typeof value === "bigint") bound.push(String(value));
    };
    const prepare = DatabaseSync.prototype.prepare;
    const exec = DatabaseSync.prototype.exec;
    DatabaseSync.prototype.prepare = function (this: DatabaseSync, sql: string) {
      const statement = prepare.call(this, sql);
      for (const method of ["run", "get", "all", "iterate"] as const) {
        const original = statement[method].bind(statement) as (...args: unknown[]) => unknown;
        Object.defineProperty(statement, method, { value: (...args: unknown[]) => (args.forEach(record), original(...args)) });
      }
      return statement;
    } as typeof prepare;
    DatabaseSync.prototype.exec = function (this: DatabaseSync, sql: string) {
      record(sql);
      return exec.call(this, sql);
    } as typeof exec;
    try {
      const store = openStore({ dataDir: null, sync: true });
      const first10 = ["4", "900101", "123"].join("");
      const planted = `${first10}${balticCheckDigit(first10)}`;
      const register = () => fromFile(lvUrRegister, "register.csv", lvRegisterCsv);
      // The register loads first and is not scanned: a sole trader's register name holds a person's name.
      await runSync(store.db, register(), { fetcher: noNetwork });
      bound.length = 0;
      await runSync(store.db, fromFile(lvUrOfficersLoader({ personRows: "role_counts" }), "officers.csv", lvOfficersCsv), { fetcher: noNetwork });
      // A foreign holder with a quoted name, unproven (no company types): never bound, in any form (G4).
      const quoted = ['SIA "Quoted', 'Sentinel', 'Holding"'].join(" ");
      const holder = { type: "FOREIGN_ENTITY", entities: [{ eid: "org-00000000000000000099", schema: "Organization" as const, country: "intl", statements: [{ prop: "name", value: quoted, itemId: "S04.LV.01" }] }] };
      const plantedRecord = { ...companyRecord(9, { extra: [{ prop: "notes", value: `ref ${planted}`, itemId: "S01.LV.01" }] }), parties: [holder] };
      plantedRecord.hashInput = [...plantedRecord.hashInput, JSON.stringify(["holder", quoted])];
      await runSync(store.db, fakeSource({ id: "planted", items: ["S01.LV.01", "S04.LV.01"] }, { records: [plantedRecord] }), { fetcher: noNetwork });
      const scanned = bound.splice(0);
      // The names the officers file holds, read the names_no_id way in a store of their own.
      const named = openStore({ dataDir: null });
      await runSync(named.db, register(), { fetcher: noNetwork });
      bound.length = 0;
      await runSync(named.db, fromFile(lvUrOfficersLoader({ personRows: "names_no_id" }), "officers.csv", lvOfficersCsv), { fetcher: noNetwork });
      const namedBinds = bound.splice(0);
      const names = (named.db.prepare("SELECT DISTINCT st.value FROM main.statements st JOIN main.entities e ON e.id = st.entity_id JOIN main.schemas s ON s.id = e.schema_id WHERE s.name = 'Person'").all() as { value: string }[]).map((r) => r.value);
      named.close();
      store.close();
      expect(names.length).toBeGreaterThan(0);
      // The recorder saw the role_counts syncs' writes, so an empty result below means something.
      expect(scanned.filter((v) => typeof v === "string").length).toBeGreaterThan(100);
      // Every sentinel is matched inside a value, not only as the whole value (F5): as itself, JSON-escaped
      // once (G4) and twice, and in its search-normalised form, against the bound text normalised too (H3).
      const escape = (text: string) => JSON.stringify(text).slice(1, -1);
      const raw = [lvMaskedCodeCanary(), LV_BIRTH_DATE_CANARY, planted, quoted, ...names];
      const sentinels = raw.flatMap((s) => [s, escape(s), escape(escape(s))]);
      const normalised = raw.map((s) => normalizeText(s)).filter((s) => s.length >= 4);
      const hits = (values: unknown[]) =>
        values.filter((v) => typeof v === "string" && (sentinels.some((s) => v.includes(s)) || normalised.some((s) => normalizeText(v).includes(s))));
      // The positive controls: the matcher finds every name the names_no_id run binds, and a sentinel inside a JSON value.
      for (const name of names) expect(hits(namedBinds.filter((v) => typeof v === "string" && v.includes(name))).length, name).toBeGreaterThan(0);
      expect(hits([JSON.stringify({ born: LV_BIRTH_DATE_CANARY }), JSON.stringify({ officer: names[0] }), `ref ${planted}.`, JSON.stringify({ holder: quoted })])).toHaveLength(4);
      // Only the escaped form can match there: the raw quoted name is not inside its JSON.
      expect(JSON.stringify({ holder: quoted }).includes(quoted)).toBe(false);
      // H3's controls: a buffer, a named-parameter object, a double-escaped JSON value and an upper-cased
      // name are each caught once recorded; and exec SQL was recorded (BEGIN, COMMIT at least).
      const probe = bound.length;
      record(new TextEncoder().encode(`x ${names[0]} y`));
      record({ $name: planted });
      record(JSON.stringify(JSON.stringify({ holder: quoted })));
      record(String(names[0]).toUpperCase());
      expect(hits(bound.splice(probe))).toHaveLength(4);
      expect(scanned.some((v) => v === "COMMIT")).toBe(true);
      expect(hits(scanned)).toEqual([]);
    } finally {
      DatabaseSync.prototype.prepare = prepare;
      DatabaseSync.prototype.exec = exec;
    }
  });
});
