import { describe, expect, it } from "vitest";
import { companies, fakeSource } from "./testing/fake-source.ts";
import { memoryDb, records, sync } from "./test-helpers.ts";

describe("an interrupted sync purges nothing", () => {
  it("a cut-off file ends partial and every record of the last full sync stays", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 100) });
    await sync(db, loader);
    loader.state.records = companies(1, 100);
    loader.state.asOf = { in_file_field: "2026-11-02" };
    loader.state.throwAfter = 10;
    const outcome = await sync(db, loader);
    expect(outcome).toMatchObject({ kind: "partial", report: { reason: "parse_error", deleted: 0 } });
    expect(records(db)).toBe(100);
  });

  it("an aborted sync ends partial with reason interrupted", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 20) });
    await sync(db, loader);
    loader.state.asOf = { in_file_field: "2026-11-02" };
    loader.state.records = companies(1, 5);
    const controller = new AbortController();
    controller.abort();
    expect(await sync(db, loader, { signal: controller.signal })).toMatchObject({ kind: "partial", report: { reason: "interrupted" } });
    expect(records(db)).toBe(20);
  });
});
