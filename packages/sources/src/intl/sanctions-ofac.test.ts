import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../field-maps.ts";
import { usOfacCons, usOfacSdn } from "./sanctions/ofac.ts";
import { fixture, parseAll, values } from "./sanctions-test-helpers.ts";

const raw = [fixture("us-ofac/SDN_ENHANCED.XML")];

describe("us-ofac-sdn and us-ofac-cons (sanctions.md §2)", () => {
  it("reads one record per organisation entity, scanning the file entity by entity", async () => {
    const { records } = await parseAll(usOfacSdn, raw);
    expect(records.map((r) => r.recordKey)).toEqual(["90000001", "90000002", "90000005"]);
    const first = records[0]!;
    expect(values(first, "name")).toEqual(["TEST ENERGY 7 SIA"]);
    expect(values(first, "previousName")).toEqual(["TEST POWER 7 SIA"]);
    expect(values(first, "number")).toEqual(["50003000024"]);
    expect(values(first, "type")).toEqual(["registration"]);
    expect(values(first, "country", "-i0")).toEqual(["lv"]);
    expect(values(first, "country", "90000001")).toEqual(["lv"]);
    expect(values(first, "incorporationDate")).toEqual(["2009-01-01"]);
    expect(values(first, "authority")).toEqual(["SDN List"]);
    expect(values(first, "listingDate")).toEqual(["2026-04-01"]);
    expect(values(first, "program")).toEqual(["FIXTURE-EO"]);
  });

  it("keeps the LEI as leiCode, the website as a host, and decodes entities", async () => {
    const { records } = await parseAll(usOfacSdn, raw);
    const entry = records[1]!;
    expect(values(entry, "name")).toEqual(["SAMPLE WEB TRADERS & PARTNERS"]);
    expect(values(entry, "leiCode")).toEqual(["FX000000000000001499"]);
    expect(values(entry, "website")).toEqual(["sample-web-traders.example"]);
  });

  it("flags low-quality aliases as weak, other scripts as aliases with the script, and a bare number with no country", async () => {
    const { records } = await parseAll(usOfacSdn, raw);
    const entry = records[2]!;
    expect(values(entry, "weakAlias")).toEqual(["MHW"]);
    expect(entry.entities[0]!.statements.filter((s) => s.prop === "alias").map((s) => [s.value, s.lang])).toEqual([["МОК ХАРБОР ВОРКС", "cyrillic"]]);
    expect(values(entry, "number")).toEqual(["10000031"]);
    expect(values(entry, "country", "-i0")).toEqual([]);
  });

  it("hands individuals to the index, documents never read, and drops vessels", async () => {
    const { records, persons, drops } = await parseAll(usOfacSdn, raw);
    expect(persons).toEqual([
      { list: "us-ofac-sdn", entryId: "90000003", names: ["PERSONFOUR, Sentinel Delta"], program: "FIXTURE-EO", listDate: "2026-06-01", birthYear: 1966, nationalities: ["lv"] },
    ]);
    expect(drops.sort()).toEqual(["person_entry", "subject_out_of_scope"]);
    expect(JSON.stringify(records)).not.toMatch(/SENTINELDOC|Sentinel|VESSEL/);
  });

  it("reads the as-of date from dataAsOf and names the list in person entries", async () => {
    expect(usOfacSdn.asOf(raw)).toEqual({ in_file_field: "2026-11-20" });
    const { persons } = await parseAll(usOfacCons, raw);
    expect(persons[0]?.list).toBe("us-ofac-cons");
  });

  it("throws on a file cut between two entity blocks, so the sync ends partial and purges nothing (qa S3)", async () => {
    const text = new TextDecoder().decode(raw[0]!.bytes);
    const cut = text.slice(0, text.indexOf('<entity id="90000005">'));
    await expect(parseAll(usOfacSdn, [{ ...raw[0]!, bytes: new TextEncoder().encode(cut) }])).rejects.toThrow();
    const midBlock = text.slice(0, text.indexOf("</entity>", text.indexOf('<entity id="90000005">')));
    await expect(parseAll(usOfacSdn, [{ ...raw[0]!, bytes: new TextEncoder().encode(midBlock) }])).rejects.toThrow();
  });

  it("never matches a tag inside a comment", async () => {
    const text = new TextDecoder().decode(raw[0]!.bytes).replace("<names>", "<names><!-- <name id=\"1\"><isPrimary>true</isPrimary><translations><translation id=\"1\"><isPrimary>true</isPrimary><script>Latin</script><formattedFullName>COMMENTED OUT</formattedFullName></translation></translations></name> -->");
    const { records } = await parseAll(usOfacSdn, [{ ...raw[0]!, bytes: new TextEncoder().encode(text) }]);
    expect(JSON.stringify(records)).not.toContain("COMMENTED OUT");
  });

  it("has a valid field map and fetches only official hosts", () => {
    expect(checkFieldMap(usOfacSdn.meta.id, usOfacSdn.fieldMap)).toEqual([]);
    expect(usOfacSdn.meta.limits.maxBytes).toBe(300 * 1024 ** 2);
  });
});
