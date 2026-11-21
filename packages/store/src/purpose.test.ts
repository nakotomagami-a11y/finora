import type { DatabaseSync } from "node:sqlite";
import { rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPurposeSection } from "./purpose.ts";
import { suppressPersonLine } from "./suppressions.ts";
import { companyRoleLines } from "./lines.ts";
import { contentSync, memoryStore, testLogs, writeRoleSet } from "./test-helpers.ts";

const COMPANIES = ["lv-00000000001", "lv-00000000002", "lv-00000000003"] as const;
const [FIRST, SECOND] = COMPANIES;
const START = "2026-11-20T08:00:00.000Z";
const at = (minutes: number) => new Date(Date.parse(START) + minutes * 60_000).toISOString();

let db: DatabaseSync;
let logs: ReturnType<typeof testLogs>;
afterEach(() => logs.remove());
beforeEach(() => {
  db = memoryStore().db;
  logs = testLogs();
  const sync = contentSync(db, "lv-officers", START);
  for (const eid of COMPANIES) writeRoleSet(db, sync, eid, [{ name: "Example Officer", role: "board_member", startDate: "2021-05-01" }]);
});

const read = (companyEid: string, purposeId: string | null, now: string, startedAt = START) =>
  readPurposeSection(db, {
    companyEid,
    section: "S03",
    itemIds: ["S03.LV.01"],
    purpose: purposeId ? { purposeId, startedAt } : null,
    surface: "ui",
    actor: "local",
    now,
  }, logs.restrictions);

const log = () => db.prepare("SELECT * FROM user.purpose_log ORDER BY id").all() as Record<string, unknown>[];

describe("P2: person data needs a stated purpose", () => {
  it("logs one row per company opened in a session", () => {
    COMPANIES.forEach((eid, i) => expect(read(eid, "supplier_check", at(i)).state).toBe("data"));
    expect(log().map((r) => r.company_eid)).toEqual([...COMPANIES]);
  });

  it("asks again after 12 hours and logs nothing for the refused read", () => {
    expect(read(FIRST, "supplier_check", at(12 * 60)).state).toBe("data");
    expect(read(FIRST, "supplier_check", at(12 * 60 + 1))).toEqual({ state: "needs_purpose" });
    expect(log()).toHaveLength(1);
  });

  it("gives a purpose change its own row and leaves the first unchanged", () => {
    read(FIRST, "supplier_check", at(1));
    const first = log()[0];
    read(FIRST, "investment_research", at(5), at(4));
    expect(log()).toHaveLength(2);
    expect(log()[0]).toEqual(first);
    expect(log()[1]).toMatchObject({ purpose_id: "investment_research", company_eid: FIRST });
  });

  it("keeps the log append-only", () => {
    read(FIRST, "supplier_check", at(1));
    expect(() => db.prepare("UPDATE user.purpose_log SET purpose_id = ?").run("customer_check")).toThrow(/append-only/);
  });

  it("needs a purpose before any read, and refuses a blocked one (P7)", () => {
    expect(read(FIRST, null, at(1))).toEqual({ state: "needs_purpose" });
    expect(() => read(FIRST, "credit_decision", at(1))).toThrow(/purpose_blocked/);
    expect(log()).toHaveLength(0);
  });

  it("returns the company's lines with no person id", () => {
    const result = read(SECOND, "counterparty_check", at(1));
    expect(result.state === "data" ? result.lines.map((l) => [l.name, l.role]) : null).toEqual([["Example Officer", "board_member"]]);
    expect(JSON.stringify(result)).not.toMatch(/\bp-\d+-\d+\b/);
  });

  it("asks again for a session that starts in the future", () => {
    expect(read(FIRST, "supplier_check", at(0), at(5))).toEqual({ state: "needs_purpose" });
    expect(log()).toHaveLength(0);
  });

  it("refuses the read, and logs nothing, when restrictions.log is missing (fail closed)", () => {
    rmSync(logs.restrictions.path);
    expect(() => read(FIRST, "supplier_check", at(1))).toThrow();
    expect(log()).toHaveLength(0);
  });
});

describe("L5: person-line restrictions apply on every read (qa S04a Q-2)", () => {
  it("drops an LV officer restricted by row id and a US principal restricted by role", () => {
    const sync = contentSync(db, "lv-officers", START);
    writeRoleSet(db, sync, FIRST, [
      { name: "Officer Kept", role: "board_member", startDate: "2020-01-01", rowId: "11" },
      { name: "Officer Restricted", role: "board_member", startDate: "2020-01-01", rowId: "12" },
    ]);
    const us = "us-ct-FX0001";
    writeRoleSet(
      db,
      contentSync(db, "us-ct-principals", START),
      us,
      [
        { name: "Principal Restricted", role: "principal", startDate: "" },
        { name: "Agent Kept", role: "agent", startDate: "" },
      ],
      { sourceId: "us-ct-principals", itemId: "S03.US.03" },
    );
    const lv = companyRoleLines(db, FIRST, ["S03.LV.01"]).find((l) => l.name === "Officer Restricted")!;
    const principal = companyRoleLines(db, us, ["S03.US.03"]).find((l) => l.role === "principal")!;
    suppressPersonLine(logs.restrictions, FIRST, lv, at(1));
    suppressPersonLine(logs.restrictions, us, principal, at(1));

    const names = (eid: string, item: string) => {
      const result = readPurposeSection(
        db,
        { companyEid: eid, section: "S03", itemIds: [item], purpose: { purposeId: "supplier_check", startedAt: START }, surface: "api", actor: "local", now: at(2) },
        logs.restrictions,
      );
      return result.state === "data" ? result.lines.map((l) => l.name) : [];
    };
    expect(names(FIRST, "S03.LV.01")).toEqual(["Officer Kept"]);
    expect(names(us, "S03.US.03")).toEqual(["Agent Kept"]);
  });
});
