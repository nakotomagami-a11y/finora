import { sourceRefForStatement } from "@finora/store";
import { describe, expect, it } from "vitest";
import { companies, fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, records, sync } from "./test-helpers.ts";

const statementIds = (db: ReturnType<typeof memoryDb>) =>
  (db.prepare("SELECT id FROM main.statements ORDER BY id").all() as { id: number }[]).map((r) => r.id);

describe("an unchanged reload writes one sync row and nothing else (P10)", () => {
  it("keeps everything live, purges nothing, writes 0 statements and keeps the as-of", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 50), asOf: { in_file_field: "2026-11-01" } });
    await sync(db, loader);
    const before = statementIds(db);
    const syncs = count(db, "SELECT COUNT(*) AS n FROM main.syncs");

    const outcome = await sync(db, loader);
    expect(outcome.kind).toBe("unchanged");
    expect(count(db, "SELECT COUNT(*) AS n FROM main.syncs")).toBe(syncs + 1);
    expect(statementIds(db)).toEqual(before);
    expect(records(db)).toBe(50);
    const ref = sourceRefForStatement(db, before[0]!);
    expect(ref.asOf).toBe("2026-11-01");
    expect(ref.checkedAt).not.toBe(ref.retrievedAt);
  });

  it("stops at an unmoved change token without parsing", async () => {
    const db = memoryDb();
    const loader = fakeSource({}, { records: companies(1, 5), token: "t1" });
    await sync(db, loader);
    loader.state.unchanged = true;
    loader.state.throwAfter = 0;
    expect((await sync(db, loader)).kind).toBe("unchanged");
    expect(records(db)).toBe(5);
  });
});
