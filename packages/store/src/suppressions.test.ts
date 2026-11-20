import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { DeletionsLog } from "./deletions-log.ts";
import { companyRoleLines } from "./lines.ts";
import { liftSuppression, suppressItem } from "./suppressions.ts";
import { contentSync, memoryStore, tempDir, writeRoleSet } from "./test-helpers.ts";

const EID = "lv-00000000001";
const OTHER = "lv-00000000002";
const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));

function setUp() {
  const { db } = memoryStore();
  const sync = contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z");
  writeRoleSet(db, sync, EID, [
    { name: "Officer Alpha", role: "board_member", startDate: "2019-03-01" },
    { name: "Officer Beta", role: "chair", startDate: "2020-03-01" },
  ]);
  writeRoleSet(db, sync, OTHER, [{ name: "Officer Gamma", role: "board_member", startDate: "2018-01-01" }]);
  const dir = tempDir();
  dirs.push(dir);
  return { db, dir, log: new DeletionsLog(join(dir.path, "deletions.log")) };
}

const hidden = (db: DatabaseSync, eid: string) => companyRoleLines(db, eid, ["S03.LV.01"]).map((l) => l.hidden);

describe("L5: a restriction hides a company's item until lifted", () => {
  it("hides every line of the item for that company only, across reloads", () => {
    const { db } = setUp();
    suppressItem(db, EID, "S03.LV.01", "2026-11-02T00:00:00.000Z");
    suppressItem(db, EID, "S03.LV.01", "2026-11-02T00:00:01.000Z");
    expect(hidden(db, EID)).toEqual(["suppressed", "suppressed"]);
    expect(hidden(db, OTHER)).toEqual([null]);
    writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-03T00:00:00.000Z"), EID, [
      { name: "Officer Delta", role: "board_member", startDate: "2026-11-01" },
    ]);
    expect(hidden(db, EID)).toEqual(["suppressed"]);
  });

  it("logs a lift before deleting, and keeps the suppression if the log fails", () => {
    const { db, dir, log } = setUp();
    suppressItem(db, EID, "S03.LV.01", "2026-11-02T00:00:00.000Z");
    const broken = new DeletionsLog(join(dir.path, "missing", "deletions.log"));
    expect(() => liftSuppression(db, broken, EID, "S03.LV.01", "2026-11-04T00:00:00.000Z")).toThrow();
    expect(hidden(db, EID)).toEqual(["suppressed", "suppressed"]);

    liftSuppression(db, log, EID, "S03.LV.01", "2026-11-04T00:00:00.000Z");
    expect(hidden(db, EID)).toEqual([null, null]);
    expect(log.entries()).toHaveLength(1);
    liftSuppression(db, log, EID, "S03.LV.01", "2026-11-05T00:00:00.000Z");
    expect(log.entries()).toHaveLength(1);
  });
});
