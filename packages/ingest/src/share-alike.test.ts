import { describe, expect, it } from "vitest";
import { clearLiveView, liveRowsFor } from "./live-views.ts";
import { companyRecord, fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, sync } from "./test-helpers.ts";

/** EE taxes paid: a share-alike source whose rows join on the public eid. */
const taxes = () =>
  fakeSource({ id: "ee-tax", country: "ee", storage: "share-alike-store", licence: "cc-by-sa-3.0", items: ["S08.EE.01b"] }, {
    records: [1, 2, 3].map((n) => ({
      recordKey: `lv-0000000000${n}:2026Q3`,
      hashInput: [String(n)],
      entities: [],
      reports: [{ entityEid: `lv-0000000000${n}`, kind: "taxes", periodEnd: "2026-09-30", itemId: "S08.EE.01b", facts: [{ concept: "taxes_paid", value: 1000 * n }] }],
    })),
  });

/** Every main-store row that could carry a share-alike value or point at its sync. */
function mainRows(db: ReturnType<typeof memoryDb>) {
  return {
    records: count(db, "SELECT COUNT(*) AS n FROM main.records WHERE source_id = 'ee-tax'"),
    facts: count(db, "SELECT COUNT(*) AS n FROM main.facts"),
    events: count(db, "SELECT COUNT(*) AS n FROM main.events"),
    values: count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value IN ('1000', '2000', '3000')"),
  };
}

describe("P1: no main-store row references a share-alike sync, in both modes (LAW-SHARE-ALIKE interim)", () => {
  it("store mode: the rows live in finora-sa.db, keyed on the eid; the main store only records the sync", async () => {
    const db = memoryDb();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1), companyRecord(2), companyRecord(3)] }));
    expect((await sync(db, taxes())).kind).toBe("content");
    expect(mainRows(db)).toEqual({ records: 0, facts: 0, events: 0, values: 0 });
    expect(db.prepare("SELECT s.eid, s.prop, s.value FROM sa.sa_statements s ORDER BY s.eid").all()).toEqual([
      { eid: "lv-00000000001", prop: "taxes_paid@2026-09-30", value: "1000" },
      { eid: "lv-00000000002", prop: "taxes_paid@2026-09-30", value: "2000" },
      { eid: "lv-00000000003", prop: "taxes_paid@2026-09-30", value: "3000" },
    ]);
    expect(db.prepare("SELECT licence_id FROM sa.sa_syncs").all()).toEqual([{ licence_id: "cc-by-sa-3.0" }]);
  });

  it("live-no-store mode: nothing in either file, the values only in memory", async () => {
    const db = memoryDb();
    clearLiveView("ee-tax");
    expect((await sync(db, taxes(), { shareAlikeMode: "live-no-store" })).kind).toBe("content");
    expect(mainRows(db)).toEqual({ records: 0, facts: 0, events: 0, values: 0 });
    expect(count(db, "SELECT COUNT(*) AS n FROM sa.sa_statements")).toBe(0);
    expect(liveRowsFor("ee-tax", "lv-00000000002")).toEqual([{ eid: "lv-00000000002", prop: "taxes_paid@2026-09-30", value: "2000", itemId: "S08.EE.01b" }]);
    expect(db.prepare("SELECT storage, content_hash FROM main.syncs").get()).toEqual({ storage: "live-no-store", content_hash: null });
  });
});
