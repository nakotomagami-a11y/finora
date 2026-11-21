import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { writeRecord } from "./registry.ts";
import { markViewed, runRetention } from "./retention.ts";
import { searchCompanies } from "./search.ts";
import { company, contentSync, memoryStore, writeRoleSet } from "./test-helpers.ts";

const DAY0 = "2026-10-01T00:00:00.000Z";
const day = (n: number) => new Date(Date.parse(DAY0) + n * 86_400_000).toISOString();
const TTL = 30;
const EID = "lv-00000000001";

function setUp(): DatabaseSync {
  const { db } = memoryStore();
  const register = contentSync(db, "lv-register", DAY0);
  writeRecord(db, { syncId: register, sourceId: "lv-register", recordKey: EID, hashInput: [EID], entities: [company(EID, "Example Trading SIA")] });
  writeRoleSet(db, contentSync(db, "lv-officers", DAY0), EID, [{ name: "Officer Alpha", role: "board_member", startDate: "2019-03-01" }]);
  return db;
}

const count = (db: DatabaseSync, sql: string) => (db.prepare(sql).get() as { n: number }).n;
const people = (db: DatabaseSync) => count(db, "SELECT COUNT(*) AS n FROM main.entities WHERE eid LIKE 'p-%' OR eid LIKE 'rel-%'");

describe("P4, P5: natural-person data expires (LAW-CACHE-TTL interim)", () => {
  it("keeps person rows on day 29 and removes them, whole, after day 30", () => {
    const db = setUp();
    expect(runRetention(db, { now: day(29), personTtlDays: TTL }).personStatements).toBe(0);
    expect(people(db)).toBe(2);

    const result = runRetention(db, { now: day(31), personTtlDays: TTL });
    expect(result.personStatements).toBe(5);
    expect(people(db)).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.records WHERE source_id = 'lv-officers'")).toBe(0);
    expect(searchCompanies(db, "example trading")[0]?.eid).toBe(EID);
  });

  it("runs the clock from the latest sync, so an unchanged source never expires its people", () => {
    const db = setUp();
    contentSync(db, "lv-officers", day(20), { kind: "unchanged" });
    runRetention(db, { now: day(31), personTtlDays: TTL });
    expect(people(db)).toBe(2);
    runRetention(db, { now: day(51), personTtlDays: TTL });
    expect(people(db)).toBe(0);
  });

  it("purges a live-cached entity not viewed for the TTL, and keeps a viewed one", () => {
    const db = setUp();
    const sync = contentSync(db, "us-ny-register", DAY0);
    for (const eid of ["us-ny-FX0001", "us-ny-FX0002"]) {
      writeRecord(db, { syncId: sync, sourceId: "us-ny-register", recordKey: eid, hashInput: [eid], entities: [company(eid, `Sample ${eid.slice(-1)} Holdings LLC`, { country: "us", legalForm: "us-llc" })] });
      markViewed(db, eid, DAY0);
    }
    contentSync(db, "us-ny-register", day(25));
    markViewed(db, "us-ny-FX0002", day(10));
    expect(runRetention(db, { now: day(31), personTtlDays: TTL }).liveCacheEntities).toBe(1);
    expect(searchCompanies(db, "sample", { country: "us" }).map((h) => h.eid)).toEqual(["us-ny-FX0002"]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.entities_trigram").get()).toEqual({ n: 2 });
  });

  it("writes a purged live-cached company again on an unchanged re-fetch (qa Q-1)", () => {
    const db = setUp();
    const eid = "us-ny-FX0003";
    const record = (syncId: number) => ({
      syncId,
      sourceId: "us-ny-register",
      recordKey: eid,
      hashInput: [eid],
      entities: [company(eid, "Sample Three Holdings LLC", { country: "us", legalForm: "us-llc" })],
    });
    writeRecord(db, record(contentSync(db, "us-ny-register", DAY0)));
    markViewed(db, eid, DAY0);
    expect(runRetention(db, { now: day(31), personTtlDays: TTL }).liveCacheEntities).toBe(1);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.records WHERE source_id = 'us-ny-register'")).toBe(0);

    expect(writeRecord(db, record(contentSync(db, "us-ny-register", day(32)))).changed).toBe(true);
    expect(searchCompanies(db, "sample three", { country: "us" }).map((h) => h.eid)).toEqual([eid]);
  });
});
