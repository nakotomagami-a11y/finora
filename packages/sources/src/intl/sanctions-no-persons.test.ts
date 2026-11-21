// sanctions.md §6 and §7a (LAW-SANCTIONS-PERSONS): no list's parse yields a Person, a birth date, a
// nationality, an individual's document or an individual's name, in any record.
import { describe, expect, it } from "vitest";
import { personFieldProblems } from "../person-fields.ts";
import { euFsf } from "./sanctions/eu-fsf.ts";
import { usOfacSdn } from "./sanctions/ofac.ts";
import { lvFidFrozen } from "../lv/fid/fid.ts";
import { ukSanctionsList } from "./sanctions/uk.ts";
import { fixture, parseAll } from "./sanctions-test-helpers.ts";

const lists = [
  { loader: euFsf, raw: [fixture("eu-fsf/csvFullSanctionsList_1_1.csv")] },
  { loader: usOfacSdn, raw: [fixture("us-ofac/SDN_ENHANCED.XML")] },
  { loader: ukSanctionsList, raw: [fixture("uk-sanctions-list/UK-Sanctions-List.csv")] },
];

describe("the stored lists hold no listed individual", () => {
  for (const { loader, raw } of lists) {
    it(`${loader.meta.id}: no Person, no birth date, no nationality, no individual's name or document`, async () => {
      const { records, persons } = await parseAll(loader, raw);
      expect(persons.length).toBeGreaterThan(0);
      const text = JSON.stringify(records);
      for (const record of records) {
        expect(record.entities.some((e) => e.schema === "Person")).toBe(false);
        expect(personFieldProblems(record)).toEqual([]);
        for (const e of record.entities) expect(e.statements.map((s) => s.prop)).not.toContain("birthDate");
      }
      expect(text).not.toMatch(/Sentinel|SENTINEL|PERSONFOUR|1958|1961|1966|Ruritania|nationalit/i);
      for (const person of persons) for (const name of person.names) expect(text).not.toContain(name);
    });
  }

  it("keeps every list that holds individuals out of the raw cache and feeding the person index", () => {
    for (const { loader } of lists) {
      expect(loader.meta.rawCache, loader.meta.id).toBe(false);
      expect(loader.meta.personIndex, loader.meta.id).toBe(true);
    }
    // The LV frozen-assets file holds persons too (column 6, birth-date rows): never cached, never indexed.
    expect(lvFidFrozen.meta.rawCache).toBe(false);
    expect(lvFidFrozen.meta.personIndex).toBeUndefined();
  });
});
