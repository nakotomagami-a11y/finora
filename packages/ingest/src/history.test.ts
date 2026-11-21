import { describe, expect, it } from "vitest";
import { companyRecord, fakeSource, roleSetRecord } from "./testing/fake-source.ts";
import { memoryDb, sync } from "./test-helpers.ts";

const events = (db: ReturnType<typeof memoryDb>) =>
  db
    .prepare("SELECT e.eid, t.name AS type, ev.data FROM main.events ev JOIN main.event_types t ON t.id = ev.type_id JOIN main.entities e ON e.id = ev.entity_id ORDER BY ev.id")
    .all() as { eid: string; type: string; data: string | null }[];

describe("history: our own snapshots (§3.7; LAW-RETENTION-ROLES interim)", () => {
  it("a rename between two content syncs is a finora.name_changed event with old and new", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: [companyRecord(1)] });
    await sync(db, loader);
    loader.state.records = [companyRecord(1, { name: "Renamed Example SIA", status: "liquidation" })];
    loader.state.asOf = { in_file_field: "2026-11-02" };
    await sync(db, loader);
    expect(events(db)).toEqual([
      { eid: "lv-00000000001", type: "finora.name_changed", data: JSON.stringify({ old: "Example Company 1 SIA", new: "Renamed Example SIA" }) },
      { eid: "lv-00000000001", type: "finora.status_changed", data: JSON.stringify({ old: "active", new: "liquidation" }) },
    ]);
  });

  it("a sole trader's rename writes no event: its old and new names are a person's (P4, rule 5)", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: [companyRecord(1, { name: "Old Trader Name IK", legalForm: "lv-ik" })] });
    await sync(db, loader);
    loader.state.records = [companyRecord(1, { name: "New Trader Name IK", legalForm: "lv-ik" })];
    loader.state.asOf = { in_file_field: "2026-11-02" };
    await sync(db, loader);
    expect(events(db)).toEqual([]);
    expect(JSON.stringify(db.prepare("SELECT * FROM main.events").all())).not.toContain("Old Trader Name");
  });

  it("a role that disappears leaves only finora.role_ended, with no name and no person id anywhere", async () => {
    const db = memoryDb();
    const register = fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] });
    await sync(db, register);
    const officers = fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, {
      records: [roleSetRecord(1, [{ name: "Officer Leaving", role: "board_member", rowId: "11" }, { name: "Officer Staying", role: "chair", rowId: "12" }])],
    });
    await sync(db, officers);
    officers.state.records = [roleSetRecord(1, [{ name: "Officer Staying", role: "chair", rowId: "12" }], 2)];
    officers.state.asOf = { in_file_field: "2026-11-02" };
    await sync(db, officers);

    expect(events(db)).toEqual([{ eid: "lv-00000000001", type: "finora.role_ended", data: JSON.stringify({ role: "board_member" }) }]);
    const everything = JSON.stringify([
      db.prepare("SELECT * FROM main.statements").all(),
      db.prepare("SELECT * FROM main.entities").all(),
      db.prepare("SELECT * FROM main.events").all(),
      db.prepare("SELECT * FROM main.syncs").all(),
      db.prepare("SELECT record_key, line_ids FROM main.records").all(),
    ]);
    expect(everything).not.toContain("Officer Leaving");
    expect(everything).not.toMatch(/p-1-0|rel-1-0|"11"/);
  });
});
