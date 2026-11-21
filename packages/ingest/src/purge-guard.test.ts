import { describe, expect, it } from "vitest";
import { companies, companyRecord, fakeSource } from "./testing/fake-source.ts";
import { memoryDb, records, sync } from "./test-helpers.ts";

let day = 1;
const next = (loader: ReturnType<typeof fakeSource>) => (loader.state.asOf = { in_file_field: `2026-11-${String(++day % 28 + 1).padStart(2, "0")}` });

async function loaded(n: number, meta: Parameters<typeof fakeSource>[0] = {}) {
  const db = memoryDb();
  const loader = fakeSource({ asOf: ["in_file_field"], ...meta }, { records: companies(1, n), asOf: { in_file_field: "2026-11-01" } });
  await sync(db, loader);
  day = 1;
  return { db, loader };
}

describe("the purge guard (A2)", () => {
  it("an empty file and a half-size file delete nothing and report purge_guard", async () => {
    for (const keep of [0, 500]) {
      const { db, loader } = await loaded(1000);
      loader.state.records = companies(1, keep);
      next(loader);
      expect(await sync(db, loader)).toMatchObject({ kind: "partial", report: { reason: "purge_guard", deleted: 0 } });
      expect(records(db)).toBe(1000);
    }
  });

  it("a removal share at maxPurgeShare purges, one more does not (1,000 records, 2%)", async () => {
    const ok = await loaded(1000);
    ok.loader.state.records = companies(1, 980);
    next(ok.loader);
    expect(await sync(ok.db, ok.loader)).toMatchObject({ kind: "content", report: { deleted: 20 } });

    const over = await loaded(1000);
    over.loader.state.records = companies(1, 979);
    next(over.loader);
    expect(await sync(over.db, over.loader)).toMatchObject({ kind: "partial", report: { reason: "purge_guard" } });
  });

  it("always allows 5: a 58-record source purges 5 removals and refuses 6", async () => {
    const five = await loaded(58);
    five.loader.state.records = companies(1, 53);
    next(five.loader);
    expect((await sync(five.db, five.loader)).report?.deleted).toBe(5);

    const six = await loaded(58);
    six.loader.state.records = companies(1, 52);
    next(six.loader);
    expect((await sync(six.db, six.loader)).report?.reason).toBe("purge_guard");
  });

  it("--allow-mass-purge overrides the guard", async () => {
    const { db, loader } = await loaded(100);
    loader.state.records = companies(1, 10);
    next(loader);
    expect(await sync(db, loader, { allowMassPurge: true })).toMatchObject({ kind: "content", report: { deleted: 90 } });
  });

  it("refuses a change-feed page that deletes 50% of the records", async () => {
    const { db, loader } = await loaded(100, { purgeScope: "none", maxPurgeShare: 0.22 });
    loader.state.records = companies(1, 50).map((r) => ({ ...r, op: "delete" as const }));
    next(loader);
    expect(await sync(db, loader)).toMatchObject({ kind: "partial", report: { reason: "purge_guard" } });
    expect(records(db)).toBe(100);
    loader.state.records = companies(1, 10).map((r) => ({ ...r, op: "delete" as const }));
    next(loader);
    expect((await sync(db, loader)).report?.deleted).toBe(10);
  });

  it("a window source: a new quarter that drops the oldest passes; one half missing inside the window does not", async () => {
    const quarter = (q: string, from: number, to: number) => companies(from, to).map((r) => ({ ...r, recordKey: `${q}:${r.recordKey}`, period: q }));
    const db = memoryDb();
    const loader = fakeSource({ purgeScope: "window" }, { records: [...quarter("2026-01-01", 1, 100), ...quarter("2026-04-01", 1, 100)], windowStart: "2026-01-01" });
    await sync(db, loader);

    loader.state.records = [...quarter("2026-04-01", 1, 100), ...quarter("2026-07-01", 1, 100)];
    loader.state.windowStart = "2026-04-01";
    next(loader);
    expect(await sync(db, loader)).toMatchObject({ kind: "content", report: { deleted: 100 } });

    loader.state.records = [...quarter("2026-04-01", 1, 100), ...quarter("2026-07-01", 1, 50)];
    next(loader);
    expect((await sync(db, loader)).report?.reason).toBe("purge_guard");
  });

  it("a periods_in_file source purges only the periods present in the file, so history stays", async () => {
    const db = memoryDb();
    const period = (p: string, n: number) => ({ ...companyRecord(n), recordKey: `${p}:${n}`, period: p });
    const loader = fakeSource({ purgeScope: "periods_in_file" }, { records: [period("2026-06-30", 1), period("2026-09-30", 1), period("2026-09-30", 2)] });
    await sync(db, loader);
    loader.state.records = [period("2026-09-30", 1), period("2026-12-31", 1)];
    next(loader);
    expect((await sync(db, loader)).report?.deleted).toBe(1);
    expect((db.prepare("SELECT record_key FROM main.records ORDER BY record_key").all() as { record_key: string }[]).map((r) => r.record_key)).toEqual([
      "2026-06-30:1",
      "2026-09-30:1",
      "2026-12-31:1",
    ]);
  });
});
