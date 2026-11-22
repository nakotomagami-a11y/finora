import { runSync } from "@finora/ingest";
import { openStore, scanStore, searchCompanies } from "@finora/store";
import { describe, expect, it } from "vitest";
import { FIXTURE_PROFILE } from "./src/loaders.ts";

const noNetwork = async (): Promise<never> => {
  throw new Error("the fixture profile never fetches");
};

function calibrate(): number {
  const start = performance.now();
  let x = 0;
  for (let i = 0; i < 3_000_000; i++) x = (x * 31 + i) % 1_000_003;
  if (x < 0) throw new Error("unreachable");
  return performance.now() - start;
}

async function loadAll() {
  const store = openStore({ dataDir: null });
  const outcomes = [];
  for (const { loader } of FIXTURE_PROFILE) outcomes.push(await runSync(store.db, loader, { fetcher: noNetwork, companyPartyTypes: ["LEGAL_ENTITY", "FOREIGN_ENTITY", "J"] }));
  return { db: store.db, outcomes };
}

describe("the fixture profile loads end to end (S04f)", () => {
  it("syncs every source; a second run writes nothing, and a third is unchanged everywhere", async () => {
    const { db, outcomes } = await loadAll();
    expect(outcomes.map((o) => o.kind)).toEqual(FIXTURE_PROFILE.map(() => "content"));
    // A file with a reference still waiting on another source is parsed again while the store
    // grows (qa M5 on S05), but it writes nothing; once the store stops growing it is unchanged.
    for (const { loader } of FIXTURE_PROFILE) {
      if (loader.meta.storage === "live-no-store") continue;
      const second = await runSync(db, loader, { fetcher: noNetwork });
      expect([second.kind, second.report?.written ?? 0, second.report?.deleted ?? 0], loader.meta.id).toEqual([second.kind === "unchanged" ? "unchanged" : "content", 0, 0]);
    }
    for (const { loader } of FIXTURE_PROFILE) {
      if (loader.meta.storage === "live-no-store") continue;
      expect((await runSync(db, loader, { fetcher: noNetwork })).kind, loader.meta.id).toBe("unchanged");
    }
  });

  it("finds an 'example compa' company in each of the four countries", async () => {
    const { db } = await loadAll();
    const hits = searchCompanies(db, "example compa", { limit: 200 });
    expect(new Set(hits.map((h) => h.country))).toEqual(new Set(["lv", "ee", "lt", "us"]));
  });

  it("drops every HIDE row and counts it; withholds the code-shaped sole-trader id", async () => {
    const { db, outcomes } = await loadAll();
    const hide = outcomes[FIXTURE_PROFILE.findIndex((p) => p.exportName === "fxHide")];
    expect(hide?.report?.dropped.hide_item).toBe(15);
    const lv = outcomes[0];
    expect(lv?.report?.dropped.personal_code).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.withheld").get()).toEqual({ n: 1 });
    expect(scanStore(db)).toEqual([]);
  });

  it("loads within the relative budget (the absolute number is in docs/plan/benchmarks.md)", async () => {
    const times: number[] = [];
    for (let i = 0; i < 2; i++) {
      const unit = calibrate();
      const start = performance.now();
      await loadAll();
      times.push((performance.now() - start) / Math.min(unit, calibrate()));
    }
    // 53-58 units on dev-desktop-1 (about 0.5 s); the limit leaves room for slow CI runners.
    expect(Math.min(...times)).toBeLessThan(400);
  }, 120_000);
});
