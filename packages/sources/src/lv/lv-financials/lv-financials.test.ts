import { describe, expect, it } from "vitest";
import { checkFieldMap } from "../../field-maps.ts";
import { checkSource } from "../../licences.ts";
import { parseAll } from "../../intl/sanctions-test-helpers.ts";
import type { ParsedRecord, RawArtifact } from "../../types.ts";
import { lvCsv } from "../fixture-csv.ts";
import { lvFx } from "../fixture-world.ts";
import { LV_STATEMENTS_HEADER, lvBalanceSheetsCsv, lvIncomeStatementsCsv, lvStatementsCsv } from "./fixture.ts";
import { lvUrAnnualReports } from "./lv-financials.ts";

const art = (name: string, bytes: Uint8Array, extra: Partial<RawArtifact> = {}): RawArtifact => ({ name, bytes, fetchedAt: "2026-11-21T00:00:00Z", ...extra });
const files = (statements = lvStatementsCsv()) => [art("financial_statements.csv", statements), art("balance_sheets.csv", lvBalanceSheetsCsv()), art("income_statements.csv", lvIncomeStatementsCsv())];
const ofCompany = (records: ParsedRecord[], n: number) => records.filter((r) => r.recordKey.startsWith(`${lvFx(n).code}|`));
const facts = (r: ParsedRecord | undefined) => Object.fromEntries((r?.reports?.[0]?.facts ?? []).map((f) => [f.concept, f.value]));

describe("lv-ur-annual-reports (lv-financials.md)", () => {
  it("maps each column to its concept, with the period, currency and unit scale of the statement", async () => {
    const { records } = await parseAll(lvUrAnnualReports, files());
    const timber2025 = records.find((r) => r.recordKey === `${lvFx(1).code}|2025-12-31`)!;
    expect(timber2025.reports).toEqual([
      {
        entityEid: `lv-${lvFx(1).code}`,
        kind: "annual_accounts",
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31",
        currency: "EUR",
        unitScale: 1,
        itemId: "S06.LV.01",
        facts: [
          { concept: "employees_avg", value: 16 },
          { concept: "cash", value: 7000 },
          { concept: "current_assets", value: 28000 },
          { concept: "non_current_assets", value: 42000 },
          { concept: "total_assets", value: 70000 },
          { concept: "current_liabilities", value: 21000 },
          { concept: "non_current_liabilities", value: 14000 },
          { concept: "equity", value: 35000 },
          { concept: "revenue", value: 70000 },
          { concept: "profit_before_tax", value: 8400 },
          { concept: "net_profit", value: 7000 },
        ],
      },
    ]);
    expect(timber2025.period).toBe("2025-12-31");
    expect(timber2025.entities).toEqual([{ eid: `lv-${lvFx(1).code}`, schema: "Company", country: "lv", code: lvFx(1).code, ref: true, statements: [] }]);
  });

  it("writes the filing event on the created_at date for S13", async () => {
    const { records } = await parseAll(lvUrAnnualReports, files());
    const exporter = ofCompany(records, 23)[0]!;
    expect(exporter.events).toEqual([{ entityEid: `lv-${lvFx(23).code}`, type: "filing.annual_report", date: "2025-11-03", itemId: "S13.LV.01", data: { periodEnd: "2025-06-30" } }]);
  });

  it("keeps the 5 newest fiscal years of the file, and leaves older years out uncounted", async () => {
    const { records, drops } = await parseAll(lvUrAnnualReports, files());
    expect(ofCompany(records, 1).map((r) => r.period)).toEqual(["2021-12-31", "2022-12-31", "2023-12-31", "2024-12-31", "2025-12-31"]);
    expect(ofCompany(records, 5)).toEqual([]);
    expect(ofCompany(records, 8)).toEqual([]);
    expect(drops).toHaveLength(2);
  });

  it("keeps at most 5 fiscal years for a company that moved its year end inside the window", async () => {
    const row = (id: string, start: string, end: string) => [id, "1", lvFx(2).code, "UGP_2015", "UGP", end.slice(0, 4), start, end, "1", "ONES", "EUR", `${end.slice(0, 4)}-12-01 00:00:00`];
    const moved = lvCsv(LV_STATEMENTS_HEADER, [
      row("8001", "2021-01-01", "2021-12-31"),
      row("8002", "2022-01-01", "2022-12-31"),
      row("8003", "2023-01-01", "2023-06-30"),
      row("8004", "2023-07-01", "2024-06-30"),
      row("8005", "2024-07-01", "2025-06-30"),
      row("8006", "2025-07-01", "2025-09-30"),
    ], { bom: false });
    expect((await parseAll(lvUrAnnualReports, files(moved))).records.map((r) => r.hashInput[0])).toEqual(["8002", "8003", "8004", "8005", "8006"]);
  });

  it("lets the latest filing win a year: the later created_at, then the higher id", async () => {
    const { records } = await parseAll(lvUrAnnualReports, files());
    const logistics = ofCompany(records, 2);
    expect(logistics).toHaveLength(1);
    expect(logistics[0]!.hashInput[0]).toBe("5011");
    expect(facts(logistics[0])).toMatchObject({ employees_avg: 5, revenue: 2100 });
    const tie = lvCsv(LV_STATEMENTS_HEADER, [
      ["7001", "1", lvFx(2).code, "UGP_2015", "UGP", "2024", "2024-01-01", "2024-12-31", "4", "ONES", "EUR", "2025-05-10 09:00:00"],
      ["7002", "2", lvFx(2).code, "UGP_2015", "UGP", "2024", "2024-01-01", "2024-12-31", "5", "ONES", "EUR", "2025-05-10 09:00:00"],
    ], { bom: false });
    expect((await parseAll(lvUrAnnualReports, files(tie))).records.map((r) => r.hashInput[0])).toEqual(["7002"]);
  });

  it("drops consolidated reports and bad codes, counted, and loads associations and older schemas", async () => {
    const { records, drops } = await parseAll(lvUrAnnualReports, files());
    expect(drops.sort()).toEqual(["consolidated_report", "invalid_code"]);
    expect(ofCompany(records, 3).map((r) => r.hashInput[0])).toEqual(["5022", "5021"]);
    expect(ofCompany(records, 14)).toHaveLength(1);
    expect(ofCompany(records, 19)).toHaveLength(1);
  });

  it("stores thousands with unit scale 1000 and lats as lats, never converted", async () => {
    const { records } = await parseAll(lvUrAnnualReports, files());
    const bakery2023 = records.find((r) => r.recordKey === `${lvFx(3).code}|2023-12-31`)!.reports![0]!;
    expect([bakery2023.unitScale, bakery2023.currency, facts(records.find((r) => r.recordKey === `${lvFx(3).code}|2023-12-31`)).total_assets]).toEqual([1000, "EUR", 70]);
    const lats = lvCsv(LV_STATEMENTS_HEADER, [["5030", "1", lvFx(5).code, "UGP_2015", "UGP", "2024", "2024-01-01", "2024-12-31", "3", "ONES", "LVL", "2025-03-01 00:00:00"]], { bom: false });
    const works = (await parseAll(lvUrAnnualReports, files(lats))).records[0]!.reports![0]!;
    expect([works.unitScale, works.currency, works.facts.find((f) => f.concept === "revenue")?.value]).toEqual([1, "LVL", 300]);
  });

  it("keeps a non-calendar fiscal year's own start and end", async () => {
    const { records } = await parseAll(lvUrAnnualReports, files());
    const report = ofCompany(records, 23)[0]!.reports![0]!;
    expect([report.periodStart, report.periodEnd]).toEqual(["2024-07-01", "2025-06-30"]);
    expect(ofCompany(records, 23)[0]!.recordKey).toBe(`${lvFx(23).code}|2025-06-30`);
  });

  it("loads a statement without an income row with its balance facts only, and an empty value is no fact (not 0)", async () => {
    const { records } = await parseAll(lvUrAnnualReports, files());
    const subsidiary = facts(ofCompany(records, 21)[0]);
    expect(Object.keys(subsidiary).sort()).toEqual(["cash", "current_assets", "current_liabilities", "employees_avg", "equity", "non_current_assets", "non_current_liabilities", "total_assets"]);
    expect(subsidiary.employees_avg).toBe(0);
    const holdings = facts(ofCompany(records, 20)[0]);
    expect(holdings).not.toHaveProperty("revenue");
    expect(holdings).not.toHaveProperty("cash");
    expect(holdings).not.toHaveProperty("non_current_liabilities");
    expect(holdings).not.toHaveProperty("employees_avg");
    expect(holdings.net_profit).toBe(-60);
  });

  it("keeps negative equity as reported", async () => {
    const { records } = await parseAll(lvUrAnnualReports, files());
    expect(facts(ofCompany(records, 22)[0]).equity).toBe(-1500);
  });

  it("loads a sole trader's accounts and a struck-off company's at parse: the store's entity decides (rule 5, load rule 3)", async () => {
    const { records } = await parseAll(lvUrAnnualReports, files());
    expect(ofCompany(records, 4)).toHaveLength(1);
    expect(ofCompany(records, 6)).toHaveLength(1);
  });

  it("hashes the selected statement and its line values in the spec's order", async () => {
    const { records } = await parseAll(lvUrAnnualReports, files());
    expect(records.find((r) => r.recordKey === `${lvFx(1).code}|2025-12-31`)!.hashInput).toEqual(["5007", "2026-05-27 10:15:30.123", "2025-01-01", "2025-12-31", "16", "ONES", "EUR", "7000", "28000", "42000", "70000", "21000", "14000", "35000", "70000", "8400", "7000"]);
  });

  it("dates the file by its latest filing and puts the window at the 5th-newest fiscal year", () => {
    const raw = files();
    expect(lvUrAnnualReports.asOf(raw).max_date_in_data).toBe("2026-05-27");
    expect(lvUrAnnualReports.windowStart?.(raw)).toBe("2021-01-01");
    const future = lvCsv(LV_STATEMENTS_HEADER, [["1", "1", lvFx(1).code, "", "UGP", "2027", "2027-01-01", "2027-12-31", "1", "ONES", "EUR", "2027-02-01 00:00:00"]], { bom: false });
    const withFuture = files(future);
    expect(lvUrAnnualReports.asOf(withFuture).max_date_in_data).toBeNull();
    expect(lvUrAnnualReports.windowStart?.(withFuture)).toBeNull();
  });

  it("fails schema_changed when a file lacks a column it reads", async () => {
    const missing = lvCsv(LV_STATEMENTS_HEADER.filter((h) => h !== "rounded_to_nearest"), [["1"]], { bom: false });
    await expect(parseAll(lvUrAnnualReports, files(missing))).rejects.toMatchObject({ name: "schema_changed" });
    await expect(parseAll(lvUrAnnualReports, files().filter((a) => a.name !== "income_statements.csv"))).rejects.toMatchObject({ name: "schema_changed" });
  });

  it("reads a byte-order mark and quoted cells the same way", async () => {
    const plain = (await parseAll(lvUrAnnualReports, files())).records;
    const text = new TextDecoder().decode(lvStatementsCsv()).replace(/;EUR;/g, ';"EUR";');
    const quoted = (await parseAll(lvUrAnnualReports, files(new TextEncoder().encode(`﻿${text}`)))).records;
    expect(quoted).toEqual(plain);
  });

  it("passes the field-map and licence invariants", () => {
    expect(checkFieldMap(lvUrAnnualReports.meta.id, lvUrAnnualReports.fieldMap)).toEqual([]);
    expect(checkSource(lvUrAnnualReports.meta, lvUrAnnualReports.fieldMap, ["data.gov.lv"])).toEqual([]);
    expect(lvUrAnnualReports.meta.purgeScope).toBe("window");
  });

  it("fetches the three files of the dataset and the statements file's portal date", async () => {
    const urls: string[] = [];
    const resources = ["financial_statements.csv", "balance_sheets.csv", "income_statements.csv", "cash_flow_statements.csv"].map((f, i) => ({ url: `https://data.gov.lv/dati/dataset/x/resource/${i}/download/${f}`, format: "CSV", last_modified: `2026-11-1${i}T21:26:00` }));
    const fetcher = async (url: string) => {
      urls.push(url);
      const body = url.includes("package_show") ? JSON.stringify({ result: { resources } }) : "id\n";
      return { status: 200, headers: {}, bytes: new TextEncoder().encode(body) };
    };
    const result = await lvUrAnnualReports.fetch({ fetcher, keys: {}, now: "2026-11-21T00:00:00Z", lastToken: null });
    expect("artifacts" in result && result.artifacts.map((a) => a.name)).toEqual(["financial_statements.csv", "resource.json", "balance_sheets.csv", "income_statements.csv"]);
    expect(urls.some((u) => u.includes("cash_flow"))).toBe(false);
    expect(lvUrAnnualReports.asOf("artifacts" in result ? result.artifacts : []).portal_metadata).toBe("2026-11-10");
  });
});
