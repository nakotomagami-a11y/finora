import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../../field-maps.ts";
import { checkSource } from "../../licences.ts";
import { parseAll } from "../../intl/sanctions-test-helpers.ts";
import type { ParsedRecord, RawArtifact } from "../../types.ts";
import { lvCsv } from "../fixture-csv.ts";
import { lvFx } from "../fixture-world.ts";
import { LV_INSOLVENCY_HEADER, LV_RISK_AUTHORITY_CODE, LV_RISK_CANARIES, LV_RISK_UNKNOWN_CODE, lvInsolvencyCsv, lvRiskMaskedCode, lvSanctionsLinksCsv, lvSecuringMeasuresCsv, lvSuspensionsCsv } from "./fixture.ts";
import { companyForm, LV_RISK_LOADERS, lvUrInsolvency, lvUrSanctionsLinks, lvUrSecuringMeasures, lvUrSuspensions } from "./lv-risk.ts";

const art = (name: string, bytes: Uint8Array): RawArtifact => ({ name, bytes, fetchedAt: "2026-11-21T00:00:00Z" });
const byKey = (records: ParsedRecord[], key: string) => records.find((r) => r.recordKey === key)!;
const eid = (n: number) => `lv-${lvFx(n).code}`;
const noCanary = (records: ParsedRecord[]) => {
  const text = JSON.stringify(records);
  for (const value of [...Object.values(LV_RISK_CANARIES), lvRiskMaskedCode()]) expect(text).not.toContain(value);
};

describe("lv-ur-insolvency (lv-risk.md)", () => {
  const parse = () => parseAll(lvUrInsolvency, [art("insolvency_legal_person_proceeding.csv", lvInsolvencyCsv())]);

  it("writes an opened event, and a closed event only when the proceeding ended", async () => {
    const { records } = await parse();
    expect(byKey(records, "5001").events).toEqual([
      { entityEid: eid(17), type: "register.insolvency_opened", date: "2026-10-01", itemId: "S09.LV.01", data: { form: "INSOLVENCY", scope: "NATIONAL", subtype: null, courtCase: "C30-0001-26", court: "Fixture District Court" } },
    ]);
    expect(byKey(records, "5002").events?.[1]).toEqual({ entityEid: eid(6), type: "register.insolvency_closed", date: "2019-04-04", itemId: "S09.LV.01", data: { form: "INSOLVENCY", scope: "NATIONAL", subtype: null, resolution: "M06" } });
    expect(byKey(records, "5006").events?.[0]?.data).toMatchObject({ scope: "CROSS_BORDER", subtype: "MAIN" });
    expect(byKey(records, "5003").events?.map((e) => e.data?.form)).toEqual(["LEGAL_PROTECTION"]);
  });

  it("never creates an entity; a sole trader's row is left to the gate, which drops S09 on it", async () => {
    const { records } = await parse();
    for (const r of records) expect(r.entities).toEqual([]);
    expect(byKey(records, "5005").events?.[0]?.entityEid).toBe(eid(4));
  });

  it("keeps an unknown form, counted; counts a row with no code; reads no unread column", async () => {
    const { records, drops } = await parse();
    expect(byKey(records, "5007").dropped).toEqual([{ reason: "unknown_enum", prop: "proceeding_form" }]);
    expect(drops).toEqual(["no_code"]);
    const text = JSON.stringify(records);
    for (const unread of ["Debtor Name", "debtor name", LV_RISK_CANARIES.debtorAddress, "Lietas izbeigšana", "C01", "L-1"]) expect(text).not.toContain(unread);
  });

  it("dates the file by its latest entry, and fails schema_changed on a missing column", async () => {
    expect(lvUrInsolvency.asOf([art("insolvency_legal_person_proceeding.csv", lvInsolvencyCsv())]).max_date_in_data).toBe("2026-10-01");
    const missing = lvCsv(LV_INSOLVENCY_HEADER.filter((h) => h !== "proceeding_form"), [["1"]]);
    await expect(parseAll(lvUrInsolvency, [art("insolvency_legal_person_proceeding.csv", missing)])).rejects.toMatchObject({ name: "schema_changed" });
  });
});

describe("lv-ur-securing-measures (lv-risk.md)", () => {
  const parse = () => parseAll(lvUrSecuringMeasures, [art("securing_measures.csv", lvSecuringMeasuresCsv())]);

  it("writes one event per type, unspecified for an empty type", async () => {
    const { records } = await parse();
    expect(records.map((r) => r.events?.[0]?.data?.kind)).toEqual(["PROHIBITION", "LIEN", "ATTACHMENT", "unspecified", "PROHIBITION", "LIEN"]);
    expect(byKey(records, "6101").events).toEqual([{ entityEid: eid(22), type: "register.securing_measure", date: "2026-11-17", itemId: "S09.LV.01", data: { kind: "PROHIBITION", case: "11-0001-26", authorityCode: null } }]);
  });

  it("drops the bailiff's name and the type details as free text, and links only a checked authority code", async () => {
    const { records } = await parse();
    noCanary(records);
    expect(byKey(records, "6102").dropped).toEqual([
      { reason: "free_text", prop: "institution_name" },
      { reason: "free_text", prop: "type_details" },
    ]);
    expect(byKey(records, "6103").events?.[0]?.data?.authorityCode).toBe(LV_RISK_AUTHORITY_CODE);
    expect(byKey(records, "6107").events?.[0]?.data?.authorityCode).toBeNull();
  });

  it("counts an empty code, and leaves a sole trader's row to the gate", async () => {
    const { records, drops } = await parse();
    expect(drops).toEqual(["no_code"]);
    expect(byKey(records, "6106").events?.[0]?.entityEid).toBe(eid(4));
    expect(records.every((r) => r.entities.length === 0)).toBe(true);
  });
});

describe("lv-ur-suspensions (lv-risk.md)", () => {
  it("writes one event per code with the register as authority, and drops the ground", async () => {
    const { records } = await parseAll(lvUrSuspensions, [art("suspensions_prohibitions.csv", lvSuspensionsCsv())]);
    expect(records.map((r) => r.events?.[0]?.data)).toEqual([
      { kind: "ECONOMIC_ACTIVITY_SUSPENDED", authority: "ur" },
      { kind: "ACTIVITY_SUSPENDED", authority: "ur" },
      { kind: "PROHIBITION_ON_PUBLIC_ACTIVITY", authority: "ur" },
      { kind: "ECONOMIC_ACTIVITY_SUSPENDED", authority: "ur" },
    ]);
    expect(byKey(records, "7101").dropped).toEqual([{ reason: "free_text", prop: "ground_for" }]);
    noCanary(records);
  });
});

describe("lv-ur-sanctions-links (lv-risk.md)", () => {
  const parse = () => parseAll(lvUrSanctionsLinks, [art("sanctions.csv", lvSanctionsLinksCsv())]);
  const linkOf = (records: ParsedRecord[], key: string) => byKey(records, key).parties![0]!.events![0]!;

  it("keeps only the type and role of a natural-person party: no name, nationality, birth date or code anywhere", async () => {
    const { records } = await parse();
    noCanary(records);
    const link = linkOf(records, "8101");
    expect(link).toEqual({
      entityEid: eid(1),
      type: "register.sanctions_link",
      date: "2022-04-08",
      itemId: "S11.LV.01",
      data: { role: "BENEFICIAL_OWNER", partyType: "person", party: null, partyName: null, partyCountry: null, list: "ES_SANCTIONS", programme: "UKR", legalBaseUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014R0269", registeredOn: "2026-10-20" },
    });
    expect(byKey(records, "8101").dropped).toEqual([{ reason: "natural_person_party" }, { reason: "natural_person_party" }, { reason: "personal_code" }, { reason: "personal_code" }]);
    for (const r of records) for (const h of r.hashInput) expect(h).not.toContain(LV_RISK_CANARIES.sanctionedPerson);
  });

  it("loads every link only through the party gate on its subject, and never creates an entity", async () => {
    const { records, drops } = await parse();
    for (const r of records) {
      expect(r.entities).toEqual([]);
      expect(r.events).toBeUndefined();
      expect(r.parties).toHaveLength(1);
      expect(r.parties![0]!.type).toBeUndefined();
    }
    expect(byKey(records, "8105").parties![0]!.code).toEqual({ country: "lv", value: lvFx(4).code });
    expect(byKey(records, "8107").parties![0]!.code).toEqual({ country: "lv", value: LV_RISK_UNKNOWN_CODE });
    expect(drops).toEqual(["no_code"]);
  });

  it("links a company party by its code, keeps a foreign party's name and country, and never names an NP-form party", async () => {
    const { records } = await parse();
    expect(linkOf(records, "8102").data).toMatchObject({ role: "SHAREHOLDER", partyType: "company", party: eid(1), partyName: null, list: "SDN_OFAC_SANCTIONS" });
    expect(linkOf(records, "8103").data).toMatchObject({ role: "FOUNDER", partyType: "foreign_company", party: null, partyName: "Sample Trading LLC", partyCountry: "ru", list: "LV_SANCTIONS" });
    expect(linkOf(records, "8104").data).toMatchObject({ role: "unspecified", partyType: "company", party: null, partyName: null, partyCountry: null });
    expect(byKey(records, "8104").dropped).toEqual([{ reason: "natural_person_party" }]);
    expect(JSON.stringify(records)).not.toContain("IK Test Person A");
  });

  it("keeps a legal-base link only on an official journal's host", async () => {
    const { records } = await parse();
    expect(linkOf(records, "8103").data?.legalBaseUrl).toBeNull();
    expect(byKey(records, "8103").dropped).toEqual([{ reason: "link_host", prop: "sourceUrl" }]);
    expect(JSON.stringify(records)).not.toContain("mirror.example.com");
  });

  it("reads the register's form code fail-closed", () => {
    expect([companyForm("LIMITED_LIABILITY_COMPANY_SIA"), companyForm("SOLE_TRADER_IK"), companyForm(""), companyForm("SOMETHING_XYZ")]).toEqual([true, false, false, false]);
  });
});

describe("the lv-risk sources", () => {
  it("pass the licence and field-map checks, in load order", () => {
    expect(LV_RISK_LOADERS.map((l) => l.meta.id)).toEqual(["lv-ur-insolvency", "lv-ur-securing-measures", "lv-ur-suspensions", "lv-ur-sanctions-links"]);
    for (const l of LV_RISK_LOADERS) {
      expect(checkFieldMap(l.meta.id, l.fieldMap)).toEqual([]);
      expect(checkSource(l.meta, l.fieldMap, ["data.gov.lv"])).toEqual([]);
    }
  });
});
