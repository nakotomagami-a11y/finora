// S05: the real LV loaders over their layout fixtures, through the whole pipeline into a store.
import { runSync } from "@finora/ingest";
import { lvFx } from "@finora/sources/testing";
import { openStore, searchCompanies } from "@finora/store";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { fxLvUrEquityCapitals, fxLvUrLiquidations, fxLvUrMemorandumDates, fxLvUrNameHistory, fxLvUrRegister, fxLvUrReorganizations } from "./src/loaders.ts";

const noNetwork = async (): Promise<never> => {
  throw new Error("the fixture profile never fetches");
};
const LV_UR = [fxLvUrRegister, fxLvUrNameHistory, fxLvUrLiquidations, fxLvUrReorganizations, fxLvUrEquityCapitals, fxLvUrMemorandumDates];

async function load(): Promise<{ db: DatabaseSync; outcomes: Awaited<ReturnType<typeof runSync>>[] }> {
  const { db } = openStore({ dataDir: null });
  const outcomes = [];
  for (const loader of LV_UR) outcomes.push(await runSync(db, loader, { fetcher: noNetwork }));
  return { db, outcomes };
}

const eid = (n: number) => `lv-${lvFx(n).code}`;
const values = (db: DatabaseSync, n: number, prop: string) =>
  (db.prepare("SELECT s.value FROM main.statements s JOIN main.entities e ON e.id = s.entity_id JOIN main.props p ON p.id = s.prop_id WHERE e.eid = ? AND p.name = ? ORDER BY s.id").all(eid(n), prop) as { value: string }[]).map((r) => r.value);
const events = (db: DatabaseSync, n: number) =>
  db.prepare("SELECT t.name AS type, ev.date, ev.data FROM main.events ev JOIN main.entities e ON e.id = ev.entity_id JOIN main.event_types t ON t.id = ev.type_id WHERE e.eid = ? ORDER BY ev.date").all(eid(n)) as { type: string; date: string; data: string | null }[];

describe("S05: the LV register sources load end to end", () => {
  it("syncs all six, and a second run is unchanged", async () => {
    const { db, outcomes } = await load();
    expect(outcomes.map((o) => o.kind)).toEqual(LV_UR.map(() => "content"));
    for (const loader of LV_UR) expect((await runSync(db, loader, { fetcher: noNetwork })).kind, loader.meta.id).toBe("unchanged");
  });

  it("makes companies searchable by name and former name, and sole traders by neither", async () => {
    const { db } = await load();
    expect(searchCompanies(db, "Example Timber").map((h) => h.eid)).toContain(eid(1));
    expect(searchCompanies(db, "Example Oldname").map((h) => h.eid)).toContain(eid(19));
    expect(searchCompanies(db, "Test Person A")).toEqual([]);
  });

  it("attaches former names and capital by reference without touching the register's identity", async () => {
    const { db } = await load();
    expect(values(db, 19, "previousName")).toEqual(['SIA "Example Oldname"', 'SIA "Example Middlename"']);
    expect(values(db, 1, "capital")).toEqual(["2800.00 EUR"]);
    const timber = db.prepare("SELECT legal_form, status, natural_person FROM main.entities WHERE eid = ?").get(eid(1));
    expect(timber).toEqual({ legal_form: "lv-sia", status: "active", natural_person: 0 });
  });

  it("drops a sole trader's former name and address (rule 5), counted", async () => {
    const { db, outcomes } = await load();
    expect(values(db, 4, "previousName")).toEqual([]);
    expect(values(db, 4, "address")).toEqual([]);
    expect(values(db, 4, "country")).toEqual(["lv"]);
    expect(outcomes[1]!.report?.dropped).toMatchObject({ natural_person_name: 1 });
    expect(db.prepare("SELECT natural_person FROM main.entities WHERE eid = ?").get(eid(4))).toEqual({ natural_person: 1 });
  });

  it("writes liquidation, reorganisation and founding-document events on the register entities", async () => {
    const { db } = await load();
    expect(events(db, 18)).toEqual([{ type: "register.liquidation", date: "2026-09-01", data: JSON.stringify({ kind: "LIQUIDATION" }) }]);
    expect(events(db, 7).map((e) => e.type)).toEqual(["register.reorganisation"]);
    expect(events(db, 2).map((e) => e.type).sort()).toEqual(["filing.founding_document", "register.reorganisation"]);
  });

  it("stores every value with its source, CC0 licence and the register's as-of", async () => {
    const { db } = await load();
    const syncs = db.prepare("SELECT DISTINCT y.licence_id, y.as_of_basis FROM main.statements s JOIN main.records r ON r.id = s.record_id JOIN main.syncs y ON y.id = r.last_changed_sync_id").all();
    expect(syncs).toEqual([{ licence_id: "cc0-1.0", as_of_basis: "max_date_in_data" }]);
    const items = (db.prepare("SELECT DISTINCT i.name FROM main.statements s JOIN main.items i ON i.id = s.item_id UNION SELECT DISTINCT i.name FROM main.events e JOIN main.items i ON i.id = e.item_id ORDER BY 1").all() as { name: string }[]).map((r) => r.name);
    expect(items).toEqual(["S01.LV.01", "S02.LV.01", "S13.LV.01", "S17.LV.01"]);
  });
});
