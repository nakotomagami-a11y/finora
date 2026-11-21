import { balticCheckDigit, isBalticPersonalCode } from "@finora/domain";
import type { ParsedRecord } from "@finora/sources";
import { describe, expect, it } from "vitest";
import { companyRecord, fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, sync } from "./test-helpers.ts";

/** A sole trader with everything a register file may carry about it. */
function soleTrader(country: "lv" | "ee" | "lt" | "us", form: string, id: string, rowRef = "row-77"): ParsedRecord {
  const eid = `${country}-st-${rowRef}`;
  const c = country.toUpperCase();
  const s01 = country === "us" ? "S01.US.02" : `S01.${c}.01`;
  return {
    recordKey: eid,
    rowRef,
    hashInput: [eid, id],
    entities: [
      {
        eid,
        schema: "Company",
        country,
        legalForm: form,
        code: rowRef,
        statements: [
          { prop: "name", value: "Sample Trader", itemId: s01 },
          { prop: "registrationNumber", value: id, itemId: s01 },
          { prop: "address", value: "Example street 1, Example town", itemId: s01 },
          { prop: "vatCode", value: "LV000", itemId: s01 },
        ],
      },
    ],
    reports: country === "us" ? [] : [{ entityEid: eid, kind: "tax", periodEnd: "2026-09-30", itemId: country === "ee" ? "S08.EE.01a" : `S08.${c}.01`, facts: [{ concept: "tax_arrears", value: 120 }] }],
    events: country === "us" ? [] : [{ entityEid: eid, type: "register.insolvency", date: "2026-10-01", itemId: `S09.${c}.01` }],
  };
}

/** An LV register code (first digit 4) that also passes the EE/LT personal-code check. */
function lvCodeFittingEeLt(): string {
  for (let i = 0; i < 1000; i++) {
    const first10 = `4${String(i).padStart(3, "0")}010100`;
    const code = `${first10}${balticCheckDigit(first10)}`;
    if (isBalticPersonalCode(code)) return code;
  }
  throw new Error("no candidate");
}

const eeLtCode = () => {
  const first10 = ["3000", "1010", "00"].join("");
  return `${first10}${balticCheckDigit(first10)}`;
};

describe("natural-person load rules (rule 5; Part H 7-9; LAW-SOLE-ADDRESS, LAW-SECURING-SOLE, LAW-PERSON-INSOLVENCY)", () => {
  it("keeps a sole trader's name and id, drops its address, VAT, tax lines and insolvency, and counts each", async () => {
    const db = memoryDb();
    const loader = fakeSource({ id: "lv-register" }, { records: [soleTrader("lv", "lv-ik", "40003000007")] });
    const outcome = await sync(db, loader);
    expect(outcome.report?.dropped).toEqual({ sole_trader_address: 1, sole_trader_vat: 1, natural_person_tax: 1, natural_person_insolvency: 1 });
    const props = (db.prepare("SELECT p.name FROM main.statements st JOIN main.props p ON p.id = st.prop_id ORDER BY p.name").all() as { name: string }[]).map((r) => r.name);
    expect(props).toEqual(["name", "registrationNumber"]);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.fact_reports")).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.events")).toBe(0);
  });

  it("leaves a company's address, VAT, tax lines and insolvency alone", async () => {
    const db = memoryDb();
    const record = soleTrader("lv", "lv-sia", "40003000007");
    const outcome = await sync(db, fakeSource({ id: "lv-register" }, { records: [record] }));
    expect(outcome.report?.dropped).toEqual({});
    expect(count(db, "SELECT COUNT(*) AS n FROM main.fact_reports")).toBe(1);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.events")).toBe(1);
  });
});

describe("S04i acceptance 6: a refused sole-trader id is counted and withheld, never silent (legal 7058881476)", () => {
  it("LV: a register code that fits the EE/LT check loads; DDMMYY and 32 shapes are refused", async () => {
    const db = memoryDb();
    const loads = lvCodeFittingEeLt();
    const records = [
      soleTrader("lv", "lv-ik", loads, "row-1"),
      soleTrader("lv", "lv-ik", ["010190", "12345"].join(""), "row-2"),
      soleTrader("lv", "lv-ik", ["32", "000000000"].join(""), "row-3"),
    ];
    const outcome = await sync(db, fakeSource({ id: "lv-register" }, { records }));
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value = ?", loads)).toBe(1);
    expect(outcome.report?.dropped.personal_code).toBe(2);
    expect(outcome.report?.droppedRows.filter((d) => d.reason === "personal_code")).toEqual([
      { reason: "personal_code", prop: "registrationNumber", rowRef: "row-2" },
      { reason: "personal_code", prop: "registrationNumber", rowRef: "row-3" },
    ]);
    const withheld = db.prepare("SELECT e.eid, p.name AS prop, w.reason FROM main.withheld w JOIN main.entities e ON e.id = w.entity_id JOIN main.props p ON p.id = w.prop_id ORDER BY e.eid").all();
    expect(withheld).toEqual([
      { eid: "lv-st-row-2", prop: "registrationNumber", reason: "personal_code" },
      { eid: "lv-st-row-3", prop: "registrationNumber", reason: "personal_code" },
    ]);
    const stored = JSON.stringify(db.prepare("SELECT report_json FROM main.syncs").all());
    expect(stored).not.toContain(["010190", "12345"].join(""));
    expect(stored).not.toContain(["32", "000000000"].join(""));
  });

  it("EE and LT refuse an 11-digit id that passes the check; US refuses a 9-digit id", async () => {
    for (const [country, form, id] of [["ee", "ee-fie", eeLtCode()], ["lt", "lt-ii", eeLtCode()], ["us", "us-sole", "123456789"]] as const) {
      const db = memoryDb();
      const outcome = await sync(db, fakeSource({ id: `${country}-register`, country }, { records: [soleTrader(country, form, id)] }));
      expect(outcome.report?.dropped.personal_code, country).toBe(1);
      expect(count(db, "SELECT COUNT(*) AS n FROM main.withheld"), country).toBe(1);
      expect(count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value = ?", id), country).toBe(0);
    }
  });

  it("never reports a row reference that is itself code-shaped", async () => {
    const db = memoryDb();
    const id = ["010190", "12345"].join("");
    const outcome = await sync(db, fakeSource({ id: "lv-register" }, { records: [soleTrader("lv", "lv-ik", id, id)] }));
    expect(outcome.report?.droppedRows.find((d) => d.reason === "personal_code")).toEqual({ reason: "personal_code", prop: "registrationNumber" });
  });

  it("a company with the same id shape keeps it (only natural persons are scanned on own ids)", async () => {
    const db = memoryDb();
    const record = companyRecord(5, { extra: [{ prop: "registrationNumber", value: ["010190", "12345"].join(""), itemId: "S01.LV.01" }] });
    expect((await sync(db, fakeSource({ id: "lv-register" }, { records: [record] }))).report?.dropped).toEqual({});
  });
});
