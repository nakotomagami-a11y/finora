import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../field-maps.ts";
import { esmaNcasp } from "./sanctions/esma.ts";
import { fixture, parseAll, values } from "./sanctions-test-helpers.ts";

const raw = [fixture("esma-ncasp/NCASP.csv")];

describe("esma-ncasp (sanctions.md §5)", () => {
  it("keys a row by its LEI, else by a hash of authority, name and website", async () => {
    const { records } = await parseAll(esmaNcasp, raw);
    expect(records[0]?.recordKey).toBe("FX000000000000000723");
    expect(records[1]?.recordKey).toMatch(/^[a-p]{32}$/);
    expect(values(records[0], "leiCode")).toEqual(["FX000000000000000723"]);
    expect(values(records[0], "name")).toEqual(["Test Energy 7"]);
    expect(values(records[0], "alias")).toEqual(["TE7 Exchange"]);
    expect(values(records[0], "website")).toEqual(["te7.example"]);
    expect(values(records[0], "country", "-s")).toEqual(["lv"]);
  });

  it("names a row without an LEI name by its commercial name, and drops an invalid LEI", async () => {
    const { records } = await parseAll(esmaNcasp, raw);
    expect(values(records[1], "name")).toEqual(["Mock Coin Desk"]);
    expect(values(records[2], "leiCode")).toEqual([]);
    expect(records[2]?.dropped).toEqual([{ reason: "invalid_code", prop: "leiCode" }]);
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
