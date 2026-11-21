import type { AsOfStrategy } from "@finora/sources";
import { describe, expect, it } from "vitest";
import { companies, fakeSource } from "./testing/fake-source.ts";
import { memoryDb, sync } from "./test-helpers.ts";

const STRATEGIES: AsOfStrategy[] = ["in_file_field", "in_file_name", "max_date_in_data", "portal_metadata", "http_last_modified"];

const basis = (db: ReturnType<typeof memoryDb>) =>
  db.prepare("SELECT upstream_as_of, as_of_basis FROM main.syncs WHERE kind = 'content' ORDER BY id DESC LIMIT 1").get();

describe("AsOfRule: ordered strategies, the first that yields a date wins (§4.2)", () => {
  for (const [i, strategy] of STRATEGIES.entries()) {
    it(`uses ${strategy} when the stronger strategies yield nothing`, async () => {
      const db = memoryDb();
      const dates = Object.fromEntries(STRATEGIES.map((s, j) => [s, j < i ? null : `2026-11-0${j + 1}`]));
      const loader = fakeSource({ asOf: STRATEGIES }, { records: companies(1, 3), asOf: dates });
      expect((await sync(db, loader)).kind).toBe("content");
      expect(basis(db)).toEqual({ upstream_as_of: `2026-11-0${i + 1}`, as_of_basis: strategy });
    });
  }

  it("lists only the strategies the source proved, in its order", async () => {
    const db = memoryDb();
    const loader = fakeSource({ asOf: ["portal_metadata", "in_file_field"] }, { records: companies(1, 3), asOf: { in_file_field: "2026-11-05", portal_metadata: "2026-11-04" } });
    await sync(db, loader);
    expect(basis(db)).toEqual({ upstream_as_of: "2026-11-04", as_of_basis: "portal_metadata" });
  });

  it("fails with as_of_missing when no strategy yields a date, and writes nothing", async () => {
    const db = memoryDb();
    const loader = fakeSource({ asOf: ["in_file_field"] }, { records: companies(1, 3), asOf: { http_last_modified: "2026-11-01" } });
    expect(await sync(db, loader)).toMatchObject({ kind: "failed", report: { reason: "as_of_missing" } });
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.records").get()).toEqual({ n: 0 });
  });
});
