import { describe, expect, it } from "vitest";
import { companies, companyRecord, fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, records, sync } from "./test-helpers.ts";

describe("purge by set difference (architecture §4.4 step 6)", () => {
  it("1,000 records, 1 changed, 1 removed: 999 live, 1 updated, 1 deleted, 998 untouched", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 1000) });
    expect((await sync(db, loader)).kind).toBe("content");
    expect(records(db)).toBe(1000);

    loader.state.records = [...companies(1, 999).map((r, i) => (i === 41 ? companyRecord(42, { name: "Renamed Company 42 SIA" }) : r))];
    loader.state.asOf = { in_file_field: "2026-11-02" };
    const outcome = await sync(db, loader);
    expect(outcome.kind).toBe("content");
    expect(outcome.report).toMatchObject({ read: 999, written: 1, unchanged: 998, deleted: 1 });
    expect(records(db)).toBe(999);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.entities WHERE eid = 'lv-00000001000'")).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value = 'Renamed Company 42 SIA'")).toBe(1);
  });

  it("purges nothing for a source whose scope is none", async () => {
    const db = memoryDb();
    const loader = fakeSource({ purgeScope: "none" }, { records: companies(1, 10) });
    await sync(db, loader);
    loader.state.records = companies(1, 2);
    loader.state.asOf = { in_file_field: "2026-11-02" };
    expect((await sync(db, loader)).report?.deleted).toBe(0);
    expect(records(db)).toBe(10);
  });

  it("tombstones a vanished record when the source says so (EE), keeping its identity", async () => {
    const db = memoryDb();
    const loader = fakeSource({ onRemoval: "tombstone" }, { records: companies(1, 10) });
    await sync(db, loader);
    loader.state.records = companies(1, 9);
    loader.state.asOf = { in_file_field: "2026-11-02" };
    const outcome = await sync(db, loader);
    expect(outcome.report).toMatchObject({ deleted: 0, tombstoned: 1 });
    expect(db.prepare("SELECT tombstone_since FROM main.entities WHERE eid = 'lv-00000000010'").get()).toMatchObject({ tombstone_since: expect.stringMatching(/^2026-11-/) });
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements st JOIN main.entities e ON e.id = st.entity_id WHERE e.eid = 'lv-00000000010'")).toBe(1);
  });
});
