import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../../field-maps.ts";
import { parseAll } from "../../intl/sanctions-test-helpers.ts";
import { LV_FID_HEADER, LV_FID_ROWS, lvFidXlsx } from "../../testing/lv-fid-fixture.ts";
import { writeXlsx, writeZip } from "../../testing/xlsx-writer.ts";
import type { RawArtifact } from "../../types.ts";
import { lvFidFrozen } from "./fid.ts";

const artifact = (bytes: Uint8Array): RawArtifact => ({ name: "sankciju_subjekti.xlsx", bytes, fetchedAt: "2026-11-21T00:00:00Z" });
const raw = [artifact(lvFidXlsx())];

describe("lv-fid-frozen (sanctions.md §4)", () => {
  it("finds the header by column number, under a title row and with reworded headers", async () => {
    const reworded = LV_FID_HEADER.map((h) => h.replace(/^(\d+\.).*/, "$1 reworded"));
    const bytes = writeXlsx([[["title"], ["note"], reworded, LV_FID_ROWS[0]!]]);
    const { records } = await parseAll(lvFidFrozen, [artifact(bytes)]);
    expect(records).toHaveLength(1);
  });

  it("routes an LV register code through the party gate, with the event on that company", async () => {
    const { records } = await parseAll(lvFidFrozen, raw);
    const lv = records[0]!;
    expect(lv.entities).toEqual([]);
    expect(lv.parties?.[0]?.code).toEqual({ country: "lv", value: "40103000014" });
    const event = lv.parties?.[0]?.events?.[0];
    expect(event).toMatchObject({ entityEid: "lv-40103000014", type: "register.frozen_assets", date: "2026-03-05", itemId: "S11.LV.02" });
    expect(event?.data).toMatchObject({ assetTypes: "Naudas līdzekļi; Nekustamais īpašums", sanctionsFrom: "2026-03-01", legalAct: "Regula FX/2026" });
  });

  it("loads a foreign row with a company-form word as a list subject for screening", async () => {
    const { records } = await parseAll(lvFidFrozen, raw);
    const foreign = records[1]!;
    expect(foreign.entities.map((e) => e.schema)).toEqual(["Organization", "Sanction", "Identification"]);
    expect(foreign.entities[0]!.eid).toBe(`sanc-lvfid-${foreign.recordKey}`);
    expect(foreign.entities[2]!.statements.find((s) => s.prop === "number")?.value).toBe("FX99887766");
    expect(foreign.entities[2]!.statements.find((s) => s.prop === "country")?.value).toBe("ru");
    expect(foreign.events?.[0]?.entityEid).toBe(foreign.entities[0]!.eid);
  });

  it("drops a foreign row with an id but no form word, and a natural person, counted", async () => {
    const { records, drops } = await parseAll(lvFidFrozen, raw);
    expect(drops.sort()).toEqual(["person_entry", "unproven_party"]);
    expect(JSON.stringify(records)).not.toMatch(/Mock Northern Holder|Personfive|1965/);
  });

  it("hands an unresolved LV code to the gate, which drops it (ingest party-gate test)", async () => {
    const { records } = await parseAll(lvFidFrozen, raw);
    expect(records[2]?.parties?.[0]?.code?.value).toBe("40003999990");
  });

  it("never stores column 6, the listed person's name, nor lets the ground repeat it", async () => {
    const { records } = await parseAll(lvFidFrozen, raw);
    const text = JSON.stringify(records);
    expect(text).not.toContain("Listedperson");
    expect(records[0]?.parties?.[0]?.events?.[0]?.data?.ground).toBe("controlled or owned by a person on the sanctions list");
  });

  it("keys a row by a hash of subject, column 2 and column 6, and dates the file from sheet 2", async () => {
    const { records } = await parseAll(lvFidFrozen, raw);
    for (const r of records) expect(r.recordKey).toMatch(/^[0-9a-f]{32}$/);
    expect(lvFidFrozen.asOf(raw)).toEqual({ in_file_field: "2026-11-16", portal_metadata: null });
  });

  it("refuses an archive with a climbing member path", async () => {
    const evil = writeZip([{ name: "xl/../../evil.xml", data: new Uint8Array(1) }]);
    await expect(parseAll(lvFidFrozen, [artifact(evil)])).rejects.toThrow(/unsafe member path/);
  });

  it("has a valid field map, with column 6 dropped", () => {
    expect(checkFieldMap(lvFidFrozen.meta.id, lvFidFrozen.fieldMap)).toEqual([]);
    expect(lvFidFrozen.fieldMap.find((e) => e.field === "6")?.target).toEqual({ dropped: "listed_person_name" });
  });
});
