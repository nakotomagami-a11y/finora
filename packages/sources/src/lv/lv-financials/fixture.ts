// Layout fixtures for lv-ur-annual-reports (lv-financials.md § Fixtures): the three files with their
// real headers, `;`, no byte-order mark (as data.gov.lv serves them) and integer amounts, over the
// LV fixture companies.
import { lvCsv } from "../fixture-csv.ts";
import { LV_FX_INVALID_CODE, lvFx } from "../fixture-world.ts";

export const LV_STATEMENTS_HEADER = ["id", "file_id", "legal_entity_registration_number", "source_schema", "source_type", "year", "year_started_on", "year_ended_on", "employees", "rounded_to_nearest", "currency", "created_at"];
export const LV_BALANCE_HEADER = ["statement_id", "file_id", "cash", "marketable_securities", "accounts_receivable", "inventories", "total_current_assets", "investments", "fixed_assets", "intangible_assets", "total_non_current_assets", "total_assets", "future_housing_repairs_payments", "current_liabilities", "non_current_liabilities", "provisions", "equity", "total_equities"];
export const LV_INCOME_HEADER = ["statement_id", "file_id", "net_turnover", "by_nature_inventory_change", "by_nature_long_term_investment_expenses", "by_nature_other_operating_revenues", "by_nature_material_expenses", "by_nature_labour_expenses", "by_nature_depreciation_expenses", "by_function_cost_of_goods_sold", "by_function_gross_profit", "by_function_selling_expenses", "by_function_administrative_expenses", "by_function_other_operating_revenues", "other_operating_expenses", "equity_investment_earnings", "other_long_term_investment_earnings", "other_interest_revenues", "investment_fair_value_adjustments", "interest_expenses", "extra_revenues", "extra_expenses", "income_before_income_taxes", "provision_for_income_taxes", "income_after_income_taxes", "other_taxes", "extra_dividends", "net_income"];

const options = { bom: false } as const;

type Statement = { id: number; n: number | null; type?: string; start: string; end: string; employees?: string; rounded?: string; currency?: string; created: string };

const calendar = (id: number, n: number | null, year: number, extra: Partial<Statement> = {}): Statement => ({ id, n, start: `${year}-01-01`, end: `${year}-12-31`, created: `${year + 1}-05-2${id % 10} 10:15:30.123`, ...extra });

/** Every case of the spec: the comments name it. */
export const LV_FINANCIAL_STATEMENTS: readonly Statement[] = [
  // Example Timber: seven fiscal years, only the newest five (the file's window, 2021-2025) load.
  ...[2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year, i) => calendar(5001 + i, 1, year, { employees: String(10 + i) })),
  // Demo Logistics: a statement and its correction for the same year; the later one wins.
  calendar(5010, 2, 2024, { employees: "4", created: "2025-05-10 09:00:00" }),
  calendar(5011, 2, 2024, { employees: "5", created: "2025-09-01 14:30:00.5" }),
  // Sample Bakery: a consolidated report (dropped) beside its own annual report, and a year in thousands.
  calendar(5020, 3, 2024, { type: "UKGP", employees: "120" }),
  calendar(5021, 3, 2024, { employees: "80" }),
  calendar(5022, 3, 2023, { employees: "75", rounded: "THOUSANDS" }),
  // Example Works: a year reported in lats, before the window.
  calendar(5030, 5, 2012, { currency: "LVL", employees: "3" }),
  // Demo Terminated: a company that stopped filing before the window.
  calendar(5031, 8, 2017, { employees: "2" }),
  // Sample Exporter: a fiscal year from July to June.
  { id: 5040, n: 23, start: "2024-07-01", end: "2025-06-30", employees: "12", created: "2025-11-03 08:00:00.25" },
  // Demo Subsidiary: no income statement row.
  calendar(5050, 21, 2024, { employees: "0" }),
  // Sample Holdings: an income row with an empty turnover.
  calendar(5060, 20, 2024, { employees: "" }),
  // Example Debtor: negative equity.
  calendar(5070, 22, 2024, { employees: "2" }),
  // IK Test Person A: a sole trader's accounts load like any other (the S06 caveat comes from the entity).
  calendar(5080, 4, 2024, { employees: "1" }),
  // Demo Closed: struck off (the register's status decides; load rule 3).
  calendar(5090, 6, 2024, { employees: "1" }),
  // Example Club: an association's report.
  calendar(5100, 14, 2024, { type: "BNAGP", employees: "0" }),
  // Example Renamed: an older schema with no source type.
  calendar(5110, 19, 2021, { type: "", employees: "6" }),
  // A code that fails the check digit.
  calendar(5120, null, 2024),
];

const codeOf = (n: number | null) => (n === null ? LV_FX_INVALID_CODE : lvFx(n).code);

export const lvStatementsCsv = () =>
  lvCsv(
    LV_STATEMENTS_HEADER,
    LV_FINANCIAL_STATEMENTS.map((s) => [String(s.id), String(s.id + 90000), codeOf(s.n), s.type === "" ? "" : "UGP_2015", s.type ?? "UGP", s.end.slice(0, 4), s.start, s.end, s.employees ?? "1", s.rounded ?? "ONES", s.currency ?? "EUR", s.created]),
    options,
  );

type Balance = { cash: string; current: number; nonCurrent: number; currentLiabilities: string; nonCurrentLiabilities: string; equity: number };

const balanceRow = (id: number, b: Balance) => {
  const total = b.current + b.nonCurrent;
  return [String(id), String(id + 90000), b.cash, "0", "100", "50", String(b.current), "0", String(b.nonCurrent), "0", String(b.nonCurrent), String(total), "", b.currentLiabilities, b.nonCurrentLiabilities, "0", String(b.equity), String(total)];
};
const plain = (base: number): Balance => ({ cash: String(base), current: base * 4, nonCurrent: base * 6, currentLiabilities: String(base * 3), nonCurrentLiabilities: String(base * 2), equity: base * 5 });

export const lvBalanceSheetsCsv = () =>
  lvCsv(
    LV_BALANCE_HEADER,
    [
      ...[5001, 5002, 5003, 5004, 5005, 5006, 5007].map((id, i) => balanceRow(id, plain(1000 * (i + 1)))),
      ["5002", "95002", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x"], // a stray line of an unselected statement: never read
      balanceRow(5010, plain(200)),
      balanceRow(5011, plain(210)),
      balanceRow(5020, plain(9000)),
      balanceRow(5021, plain(800)),
      balanceRow(5022, plain(7)),
      balanceRow(5030, plain(30)),
      balanceRow(5040, plain(400)),
      balanceRow(5050, plain(50)),
      balanceRow(5060, { ...plain(60), cash: "", nonCurrentLiabilities: "" }),
      balanceRow(5070, { ...plain(70), equity: -1500 }),
      balanceRow(5080, plain(8)),
      balanceRow(5090, plain(9)),
      balanceRow(5100, plain(10)),
      balanceRow(5110, plain(11)),
    ],
    options,
  );

const incomeRow = (id: number, turnover: string, beforeTax: number, net: number) => {
  const row = LV_INCOME_HEADER.map(() => "0");
  row[0] = String(id);
  row[1] = String(id + 90000);
  row[LV_INCOME_HEADER.indexOf("net_turnover")] = turnover;
  row[LV_INCOME_HEADER.indexOf("income_before_income_taxes")] = String(beforeTax);
  row[LV_INCOME_HEADER.indexOf("provision_for_income_taxes")] = String(beforeTax - net);
  row[LV_INCOME_HEADER.indexOf("income_after_income_taxes")] = String(net);
  row[LV_INCOME_HEADER.indexOf("net_income")] = String(net);
  return row;
};

export const lvIncomeStatementsCsv = () =>
  lvCsv(
    LV_INCOME_HEADER,
    [
      ...[5001, 5002, 5003, 5004, 5005, 5006, 5007].map((id, i) => incomeRow(id, String(10000 * (i + 1)), 1200 * (i + 1), 1000 * (i + 1))),
      incomeRow(5010, "2000", 120, 100),
      incomeRow(5011, "2100", 130, 110),
      incomeRow(5020, "99000", 9000, 8000),
      incomeRow(5021, "8000", 900, 800),
      incomeRow(5022, "70", 9, 7),
      incomeRow(5030, "300", 40, 30),
      incomeRow(5040, "4000", 500, 400),
      incomeRow(5060, "", -60, -60),
      incomeRow(5070, "700", -900, -900),
      incomeRow(5080, "80", 10, 8),
      incomeRow(5090, "90", 10, 9),
      incomeRow(5100, "100", 0, 0),
      incomeRow(5110, "110", 12, 11),
    ],
    options,
  );
