// qa's S05 review, M1-M5 (7075336394; legal 7075341817): refs and event-data references follow the
// conditions of the design check. Each case is qa's probe, built from fixture-world parts.
import { fixtureRegisterCode, idIsPersonalCode, isBalticPersonalCode, isFixtureRegisterCode } from "@finora/domain";
import type { ParsedRecord } from "@finora/sources";
import { StoreError, writeRecord } from "@finora/store";
import { describe, expect, it } from "vitest";
import { runSync } from "./pipeline.ts";
import { validateRecord } from "./validate.ts";
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
    // The very same file: a file with a waiting record keeps no content hash, so it is parsed again.
    const second = await sync(db, "fake-register", records);
    expect(second.report?.dropped.reference_unresolved).toBeUndefined();
    expect(count(db, `SELECT COUNT(*) AS n FROM main.events WHERE data LIKE '%${target}%'`)).toBe(1);
  });

  it("a reference that never resolves does not churn: once the store stops growing the file is unchanged, and the count is still reported", async () => {
    const db = memoryDb();
    const event = [{ entityEid: `lv-${lv(1)}`, type: "register.reorganisation", date: "2026-01-01", itemId: "S02.LV.01", data: { other: `lv-${overlapCode()}` } }];
    const records = [company(lv(1), {}, event)];
    await sync(db, "fake-register", records);
    const second = await sync(db, "fake-register", records);
    expect([second.kind, second.report?.written]).toEqual(["content", 0]);
    const third = await sync(db, "fake-register", records);
    expect(third.kind).toBe("unchanged");
    expect(third.report?.dropped.reference_unresolved).toBe(1);
  });

  it("SEC-4: facts and events never attach to a person row, and an unknown entity's facts fail closed", async () => {
    const db = memoryDb();
    await sync(db, "fake-register", [company(lv(1))]);
    await sync(db, "fake-officers", [roleSetRecord(1, [{ name: "Example Person", role: "board_member", rowId: "11" }])]);
    const person = (db.prepare("SELECT eid FROM main.entities WHERE eid LIKE 'p-%' LIMIT 1").get() as { eid: string }).eid;
    expect(() =>
      writeRecord(db, { syncId: 1, sourceId: "fake-register", recordKey: "ev", hashInput: ["ev"], entities: [], events: [{ entityEid: person, type: "x.y", date: "2026-01-01", itemId: "S02.LV.01" }] }),
    ).toThrow(/ref_not_company/);
    // A tax report on an entity the store does not hold yet is judged a natural person's and dropped; the file is retried.
    const report = { recordKey: "tax-1", hashInput: ["1"], entities: [], reports: [{ entityEid: `lv-${lv(9)}`, kind: "taxes", periodEnd: "2026-09-30", itemId: "S08.LV.01", facts: [{ concept: "taxes_paid", value: 1 }] }] };
    const outcome = await sync(db, "fake-tax", [report]);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.fact_reports")).toBe(0);
    expect(db.prepare("SELECT content_hash FROM main.syncs WHERE id = ?").get(outcome.syncId)).toEqual({ content_hash: null });
  });

  it("legal: a reference that resolves to a natural person is refused for good, never retried", async () => {
    const db = memoryDb();
    await sync(db, "fake-register", [company(lv(1)), company(lv(2), { legalForm: "lv-ik" })]);
    const event = [{ entityEid: `lv-${lv(1)}`, type: "register.reorganisation", date: "2026-01-01", itemId: "S02.LV.01", data: { other: `lv-${lv(2)}` } }];
    const outcome = await sync(db, "fake-events", [{ ...company(lv(1), {}, event), recordKey: "to-sole-trader" }]);
    expect(outcome.report?.dropped.natural_person_party).toBe(1);
    expect(outcome.report?.dropped.reference_unresolved).toBeUndefined();
    expect(count(db, `SELECT COUNT(*) AS n FROM main.events WHERE data LIKE '%${lv(2)}%'`)).toBe(0);
  });

  it("M4: a shape-valid reference needs a register check digit and must not fit the LV personal-code shape", async () => {
    const db = memoryDb();
    await sync(db, "fake-register", [company(lv(1))]);
    const bad = `lv-${lv(1).slice(0, 10)}${(Number(lv(1)[10]) + 5) % 10}`;
    const event = (other: string) => [{ entityEid: `lv-${lv(1)}`, type: "register.reorganisation", date: "2026-01-01", itemId: "S02.LV.01", data: { other } }];
    await sync(db, "fake-events", [{ ...company(lv(1), {}, event(bad)), recordKey: "bad-digit" }]);
    expect(count(db, `SELECT COUNT(*) AS n FROM main.events WHERE data LIKE '%${bad}%'`)).toBe(0);
  });

  it("SEC-3: a role-count record and an ownership record get the strict key rule, though they hold no person entity", () => {
    // An LV personal code behind an "lv-" prefix: the company-only rule reads it as an eid, the strict rule refuses it.
    const code = ["lv-", "010190", "12345"].join("");
    const roleCounts: ParsedRecord = {
      recordKey: `lv-${lv(1)}:officers`,
      hashInput: ["3"],
      lineIds: [code],
      entities: [{ eid: `lv-${lv(1)}`, schema: "Company", country: "lv", code: lv(1), ref: true, statements: [{ prop: "notes", value: "3 role lines", itemId: "S03.LV.01" }] }],
    };
    expect(validateRecord(roleCounts)).toEqual({ ok: false, reason: "person_field" });
    const members: ParsedRecord = {
      recordKey: `lv-${lv(1)}:members`,
      hashInput: ["1"],
      lineIds: [code],
      entities: [{ eid: "rel-1-0", schema: "Ownership", country: "lv", statements: [{ prop: "asset", value: `lv-${lv(1)}`, itemId: "S04.LV.01" }] }],
    };
    expect(validateRecord(members)).toEqual({ ok: false, reason: "person_field" });
    // The control: the same key in a company-only record passes the country-aware rule, so the two cases above are the strict rule at work.
    expect(validateRecord({ ...roleCounts, entities: [{ ...roleCounts.entities[0]!, statements: [{ prop: "name", value: "Example SIA", itemId: "S01.LV.01" }] }] }).ok).toBe(true);
  });
});
