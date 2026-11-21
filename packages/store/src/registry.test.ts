import { balticCheckDigit } from "@finora/domain";
import { describe, expect, it } from "vitest";
import { IDENTIFIER_INDEX_WHERE, IDENTIFIER_PROPS } from "./migrations.ts";
import { findByIdentifier } from "./search.ts";
import { transaction } from "./open.ts";
import { intern, writeRecord, type EntityInput, type RecordInput } from "./registry.ts";
import { company, contentSync, memoryStore, writeRoleSet } from "./test-helpers.ts";

const count = (db: ReturnType<typeof memoryStore>["db"], table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

/** An 11-digit LV-style register code (first digit 4) that also passes the EE/LT personal-code check. */
function lvCodePassingBalticCheck(): string {
  for (let i = 0; i < 100; i++) {
    const first10 = `40001${String(i).padStart(2, "0")}010`.slice(0, 10);
    const c = balticCheckDigit(first10);
    const candidate = `${first10}${c}`;
    if (candidate.length === 11) return candidate;
  }
  throw new Error("no candidate");
}

describe("the sole-trader id guard is country-aware (lv-register.md, legal's S04a condition 1)", () => {
  const sole = (country: string, legalForm: string, id: string): RecordInput => ({
    syncId: 0,
    sourceId: `${country}-register`,
    recordKey: `${country}-sole`,
    hashInput: [id],
    entities: [
      {
        ...company(`${country}-00000000009`, "Sample Trader", { country, legalForm }),
        statements: [
          { prop: "name", value: "Sample Trader", itemId: `S01.${country.toUpperCase()}.01` },
          { prop: "registrationNumber", value: id, itemId: `S01.${country.toUpperCase()}.01` },
        ],
      },
    ],
  });

  it("loads an LV sole trader whose register code happens to pass the EE/LT check", () => {
    const { db } = memoryStore();
    const input = { ...sole("lv", "lv-ik", lvCodePassingBalticCheck()), syncId: contentSync(db, "lv-register", "2026-11-01T00:00:00.000Z") };
    expect(writeRecord(db, input).changed).toBe(true);
  });

  it("refuses an LV sole-trader id with the DDMMYY or the 32 shape", () => {
    const { db } = memoryStore();
    const syncId = contentSync(db, "lv-register", "2026-11-01T00:00:00.000Z");
    for (const id of [["010190", "12345"].join(""), ["32", "000000000"].join(""), ["010190", "12345"].join("-")]) {
      expect(() => writeRecord(db, { ...sole("lv", "lv-ik", id), syncId }), id).toThrow(/personal_code_refused/);
    }
    expect(count(db, "main.entities")).toBe(0);
  });

  it("refuses an EE or LT sole-trader id that passes the EE/LT personal-code check", () => {
    for (const [country, form] of [["ee", "ee-fie"], ["lt", "lt-ii"]] as const) {
      const { db } = memoryStore();
      const syncId = contentSync(db, `${country}-register`, "2026-11-01T00:00:00.000Z");
      const first10 = ["3000", "1010", "00"].join("");
      const id = `${first10}${balticCheckDigit(first10)}`;
      expect(() => writeRecord(db, { ...sole(country, form, id), syncId })).toThrow(/personal_code_refused/);
      expect(writeRecord(db, { ...sole(country, form, "10000001"), syncId }).changed).toBe(true);
    }
  });
});

describe("writeRecord", () => {
  it("refuses a personal code in an event's data, the second line behind the gate (SEC-1)", () => {
    const { db } = memoryStore();
    const syncId = contentSync(db, "lv-register", "2026-11-01T00:00:00.000Z");
    const first10 = ["3000", "1010", "00"].join("");
    const entity = company("lv-00000000001", "Example SIA");
    expect(() =>
      writeRecord(db, {
        syncId,
        sourceId: "lv-register",
        recordKey: entity.eid,
        hashInput: ["1"],
        entities: [entity],
        events: [{ entityEid: entity.eid, type: "register.note", date: "2026-10-01", itemId: "S09.LV.01", data: { note: `${first10}${balticCheckDigit(first10)}` } }],
      }),
    ).toThrow(/personal_code_refused/);
    expect(count(db, "main.records")).toBe(0);
  });

  it("is atomic on its own: a failure mid-write leaves nothing, inside or outside a transaction", () => {
    const { db } = memoryStore();
    const syncId = contentSync(db, "lv-register", "2026-11-01T00:00:00.000Z");
    const bad = company("lv-00000000001", "Example SIA");
    bad.statements.push({ prop: "alias", value: "x", itemId: "S01.LV.01", line: "not a number" as unknown as number });
    const input = { syncId, sourceId: "lv-register", recordKey: bad.eid, hashInput: ["x"], entities: [bad] };
    expect(() => writeRecord(db, input)).toThrow();
    expect([count(db, "main.records"), count(db, "main.entities"), count(db, "main.statements")]).toEqual([0, 0, 0]);

    transaction(db, () => {
      writeRecord(db, { ...input, recordKey: "good", entities: [company("lv-00000000002", "Good SIA")] });
      expect(() => writeRecord(db, input)).toThrow();
    });
    expect([count(db, "main.records"), count(db, "main.entities")]).toEqual([1, 1]);
  });

  it("keeps an entity that still has facts or events from another source when its record drops it (qa Q-4)", () => {
    const { db } = memoryStore();
    const officers = contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z");
    const corporate: EntityInput = company("lv-00000000002", "Holding Example SIA");
    writeRecord(db, { syncId: officers, sourceId: "lv-officers", recordKey: "set", hashInput: ["1"], entities: [corporate] });
    const entityId = (db.prepare("SELECT id FROM main.entities WHERE eid = ?").get(corporate.eid) as { id: number }).id;
    const accounts = contentSync(db, "lv-accounts", "2026-11-01T00:00:00.000Z");
    const record = Number(
      db
        .prepare("INSERT INTO main.records (source_id, record_key, row_hash, first_sync_id, last_changed_sync_id) VALUES ('lv-accounts', 'r', x'00', ?, ?)")
        .run(accounts, accounts).lastInsertRowid,
    );
    db.prepare("INSERT INTO main.fact_reports (entity_id, kind, period_end, record_id) VALUES (?, 'annual', '2025-12-31', ?)").run(entityId, record);

    writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-02T00:00:00.000Z"), "lv-00000000001", []);
    writeRecord(db, { syncId: officers, sourceId: "lv-officers", recordKey: "set", hashInput: ["2"], entities: [] });
    expect(db.prepare("SELECT eid FROM main.entities WHERE id = ?").get(entityId)).toEqual({ eid: corporate.eid });
    expect(count(db, "main.fact_reports")).toBe(1);
  });
});

describe("the identifier index (cto M1 health check)", () => {
  it("seeds the identifier props at their fixed ids", () => {
    const { db } = memoryStore();
    for (const [name, id] of Object.entries(IDENTIFIER_PROPS)) expect(intern(db, "props", name)).toBe(id);
  });

  it("serves an ID lookup from the partial index, and has no full (prop_id, value) index", () => {
    const { db } = memoryStore();
    const sync = contentSync(db, "gleif", "2026-11-01T00:00:00.000Z");
    const lei = company("lv-00000000001", "Example SIA");
    lei.statements.push({ prop: "leiCode", value: "FX00000000000000TEST", itemId: "S01.ALL.01" });
    writeRecord(db, { syncId: sync, sourceId: "gleif", recordKey: lei.eid, hashInput: ["1"], entities: [lei] });
    expect(findByIdentifier(db, "leiCode", "FX00000000000000TEST")).toEqual([lei.eid]);
    const sql = `SELECT st.entity_id FROM main.statements st WHERE st.prop_id = 4 AND st.value = ? AND ${IDENTIFIER_INDEX_WHERE}`;
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all("x") as { detail: string }[];
    expect(plan.map((p) => p.detail).join(" ")).toMatch(/USING (?:COVERING )?INDEX statements_identifier/);
    const indexes = db.prepare("SELECT name, sql FROM main.sqlite_master WHERE type = 'index' AND tbl_name = 'statements'").all() as {
      name: string;
      sql: string;
    }[];
    for (const index of indexes) {
      if (/\(prop_id, value\)/.test(index.sql)) expect(index.sql, index.name).toMatch(/WHERE prop_id BETWEEN 1 AND 8/);
    }
  });
});
