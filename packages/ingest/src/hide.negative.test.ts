import { HIDE_ITEM_IDS, ITEMS } from "@finora/domain";
import type { ParsedRecord } from "@finora/sources";
import { describe, expect, it } from "vitest";
import { fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, sync } from "./test-helpers.ts";

// Every HIDE item, carried by a record as a statement, a fact report and an event (architecture
// §10.4). The raw-layout fixtures of each source join this suite with S04f and the loader slices.
function carrying(itemId: string, n: number): ParsedRecord {
  const eid = `lv-${String(n).padStart(11, "0")}`;
  return {
    recordKey: eid,
    hashInput: [itemId],
    entities: [
      {
        eid,
        schema: "Company",
        country: "lv",
        legalForm: "lv-sia",
        statements: [
          { prop: "name", value: `Example Company ${n} SIA`, itemId: "S01.LV.01" },
          { prop: "notes", value: `HIDDEN-${itemId}`, itemId },
        ],
      },
    ],
    reports: [{ entityEid: eid, kind: "hidden", periodEnd: "2026-09-30", itemId, facts: [{ concept: "equity", value: 1 }] }],
    events: [{ entityEid: eid, type: "register.hidden", date: "2026-10-01", itemId }],
  };
}

describe("HIDE: every HIDE item is dropped at load and counted (§10.4)", () => {
  it("knows the five HIDE items", () => {
    expect(HIDE_ITEM_IDS).toHaveLength(ITEMS.filter((i) => i.call === "hide").length);
    expect(HIDE_ITEM_IDS.length).toBe(5);
  });

  for (const itemId of HIDE_ITEM_IDS) {
    it(`${itemId}: nothing of it reaches the store`, async () => {
      const db = memoryDb();
      const outcome = await sync(db, fakeSource({}, { records: [carrying(itemId, 1)] }));
      expect(outcome.report?.dropped).toEqual({ hide_item: 3 });
      expect(count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value LIKE 'HIDDEN-%'")).toBe(0);
      expect(count(db, "SELECT COUNT(*) AS n FROM main.items WHERE name = ?", itemId)).toBe(0);
      expect(count(db, "SELECT COUNT(*) AS n FROM main.fact_reports")).toBe(0);
      expect(count(db, "SELECT COUNT(*) AS n FROM main.events")).toBe(0);
      expect(count(db, "SELECT COUNT(*) AS n FROM main.entities")).toBe(1);
    });
  }

  it("a share-alike or live-no-store source drops every HIDE item too", async () => {
    for (const storage of ["share-alike-store", "live-no-store"] as const) {
      const db = memoryDb();
      const records = HIDE_ITEM_IDS.map((id, i) => carrying(id, i + 1));
      const outcome = await sync(db, fakeSource({ id: `hide-${storage}`, storage, licence: storage === "share-alike-store" ? "cc-by-sa-3.0" : "cc0-1.0" }, { records }));
      expect(outcome.report?.dropped, storage).toEqual({ hide_item: 3 * HIDE_ITEM_IDS.length });
      expect(count(db, "SELECT COUNT(*) AS n FROM sa.sa_statements WHERE value LIKE 'HIDDEN-%'"), storage).toBe(0);
    }
  });

  it("a LATER item is dropped too, counted apart", async () => {
    const db = memoryDb();
    const later = ITEMS.find((i) => i.call === "later")!.id;
    expect((await sync(db, fakeSource({}, { records: [carrying(later, 2)] }))).report?.dropped).toEqual({ later_item: 3 });
  });
});
