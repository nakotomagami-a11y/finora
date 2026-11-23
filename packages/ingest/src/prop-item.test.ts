// M1-F2 (council session 3a): every statement's prop must be one its loader's field map declares for
// its item. qa's probe stored `notes` under the register-name item, and it was shown.
import type { FieldMap } from "@finora/sources";
import { describe, expect, it } from "vitest";
import { companyRecord, fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, sync } from "./test-helpers.ts";

const NOTE = ["Example", "probe", "note"].join(" ");
const nameOnly: FieldMap = [{ field: "name", target: { prop: "name" }, itemId: "S01.LV.01", personal: false }];
const withNotes: FieldMap = [...nameOnly, { field: "notes", target: { prop: "notes" }, itemId: "S01.LV.01", personal: false }];

const probe = async (fieldMap: FieldMap) => {
  const db = memoryDb();
  const loader = Object.assign(fakeSource({}, { records: [companyRecord(1, { extra: [{ prop: "notes", value: NOTE, itemId: "S01.LV.01" }] })] }), { fieldMap });
  const outcome = await sync(db, loader);
  return { db, report: outcome.report! };
};

describe("M1-F2: a statement's prop must belong to its item", () => {
  it("qa's probe: notes under the register-name item is refused, counted, and never stored", async () => {
    const { db, report } = await probe(nameOnly);
    expect(report.dropped.prop_not_in_item).toBe(1);
    expect(report.droppedRows).toContainEqual(expect.objectContaining({ reason: "prop_not_in_item", prop: "notes" }));
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value = ?", NOTE)).toBe(0);
    // The rest of the record loads: the name is a declared prop of the item.
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE p.name = 'name'")).toBe(1);
  });

  it("the control: with notes declared for the item, it is stored", async () => {
    const { db, report } = await probe(withNotes);
    expect(report.dropped.prop_not_in_item).toBeUndefined();
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value = ?", NOTE)).toBe(1);
  });
});
