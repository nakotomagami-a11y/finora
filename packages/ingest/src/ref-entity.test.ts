// S05: a source that adds statements, facts or events to an entity another source owns (an LV
// former name, a capital value, an insolvency row) never changes that entity, and the natural-person
// rules use what the store holds for it.
import { describe, expect, it } from "vitest";
import { count, memoryDb, sync } from "./test-helpers.ts";
import { fakeSource } from "./testing/fake-source.ts";

const COMPANY = "40003000014";
const TRADER = "40003000022";

function registered() {
  const db = memoryDb();
  const register = fakeSource(
    { id: "fake-register", items: ["S01.LV.01"] },
    {
      records: [
        { recordKey: COMPANY, hashInput: ["c"], entities: [{ eid: `lv-${COMPANY}`, schema: "Company", country: "lv", legalForm: "lv-sia", status: "active", code: COMPANY, statements: [{ prop: "name", value: "Example Timber SIA", itemId: "S01.LV.01" }] }] },
        { recordKey: TRADER, hashInput: ["t"], entities: [{ eid: `lv-${TRADER}`, schema: "Company", country: "lv", legalForm: "lv-ik", status: "active", code: TRADER, statements: [{ prop: "name", value: "IK Test Person A", itemId: "S01.LV.01" }] }] },
      ],
    },
  );
  return { db, register };
}

const ref = (code: string, statements: { prop: string; value: string; itemId: string }[]) => ({ eid: `lv-${code}`, schema: "Company" as const, country: "lv", code, ref: true, statements });

describe("entities owned by another source (ParsedEntity.ref)", () => {
  it("attaches statements without changing the entity's form, status or person flag", async () => {
    const { db, register } = registered();
    await sync(db, register);
    const names = fakeSource({ id: "fake-names", items: ["S02.LV.01"] }, { records: [{ recordKey: "n1", hashInput: ["n1"], entities: [ref(COMPANY, [{ prop: "previousName", value: "Example Oldname SIA", itemId: "S02.LV.01" }])] }] });
    expect((await sync(db, names)).kind).toBe("content");
    expect(db.prepare("SELECT legal_form, status, natural_person FROM main.entities WHERE eid = ?").get(`lv-${COMPANY}`)).toEqual({ legal_form: "lv-sia", status: "active", natural_person: 0 });
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements s JOIN main.props p ON p.id = s.prop_id WHERE p.name = 'previousName'")).toBe(1);
  });

  it("never creates the entity: a code the store lacks is a counted skip", async () => {
    const { db, register } = registered();
    await sync(db, register);
    const names = fakeSource({ id: "fake-names", items: ["S02.LV.01"] }, { records: [{ recordKey: "n1", hashInput: ["n1"], entities: [ref("40003999990", [{ prop: "previousName", value: "Ghost SIA", itemId: "S02.LV.01" }])] }] });
    const outcome = await sync(db, names);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.entities WHERE eid = 'lv-40003999990'")).toBe(0);
    expect(outcome.report?.skipped).toMatchObject({ entity_missing: 1 });
  });

  it("drops a referenced sole trader's former name, and S09 events on it from a record that does not carry it", async () => {
    const { db, register } = registered();
    await sync(db, register);
    const other = fakeSource(
      { id: "fake-risk", items: ["S02.LV.01", "S09.LV.01"] },
      {
        records: [
          { recordKey: "n1", hashInput: ["n1"], entities: [ref(TRADER, [{ prop: "previousName", value: "IK Former Name", itemId: "S02.LV.01" }])] },
          { recordKey: "e1", hashInput: ["e1"], entities: [], events: [{ entityEid: `lv-${TRADER}`, type: "register.securing_measure", date: "2026-01-01", itemId: "S09.LV.01" }] },
          { recordKey: "e2", hashInput: ["e2"], entities: [], events: [{ entityEid: `lv-${COMPANY}`, type: "register.securing_measure", date: "2026-01-01", itemId: "S09.LV.01" }] },
        ],
      },
    );
    const outcome = await sync(db, other);
    expect(outcome.report?.dropped).toMatchObject({ natural_person_name: 1, natural_person_insolvency: 1 });
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements s JOIN main.props p ON p.id = s.prop_id WHERE p.name = 'previousName'")).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.events")).toBe(1);
  });
});

describe("load rule 3: an ended entity keeps no current-business data, whatever source writes to it", () => {
  it("drops accounts on a struck-off company, keeps its former name and its risk history", async () => {
    const db = memoryDb();
    const ENDED = "40003000030";
    await sync(
      db,
      fakeSource({ id: "fake-register", items: ["S01.LV.01"] }, { records: [{ recordKey: ENDED, hashInput: ["x"], entities: [{ eid: `lv-${ENDED}`, schema: "Company", country: "lv", legalForm: "lv-sia", status: "struck_off", code: ENDED, statements: [{ prop: "name", value: "Demo Closed SIA", itemId: "S01.LV.01" }] }] }] }),
    );
    const other = fakeSource(
      { id: "fake-tax", items: ["S02.LV.01", "S06.LV.01", "S09.LV.01"] },
      {
        records: [
          { recordKey: "a", hashInput: ["a"], entities: [ref(ENDED, [{ prop: "previousName", value: "Demo Older SIA", itemId: "S02.LV.01" }])], reports: [{ entityEid: `lv-${ENDED}`, kind: "annual_accounts", periodEnd: "2024-12-31", itemId: "S06.LV.01", facts: [{ concept: "revenue", value: 1 }] }] },
          { recordKey: "b", hashInput: ["b"], entities: [], events: [{ entityEid: `lv-${ENDED}`, type: "register.securing_measure", date: "2026-01-01", itemId: "S09.LV.01" }] },
        ],
      },
    );
    const outcome = await sync(db, other);
    expect(outcome.report?.dropped).toMatchObject({ struck_off_identity_only: 1 });
    expect(count(db, "SELECT COUNT(*) AS n FROM main.fact_reports")).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.events")).toBe(1);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements s JOIN main.props p ON p.id = s.prop_id WHERE p.name = 'previousName'")).toBe(1);
  });
});
