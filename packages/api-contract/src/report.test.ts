import { describe, expect, it } from "vitest";
import { CompanyReport, Section, SectionResponse } from "./report.ts";
import { companyReport, EID, source } from "./testing/samples.ts";

describe("report.ts (architecture §5.4)", () => {
  it("accepts a valid profile", () => {
    expect(CompanyReport.safeParse(companyReport()).success).toBe(true);
  });

  it("rejects a data section with an empty value list: none found comes only from checked_none (qa 12)", () => {
    expect(Section.safeParse({ state: "data", value: [], freshness: "current", asOf: "2026-11-21", completeness: "full" }).success).toBe(false);
    expect(Section.safeParse({ state: "checked_none", source: source(), checkedAt: "x", asOf: "2026-11-21" }).success).toBe(true);
  });

  it("rejects a value without a source, an unknown item, and an unknown field", () => {
    const bare = { state: "data", value: [{ value: { itemId: "S01.LV.01", prop: "name", value: "x" }, sources: [] }], freshness: "current", asOf: "x", completeness: "full" };
    expect(Section.safeParse(bare).success).toBe(false);
    const unknown = { ...bare, value: [{ value: { itemId: "S99.XX.99", prop: "name", value: "x" }, sources: [source()] }] };
    expect(Section.safeParse(unknown).success).toBe(false);
    expect(Section.safeParse({ state: "disputed", disputeId: "d1", note: "x" }).success).toBe(false);
  });

  it("holds the coverage at 11 and each check once", () => {
    const report = companyReport();
    expect(CompanyReport.safeParse({ ...report, coverage: { ...report.coverage, total: 10 } }).success).toBe(false);
    expect(CompanyReport.safeParse({ ...report, checks: report.checks.slice(0, 10) }).success).toBe(false);
  });

  it("never names a natural person in the header (L3, P6)", () => {
    const report = companyReport();
    expect(CompanyReport.safeParse({ ...report, isNaturalPerson: true }).success).toBe(false);
    const { name: _name, ...header } = report.header;
    expect(CompanyReport.safeParse({ ...report, isNaturalPerson: true, header }).success).toBe(true);
  });

  it("refuses a manual link that is not https and a needs_key for anything but the SEC contact", () => {
    expect(Section.safeParse({ state: "not_checked", reason: { reason: "manual_lookup", url: "http://x.invalid/" } }).success).toBe(false);
    expect(Section.safeParse({ state: "not_checked", reason: { reason: "needs_key", key: "SOME_API_KEY" } }).success).toBe(false);
  });

  it("validates one section's response", () => {
    expect(SectionResponse.safeParse({ eid: EID, section: "S03", result: { state: "not_checked", reason: { reason: "needs_purpose", purposes: ["counterparty_check"] } } }).success).toBe(true);
    expect(SectionResponse.safeParse({ eid: "p-1-2", section: "S03", result: { state: "not_checked", reason: { reason: "later" } } }).success).toBe(false);
  });
});
