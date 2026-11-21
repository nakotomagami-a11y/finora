import { describe, expect, it } from "vitest";
import { companyRecord, fakeSource, roleSetRecord } from "./testing/fake-source.ts";
import { memoryDb, sync } from "./test-helpers.ts";

type Line = Parameters<typeof roleSetRecord>[1][number];

async function twoLoads(first: Line[], second: Line[]) {
  const db = memoryDb();
  await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
  const officers = fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records: [roleSetRecord(1, first)] });
  await sync(db, officers);
  officers.state.records = [roleSetRecord(1, second, 2)];
  officers.state.asOf = { in_file_field: "2026-11-02" };
  await sync(db, officers);
  return (db.prepare("SELECT data FROM main.events ev JOIN main.event_types t ON t.id = ev.type_id WHERE t.name = 'finora.role_ended'").all() as { data: string }[]).map(
    (r) => JSON.parse(r.data) as { role: string },
  );
}

describe("a role end is detected by line identity, never by names (§3.3, qa S1)", () => {
  it("a spelling fix on the same row id is not a role end", async () => {
    expect(await twoLoads([{ name: "Officer Alfa", role: "board_member", rowId: "11" }], [{ name: "Officer Alpha", role: "board_member", rowId: "11" }])).toEqual([]);
  });

  it("a changed role title on the same row id is not a role end", async () => {
    expect(await twoLoads([{ name: "Officer A", role: "board_member", rowId: "11" }], [{ name: "Officer A", role: "chair", rowId: "11" }])).toEqual([]);
  });

  it("a removed row is a role end", async () => {
    expect(
      await twoLoads(
        [{ name: "Officer A", role: "board_member", rowId: "11" }, { name: "Officer B", role: "board_member", rowId: "12" }],
        [{ name: "Officer A", role: "board_member", rowId: "11" }],
      ),
    ).toEqual([{ role: "board_member" }]);
  });

  it("without row ids, (role, start date) is the identity", async () => {
    const lines = [{ name: "A", role: "board_member", startDate: "2020-01-01" }, { name: "B", role: "board_member", startDate: "2021-01-01" }];
    expect(await twoLoads(lines, [{ name: "A renamed", role: "board_member", startDate: "2020-01-01" }])).toEqual([{ role: "board_member" }]);
  });

  it("without row ids or start dates, a role ends when that role's count falls", async () => {
    const two = [{ name: "P", role: "principal" }, { name: "Q", role: "principal" }, { name: "R", role: "agent" }];
    expect(await twoLoads(two, [{ name: "Q", role: "principal" }, { name: "R", role: "agent" }])).toEqual([{ role: "principal" }]);
    expect(await twoLoads(two, [{ name: "X", role: "principal" }, { name: "Y", role: "principal" }, { name: "R", role: "agent" }])).toEqual([]);
  });

  it("a whole role set purged from the file ends every role in it", async () => {
    const db = memoryDb();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
    const officers = fakeSource({ id: "lv-officers", items: ["S03.LV.01"] }, { records: [roleSetRecord(1, [{ name: "A", role: "board_member", rowId: "1" }, { name: "B", role: "chair", rowId: "2" }])] });
    await sync(db, officers);
    officers.state.records = [];
    officers.state.asOf = { in_file_field: "2026-11-02" };
    expect((await sync(db, officers)).report).toMatchObject({ deleted: 1, events: 2 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.entities WHERE eid LIKE 'p-%' OR eid LIKE 'rel-%'").get()).toEqual({ n: 0 });
  });
});
