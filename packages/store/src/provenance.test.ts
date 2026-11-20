import { describe, expect, it } from "vitest";
import { sourceRefForStatement } from "./provenance.ts";
import { beginSync, upsertSource, writeRecord } from "./registry.ts";
import { company, contentSync, memoryStore, statementIdOf } from "./test-helpers.ts";

const record = (syncId: number, eid: string, name: string) => ({
  syncId,
  sourceId: "lv-register",
  recordKey: eid,
  hashInput: [eid, name],
  entities: [company(eid, name)],
});

describe("R3: every stored value carries its source", () => {
  it("gives source, licence, retrieval date, as-of and access tier", () => {
    const { db } = memoryStore();
    const sync = contentSync(db, "lv-register", "2026-11-01T06:00:00.000Z", { licenceId: "cc0-1.0", upstreamAsOf: "2026-10-31" });
    writeRecord(db, record(sync, "lv-00000000001", "Example Trading SIA"));
    expect(sourceRefForStatement(db, statementIdOf(db, "lv-00000000001"))).toEqual({
      sourceId: "lv-register",
      licenceId: "cc0-1.0",
      retrievedAt: "2026-11-01T06:00:00.000Z",
      asOf: "2026-10-31",
      asOfBasis: null,
      checkedAt: "2026-11-01T06:00:00.000Z",
      accessTier: "open",
      derived: false,
    });
  });

  it("moves checkedAt on an unchanged sync and keeps retrievedAt", () => {
    const { db } = memoryStore();
    const first = contentSync(db, "lv-register", "2026-11-01T06:00:00.000Z");
    writeRecord(db, record(first, "lv-00000000001", "Example Trading SIA"));
    const again = contentSync(db, "lv-register", "2026-11-02T06:00:00.000Z", { kind: "unchanged" });
    expect(writeRecord(db, record(again, "lv-00000000001", "Example Trading SIA")).changed).toBe(false);
    const ref = sourceRefForStatement(db, statementIdOf(db, "lv-00000000001"));
    expect(ref.retrievedAt).toBe("2026-11-01T06:00:00.000Z");
    expect(ref.checkedAt).toBe("2026-11-02T06:00:00.000Z");
  });

  it("refuses a record whose sync does not exist", () => {
    const { db } = memoryStore();
    upsertSource(db, { id: "lv-register", storage: "store" }, "2026-11-01T00:00:00.000Z");
    expect(() => writeRecord(db, record(999, "lv-00000000001", "Example Trading SIA"))).toThrow(/FOREIGN KEY/);
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.statements").get()).toEqual({ n: 0 });
  });

  it("refuses a sync with no licence", () => {
    const { db } = memoryStore();
    upsertSource(db, { id: "lv-register", storage: "store" }, "2026-11-01T00:00:00.000Z");
    const start = { sourceId: "lv-register", storage: "store", parserVersion: "test", startedAt: "2026-11-01T00:00:00.000Z" };
    expect(() => beginSync(db, { ...start, licenceId: "" })).toThrow(/CHECK/);
    expect(() => beginSync(db, { ...start, licenceId: null as unknown as string })).toThrow(/NOT NULL/);
  });

  it("refuses a HIDE or LATER item and an unknown property", () => {
    const { db } = memoryStore();
    const sync = contentSync(db, "lv-register", "2026-11-01T06:00:00.000Z");
    const hidden = { ...record(sync, "lv-00000000001", "Example"), entities: [company("lv-00000000001", "Example", { statements: [{ prop: "name", value: "Example", itemId: "S04.LV.02" }] })] };
    expect(() => writeRecord(db, hidden)).toThrow(/item_not_loadable/);
    const later = { ...hidden, entities: [company("lv-00000000001", "Example", { statements: [{ prop: "name", value: "Example", itemId: "S05.LV.01" }] })] };
    expect(() => writeRecord(db, later)).toThrow(/item_not_loadable/);
    const unknown = { ...hidden, entities: [company("lv-00000000001", "Example", { statements: [{ prop: "birthDate", value: "x", itemId: "S01.LV.01" }] })] };
    expect(() => writeRecord(db, unknown)).toThrow(/unknown_prop/);
  });
});
