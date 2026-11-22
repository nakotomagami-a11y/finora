// S05 acceptance 1 and 2: every LV SHOW and CAVEAT item a loader fills gets a stored value from the
// fixture world, with its source and licence; the LV HIDE items and natural-person members never do.
import { ITEMS } from "@finora/domain";
import { runSync } from "@finora/ingest";
import { openStore } from "@finora/store";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { FIXTURE_PROFILE } from "./src/loaders.ts";

const noNetwork = async (): Promise<never> => {
  throw new Error("the fixture profile never fetches");
};

/** Filled outside the LV loaders: by agents at query time, or computed by the report (S07). */
const NOT_A_LOADER_ITEM: Record<string, string> = {
  "S11.LV.03": "agent-only live list (S10)",
  "S15.LV.02": "found by the web agent (S10)",
  "S18.LV.01": "computed by domain/verdict from the other LV items (S07)",
};

async function loadLv(): Promise<DatabaseSync> {
  const { db } = openStore({ dataDir: null });
  for (const { loader } of FIXTURE_PROFILE.filter((p) => p.loader.meta.id.startsWith("lv-"))) {
    const outcome = await runSync(db, loader, { fetcher: noNetwork, companyPartyTypes: ["LEGAL_ENTITY", "FOREIGN_ENTITY", "J"] });
    expect(outcome.kind, loader.meta.id).toBe("content");
  }
  return db;
}

const withItem = (db: DatabaseSync, itemId: string): number =>
  (
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM main.statements s JOIN main.items i ON i.id = s.item_id WHERE i.name = ?1)
              + (SELECT COUNT(*) FROM main.events e JOIN main.items i ON i.id = e.item_id WHERE i.name = ?1) AS n`,
      )
      .get(itemId) as { n: number }
  ).n;

/** A fact report's item follows from its kind and concepts (architecture §3.3); the stored row keeps the kind. */
const reportsOfKind = (db: DatabaseSync, kinds: string[]): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM main.fact_reports WHERE kind IN (${kinds.map(() => "?").join(", ")})`).get(...kinds) as { n: number }).n;

describe("S05: every LV item from the fixture world", () => {
  it("stores at least one value for each LV SHOW and CAVEAT item a loader fills", async () => {
    const db = await loadLv();
    const lvItems = ITEMS.filter((i) => i.country === "lv" && (i.call === "show" || i.call === "caveat")).map((i) => i.id);
    const missing = lvItems.filter((id) => !(id in NOT_A_LOADER_ITEM)).filter((id) => {
      if (id === "S06.LV.01") return reportsOfKind(db, ["annual_accounts"]) === 0;
      if (id === "S07.LV.01") return reportsOfKind(db, ["quarterly_employees", "annual_employees"]) === 0;
      return withItem(db, id) === 0 && (id !== "S08.LV.01" || reportsOfKind(db, ["quarterly_tax", "annual_tax"]) === 0);
    });
    expect(missing).toEqual([]);
  });

  it("stores every LV value with its source's licence, CC0", async () => {
    const db = await loadLv();
    const licences = db
      .prepare(
        `SELECT DISTINCT y.licence_id FROM main.records r JOIN main.syncs y ON y.id = r.last_changed_sync_id JOIN main.sources s ON s.id = r.source_id
         WHERE s.id LIKE 'lv-%'`,
      )
      .all() as { licence_id: string }[];
    expect(licences).toEqual([{ licence_id: "cc0-1.0" }]);
  });

  it("loads nothing for the LV HIDE items", async () => {
    const db = await loadLv();
    for (const id of ITEMS.filter((i) => i.country === "lv" && i.call === "hide").map((i) => i.id)) expect(withItem(db, id), id).toBe(0);
  });
});
