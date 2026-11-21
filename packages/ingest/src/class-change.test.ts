import { describe, expect, it } from "vitest";
import { liveView } from "./live-views.ts";
import { companies, fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, records, sync } from "./test-helpers.ts";

const saRows = (db: ReturnType<typeof memoryDb>) => count(db, "SELECT COUNT(*) AS n FROM sa.sa_statements");

describe("a storage class change is a migration (A7)", () => {
  it("store → share-alike-store: a full reload into the new class, then nothing left in the old one", async () => {
    const db = memoryDb();
    const loader = fakeSource({ id: "ee-tax", country: "ee" }, { records: companies(1, 20) });
    await sync(db, loader);
    expect(records(db, "ee-tax")).toBe(20);

    loader.meta.storage = "share-alike-store";
    loader.meta.licence = "cc-by-sa-3.0";
    expect((await sync(db, loader)).kind).toBe("content");
    expect(records(db, "ee-tax")).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements")).toBe(0);
    expect(saRows(db)).toBe(20);
    expect(db.prepare("SELECT storage FROM main.syncs ORDER BY id DESC LIMIT 1").get()).toEqual({ storage: "share-alike-store" });
  });

  it("share-alike-store → live-no-store by SHARE_ALIKE_MODE: the share-alike rows go", async () => {
    const db = memoryDb();
    const loader = fakeSource({ id: "ee-tax", country: "ee", storage: "share-alike-store", licence: "cc-by-sa-3.0" }, { records: companies(1, 5) });
    await sync(db, loader);
    expect(saRows(db)).toBe(5);
    expect((await sync(db, loader, { shareAlikeMode: "live-no-store" })).kind).toBe("content");
    expect(saRows(db)).toBe(0);
    expect(liveView("ee-tax")?.rows).toHaveLength(5);
  });
});
