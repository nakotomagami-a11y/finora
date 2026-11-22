// qa's S05 review, M1-M5 (7075336394; legal 7075341817): refs and event-data references follow the
// conditions of the design check. Each case is qa's probe, built from fixture-world parts.
import { fixtureRegisterCode, idIsPersonalCode, isBalticPersonalCode, isFixtureRegisterCode } from "@finora/domain";
import type { ParsedRecord } from "@finora/sources";
import { StoreError, writeRecord } from "@finora/store";
import { describe, expect, it } from "vitest";
import { runSync } from "./pipeline.ts";
import { fakeSource, noNetwork, roleSetRecord } from "./testing/fake-source.ts";
import { count, memoryDb } from "./test-helpers.ts";

const lv = (n: number) => fixtureRegisterCode("lv", `4000300${String(n).padStart(3, "0")}`) as string;
/** A fixture LV code that also passes the EE/LT personal-code check (the 688 reorganisations). */
function overlapCode(): string {
  for (let i = 0; ; i++) {
    const code = fixtureRegisterCode("lv", `40004${String(i).padStart(5, "0")}`) as string;
    if (isFixtureRegisterCode("lv", code) && isBalticPersonalCode(code) && !idIsPersonalCode("lv", code)) return code;
  }
}

const company = (code: string, extra: Partial<ParsedRecord["entities"][number]> = {}, events: ParsedRecord["events"] = []): ParsedRecord => ({
  recordKey: `lv-${code}`,
  hashInput: [String(code.length), JSON.stringify(extra.legalForm ?? ""), String(events?.length ?? 0)],
  entities: [{ eid: `lv-${code}`, schema: "Company", country: "lv", legalForm: "lv-sia", status: "active", code, statements: [{ prop: "name", value: "Example Company SIA", itemId: "S01.LV.01" }], ...extra }],
  events,
});
let refs = 0;
const ref = (eid: string, code: string, statements: ParsedRecord["entities"][number]["statements"], events: ParsedRecord["events"] = []): ParsedRecord => ({
  recordKey: `extra-${++refs}`,
  hashInput: [code, JSON.stringify(statements)],
  entities: [{ eid, schema: "Company", country: "lv", code, ref: true, statements }],
  events,
});
const sync = (db: ReturnType<typeof memoryDb>, id: string, records: ParsedRecord[]) => runSync(db, fakeSource({ id }, { records }), { fetcher: noNetwork });

describe("qa M1-M5 on S05", () => {
  it("M1: a ref never attaches to a person row; the store refuses it too", async () => {
    const db = memoryDb();
    await sync(db, "fake-register", [company(lv(1))]);
    await sync(db, "fake-officers", [roleSetRecord(1, [{ name: "Example Person", role: "board_member", rowId: "11" }])]);
    const person = (db.prepare("SELECT eid FROM main.entities WHERE eid LIKE 'p-%' LIMIT 1").get() as { eid: string } | undefined)?.eid;
    expect(person).toBeDefined();
    const outcome = await sync(db, "fake-notes", [ref(person as string, lv(1), [{ prop: "notes", value: "planted note", itemId: "S01.LV.01" }])]);
    expect(outcome.report?.dropped.ref_not_company).toBe(1);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value = 'planted note'")).toBe(0);
    expect(() =>
      writeRecord(db, { syncId: 1, sourceId: "fake-notes", recordKey: "x", hashInput: ["x"], entities: [{ eid: person as string, schema: "Company", country: "lv", ref: true, statements: [] }] }),
    ).toThrow(StoreError);
  });

  it("M2: a ref is judged by the row it writes to; a code that is not that row's own attaches nothing", async () => {
    const db = memoryDb();
    await sync(db, "fake-register", [company(lv(1)), company(lv(2), { legalForm: "lv-ik" })]);
    const address = [{ prop: "address", value: "Example iela 1, Riga", itemId: "S01.LV.01" }];
    // The sole trader's eid with the company's code: refused, nothing attached.
    const mismatch = await sync(db, "fake-addresses", [ref(`lv-${lv(2)}`, lv(1), address)]);
    expect(mismatch.report?.dropped.ref_mismatch).toBe(1);
    // The sole trader's own code: judged as the natural person it is, so the address is dropped.
    const own = await sync(db, "fake-addresses-2", [ref(`lv-${lv(2)}`, lv(2), address)]);
    expect(own.report?.dropped.sole_trader_address).toBe(1);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value = 'Example iela 1, Riga'")).toBe(0);
  });

  it("M3 and M4: a person or relationship row id in event data is never a reference", async () => {
    const db = memoryDb();
    await sync(db, "fake-register", [company(lv(1))]);
    await sync(db, "fake-officers", [roleSetRecord(1, [{ name: "Example Person", role: "board_member", rowId: "11" }])]);
    const person = (db.prepare("SELECT eid FROM main.entities WHERE eid LIKE 'p-%' LIMIT 1").get() as { eid: string }).eid;
    const rel = (db.prepare("SELECT eid FROM main.entities WHERE eid LIKE 'rel-%' LIMIT 1").get() as { eid: string }).eid;
    const event = (other: string) => [{ entityEid: `lv-${lv(1)}`, type: "register.reorganisation", date: "2026-01-01", itemId: "S02.LV.01", data: { other } }];
    await sync(db, "fake-events", [ref(person, lv(1), [], event(person)), { ...company(lv(1), {}, event(rel)), recordKey: "second" }]);
    expect(count(db, `SELECT COUNT(*) AS n FROM main.events WHERE data LIKE '%${person}%' OR data LIKE '%${rel}%'`)).toBe(0);
  });

  it("M5: a company reference whose target is not loaded yet is counted, withheld, and loads on the next sync", async () => {
    const db = memoryDb();
    const target = overlapCode();
    const event = [{ entityEid: `lv-${lv(1)}`, type: "register.reorganisation", date: "2026-01-01", itemId: "S02.LV.01", data: { other: `lv-${target}` } }];
    // The target is a later record of the same file, so it is not in the store when the event is gated.
    const records = [company(lv(1), {}, event), company(target)];
    const first = await sync(db, "fake-register", records);
    expect(first.report?.dropped.reference_unresolved).toBe(1);
    expect(first.report?.dropped.personal_code).toBeUndefined();
    expect(count(db, `SELECT COUNT(*) AS n FROM main.events WHERE data LIKE '%${target}%'`)).toBe(0);
    const second = await runSync(db, fakeSource({ id: "fake-register" }, { records, asOf: { in_file_field: "2026-11-02" } }), { fetcher: noNetwork });
    expect(second.report?.dropped.reference_unresolved).toBeUndefined();
    expect(count(db, `SELECT COUNT(*) AS n FROM main.events WHERE data LIKE '%${target}%'`)).toBe(1);
  });

  it("M4: a shape-valid reference needs a register check digit and must not fit the LV personal-code shape", async () => {
    const db = memoryDb();
    await sync(db, "fake-register", [company(lv(1))]);
    const bad = `lv-${lv(1).slice(0, 10)}${(Number(lv(1)[10]) + 5) % 10}`;
    const event = (other: string) => [{ entityEid: `lv-${lv(1)}`, type: "register.reorganisation", date: "2026-01-01", itemId: "S02.LV.01", data: { other } }];
    await sync(db, "fake-events", [{ ...company(lv(1), {}, event(bad)), recordKey: "bad-digit" }]);
    expect(count(db, `SELECT COUNT(*) AS n FROM main.events WHERE data LIKE '%${bad}%'`)).toBe(0);
  });
});
