import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { DeletionsLog } from "./deletions-log.ts";
import { openDispute, resolveDispute } from "./disputes.ts";
import { companyRoleLines, type RoleLine } from "./lines.ts";
import { contentSync, memoryStore, tempDir, writeRoleSet } from "./test-helpers.ts";

const EID = "lv-00000000001";
const A = { name: "Officer Alpha", role: "board_member", startDate: "2019-03-01" };
const B = { name: "Officer Beta", role: "board_member", startDate: "2026-11-01" };
const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));

function setUp() {
  const { db } = memoryStore();
  writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z"), EID, [A]);
  const dir = tempDir();
  dirs.push(dir);
  const [lineA] = companyRoleLines(db, EID, ["S03.LV.01"]) as [RoleLine];
  return { db, dir, lineA, log: new DeletionsLog(join(dir.path, "deletions.log")) };
}

const shown = (db: DatabaseSync) =>
  companyRoleLines(db, EID, ["S03.LV.01"])
    .filter((l) => l.hidden === null)
    .map((l) => l.name);

describe("R10: a dispute hides its line until resolved, across reloads", () => {
  it("keeps officer A hidden when the role set is replaced, and shows B", () => {
    const { db, lineA } = setUp();
    openDispute(db, { companyEid: EID, line: lineA, kind: "objection", personal: true, now: "2026-11-02T00:00:00.000Z" });
    expect(shown(db)).toEqual([]);

    writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-03T00:00:00.000Z"), EID, [A, B]);
    expect(shown(db)).toEqual(["Officer Beta"]);
    expect(companyRoleLines(db, EID, ["S03.LV.01"]).find((l) => l.name === "Officer Alpha")?.hidden).toBe("disputed");

    writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-04T00:00:00.000Z", { kind: "unchanged" }), EID, [A, B]);
    expect(shown(db)).toEqual(["Officer Beta"]);
  });

  it("shows the line again once resolved, and logs the resolution first", () => {
    const { db, lineA, log } = setUp();
    const id = openDispute(db, { companyEid: EID, line: lineA, kind: "correction", personal: true, now: "2026-11-02T00:00:00.000Z" });
    resolveDispute(db, log, id, "2026-11-05T00:00:00.000Z");
    expect(shown(db)).toEqual(["Officer Alpha"]);
    expect(log.entries()).toEqual([{ table: "disputes", id: String(id), deletedAt: "2026-11-05T00:00:00.000Z" }]);
  });

  it("changes nothing when the log cannot be written", () => {
    const { db, dir, lineA } = setUp();
    const id = openDispute(db, { companyEid: EID, line: lineA, kind: "objection", personal: true, now: "2026-11-02T00:00:00.000Z" });
    const broken = new DeletionsLog(join(dir.path, "missing", "deletions.log"));
    expect(() => resolveDispute(db, broken, id, "2026-11-05T00:00:00.000Z")).toThrow();
    expect(db.prepare("SELECT status FROM user.disputes WHERE id = ?").get(id)).toEqual({ status: "open" });
    expect(shown(db)).toEqual([]);
  });

  it("stores the company, source, item and a content hash, never a person id or name", () => {
    const { db, lineA } = setUp();
    openDispute(db, { companyEid: EID, line: lineA, kind: "objection", personal: true, now: "2026-11-02T00:00:00.000Z" });
    const row = db.prepare("SELECT * FROM user.disputes").get() as Record<string, unknown>;
    expect(row).toMatchObject({ company_eid: EID, source_id: "lv-officers", item_id: "S03.LV.01", line_hash: lineA.hash });
    expect(JSON.stringify(row)).not.toMatch(/\bp-\d+-\d+\b|Officer Alpha/);
  });
});
