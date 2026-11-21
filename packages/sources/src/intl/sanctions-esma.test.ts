import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../field-maps.ts";
import { esmaNcasp } from "./sanctions/esma.ts";
import { fixture, parseAll, values } from "./sanctions-test-helpers.ts";

const raw = [fixture("esma-ncasp/NCASP.csv")];

describe("esma-ncasp (sanctions.md §5)", () => {
  it("keys a row by its LEI", async () => {
    const { records } = await parseAll(esmaNcasp, raw);
    expect(records.map((r) => r.recordKey)).toEqual(["FX000000000000000723"]);
    expect(values(records[0], "leiCode")).toEqual(["FX000000000000000723"]);
    expect(values(records[0], "name")).toEqual(["Test Energy 7"]);
    expect(values(records[0], "alias")).toEqual(["TE7 Exchange"]);
    expect(values(records[0], "website")).toEqual(["te7.example"]);
    expect(values(records[0], "country", "-s")).toEqual(["lv"]);
  });

  it("keeps only rows with a valid LEI: a name alone, or an invalid LEI, is dropped as unproven (legal, SEC-4)", async () => {
    const { records, drops } = await parseAll(esmaNcasp, raw);
    expect(records).toHaveLength(1);
    expect(drops).toEqual(["unproven_party", "unproven_party"]);
    expect(JSON.stringify(records)).not.toMatch(/Mock Token Counter|Demo Token House/);
  });

  it("never reads the comments column", async () => {
    const { records } = await parseAll(esmaNcasp, raw);
    expect(JSON.stringify(records)).not.toContain("Sentinel");
  });

  it("takes the latest update date as the as-of date", () => {
    expect(esmaNcasp.asOf(raw)).toEqual({ max_date_in_data: "2026-11-18" });
  });

  it("has a valid field map", () => {
    expect(checkFieldMap(esmaNcasp.meta.id, esmaNcasp.fieldMap)).toEqual([]);
  });
});
