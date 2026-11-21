import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../field-maps.ts";
import { ukSanctionsList } from "./sanctions/uk.ts";
import { fixture, parseAll, values } from "./sanctions-test-helpers.ts";

const raw = [fixture("uk-sanctions-list/UK-Sanctions-List.csv")];

describe("uk-sanctions-list (sanctions.md §3)", () => {
  it("reads the report date on line 1 and the header on line 2", () => {
    expect(ukSanctionsList.asOf(raw)).toEqual({ in_file_field: "2026-11-20" });
  });

  it("groups name rows by Unique ID into one record per entity", async () => {
    const { records } = await parseAll(ukSanctionsList, raw);
    expect(records.map((r) => r.recordKey)).toEqual(["FX0001", "FX0004", "FX0005"]);
    const first = records[0]!;
    expect(values(first, "name")).toEqual(["Test Bakery 1"]);
    expect(values(first, "alias")).toEqual(["Test Bakery One"]);
    expect(values(first, "weakAlias")).toEqual(["TB One"]);
    expect(values(first, "number")).toEqual(["10000025"]);
    expect(values(first, "country", "-i0")).toEqual(["ee"]);
    expect(values(first, "website")).toEqual(["test-bakery.example"]);
    expect(values(first, "listingDate")).toEqual(["2026-02-02"]);
    expect(values(first, "authorityId")).toEqual(["90001"]);
  });

  it("puts the primary name first whatever its spelling, keeps non-Latin aliases with their language", async () => {
    const { records } = await parseAll(ukSanctionsList, raw);
    const entry = records[1]!;
    expect(values(entry, "name")).toEqual(["Mock Cargo Partners Limited"]);
    expect(entry.entities[0]!.statements.filter((s) => s.prop === "alias").map((s) => [s.value, s.lang ?? null])).toEqual([
      ["Мок Карго Партнерс", "russian"],
      ["Mock Cargo", null],
    ]);
    expect(values(entry, "number")).toEqual(["FX123456"]);
    expect(values(entry, "country", "-i0")).toEqual(["gb"]);
  });

  it("gives a number no country when the entry has several address countries", async () => {
    const { records } = await parseAll(ukSanctionsList, raw);
    expect(values(records[2], "country", "-i0")).toEqual([]);
    expect(values(records[2], "country", "FX0005")).toEqual(["lv", "lt"]);
  });

  it("hands individuals to the index, drops ships and never reads documents", async () => {
    const { records, persons, drops } = await parseAll(ukSanctionsList, raw);
    expect(persons.map((p) => [p.entryId, p.names, p.birthYear])).toEqual([["FX0002", ["Sentinel Personthree Charlie", "Sentinel Charlie"], 1958]]);
    expect(drops.sort()).toEqual(["person_entry", "subject_out_of_scope"]);
    expect(JSON.stringify(records)).not.toMatch(/SENTINELDOC|Sentinel|IMO99/);
  });

  it("fails closed on a designation whose rows disagree, in either order (security review, SEC-3)", async () => {
    const text = new TextDecoder().decode(raw[0]!.bytes);
    const lines = text.split("\n");
    const person = lines.find((l) => l.includes(",FX0002,") && l.includes("Sentinel"))!;
    for (const order of ["entity-first", "individual-first"]) {
      // The individual's row joins the entity FX0001, before or after its rows.
      const moved = person.replace(",FX0002,", ",FX0001,");
      const rest = lines.filter((l) => l !== person && l !== "");
      const body = order === "entity-first" ? [...rest, moved] : [rest[0]!, rest[1]!, moved, ...rest.slice(2)];
      const { records, persons } = await parseAll(ukSanctionsList, [{ ...raw[0]!, bytes: new TextEncoder().encode(body.join("\n") + "\n") }]);
      expect(records.map((r) => r.recordKey), order).toEqual(["FX0004", "FX0005"]);
      expect(persons.map((p) => p.entryId).sort(), order).toEqual(["FX0001", "FX0002"]);
      expect(JSON.stringify(records), order).not.toMatch(/Sentinel|Test Bakery/);
    }
  });

  it("fails on a missing report date line", async () => {
    const text = new TextDecoder().decode(raw[0]!.bytes).replace(/^﻿?Report Date: [^\n]*\n/, "");
    await expect(parseAll(ukSanctionsList, [{ ...raw[0]!, bytes: new TextEncoder().encode(text) }])).rejects.toThrow();
  });

  it("has a valid field map", () => {
    expect(checkFieldMap(ukSanctionsList.meta.id, ukSanctionsList.fieldMap)).toEqual([]);
  });
});
