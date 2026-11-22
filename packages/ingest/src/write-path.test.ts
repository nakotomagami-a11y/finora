// cto's write-path fixes on S05 (one write path, 7075394106) and the agreed proof that no person
// value outlives a sync in the connection (qa 7082809281, legal 7082812770, cto 7082802021).
import { DatabaseSync } from "node:sqlite";
import { balticCheckDigit } from "@finora/domain";
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
    const bound: unknown[] = [];
    const prepare = DatabaseSync.prototype.prepare;
    DatabaseSync.prototype.prepare = function (this: DatabaseSync, sql: string) {
      const statement = prepare.call(this, sql);
      for (const method of ["run", "get", "all", "iterate"] as const) {
        const original = statement[method].bind(statement) as (...args: unknown[]) => unknown;
        Object.defineProperty(statement, method, { value: (...args: unknown[]) => (bound.push(...args), original(...args)) });
      }
      return statement;
    } as typeof prepare;
    try {
      const store = openStore({ dataDir: null, sync: true });
      const first10 = ["4", "900101", "123"].join("");
      const planted = `${first10}${balticCheckDigit(first10)}`;
      const officers = fromFile(lvUrOfficersLoader({ personRows: "role_counts" }), "officers.csv", lvOfficersCsv);
      await runSync(store.db, fromFile(lvUrRegister, "register.csv", lvRegisterCsv), { fetcher: noNetwork });
      await runSync(store.db, officers, { fetcher: noNetwork });
      await runSync(store.db, fakeSource({ id: "planted" }, { records: [companyRecord(9, { extra: [{ prop: "notes", value: `ref ${planted}`, itemId: "S01.LV.01" }] })] }), { fetcher: noNetwork });
      // The names the officers file holds, read the names_no_id way in a store of their own.
      const named = openStore({ dataDir: null });
      const before = bound.length;
      await runSync(named.db, fromFile(lvUrRegister, "register.csv", lvRegisterCsv), { fetcher: noNetwork });
      await runSync(named.db, fromFile(lvUrOfficersLoader({ personRows: "names_no_id" }), "officers.csv", lvOfficersCsv), { fetcher: noNetwork });
      const names = (named.db.prepare("SELECT DISTINCT st.value FROM main.statements st JOIN main.entities e ON e.id = st.entity_id JOIN main.schemas s ON s.id = e.schema_id WHERE s.name = 'Person'").all() as { value: string }[]).map((r) => r.value);
      bound.length = before;
      named.close();
      store.close();
      expect(names.length).toBeGreaterThan(0);
      // The recorder saw the role_counts syncs' writes, so an empty result below means something.
      expect(bound.filter((v) => typeof v === "string").length).toBeGreaterThan(100);
      const sentinels = [lvMaskedCodeCanary(), LV_BIRTH_DATE_CANARY, planted, ...names];
      const leaked = bound.filter((v) => typeof v === "string" && sentinels.some((s) => v === s || v.includes(planted) || v.includes(lvMaskedCodeCanary())));
      expect(leaked).toEqual([]);
    } finally {
      DatabaseSync.prototype.prepare = prepare;
    }
  });
});
