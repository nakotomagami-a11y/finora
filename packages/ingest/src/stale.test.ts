import { describe, expect, it } from "vitest";
import { companies, companyRecord, fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, sync } from "./test-helpers.ts";

describe("a stale file is skipped", () => {
  it("an as-of older than the last content sync writes nothing", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 5), asOf: { in_file_field: "2026-11-10" } });
    await sync(db, loader);
    loader.state.records = [companyRecord(1, { name: "Older Example Name SIA" })];
    loader.state.asOf = { in_file_field: "2026-11-09" };
    expect((await sync(db, loader)).kind).toBe("stale_skipped");
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value = 'Older Example Name SIA'")).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.records")).toBe(5);
  });

  it("the same as-of with new content is not stale", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 5), asOf: { in_file_field: "2026-11-10" } });
    await sync(db, loader);
    loader.state.records = companies(1, 6);
    expect((await sync(db, loader)).kind).toBe("content");
  });
});
