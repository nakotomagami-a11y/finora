import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../field-maps.ts";
import { euFsf } from "./sanctions/eu-fsf.ts";
import { fixture, parseAll, values } from "./sanctions-test-helpers.ts";

const raw = [fixture("eu-fsf/csvFullSanctionsList_1_1.csv")];

describe("eu-fsf (sanctions.md §1)", () => {
  it("groups the long-format rows into one record per enterprise entry", async () => {
    const { records } = await parseAll(euFsf, raw);
    expect(records.map((r) => r.recordKey)).toEqual(["900001", "900002", "900005"]);
    const first = records[0]!;
    expect(first.entities.map((e) => [e.eid, e.schema])).toEqual([
      ["sanc-eu-900001", "Organization"],
      ["sanc-eu-900001-s", "Sanction"],
      ["sanc-eu-900001-i0", "Identification"],
    ]);
    expect(values(first, "name")).toEqual(["Example Company 1"]);
    expect(values(first, "number")).toEqual(["40003000018"]);
    expect(values(first, "country", "-i0")).toEqual(["lv"]);
    expect(values(first, "authorityId")).toEqual(["EU.FX.1"]);
    expect(values(first, "listingDate")).toEqual(["2026-03-01"]);
    expect(values(first, "program")).toEqual(["FXP"]);
    expect(first.entities.every((e) => e.statements.every((s) => s.itemId === "S11.ALL.01"))).toBe(true);
  });

  it("keeps the first name as the name, the others as aliases with their language", async () => {
    const { records } = await parseAll(euFsf, raw);
    const entry = records.find((r) => r.recordKey === "900005")!;
    expect(values(entry, "name")).toEqual(["Demo Orbital Systems"]);
    const aliases = entry.entities[0]!.statements.filter((s) => s.prop === "alias");
    expect(aliases.map((s) => [s.value, s.lang])).toEqual([
      ["Demo Orbitaalsed Süsteemid", "et"],
      ["Demo Orbitālās Sistēmas", "lv"],
    ]);
  });

  it("keeps a publication URL only on the official host, and the UN reference", async () => {
    const { records } = await parseAll(euFsf, raw);
    expect(values(records[0], "sourceUrl")).toHaveLength(1);
    const offHost = records.find((r) => r.recordKey === "900002")!;
    expect(values(offHost, "sourceUrl")).toEqual([]);
    expect(values(offHost, "unscId")).toEqual(["QDe.900"]);
    expect(values(offHost, "number")).toEqual(["FX7700"]);
  });

  it("hands persons to the index with their documents dropped, and counts unknown subject types", async () => {
    const { records, persons, drops } = await parseAll(euFsf, raw);
    expect(persons.map((p) => [p.entryId, p.names, p.birthYear, p.nationalities])).toEqual([
      ["900003", ["Sentinel Personone Alpha"], 1961, ["zz"]],
      ["900004", ["Officer Golf 600", "Sentinel Persontwo Bravo"], 1970, []],
    ]);
    expect(drops.sort()).toEqual(["person_entry", "person_entry", "unknown_subject_type"]);
    expect(JSON.stringify(records)).not.toMatch(/SENTINELDOC|Sentinel|1961/);
  });

  it("reads the as-of date from fileGenerationDate", () => {
    expect(euFsf.asOf(raw)).toEqual({ in_file_field: "2026-11-20" });
  });

  it("sorts the hash input, so a reordered file is not a change", async () => {
    const { records } = await parseAll(euFsf, raw);
    const hash = records[2]!.hashInput;
    expect([...hash].sort()).toEqual(hash);
  });

  it("fails on a changed header instead of reading the wrong columns", async () => {
    const text = new TextDecoder().decode(raw[0]!.bytes).replace("NameAlias_WholeName", "NameAlias_Whole");
    await expect(parseAll(euFsf, [{ ...raw[0]!, bytes: new TextEncoder().encode(text) }])).rejects.toThrow();
  });

  it("has a valid field map", () => {
    expect(checkFieldMap(euFsf.meta.id, euFsf.fieldMap)).toEqual([]);
  });
});
