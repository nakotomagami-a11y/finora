import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { DeletionsLog } from "./deletions-log.ts";
import { openDispute, resolveDispute } from "./disputes.ts";
import { companyRoleLines, type RoleLine } from "./lines.ts";
import { writeRecord } from "./registry.ts";
import { RestrictionsLog } from "./restrictions-log.ts";
import { company, contentSync, memoryStore, testLogs, writeRoleSet } from "./test-helpers.ts";

const EID = "lv-00000000001";
const A = { name: "Officer Alpha", role: "board_member", startDate: "2019-03-01", rowId: "4711" };
const B = { name: "Officer Beta", role: "board_member", startDate: "2026-11-01", rowId: "4712" };
const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((c) => c()));

function setUp() {
  const { db } = memoryStore();
  writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z"), EID, [A]);
  const logs = testLogs();
  cleanups.push(logs.remove);
  const [lineA] = companyRoleLines(db, EID, ["S03.LV.01"]) as [RoleLine];
  return { db, logs, lineA };
}

const shown = (db: DatabaseSync, restrictions: RestrictionsLog) =>
  companyRoleLines(db, EID, ["S03.LV.01"], restrictions.active())
    .filter((l) => l.hidden === null)
    .map((l) => l.name);

describe("R10: a dispute hides its line until resolved, across reloads and repairs", () => {
  it("keeps officer A hidden when the role set is replaced, and shows B", () => {
    const { db, logs, lineA } = setUp();
    expect(lineA.target).toEqual({ kind: "row", rowId: "4711" });
    openDispute(db, logs.restrictions, { companyEid: EID, line: lineA, kind: "objection", now: "2026-11-02T00:00:00.000Z" });
    expect(shown(db, logs.restrictions)).toEqual([]);

    writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-03T00:00:00.000Z"), EID, [A, B]);
    expect(shown(db, logs.restrictions)).toEqual(["Officer Beta"]);
    const lines = companyRoleLines(db, EID, ["S03.LV.01"], logs.restrictions.active());
    expect(lines.find((l) => l.name === "Officer Alpha")?.hidden).toBe("disputed");

    writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-04T00:00:00.000Z", { kind: "unchanged" }), EID, [A, B]);
    expect(shown(db, logs.restrictions)).toEqual(["Officer Beta"]);
  });

  it("keeps a person's line hidden after a repair that lost the dispute row", () => {
    const { db, logs, lineA } = setUp();
    openDispute(db, logs.restrictions, { companyEid: EID, line: lineA, kind: "objection", now: "2026-11-02T00:00:00.000Z" });
    db.exec("DELETE FROM user.disputes");
    expect(shown(db, logs.restrictions)).toEqual([]);
  });

  it("stores no content hash, name or person id for a person's line", () => {
    const { db, logs, lineA } = setUp();
    openDispute(db, logs.restrictions, { companyEid: EID, line: lineA, kind: "objection", now: "2026-11-02T00:00:00.000Z" });
    const row = db.prepare("SELECT * FROM user.disputes").get() as Record<string, unknown>;
    expect(row).toMatchObject({ company_eid: EID, item_id: "S03.LV.01", source_row_id: "4711", role: null, line_hash: null, personal: 1 });
    const stored = JSON.stringify(row) + readFileSync(logs.restrictions.path, "utf8");
    expect(stored).not.toMatch(/[0-9a-f]{32,}|\bp-\d+-\d+\b|Officer Alpha/);
    expect(() => db.prepare("UPDATE user.disputes SET line_hash = ?").run("ab".repeat(32))).toThrow(/CHECK/);
  });

  it("targets a US person's line by its role, which hides that role's lines", () => {
    const { db } = memoryStore();
    const logs = testLogs();
    cleanups.push(logs.remove);
    const us = "us-ct-FX0001";
    writeRoleSet(
      db,
      contentSync(db, "us-ct-principals", "2026-11-01T00:00:00.000Z"),
      us,
      [
        { name: "Principal One", role: "principal", startDate: "" },
        { name: "Agent One", role: "agent", startDate: "" },
      ],
      { sourceId: "us-ct-principals", itemId: "S03.US.03" },
    );
    const [principal] = companyRoleLines(db, us, ["S03.US.03"]) as [RoleLine];
    expect(principal.target).toEqual({ kind: "role", role: "principal" });
    openDispute(db, logs.restrictions, { companyEid: us, line: principal, kind: "correction", now: "2026-11-02T00:00:00.000Z" });
    const visible = companyRoleLines(db, us, ["S03.US.03"], logs.restrictions.active()).filter((l) => l.hidden === null);
    expect(visible.map((l) => l.role)).toEqual(["agent"]);
  });

  it("targets a company's own line (a corporate officer) by its content hash", () => {
    const { db } = memoryStore();
    const logs = testLogs();
    cleanups.push(logs.remove);
    const sync = contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z");
    writeRecord(db, {
      syncId: sync,
      sourceId: "lv-officers",
      recordKey: `${EID}:officers`,
      hashInput: ["corporate"],
      lineIds: ["9001"],
      entities: [
        company("lv-00000000002", "Holding Example SIA"),
        {
          eid: "rel-1-0",
          schema: "Directorship",
          country: "lv",
          statements: [
            { prop: "organization", value: EID, itemId: "S03.LV.01", line: 0 },
            { prop: "director", value: "lv-00000000002", itemId: "S03.LV.01", line: 0 },
            { prop: "role", value: "board_member", itemId: "S03.LV.01", line: 0 },
          ],
        },
      ],
    });
    const [line] = companyRoleLines(db, EID, ["S03.LV.01"]) as [RoleLine];
    expect(line).toMatchObject({ personal: false, name: "Holding Example SIA" });
    expect(line.target.kind).toBe("hash");
    openDispute(db, logs.restrictions, { companyEid: EID, line, kind: "correction", now: "2026-11-02T00:00:00.000Z" });
    expect(readFileSync(logs.restrictions.path, "utf8")).toBe("");
    expect(companyRoleLines(db, EID, ["S03.LV.01"])[0]?.hidden).toBe("disputed");
  });

  it("shows the line again once resolved, and logs the resolution first", () => {
    const { db, logs, lineA } = setUp();
    const id = openDispute(db, logs.restrictions, { companyEid: EID, line: lineA, kind: "correction", now: "2026-11-02T00:00:00.000Z" });
    resolveDispute(db, logs.deletions, logs.restrictions, id, "2026-11-05T00:00:00.000Z");
    expect(shown(db, logs.restrictions)).toEqual(["Officer Alpha"]);
    expect(logs.deletions.entries()).toEqual([{ table: "disputes", id: String(id), deletedAt: "2026-11-05T00:00:00.000Z" }]);
    expect(logs.restrictions.active()).toEqual([]);
  });

  it("changes nothing when a log cannot be written", () => {
    const { db, logs, lineA } = setUp();
    const brokenRestrictions = new RestrictionsLog(join(logs.dir, "missing", "restrictions.log"));
    expect(() => openDispute(db, brokenRestrictions, { companyEid: EID, line: lineA, kind: "objection", now: "2026-11-02T00:00:00.000Z" })).toThrow();
    expect(db.prepare("SELECT COUNT(*) AS n FROM user.disputes").get()).toEqual({ n: 0 });

    const id = openDispute(db, logs.restrictions, { companyEid: EID, line: lineA, kind: "objection", now: "2026-11-02T00:00:00.000Z" });
    const brokenDeletions = new DeletionsLog(join(logs.dir, "missing", "deletions.log"));
    expect(() => resolveDispute(db, brokenDeletions, logs.restrictions, id, "2026-11-05T00:00:00.000Z")).toThrow();
    expect(db.prepare("SELECT status FROM user.disputes WHERE id = ?").get(id)).toEqual({ status: "open" });
    expect(shown(db, logs.restrictions)).toEqual([]);
  });
});
