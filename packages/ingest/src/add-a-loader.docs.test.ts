// M1-F1: the add-a-loader how-to's example field map and record are checked against the real field-map
// check, validator and prop-to-item gate, and loaded by a real sync, so the page cannot drift.
import { readFileSync } from "node:fs";
import { checkFieldMap, type FieldMap, type ParsedRecord } from "@finora/sources";
import { describe, expect, it } from "vitest";
import { allowedPropsOf } from "./gates.ts";
import { fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, sync } from "./test-helpers.ts";
import { validateRecord } from "./validate.ts";

const page = readFileSync(new URL("../../../docs/contributing/add-a-loader.md", import.meta.url), "utf8");
const block = (tag: string) => {
  const m = new RegExp("```json " + tag + "\\r?\\n([\\s\\S]*?)```").exec(page);
  if (!m) throw new Error(`no ${tag} block in add-a-loader.md`);
  return JSON.parse(m[1]!) as unknown;
};
const fieldMap = block("example-field-map") as FieldMap;
const record = block("example-record") as ParsedRecord;

describe("docs/contributing/add-a-loader.md (M1-F1)", () => {
  it("its field map passes checkFieldMap", () => {
    expect(checkFieldMap("lv-example", fieldMap)).toEqual([]);
  });

  it("its record passes the validator, and every statement is a pair the field map declares", () => {
    expect(validateRecord(record)).toMatchObject({ ok: true });
    const allowed = allowedPropsOf(fieldMap);
    for (const s of record.entities.flatMap((e) => e.statements)) expect(allowed.has(`${s.itemId}\u0000${s.prop}`), `${s.itemId} ${s.prop}`).toBe(true);
  });

  it("a sync with them writes the record and drops nothing", async () => {
    const db = memoryDb();
    const loader = Object.assign(fakeSource({}, { records: [record] }), { fieldMap });
    const outcome = await sync(db, loader);
    expect(outcome.report).toMatchObject({ written: 1, dropped: {} });
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements")).toBe(2);
  });
});
