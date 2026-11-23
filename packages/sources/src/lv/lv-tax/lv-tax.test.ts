import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../../field-maps.ts";
import { checkSource } from "../../licences.ts";
import { parseAll, values } from "../../intl/sanctions-test-helpers.ts";
import type { ParsedRecord, RawArtifact } from "../../types.ts";
import { lvCsv } from "../fixture-csv.ts";
import { lvFx } from "../fixture-world.ts";
import { LV_VID_PERSON_VAT, LV_VID_QUARTERLY_HEADER, lvVidQuarterlyCsv, lvVidRatingCsv, lvVidSuspensionsCsv, lvVidVatCsv, lvVidYearlyCsv } from "./fixture.ts";
import { dmyDate, LV_TAX_LOADERS, lvVidRating, lvVidSuspensions, lvVidTaxesQuarterly, lvVidTaxesYearly, lvVidVatPayers, naceClass, quarterOf } from "./lv-tax.ts";

const art = (name: string, bytes: Uint8Array, extra: Partial<RawArtifact> = {}): RawArtifact => ({ name, bytes, fetchedAt: "2026-11-21T00:00:00Z", ...extra });
const quarterly = () => [art("pdb_samaksato_nodoklu_kopsummas_cet.csv", lvVidQuarterlyCsv())];
const yearly = () => [art("pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv", lvVidYearlyCsv())];
const rating = () => [art("reitings_uznemumi.csv", lvVidRatingCsv())];
const vat = () => [art("pdb_pvnmaksataji_odata.csv", lvVidVatCsv())];
const suspensions = () => [art("pdb_saimndarbibaaptureta_odata.csv", lvVidSuspensionsCsv())];
const facts = (r: ParsedRecord | undefined) => Object.fromEntries((r?.reports ?? []).flatMap((p) => p.facts).map((f) => [f.concept, f.value]));
const key = (n: number, suffix = "") => `${lvFx(n).code}${suffix}`;
const find = (records: ParsedRecord[], k: string) => records.find((r) => r.recordKey === k);

describe("lv-vid-taxes-quarterly (lv-tax.md)", () => {
  it("parses the quarter label into the report's period and the record key", async () => {
    expect(quarterOf("2026. gada 3. ceturksnis")).toEqual({ start: "2026-07-01", end: "2026-09-30", key: "2026Q3" });
    expect(quarterOf("2026. gada 1. ceturksnis")).toEqual({ start: "2026-01-01", end: "2026-03-31", key: "2026Q1" });
    expect(quarterOf("2026. gada 5. ceturksnis")).toBeNull();
    const { records } = await parseAll(lvVidTaxesQuarterly, quarterly());
    const r = find(records, key(1, "|2026Q2"))!;
    expect(r.period).toBe("2026-06-30");
    expect(r.reports).toEqual([
      {
        entityEid: `lv-${lvFx(1).code}`,
        kind: "quarterly_tax",
        periodStart: "2026-04-01",
        periodEnd: "2026-06-30",
        currency: "EUR",
        unitScale: 1000,
        itemId: "S08.LV.01",
        facts: [
          { concept: "taxes_paid", value: 12.5 },
          { concept: "vat_paid", value: 6.25 },
          { concept: "labour_taxes", value: 9.3 },
        ],
      },
      // The head count is a plain number in its own workforce report (S07), not in thousands.
      { entityEid: `lv-${lvFx(1).code}`, kind: "quarterly_employees", periodStart: "2026-04-01", periodEnd: "2026-06-30", itemId: "S07.LV.01", facts: [{ concept: "employees", value: 10 }] },
    ]);
    expect(r.entities).toEqual([{ eid: `lv-${lvFx(1).code}`, schema: "Company", country: "lv", code: lvFx(1).code, ref: true, statements: [] }]);
  });

  it("sums personal income tax and social contributions into labour_taxes, and keeps 0 employees", async () => {
    const { records } = await parseAll(lvVidTaxesQuarterly, quarterly());
    expect(facts(find(records, key(2, "|2026Q2")))).toEqual({ taxes_paid: -1.75, vat_paid: 0, labour_taxes: 1.2, employees: 0 });
    expect(facts(find(records, key(23, "|2026Q3")))).toEqual({ taxes_paid: 250, vat_paid: 180, employees: 42 });
    expect(facts(find(records, key(22, "|2026Q1")))).not.toHaveProperty("vat_paid");
  });

  it("never reads the VAT refund column", async () => {
    const { records } = await parseAll(lvVidTaxesQuarterly, quarterly());
    expect(records.flatMap((r) => r.reports!.flatMap((p) => p.facts.map((f) => f.concept)))).not.toContain("vat_refunded");
    expect(records.every((r) => !r.hashInput.includes("6.40"))).toBe(true);
    const withoutRefund = lvCsv(LV_VID_QUARTERLY_HEADER.filter((h) => h !== "Taja_skaita_PVN_atmaksa"), [[lvFx(1).code, "x", "2026. gada 1. ceturksnis", "1.00", "0.00", "0.00", "0.00", "1"]], { separator: ",", quoteAll: true });
    expect((await parseAll(lvVidTaxesQuarterly, [art("pdb_samaksato_nodoklu_kopsummas_cet.csv", withoutRefund)])).records).toHaveLength(1);
  });

  it("skips a letter-prefixed code and a bad quarter label, counted", async () => {
    const { records, drops } = await parseAll(lvVidTaxesQuarterly, quarterly());
    expect(drops.sort()).toEqual(["bad_period", "invalid_code"]);
    expect(records).toHaveLength(13);
  });

  it("puts a sole trader's row in S08 and S07 reports, both dropped by the gate's natural-person rule", async () => {
    const { records } = await parseAll(lvVidTaxesQuarterly, quarterly());
    const sole = find(records, key(4, "|2026Q3"))!;
    expect(sole.reports!.map((r) => r.itemId)).toEqual(["S08.LV.01", "S07.LV.01"]);
    expect(facts(sole)).toHaveProperty("employees", 1);
    expect(sole.entities.every((e) => e.ref && e.statements.length === 0)).toBe(true);
  });

  it("dates the file by its newest quarter's end", () => {
    expect(lvVidTaxesQuarterly.asOf(quarterly()).max_date_in_data).toBe("2026-09-30");
    expect(lvVidTaxesQuarterly.meta.purgeScope).toBe("periods_in_file");
  });
});

describe("lv-vid-taxes-yearly (lv-tax.md)", () => {
  it("writes an annual tax report for the calendar year", async () => {
    const { records } = await parseAll(lvVidTaxesYearly, yearly());
    const r = find(records, key(1, "|2024"))!;
    expect(r.period).toBe("2024-12-31");
    expect(r.reports![0]).toMatchObject({ kind: "annual_tax", periodStart: "2024-01-01", periodEnd: "2024-12-31", currency: "EUR", unitScale: 1000, itemId: "S08.LV.01" });
    expect(facts(r)).toEqual({ taxes_paid: 48.6, labour_taxes: 30, employees: 11 });
  });

  it("formats the NACE code from the newest year only", async () => {
    expect([naceClass("4120"), naceClass("4690."), naceClass("?     "), naceClass("412")]).toEqual(["NACE:41.20", "NACE:46.90", null, null]);
    const { records } = await parseAll(lvVidTaxesYearly, yearly());
    expect(values(find(records, key(1, "|2024")), "classification")).toEqual(["NACE:41.10"]);
    expect(values(find(records, key(1, "|2023")), "classification")).toEqual([]);
    expect(values(find(records, key(23, "|2024")), "classification")).toEqual(["NACE:46.90"]);
    expect(find(records, key(1, "|2024"))!.entities[0]!.statements[0]!.itemId).toBe("S01.LV.01");
  });

  it("counts a placeholder NACE as bad_nace, with no statement, and a bad year as bad_period", async () => {
    const { records, drops } = await parseAll(lvVidTaxesYearly, yearly());
    const logistics = find(records, key(2, "|2024"))!;
    expect(values(logistics, "classification")).toEqual([]);
    expect(logistics.dropped).toEqual([{ reason: "bad_nace", prop: "classification" }]);
    expect(find(records, key(2, "|2023"))!.dropped).toBeUndefined();
    expect(drops).toEqual(["bad_period"]);
  });

  it("dates the file by its newest year's end", () => {
    expect(lvVidTaxesYearly.asOf(yearly()).max_date_in_data).toBe("2024-12-31");
  });
});

describe("lv-vid-rating (lv-tax.md)", () => {
  it("states the rating letter on the register entity, keyed on the code", async () => {
    const { records } = await parseAll(lvVidRating, rating());
    expect(records.map((r) => values(r, "finora:taxAuthorityRating")[0])).toEqual(["A", "B", "C", "N", "J", "X", "B"]);
    const debtor = find(records, key(22))!;
    expect(debtor.entities).toEqual([{ eid: `lv-${lvFx(22).code}`, schema: "Company", country: "lv", code: lvFx(22).code, ref: true, statements: [{ prop: "finora:taxAuthorityRating", value: "C", itemId: "S08.LV.01" }] }]);
  });

  it("keeps an unknown letter, counted", async () => {
    const { records } = await parseAll(lvVidRating, rating());
    expect(find(records, key(3))!.dropped).toEqual([{ reason: "unknown_enum", prop: "finora:taxAuthorityRating" }]);
    expect(records.filter((r) => r.dropped)).toHaveLength(1);
  });

  it("takes the as-of from the stated update date, an in-file field", () => {
    expect(lvVidRating.asOf(rating())).toMatchObject({ in_file_field: "2026-11-11" });
    expect(lvVidRating.meta.asOf[0]).toBe("in_file_field");
  });
});

describe("lv-vid-vat-payers (lv-tax.md)", () => {
  it("merges the rows of one number: active if any row is", async () => {
    const { records } = await parseAll(lvVidVatPayers, vat());
    const exporter = records.filter((r) => r.recordKey === `LV${lvFx(23).code}`);
    expect(exporter).toHaveLength(1);
    expect(values(exporter[0], "vatCode")).toEqual([`LV${lvFx(23).code}`]);
    expect(values(exporter[0], "finora:vatRegistered")).toEqual(["yes"]);
    expect(exporter[0]!.hashInput).toEqual(["nav", "01.03.2012", "30.06.2015", "ir", "01.07.2016", ""]);
  });

  it("gives an inactive number no vatCode, only 'no'", async () => {
    const { records } = await parseAll(lvVidVatPayers, vat());
    const logistics = find(records, `LV${lvFx(2).code}`)!;
    expect(values(logistics, "vatCode")).toEqual([]);
    expect(values(logistics, "finora:vatRegistered")).toEqual(["no"]);
  });

  it("states a sole trader's number like any other on its register entity, for the gate to drop (yes / no stays)", async () => {
    const { records } = await parseAll(lvVidVatPayers, vat());
    const sole = find(records, `LV${lvFx(4).code}`)!;
    expect(sole.entities[0]).toMatchObject({ eid: `lv-${lvFx(4).code}`, ref: true });
    expect(values(sole, "finora:vatRegistered")).toEqual(["yes"]);
  });

  it("drops a number that embeds a personal code before it becomes a key, counted", async () => {
    const { records, drops } = await parseAll(lvVidVatPayers, vat());
    expect(drops).toEqual(["natural_person_vat"]);
    expect(records.some((r) => r.recordKey === LV_VID_PERSON_VAT || r.hashInput.join().includes(LV_VID_PERSON_VAT.slice(2)))).toBe(false);
    expect(records).toHaveLength(5);
  });

  it("reads space-padded dates and ignores removal dates in the future for the as-of", () => {
    expect(dmyDate(" 30.06.2015 ")).toBe("2015-06-30");
    expect(dmyDate("  ")).toBeNull();
    expect(lvVidVatPayers.asOf(vat()).max_date_in_data).toBe("2026-11-19");
  });
});

describe("lv-vid-suspensions (lv-tax.md)", () => {
  it("strips the single quotes around codes and writes the suspension event", async () => {
    const { records } = await parseAll(lvVidSuspensions, suspensions());
    const open = find(records, key(24, "|2026-10-10"))!;
    expect(open.events).toEqual([{ entityEid: `lv-${lvFx(24).code}`, type: "register.suspension", date: "2026-10-10", itemId: "S09.LV.01", data: { authority: "vid", bannedFrom: "2026-10-11", bannedUntil: null, restoredOn: null } }]);
    expect(open.entities[0]).toMatchObject({ eid: `lv-${lvFx(24).code}`, code: lvFx(24).code, ref: true });
  });

  it("carries what tells open, restored and expired apart (the domain rule decides)", async () => {
    const { records } = await parseAll(lvVidSuspensions, suspensions());
    const data = (n: number, date: string) => find(records, key(n, `|${date}`))!.events![0]!.data;
    expect(data(1, "2024-02-01")).toMatchObject({ restoredOn: "2024-06-01", bannedUntil: null });
    expect(data(2, "2025-01-01")).toMatchObject({ bannedFrom: "2025-01-02", bannedUntil: "2025-03-01", restoredOn: null });
    expect(data(24, "2026-10-10")).toMatchObject({ bannedUntil: null, restoredOn: null });
  });

  it("skips a decision date that does not parse, counted", async () => {
    const { records, drops } = await parseAll(lvVidSuspensions, suspensions());
    expect(drops).toEqual(["bad_date"]);
    expect(records).toHaveLength(4);
    expect(lvVidSuspensions.asOf(suspensions()).max_date_in_data).toBe("2026-10-10");
    expect(lvVidSuspensions.meta.cadence).toBe("daily");
  });
});

describe("the VID sources", () => {
  it("pass the field-map and licence invariants, on the official hosts", () => {
    for (const loader of LV_TAX_LOADERS) {
      expect(checkFieldMap(loader.meta.id, loader.fieldMap), loader.meta.id).toEqual([]);
      expect(checkSource(loader.meta, loader.fieldMap, ["data.gov.lv"]), loader.meta.id).toEqual([]);
    }
  });

  it("fail schema_changed on a missing column", async () => {
    const missing = lvCsv(["Registracijas_kods", "Nosaukums", "Reitings"], [[lvFx(1).code, "x", "A"]], { separator: ",", quoteAll: true });
    await expect(parseAll(lvVidRating, [art("reitings_uznemumi.csv", missing)])).rejects.toMatchObject({ name: "schema_changed" });
  });

  it("write a key per row once, counting a repeated one", async () => {
    const text = new TextDecoder().decode(lvVidRatingCsv());
    const line = text.split("\r\n")[1]!;
    const { records, drops } = await parseAll(lvVidRating, [art("reitings_uznemumi.csv", new TextEncoder().encode(`${text}${line}\r\n`))]);
    expect(drops).toEqual(["duplicate_key"]);
    expect(records).toHaveLength(7);
  });
});
