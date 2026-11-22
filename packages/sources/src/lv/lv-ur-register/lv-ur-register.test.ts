import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../../field-maps.ts";
import { parseAll, values } from "../../intl/sanctions-test-helpers.ts";
import type { RawArtifact } from "../../types.ts";
import { lvCsv } from "../fixture-csv.ts";
import { LV_FX, lvFx } from "../fixture-world.ts";
import { LV_REGISTER_HEADER, lvEquityCapitalsCsv, lvLiquidationsCsv, lvMemorandumCsv, lvNameHistoryCsv, lvRegisterCsv, lvReorganizationsCsv } from "./fixture.ts";
import { lvStatus, lvUrEquityCapitals, lvUrLiquidations, lvUrMemorandumDates, lvUrNameHistory, lvUrRegister, lvUrReorganizations } from "./lv-ur-register.ts";

const art = (name: string, bytes: Uint8Array, extra: Partial<RawArtifact> = {}): RawArtifact => ({ name, bytes, fetchedAt: "2026-11-21T00:00:00Z", ...extra });
const portal = (lastModified: string) => art("resource.json", new TextEncoder().encode(JSON.stringify({ lastModified })));
const byCode = <T extends { recordKey: string }>(records: T[], n: number) => records.find((r) => r.recordKey === lvFx(n).code);

describe("lv-ur-register (lv-register.md)", () => {
  it("maps a company row to its statements and items, and keeps the postal code", async () => {
    const { records } = await parseAll(lvUrRegister, [art("register.csv", lvRegisterCsv())]);
    const timber = byCode(records, 1)!;
    const entity = timber.entities[0]!;
    expect(entity).toMatchObject({ eid: `lv-${lvFx(1).code}`, schema: "Company", country: "lv", legalForm: "lv-sia", status: "active", code: lvFx(1).code });
    expect(values(timber, "name")).toEqual(['SIA "Example Timber"']);
    expect(values(timber, "address")).toEqual(["1 Example iela, Fixture Town, LV-1001"]);
    expect(values(timber, "finora:addressId")).toEqual(["900001"]);
    expect(entity.statements.find((s) => s.prop === "finora:addressId")?.itemId).toBe("S17.LV.01");
    expect(entity.statements.find((s) => s.prop === "status")).toEqual({ prop: "status", value: "active", itemId: "S02.LV.01" });
    expect(values(byCode(records, 3), "address")).toEqual(["3 Example iela, Fixture Town"]);
  });

  it("reads no column outside the field map", async () => {
    const { records } = await parseAll(lvUrRegister, [art("register.csv", lvRegisterCsv())]);
    const props = new Set(records.flatMap((r) => r.entities.flatMap((e) => e.statements.map((s) => s.prop))));
    expect([...props].sort()).toEqual(["address", "country", "dissolutionDate", "finora:addressId", "incorporationDate", "legalForm", "name", "registrationNumber", "status"]);
  });

  it("skips legacy and invalid codes and the media register, counted", async () => {
    const { records, drops } = await parseAll(lvUrRegister, [art("register.csv", lvRegisterCsv())]);
    expect(drops.sort()).toEqual(["invalid_code", "legacy_code", "no_item"]);
    expect(byCode(records, 15)).toBeUndefined();
  });

  it("maps closed and terminated to a status, and gives ended entities identity only", async () => {
    expect([lvStatus("L", ""), lvStatus("R", "2021-01-01"), lvStatus("", "2019-04-04"), lvStatus("", "")]).toEqual(["struck_off", "reorganised", "struck_off", "active"]);
    const { records } = await parseAll(lvUrRegister, [art("register.csv", lvRegisterCsv())]);
    for (const n of [6, 7, 8]) {
      const props = byCode(records, n)!.entities[0]!.statements.map((s) => s.prop).sort();
      expect(props).toEqual(["dissolutionDate", "incorporationDate", "legalForm", "name", "registrationNumber", "status"]);
    }
    expect(byCode(records, 7)!.entities[0]!.status).toBe("reorganised");
  });

  it("gives a natural-person form no address text and no address id, only the country", async () => {
    const { records } = await parseAll(lvUrRegister, [art("register.csv", lvRegisterCsv())]);
    for (const n of [4, 9, 10]) {
      const r = byCode(records, n)!;
      expect(values(r, "address")).toEqual([]);
      expect(values(r, "finora:addressId")).toEqual([]);
      expect(values(r, "country")).toEqual(["lv"]);
      expect(r.dropped).toEqual([{ reason: "natural_person_address", prop: "address" }]);
    }
    expect(byCode(records, 9)!.entities[0]!.legalForm).toBe("lv-zem");
  });

  it("counts an unknown legal form and maps every register type to a schema", async () => {
    const { records } = await parseAll(lvUrRegister, [art("register.csv", lvRegisterCsv())]);
    // An unknown form is over-protected as a natural person (domain rule): no address either.
    expect(byCode(records, 16)!.dropped).toEqual([
      { reason: "unknown_legal_form", prop: "legalForm" },
      { reason: "natural_person_address", prop: "address" },
    ]);
    expect(byCode(records, 13)!.entities[0]!.schema).toBe("LegalEntity");
    expect(byCode(records, 14)!.entities[0]!.schema).toBe("Organization");
  });

  it("fails schema_changed on a missing column and tolerates an extra one", async () => {
    const missing = lvCsv(LV_REGISTER_HEADER.filter((h) => h !== "closed"), [["x"]]);
    await expect(parseAll(lvUrRegister, [art("register.csv", missing)])).rejects.toMatchObject({ name: "schema_changed" });
    const extra = lvCsv([...LV_REGISTER_HEADER, "new_column"], [[lvFx(1).code, "", "SIA \"X\"", "", "", "", "", "K", "", "SIA", "", "2010-01-01", "", "", "1 iela", "", "", "", "", "", "", "z"]]);
    expect((await parseAll(lvUrRegister, [art("register.csv", extra)])).records).toHaveLength(1);
  });

  it("dates the file by its latest registration or termination, ignoring future dates", () => {
    const future = lvCsv(LV_REGISTER_HEADER, [[lvFx(1).code, "", "x", "", "", "", "", "K", "", "SIA", "", "2099-01-01", "", "", "", "", "", "", "", "", ""]]);
    const latest = [...LV_FX.flatMap((c) => [c.registered, c.terminated]), "2015-01-01"].filter(Boolean).sort().at(-1);
    expect(lvUrRegister.asOf([art("register.csv", lvRegisterCsv()), portal("2026-11-18T21:25:00")])).toEqual({ max_date_in_data: latest, portal_metadata: "2026-11-18", http_last_modified: null });
    expect(lvUrRegister.asOf([art("register.csv", future)]).max_date_in_data).toBeNull();
  });

  it("has a field map with SHOW and CAVEAT targets only", () => {
    for (const l of [lvUrRegister, lvUrNameHistory, lvUrLiquidations, lvUrReorganizations, lvUrEquityCapitals, lvUrMemorandumDates]) expect(checkFieldMap(l.meta.id, l.fieldMap)).toEqual([]);
  });
});

describe("lv-ur-name-history", () => {
  it("attaches former names to the register entity, by reference, with a stable key", async () => {
    const { records, drops } = await parseAll(lvUrNameHistory, [art("register_name_history.csv", lvNameHistoryCsv())]);
    const renamed = records.filter((r) => r.recordKey.startsWith(lvFx(19).code));
    expect(renamed.map((r) => values(r, "previousName")[0])).toEqual(['SIA "Example Oldname"', 'SIA "Example Middlename"']);
    expect(renamed[0]!.entities[0]).toMatchObject({ ref: true, eid: `lv-${lvFx(19).code}` });
    expect(drops).toEqual(["invalid_record"]);
    const again = await parseAll(lvUrNameHistory, [art("register_name_history.csv", lvNameHistoryCsv())]);
    expect(again.records.map((r) => r.recordKey)).toEqual(records.map((r) => r.recordKey));
  });
});

describe("lv-ur-liquidations, reorganisations and memorandum dates", () => {
  it("writes a liquidation event and drops the free-text grounds", async () => {
    const { records } = await parseAll(lvUrLiquidations, [art("liquidations.csv", lvLiquidationsCsv())]);
    expect(records[0]!.events).toEqual([{ entityEid: `lv-${lvFx(18).code}`, type: "register.liquidation", date: "2026-09-01", itemId: "S02.LV.01", data: { kind: "LIQUIDATION" } }]);
    expect(records[0]!.dropped).toEqual([{ reason: "free_text", prop: "grounds_for_liquidation" }]);
    expect(JSON.stringify(records)).not.toContain("sapulces");
    expect(JSON.stringify(records)).not.toContain("Test Person S");
    expect(records[1]!.dropped).toContainEqual({ reason: "free_text", prop: "grounds_for_liquidation" });
    expect(records[2]!.dropped).toContainEqual({ reason: "unknown_enum", prop: "liquidation_type" });
  });

  it("writes a reorganisation on both sides, or on the one side that resolves", async () => {
    const { records } = await parseAll(lvUrReorganizations, [art("reorganizations.csv", lvReorganizationsCsv())]);
    expect(records[0]!.events?.map((e) => e.data)).toEqual([
      { kind: "MERGER", role: "source", other: `lv-${lvFx(1).code}` },
      { kind: "MERGER", role: "final", other: `lv-${lvFx(7).code}` },
    ]);
    expect(records[1]!.events).toEqual([{ entityEid: `lv-${lvFx(2).code}`, type: "register.reorganisation", date: "2026-11-21", itemId: "S02.LV.01", data: { kind: "ACQUISITION", role: "source", other: null, date_estimated: 1 } }]);
  });

  it("falls back to the registration date for a typo year, and counts a row with no code", async () => {
    const { records, drops } = await parseAll(lvUrMemorandumDates, [art("memorandum_date.csv", lvMemorandumCsv())]);
    expect(records[1]!.events?.[0]).toMatchObject({ type: "filing.founding_document", date: "2011-03-04", itemId: "S13.LV.01", data: { registered_on: "2011-03-04", date_from_registration: 1 } });
    expect(drops).toEqual(["no_code"]);
  });
});

describe("lv-ur-equity-capitals", () => {
  it("keeps paid-up over registered, the latest date per company, and LVL as LVL", async () => {
    const { records, drops } = await parseAll(lvUrEquityCapitals, [art("equity_capitals.csv", lvEquityCapitalsCsv())]);
    expect(values(byCode(records, 1), "capital")).toEqual(["2800.00 EUR"]);
    expect(values(byCode(records, 2), "capital")).toEqual(["2000.00 LVL"]);
    expect(drops).toEqual(["no_item"]);
    expect(byCode(records, 1)!.entities[0]!.ref).toBe(true);
  });
});
