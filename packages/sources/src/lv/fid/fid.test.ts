import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../../field-maps.ts";
import { parseAll } from "../../intl/sanctions-test-helpers.ts";
import { LV_FID_HEADER, LV_FID_ROWS, lvFidXlsx } from "../../testing/lv-fid-fixture.ts";
import { writeXlsx, writeZip } from "../../testing/xlsx-writer.ts";
import type { RawArtifact } from "../../types.ts";
import { FID_GROUNDS, lvFidFrozen } from "./fid.ts";

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
    expect(event?.data).toEqual({
      assetTypes: "Naudas līdzekļi; Nekustamais īpašums",
      ground: FID_GROUNDS.ownedOrControlled,
      sanctionsFrom: "2026-03-01",
      legalAct: "Regula FX/2026",
      checkedNote: null,
    });
    expect(lv.dropped).toEqual([{ reason: "listed_person_name" }]);
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
    expect(text).not.toMatch(/listedperson|sentinel|golf/i);
    expect(records[0]?.parties?.[0]?.events?.[0]?.data?.ground).toBe(FID_GROUNDS.ownedOrControlled);
  });

  it("drops any free-text field holding a token of the listed name: reordered, declined or partial, in columns 4, 5, 8 and 9 (qa M2)", async () => {
    const base = [...LV_FID_ROWS[0]!];
    const forms = ["Golfa Sentinela kontrolē", "Listedpersonai piederošs", "saistīts ar Sentinelu", "Listedpers."];
    for (const column of [4, 5, 8, 9]) {
      for (const form of forms) {
        const row = [...base];
        row[column - 1] = form;
        const { records } = await parseAll(lvFidFrozen, [artifact(lvFidXlsx([row]))]);
        const text = JSON.stringify(records);
        expect(text, `column ${column}: ${form}`).not.toMatch(/sentinel|listedpers|golfa/i);
      }
    }
  });

  it("stores the ground as a fixed category: the company itself listed, or owned or controlled by a listed person", async () => {
    const own = [...LV_FID_ROWS[1]!];
    own[5] = own[0]!;
    const { records } = await parseAll(lvFidFrozen, [artifact(lvFidXlsx([own]))]);
    expect(records[0]?.events?.[0]?.data?.ground).toBe(FID_GROUNDS.listedSubject);
  });

  it("keeps the raw file out of the cache: it holds natural persons (qa M1)", () => {
    expect(lvFidFrozen.meta.rawCache).toBe(false);
  });

  it("keys a row by subject, column 2 and its place, never column 6, in letters only; dates the file from sheet 2", async () => {
    const { records } = await parseAll(lvFidFrozen, raw);
    for (const r of records) expect(r.recordKey).toMatch(/^[a-p]{32}$/);
    const renamed = LV_FID_ROWS.map((r) => r.map((c, i) => (i === 5 ? "Another Listed Name" : c)));
    const again = await parseAll(lvFidFrozen, [artifact(lvFidXlsx(renamed))]);
    expect(again.records.map((r) => r.recordKey)).toEqual(records.map((r) => r.recordKey));
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
