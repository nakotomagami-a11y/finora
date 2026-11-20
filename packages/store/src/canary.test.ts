import { describe, expect, it } from "vitest";
import { scanStore } from "./canary.ts";
import { companyRoleLines } from "./lines.ts";
import { openDispute } from "./disputes.ts";
import { readPurposeSection } from "./purpose.ts";
import { writeRecord, type EntityInput } from "./registry.ts";
import { company, contentSync, memoryStore, personalCodeSamples, roleSetEntities, writeRoleSet } from "./test-helpers.ts";

const EID = "lv-00000000001";

function loaded() {
  const { db } = memoryStore();
  const sync = contentSync(db, "lv-register", "2026-11-01T00:00:00.000Z");
  const put = (entity: EntityInput) =>
    writeRecord(db, { syncId: sync, sourceId: "lv-register", recordKey: entity.eid, hashInput: [entity.eid], entities: [entity] });
  put(company(EID, "Example Trading SIA"));
  put(company("lv-00000000002", "Rasma Example IK", { legalForm: "lv-ik" }));
  writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z"), EID, [
    { name: "Officer Alpha", role: "board_member", startDate: "2019-03-01" },
  ]);
  const read = readPurposeSection(db, {
    companyEid: EID,
    section: "S03",
    itemIds: ["S03.LV.01"],
    purpose: { purposeId: "supplier_check", startedAt: "2026-11-01T00:00:00.000Z" },
    surface: "ui",
    actor: "local",
    now: "2026-11-01T01:00:00.000Z",
  });
  const [line] = companyRoleLines(db, EID, ["S03.LV.01"]);
  if (line) openDispute(db, { companyEid: EID, line, kind: "objection", personal: true, now: "2026-11-02T00:00:00.000Z" });
  return { db, read };
}

const codes = Object.values(personalCodeSamples());

describe("P3, PS5: no personal code or person id outside its own row", () => {
  it("finds no fixture code and no person eid in any table", () => {
    const { db } = loaded();
    expect(scanStore(db, codes)).toEqual([]);
  });

  it("refuses a personal code on a person or a sole trader at write time", () => {
    const { db } = memoryStore();
    const sync = contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z");
    for (const code of codes) {
      const [person, rel] = roleSetEntities(EID, [{ name: "Officer Alpha", role: "board_member", startDate: "2019-03-01" }]);
      const leaky = { ...person!, statements: [...person!.statements, { prop: "idNumber", value: code, itemId: "S03.LV.01" }] };
      expect(() => writeRecord(db, { syncId: sync, sourceId: "lv-officers", recordKey: EID, hashInput: [code], entities: [leaky, rel!] })).toThrow(
        /personal_code_refused/,
      );
      const sole = company("lv-00000000002", "Sample IK", { legalForm: "lv-ik" });
      sole.statements.push({ prop: "notes", value: `code ${code}`, itemId: "S01.LV.01" });
      expect(() => writeRecord(db, { syncId: sync, sourceId: "lv-officers", recordKey: "sole", hashInput: [code], entities: [sole] })).toThrow(
        /personal_code_refused/,
      );
    }
    expect(scanStore(db, codes)).toEqual([]);
  });

  it("flags a code or a person eid planted in any table, and a planted needle", () => {
    const { db } = loaded();
    const { eeLt, lv, ssn } = personalCodeSamples();
    db.prepare("INSERT INTO user.settings (key, value) VALUES (?, ?)").run("note", `see ${lv}`);
    db.prepare("INSERT INTO main.jobs (name, last_status) VALUES (?, ?)").run("probe", `failed on ${eeLt}`);
    db.prepare("INSERT INTO main.labels (scheme, code, lang, label) VALUES (?, ?, ?, ?)").run("x", "y", "en", `SSN ${ssn}`);
    db.prepare("UPDATE main.syncs SET report_json = ? WHERE id = 1").run('{"first":"p-1-0"}');
    db.prepare("INSERT INTO sa.sa_syncs (source_id, licence_id, started_at) VALUES (?, ?, ?)").run("ee-tax", "cc-by-sa-4.0", "PLANTED-NEEDLE");
    const kinds = scanStore(db, ["PLANTED-NEEDLE"]).map((h) => `${h.table}.${h.column}:${h.kind}`);
    expect(kinds.sort()).toEqual(
      [
        "user.settings.value:lv_personal_code",
        "main.jobs.last_status:ee_lt_personal_code",
        "main.labels.label:us_ssn",
        "main.syncs.report_json:person_eid",
        "sa.sa_syncs.started_at:needle",
      ].sort(),
    );
  });

  it("does not flag a company's own registration number (qa #20)", () => {
    const { db } = memoryStore();
    const sync = contentSync(db, "ee-register", "2026-11-01T00:00:00.000Z");
    const { eeLt } = personalCodeSamples();
    const entity = company("ee-00000001", "Sample OÜ", { legalForm: "ee-ou" });
    entity.statements.push({ prop: "registrationNumber", value: eeLt, itemId: "S01.EE.01" });
    writeRecord(db, { syncId: sync, sourceId: "ee-register", recordKey: entity.eid, hashInput: [entity.eid], entities: [entity] });
    expect(scanStore(db)).toEqual([]);
  });
});
