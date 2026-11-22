// SEC-2 and SEC-8 of the S05 security review, with legal's required SHOULDs: an enum column could
// carry free text, a name included, so the LV loaders store only values from closed sets; a line id
// shaped like a personal code is nulled and counted; rejected codes are never hashed.
import { isBalticPersonalCode } from "@finora/domain";
import { describe, expect, it } from "vitest";
import { parseAll } from "../intl/sanctions-test-helpers.ts";
import type { RawArtifact } from "../types.ts";
import { lvCsv } from "./fixture-csv.ts";
import { lvFx } from "./fixture-world.ts";
import { lvMembersCsv, lvOfficersCsv } from "./lv-people/fixture.ts";
import { lvUrMembers, lvUrOfficers, lvUrOfficersLoader } from "./lv-people/lv-people.ts";
import { LV_INSOLVENCY_HEADER, LV_SANCTIONS_HEADER, LV_SECURING_HEADER, LV_SUSPENSIONS_HEADER } from "./lv-risk/fixture.ts";
import { lvUrInsolvency, lvUrSanctionsLinks, lvUrSecuringMeasures, lvUrSuspensions } from "./lv-risk/lv-risk.ts";
import { lvUrLiquidations, lvUrReorganizations } from "./lv-ur-register/lv-ur-register.ts";

/** A fictional name placed in every enum column: it must never survive a parse. */
const NAME = "Test Person Canary";
const art = (name: string, bytes: Uint8Array): RawArtifact => ({ name, bytes, fetchedAt: "2026-11-21T00:00:00Z" });
/** An 11-digit row id that passes the EE/LT personal-code check. */
const CODE_ID = (() => {
  for (let i = 0; ; i++) {
    const id = `3900101${String(i).padStart(4, "0")}`;
    if (isBalticPersonalCode(id)) return Number(id);
  }
})();

describe("lv-ur-officers and members store closed sets only", () => {
  const rows = [
    { id: 5001, n: 1, position: NAME, body: NAME, name: "Test Person Q1", rights: NAME, registered: "2020-01-01" },
    { id: 5002, n: 1, position: "BOARD_MEMBER", body: "EXECUTIVE_BOARD", name: "Test Person Q2", rights: "WITH_AT_LEAST", atLeast: NAME, registered: "2020-01-01" },
    { id: CODE_ID, n: 1, position: "BOARD_MEMBER", body: "EXECUTIVE_BOARD", name: "Test Person Q3", rights: "INDIVIDUALLY/WITH_ALL", registered: "2020-01-01" },
  ];

  it("turns an unknown position into unspecified and drops an unknown body or signing right, counted", async () => {
    for (const loader of [lvUrOfficers, lvUrOfficersLoader({ personRows: "role_counts" })]) {
      const { records } = await parseAll(loader, [art("officers.csv", lvOfficersCsv(rows))]);
      const record = records[0]!;
      expect(JSON.stringify(record)).not.toContain("Canary");
      const props = (rel: string) => record.entities.filter((e) => e.eid === rel).flatMap((e) => e.statements).map((s) => [s.prop, s.value]);
      const rel = (pos: number) => `rel-1${lvFx(1).code}-${pos}`;
      expect(props(rel(1))).toEqual(expect.arrayContaining([["role", "unspecified"]]));
      expect(props(rel(1)).map(([p]) => p)).not.toContain("finora:governingBody");
      expect(props(rel(1)).map(([p]) => p)).not.toContain("finora:signingRights");
      expect(props(rel(2)).map(([p]) => p)).not.toContain("finora:signingRights");
      expect(props(rel(3))).toEqual(expect.arrayContaining([["finora:signingRights", "INDIVIDUALLY/WITH_ALL"]]));
      expect(record.dropped).toEqual(
        expect.arrayContaining([
          { reason: "unknown_enum", prop: "role" },
          { reason: "unknown_enum", prop: "finora:governingBody" },
          { reason: "unknown_enum", prop: "finora:signingRights" },
        ]),
      );
    }
  });

  it("nulls a line id shaped like a personal code, counted, and keeps it out of the hash", async () => {
    const { records } = await parseAll(lvUrOfficers, [art("officers.csv", lvOfficersCsv(rows))]);
    const record = records[0]!;
    expect(record.lineIds).toEqual(["5001", "5002", null]);
    expect(JSON.stringify(record)).not.toContain(String(CODE_ID));
    const members = await parseAll(lvUrMembers, [art("members.csv", lvMembersCsv([{ id: CODE_ID, n: 2, type: "FOREIGN_ENTITY", name: "Sample Holdings Ltd", shares: "5", nominal: "1.00" }]))]);
    expect(members.records[0]!.lineIds).toEqual([null]);
    expect(JSON.stringify(members.records)).not.toContain(String(CODE_ID));
    expect(members.records[0]!.dropped).toContainEqual({ reason: "personal_code" });
  });

  it("stores a share value only with an ISO 4217 currency or LVL", async () => {
    const { records } = await parseAll(lvUrMembers, [
      art("members.csv", lvMembersCsv([
        { id: 6001, n: 2, type: "FOREIGN_ENTITY", name: "Sample Holdings Ltd", shares: "5", nominal: "1.00", currency: NAME },
        { id: 6002, n: 3, type: "FOREIGN_ENTITY", name: "Sample Trading LLC", shares: "5", nominal: "1.00", currency: "LVL" },
      ])),
    ]);
    expect(JSON.stringify(records)).not.toContain("Canary");
    const shares = (n: number) => records.find((r) => r.recordKey === `lv-${lvFx(n).code}|members`)!.parties!.flatMap((p) => p.entities).flatMap((e) => e.statements).filter((s) => s.prop === "sharesValue").map((s) => s.value);
    expect(shares(2)).toEqual([]);
    expect(shares(3)).toEqual(["1 LVL"]);
  });
});

describe("LV event data stores closed sets and case-number shapes only", () => {
  it("writes unspecified for an unknown liquidation, reorganisation, securing, suspension or sanctions kind", async () => {
    const liquidations = lvCsv(["id", "legal_entity_registration_number", "liquidation_type", "liquidation_type_text", "date_from", "grounds_for_liquidation", "registered_on", "last_modified_at"], [["7101", lvFx(18).code, NAME, "", "2026-09-01", "", "2026-09-02", "2026-09-02T10:00:00"]]);
    const reorganisations = lvCsv(["id", "reorganization_type", "reorganization_type_text", "source_entity_regcode", "final_entity_regcode", "registered"], [["8101", NAME, "", lvFx(7).code, lvFx(1).code, "2021-06-06"]]);
    const securing = lvCsv(LV_SECURING_HEADER, [["6201", lvFx(22).code, NAME, "", "", "2026-11-17", NAME, "", "", ""]]);
    const suspensions = lvCsv(LV_SUSPENSIONS_HEADER, [["7201", lvFx(24).code, NAME, "", "2026-11-17", ""]]);
    const sanctionRow = LV_SANCTIONS_HEADER.map((h) => ({ id: "9101", registered_on: "2022-04-08", entity_type: "FOREIGN_ENTITY", legal_entity_name: "Sample Trading LLC", legal_entity_country: NAME, position: NAME, list: NAME, sanctions_subject_registration_number: lvFx(1).code, entry_date: "2022-04-08" })[h as "id"] ?? "");
    const sanctions = lvCsv(LV_SANCTIONS_HEADER, [sanctionRow]);
    const parsed = await Promise.all([
      parseAll(lvUrLiquidations, [art("liquidations.csv", liquidations)]),
      parseAll(lvUrReorganizations, [art("reorganizations.csv", reorganisations)]),
      parseAll(lvUrSecuringMeasures, [art("securing_measures.csv", securing)]),
      parseAll(lvUrSuspensions, [art("suspensions_prohibitions.csv", suspensions)]),
      parseAll(lvUrSanctionsLinks, [art("sanctions.csv", sanctions)]),
    ]);
    for (const { records } of parsed) {
      expect(records).toHaveLength(1);
      expect(JSON.stringify(records)).not.toContain("Canary");
    }
    const data = parsed.map(({ records }) => records[0]!.events?.[0]?.data ?? records[0]!.parties?.[0]?.events?.[0]?.data);
    expect(data.map((d) => d?.kind ?? d?.role)).toEqual(["unspecified", "unspecified", "unspecified", "unspecified", "unspecified"]);
    expect(data[2]?.case).toBeNull();
    expect(data[4]).toMatchObject({ list: "unspecified", partyCountry: null });
  });

  it("hashes only the checked reorganisation codes, never a rejected column value (SEC-8)", async () => {
    const rows = (final: string) => lvCsv(["id", "reorganization_type", "reorganization_type_text", "source_entity_regcode", "final_entity_regcode", "registered"], [["8201", "MERGER", "", lvFx(7).code, final, "2021-06-06"]]);
    const a = await parseAll(lvUrReorganizations, [art("reorganizations.csv", rows("rejected 1"))]);
    const b = await parseAll(lvUrReorganizations, [art("reorganizations.csv", rows("rejected 2"))]);
    expect(a.records[0]!.hashInput).toEqual(b.records[0]!.hashInput);
    expect(JSON.stringify(a.records[0]!.hashInput)).not.toContain("rejected");
  });
});

// The S05 security re-check (N1-N5): each field below once let a name through.
describe("names in id, case-number, court, programme and country columns are never stored", () => {
  const row = (header: readonly string[], values: Record<string, string>) => header.map((h) => values[h] ?? "");

  it("keeps only digit ids of up to 12 digits (N1), in both modes and in members", async () => {
    for (const loader of [lvUrOfficers, lvUrOfficersLoader({ personRows: "role_counts" })]) {
      const { records } = await parseAll(loader, [art("officers.csv", lvOfficersCsv([{ id: "Test Person Canary" as never, n: 1, position: "BOARD_MEMBER", name: "Test Person Q1", rights: "INDIVIDUALLY", registered: "2020-01-01" }, { id: 5003, n: 1, position: "BOARD_MEMBER", name: "Test Person Q2", rights: "INDIVIDUALLY", registered: "2020-01-01" }]))]);
      expect(JSON.stringify(records)).not.toContain("Canary");
      expect(records[0]!.lineIds).toEqual([null, "5003"]);
      expect(records[0]!.dropped).toContainEqual({ reason: "free_text" });
    }
    const members = await parseAll(lvUrMembers, [art("members.csv", lvMembersCsv([{ id: "TEST PERSON CANARY 1" as never, n: 2, type: "FOREIGN_ENTITY", name: "Sample Holdings Ltd", shares: "5", nominal: "1.00" }]))]);
    expect(members.records[0]!.lineIds).toEqual([null]);
    expect(JSON.stringify(members.records)).not.toContain("CANARY");
  });

  it("nulls an 11- or 12-digit id, so a personal code with a digit around it never passes (N1, qa 7083380788)", async () => {
    const wrapped = [`${CODE_ID}`, `7${CODE_ID}`, `${CODE_ID}7`];
    const officers = wrapped.map((id, i) => ({ id: id as never, n: 1, position: "BOARD_MEMBER", name: `Test Person W${i}`, rights: "INDIVIDUALLY", registered: "2020-01-01" }));
    const { records } = await parseAll(lvUrOfficers, [art("officers.csv", lvOfficersCsv([...officers, { id: 1234567890 as never, n: 1, position: "BOARD_MEMBER", name: "Test Person W9", rights: "INDIVIDUALLY", registered: "2020-01-01" }]))]);
    expect(records[0]!.lineIds).toEqual([null, null, null, "1234567890"]);
    expect(records[0]!.dropped?.filter((d) => d.reason === "personal_code").length).toBeGreaterThanOrEqual(3);
    const members = await parseAll(lvUrMembers, [art("members.csv", lvMembersCsv(wrapped.map((id) => ({ id: id as never, n: 2, type: "FOREIGN_ENTITY", name: "Sample Holdings Ltd", shares: "5", nominal: "1.00" }))))]);
    expect(members.records[0]!.lineIds).toEqual([null, null, null]);
    for (const id of wrapped) expect(JSON.stringify([...records, ...members.records])).not.toContain(id);
  });

  it("keeps a case number only with the known letter codes, so a capitalised name with a digit is dropped (N2)", async () => {
    const securing = (caseNo: string) => lvCsv(LV_SECURING_HEADER, [["6301", lvFx(22).code, "LIEN", "", "", "2026-11-17", caseNo, "", "", ""]]);
    for (const caseNo of ["TEST PERSON 1", "CANARY-12", "12345/123/2024-NOSX"]) {
      const { records } = await parseAll(lvUrSecuringMeasures, [art("securing_measures.csv", securing(caseNo))]);
      expect(records[0]!.events![0]!.data!.case, caseNo).toBeNull();
      expect(records[0]!.dropped).toContainEqual({ reason: "free_text", prop: "case_number" });
    }
    for (const caseNo of ["12345/123/2024-NOS", "11.1-2.13.1/L-1234", "C30-0001-26", "12.3/45.67.8/12345"]) {
      const { records } = await parseAll(lvUrSecuringMeasures, [art("securing_measures.csv", securing(caseNo))]);
      expect(records[0]!.events![0]!.data!.case, caseNo).toBe(caseNo);
    }
  });

  it("keeps a court only from the courts list and a programme only from the programme list (N3)", async () => {
    const insolvency = lvCsv(LV_INSOLVENCY_HEADER, [
      row(LV_INSOLVENCY_HEADER, { proceeding_id: "5101", debtor_registration_number: lvFx(17).code, proceeding_started_on: "2026-10-01", proceeding_form: "INSOLVENCY", proceeding_type: "NATIONAL", court_case_initial_number: "C30-0002-26", court_name: NAME }),
      row(LV_INSOLVENCY_HEADER, { proceeding_id: "5102", debtor_registration_number: lvFx(17).code, proceeding_started_on: "2026-10-02", proceeding_form: "INSOLVENCY", proceeding_type: "NATIONAL", court_name: "Liepājas tiesa" }),
    ]);
    const { records } = await parseAll(lvUrInsolvency, [art("insolvency_legal_person_proceeding.csv", insolvency)]);
    expect(JSON.stringify(records)).not.toContain("Canary");
    expect(records.map((r) => r.events![0]!.data!.court)).toEqual([null, "Liepājas tiesa"]);
    expect(records[0]!.dropped).toContainEqual({ reason: "unknown_enum", prop: "court_name" });
    const link = (program: string, country: string) =>
      lvCsv(LV_SANCTIONS_HEADER, [row(LV_SANCTIONS_HEADER, { id: "9201", registered_on: "2022-04-08", entity_type: "FOREIGN_ENTITY", legal_entity_name: "Sample Trading LLC", legal_entity_country: country, position: "FOUNDER", list: "ES_SANCTIONS", program, sanctions_subject_registration_number: lvFx(1).code, entry_date: "2022-04-08" })]);
    const named = await parseAll(lvUrSanctionsLinks, [art("sanctions.csv", link(NAME, "ZZ"))]);
    expect(JSON.stringify(named.records)).not.toContain("Canary");
    const data = named.records[0]!.parties![0]!.events![0]!.data!;
    // N5: "zz" has the shape of a country code but is not an ISO 3166-1 code.
    expect([data.programme, data.partyCountry]).toEqual(["unspecified", null]);
    const known = await parseAll(lvUrSanctionsLinks, [art("sanctions.csv", link("RUSSIA-EO14024", "GB"))]);
    expect(known.records[0]!.parties![0]!.events![0]!.data).toMatchObject({ programme: "RUSSIA-EO14024", partyCountry: "gb" });
  });
});
