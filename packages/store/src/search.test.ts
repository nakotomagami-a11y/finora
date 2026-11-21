import type { DatabaseSync } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";
import { writeRecord, type EntityInput } from "./registry.ts";
import { findByIdentifier, searchCompanies } from "./search.ts";
import { company, contentSync, memoryStore, writeRoleSet } from "./test-helpers.ts";

let db: DatabaseSync;

beforeAll(() => {
  db = memoryStore().db;
  const sync = contentSync(db, "lv-register", "2026-11-01T00:00:00.000Z");
  const put = (entity: EntityInput) =>
    writeRecord(db, { syncId: sync, sourceId: "lv-register", recordKey: entity.eid, hashInput: [JSON.stringify(entity)], entities: [entity] });
  put(company("lv-00000000001", "Ābeļu Dārzs Paraugs SIA"));
  put(company("lv-00000000002", "Fixture Timber Works SIA"));
  put(company("lv-00000000003", "Example Trading SIA"));
  put(company("lv-00000000004", "Example Logistics SIA"));
  put(company("lv-00000000005", "Rasma Example IK", { legalForm: "lv-ik" }));
  // A sanctions list entry named like a company, with an LEI: reachable by screening only (sanctions.md §6).
  const lists = contentSync(db, "eu-fsf", "2026-11-01T00:00:00.000Z");
  writeRecord(db, {
    syncId: lists,
    sourceId: "eu-fsf",
    recordKey: "900001",
    hashInput: ["900001"],
    entities: [
      {
        eid: "sanc-eu-900001",
        schema: "Organization",
        country: "intl",
        statements: [
          { prop: "name", value: "Example Trading Listed", itemId: "S11.ALL.01" },
          { prop: "leiCode", value: "FX00000000000000SANC", itemId: "S11.ALL.01" },
        ],
      },
    ],
  });
  writeRoleSet(db, contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z"), "lv-00000000003", [
    { name: "Ilze Example", role: "board_member", startDate: "2020-01-01" },
  ]);
});

const eids = (query: string) => searchCompanies(db, query).map((h) => h.eid);

describe("company search", () => {
  it("never returns a sanctions list entry, by name or by identifier", () => {
    expect(eids("example trading listed")).not.toContain("sanc-eu-900001");
    expect(eids("example")).not.toContain("sanc-eu-900001");
    expect(findByIdentifier(db, "leiCode", "FX00000000000000SANC")).toEqual([]);
  });

  it("finds a diacritic name by its ASCII form", () => {
    const [hit] = searchCompanies(db, "abelu darzs");
    expect(hit).toMatchObject({ eid: "lv-00000000001", caption: "Ābeļu Dārzs Paraugs SIA", match: "prefix" });
  });

  it("finds a name by a substring inside a word", () => {
    const [hit] = searchCompanies(db, "mber wor");
    expect(hit).toMatchObject({ eid: "lv-00000000002", match: "substring" });
  });

  it("finds a name with a one-letter typo", () => {
    const [hit] = searchCompanies(db, "fixtura timber");
    expect(hit).toMatchObject({ eid: "lv-00000000002", match: "fuzzy" });
  });

  it("finds a company by its registry code", () => {
    expect(searchCompanies(db, "00000000004")[0]).toMatchObject({ eid: "lv-00000000004", match: "code" });
  });

  it("ranks deterministically", () => {
    const first = searchCompanies(db, "example");
    for (let i = 0; i < 5; i++) expect(searchCompanies(db, "example")).toEqual(first);
    expect(new Set(first.map((h) => h.eid))).toEqual(new Set(["lv-00000000003", "lv-00000000004"]));
  });

  it("returns nothing for a person's name or a sole trader's name (L2, L3)", () => {
    expect(eids("ilze")).toEqual([]);
    expect(eids("rasma")).toEqual([]);
    expect(eids("example")).not.toContain("lv-00000000005");
  });

  it("finds a sole trader by registry code only, titled by legal form and code", () => {
    const [hit] = searchCompanies(db, "00000000005");
    expect(hit).toMatchObject({ eid: "lv-00000000005", caption: "IK 00000000005", match: "code" });
    expect(JSON.stringify(hit)).not.toContain("Rasma");
  });

  it("filters by country and ignores empty queries", () => {
    expect(searchCompanies(db, "example", { country: "ee" })).toEqual([]);
    expect(searchCompanies(db, "  -- ")).toEqual([]);
  });
});
