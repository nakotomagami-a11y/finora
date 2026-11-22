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
import { LV_SANCTIONS_HEADER, LV_SECURING_HEADER, LV_SUSPENSIONS_HEADER } from "./lv-risk/fixture.ts";
import { lvUrSanctionsLinks, lvUrSecuringMeasures, lvUrSuspensions } from "./lv-risk/lv-risk.ts";
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
