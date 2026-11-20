import { describe, expect, it } from "vitest";
import { companyRoleLines } from "./lines.ts";
import { sourceRefForStatement } from "./provenance.ts";
import { readPurposeSection } from "./purpose.ts";
import { writeRecord } from "./registry.ts";
import { company, contentSync, memoryStore, statementIdOf, writeRoleSet } from "./test-helpers.ts";

const EID = "lv-00000000001";
const A = { name: "Officer Alpha", role: "board_member", startDate: "2019-03-01" };
const B = { name: "Officer Beta", role: "chair", startDate: "2026-11-01" };

describe("stable targets: nothing that must survive a reload points at a person row", () => {
  it("resolves an existing citation and line target after the people source reloads", () => {
    const { db } = memoryStore();
    const register = contentSync(db, "lv-register", "2026-11-01T00:00:00.000Z");
    writeRecord(db, { syncId: register, sourceId: "lv-register", recordKey: EID, hashInput: [EID], entities: [company(EID, "Example Trading SIA")] });
    writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z"), EID, [A]);

    const citation = sourceRefForStatement(db, statementIdOf(db, EID));
    const [before] = companyRoleLines(db, EID, ["S03.LV.01"]);
    const personBefore = db.prepare("SELECT eid FROM main.entities WHERE eid LIKE 'p-%'").all();

    writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-05T00:00:00.000Z"), EID, [A, B]);

    expect(db.prepare("SELECT eid FROM main.entities WHERE eid LIKE 'p-%'").all()).not.toEqual(personBefore);
    expect(sourceRefForStatement(db, statementIdOf(db, EID))).toEqual(citation);
    const after = companyRoleLines(db, EID, ["S03.LV.01"]);
    expect(after.find((l) => l.hash === before?.hash)?.name).toBe("Officer Alpha");
  });

  it("logs the company eid, never a person id", () => {
    const { db } = memoryStore();
    writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z"), EID, [A]);
    readPurposeSection(db, {
      companyEid: EID,
      section: "S03",
      itemIds: ["S03.LV.01"],
      purpose: { purposeId: "counterparty_check", startedAt: "2026-11-01T00:00:00.000Z" },
      surface: "api",
      actor: "local",
      now: "2026-11-01T01:00:00.000Z",
    });
    const row = db.prepare("SELECT * FROM user.purpose_log").get();
    expect(row).toMatchObject({ company_eid: EID });
    expect(JSON.stringify(row)).not.toMatch(/\bp-\d+-\d+\b/);
  });
});
