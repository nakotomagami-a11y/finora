# lv-ur-annual-reports: Latvian annual-report financial data

One `SourceMeta`, `lv-ur-annual-reports`, reads three files of the dataset `gada-parskatu-finansu-dati` and joins them on the statement id:

| File | Rows (2026-11-19) | MB | Read? |
|---|---|---|---|
| `financial_statements.csv` | 1,986,890 | 206 | yes: one row per filed statement |
| `balance_sheets.csv` | 1,862,399 | 143 | yes |
| `income_statements.csv` | 1,753,345 | 150 | yes |
| `cash_flow_statements.csv` | 181,124 | 21 | **not fetched**: no item (9% fill, no S06 line uses it) |

## Source

- **Publisher:** Register of Enterprises of the Republic of Latvia. The statements are filed through the State Revenue Service's electronic declaration system and published by the register on `https://data.gov.lv`.
- **URL discovery:** `package_show?id=gada-parskatu-finansu-dati`, then the resources by basename (`lv-register.md` § Source).
- **Licence:** `cc0-1.0` ("CC0-1.0" on the dataset page, verified 2026-11-19).
- **Attribution:** "Source: Register of Enterprises of the Republic of Latvia, Annual report financial data, data.gov.lv, CC0 1.0".
- **Storage:** `store`.
- **Cadence:** `weekly` (cto §2: about 0.003% of rows change a day). The files are regenerated nightly at about 21:26 UTC; the job runs once a week after `publishedAtUtc: "21:40"`, on a different night from the heavy EE general-data job.
- **`asOf`**: three strategies, proved on the 2026-11-19 and 2026-11-20 pulls, in this order:
  1. `max_date_in_data` over `financial_statements.created_at` (date part), ignoring dates after the sync date. **This one wins today:** 2026-11-18 on the 19 Nov pull.
  2. `portal_metadata`: the CKAN resource `last_modified`.
  3. `http_last_modified`: changes nightly.
- **`purgeScope: "window"`**. The window field is `year_ended_on`, and the window is **the 5 newest fiscal years in the file**, at most 5 per company (load rule 3; as built in S05). Counting 5 years per company instead kept old years of companies that stopped filing: 1.04 M records on the real files, against ≈ 548 k this way (547,280 measured), and it would break `windowStart`, which the purge guard needs as one date. A record whose fiscal year falls behind the window is an expected deletion.
- **`maxPurgeShare`: 0.02.** Measured 6 statements removed of 1,986,939 in one day (0.0003%). That is about 42 a week (0.002%), and ×5 is still under the floor. Records in the window number ≈ 540,000.
- **`parserVersion`:** sha256 of the loader module (it holds the window length of 5 and the `source_type` selection), its field map and `items.generated.ts`.
- **Keys and limits:** no key; ≤ 2 requests/s; size cap 400 MB per file.
- **Deep link:** the company page `https://info.ur.gov.lv/#/legal-entity/{entityCode}`. The statements themselves have no public per-document URL. `officialHosts`: `data.gov.lv`, `info.ur.gov.lv`.

## Items

| item_id | Call | Caveat text | Empty state | Filled by |
|---|---|---|---|---|
| S06.LV.01 | SHOW | - | NP; "[year] not filed" | balance-sheet and income-statement key lines, by fiscal year |
| S13.LV.01 | SHOW | - | NP | `filing.annual_report` events (filing date per fiscal year) |

- Sole traders and other NP entities (2.2% of statements): S06 is CAVEAT behind the purpose gate, facts only, with the rule 6 disclaimer, and never in a verdict (Part H 8). The loader stores their figures like any other; the flag comes from the entity's `natural_person`.
- Checks fed: check 5 ("accounts filed on time") reads S13.LV.01; check 6 ("financial position") reads S06.LV.01.
- **Background for the check 5 window, from the law.** The Annual Accounts and Consolidated Annual Accounts Law, Section 97(1), as amended on 8 March 2023 (*Latvijas Vēstnesis* 57A, 21.03.2023; applies from the 2022 financial year; text at `https://likumi.lv/ta/id/340392`, read 2026-11-20), requires the annual report to reach the State Revenue Service:
  - micro and small companies: "ne vēlāk kā piecus mēnešus pēc pārskata gada beigām" (no later than 5 months after the financial year ends);
  - medium and large companies, and parent companies preparing a consolidated report: "ne vēlāk kā septiņus mēnešus" (7 months).
- **What the check uses.** The files carry no size class, so `domain/config/filing-windows.ts` holds **Finora's estimate of the usual filing window**: 7 months + 30 days for every LV company (council Part H). That can only under-flag small companies. Check 5 reads "Annual report for [year] not in the register, [N] months after the year ended"; it states a fact about the register, it uses none of the words Part H item 4 bans for this check, and never names a statutory date (legal, council). Test: `domain/src/checks/filing-window.test.ts` (LV cases).
- **Measured lag** from year end to `created_at` (FY 2020+): p50 150 days (≈ the 5-month statutory date), p95 431 days.
- Employees from the statements (`employees_avg`) are part of the annual accounts (S06.LV.01). The quarterly headcount in S07.LV.01 comes from `lv-tax.md`.

## Field map

### `financial_statements.csv` (`;`, UTF-8 with BOM)

Header: `id;file_id;legal_entity_registration_number;source_schema;source_type;year;year_started_on;year_ended_on;employees;rounded_to_nearest;currency;created_at`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | int | join key to the other two files; part of the hash input | S06.LV.01 (R) | no | - |
| `legal_entity_registration_number` | text | `fact_reports.entity_id` → `lv-<code>`; record key part | S06.LV.01 (R) | no | check digit; must be in `lv-ur-register` (100% measured) |
| `year_ended_on` | date | `fact_reports.period_end`; record key part | S06.LV.01 | no | ISO |
| `year_started_on` | date | `fact_reports.period_start` | S06.LV.01 | no | ISO. 7.3% of active companies have a non-calendar fiscal year |
| `year` | int | not stored (period_end carries it); used for the window | - | no | - |
| `source_type` | enum | selection | S06.LV.01 | no | `UGP` (annual report) and empty (older schemas) are loaded. `UKGP` (consolidated report, 3,117 rows) is **not loaded**, counted `consolidated_report` (Open question 2). `BNAGP` (association and foundation reports) is loaded for those entities |
| `employees` | int | fact `employees_avg` | S06.LV.01 | no | stored as reported, including 0 |
| `rounded_to_nearest` | `ONES` / `THOUSANDS` | `fact_reports.unit_scale` = 1 / 1000 | S06.LV.01 | no | values are stored as reported; the scale stays visible ("reported in thousands") |
| `currency` | `EUR` / `LVL` | `fact_reports.currency` | S06.LV.01 | no | LVL is never converted |
| `created_at` | datetime | event `filing.annual_report`, date (date part); `data = {periodEnd}` | S13.LV.01 | no | ISO date |
| `file_id`, `source_schema` | - | not read | - | - | - |

### `balance_sheets.csv` (`;`)

Header: `statement_id;file_id;cash;marketable_securities;accounts_receivable;inventories;total_current_assets;investments;fixed_assets;intangible_assets;total_non_current_assets;total_assets;future_housing_repairs_payments;current_liabilities;non_current_liabilities;provisions;equity;total_equities`

| Source field | Type | Target concept (`annual_accounts`) | item_id | Transform |
|---|---|---|---|---|
| `statement_id` | int | join to `financial_statements.id` | S06.LV.01 (R) | rows whose id is not selected are skipped without parsing the rest of the line |
| `cash` | int | `cash` | S06.LV.01 | empty → no fact |
| `total_current_assets` | int | `current_assets` | S06.LV.01 | as above |
| `total_non_current_assets` | int | `non_current_assets` | S06.LV.01 | as above |
| `total_assets` | int | `total_assets` | S06.LV.01 | as above |
| `current_liabilities` | int | `current_liabilities` | S06.LV.01 | as above |
| `non_current_liabilities` | int | `non_current_liabilities` | S06.LV.01 | as above |
| `equity` | int | `equity` | S06.LV.01 | negative values allowed (soft flag "negative equity") |
| `file_id`, `marketable_securities`, `accounts_receivable`, `inventories`, `investments`, `fixed_assets`, `intangible_assets`, `future_housing_repairs_payments`, `provisions`, `total_equities` | - | not read | - | - |

`liabilities` is not loaded: the file has no total-liabilities line, and Finora does not sum it.

### `income_statements.csv` (`;`)

Header: `statement_id;file_id;net_turnover;by_nature_inventory_change;by_nature_long_term_investment_expenses;by_nature_other_operating_revenues;by_nature_material_expenses;by_nature_labour_expenses;by_nature_depreciation_expenses;by_function_cost_of_goods_sold;by_function_gross_profit;by_function_selling_expenses;by_function_administrative_expenses;by_function_other_operating_revenues;other_operating_expenses;equity_investment_earnings;other_long_term_investment_earnings;other_interest_revenues;investment_fair_value_adjustments;interest_expenses;extra_revenues;extra_expenses;income_before_income_taxes;provision_for_income_taxes;income_after_income_taxes;other_taxes;extra_dividends;net_income`

| Source field | Type | Target concept | item_id | Transform |
|---|---|---|---|---|
| `statement_id` | int | join | S06.LV.01 (R) | as above |
| `net_turnover` | int | `revenue` | S06.LV.01 | empty → no fact |
| `income_before_income_taxes` | int | `profit_before_tax` | S06.LV.01 | as above |
| `net_income` | int | `net_profit` | S06.LV.01 | as above |
| every other column | - | not read | - | - |

### Selection and record

- **Window** (load rule 3): per company, the statements of its 5 latest fiscal years by `year_ended_on`, after dropping consolidated reports. Globally that is ≈ 548,000 statements of FY 2022-2026 (measured: 548,424 statements with `year` > 2021).
- **Corrections:** where a company has more than one statement for the same `year_ended_on` (0.3% of company-years), the latest `created_at` wins, then the highest `id`.
- **Struck-off entities** (`status` ≠ `active` in `lv-ur-register`): no financials. Rows are dropped with `struck_off_identity_only` (load rule 3).
- **Record unit:** one record per company fiscal year. `recordKey` = `<regcode>|<year_ended_on>`, so a corrected statement replaces the old one in place.
- **Hash input, in order:** the selected statement `id`, `created_at`, `year_started_on`, `year_ended_on`, `employees`, `rounded_to_nearest`, `currency`; then the balance values `cash`, `total_current_assets`, `total_non_current_assets`, `total_assets`, `current_liabilities`, `non_current_liabilities`, `equity`; then the income values `net_turnover`, `income_before_income_taxes`, `net_income`. An empty value is hashed as an empty string. `row_hash` = sha256 truncated to 16 bytes.
- **Sort order:** none is relied on. `financial_statements.csv` is neither grouped by company (1.7 M contiguity breaks) nor in ascending id order, hence the temp-table join below.
- One record writes one `fact_reports` row (`kind = 'annual_accounts'`), up to 11 `facts`, and one `filing.annual_report` event.

### Join procedure

`parse` is pure, but the three files are joined through a temporary SQLite staging table, not in memory:
1. Stream `financial_statements.csv`, apply the selection, and stage the chosen ids (≈ 548,000).
2. Stream the balance file, then the income file, staging only rows whose id is chosen.
3. Emit one `ParsedRecord` per chosen statement.

## Party gate

Not applicable: every row belongs to the register entity named by its code. These are its own accounts, not a party list. Codes not in the register are a counted skip (`code_not_in_register`, 0 measured). NP entities are loaded (S06 CAVEAT for them, above). Their figures are never used by `domain/verdict`, because the facts-only variant has no verdict.

## Identity and joins

- Entity `lv-<code>`, with the check digit from `lv-register.md`.
- Join to the register by code. Statement-to-lines join by `statement_id` (100% of balance and income ids are found among statement ids).
- A statement without a balance or an income row loads with the facts it has: by the 2026-11-19 row totals, about 6.3% of statements have no balance row and 11.8% no income row.

## Refresh and change

- **Weekly.** Content hash per file; if all three are unchanged → one `unchanged` sync row.
- **Measured churn:** about 55 statements added and 6 removed per day, so about 400 records change per week. Only those are rewritten.
- **When a company's 6th-newest year leaves the window,** its record is absent from the staged set and is purged with its report, facts and event. That is load rule 3, not history.
- **Removed statement** (withdrawn upstream) → purged. No `finora.*` event: the "[year] not filed" state appears by itself.
- **No tombstones.**
- **Partial or interrupted** (any of the three files failed), or the purge guard tripped → the whole sync is `partial`, and nothing is purged.
- **Storage or licence class change** (A7): a full reload into the new class and a purge from the old one. None is foreseen (CC0).

## Size and time budget

| | Count | Bytes |
|---|---|---|
| Records (`records` rows) | ≈ 540,000 (548k minus consolidated, corrections, struck-off) | ≈ 33 MB |
| `fact_reports` | ≈ 540,000 | ≈ 22 MB |
| `facts` (≤ 11 per report; balance lines missing on ≈ 6%, income lines on ≈ 12%) | ≈ 5.5 M | ≈ 88 MB (16 B per figure) |
| `filing.annual_report` events | ≈ 540,000 | ≈ 17 MB |
| **Total** | | **≈ 0.16 GB 🟡** |

This fits within LV ≤ 2.5 GB (LV total ≈ 1.6 GB, `lv-register.md`).

**Time** 🟡 (measured stdlib-Python parse, including row hashing; Node is expected to be similar):
- Download 499 MB ≈ 2.8 min.
- Parse ≈ 5 min (statements 96 s, balance 75 s, income 125 s). Skipping unselected ids early should cut the line work on the two line files by about 70%.
- Write ≈ 6.8 M rows ≈ 45 s.
- **First load ≈ 9 min in the background**, after LV is already searchable. The weekly refresh costs the same download and parse, plus about 400 record writes.

## Fixtures

- **Writer:** `packages/sources/src/lv/lv-ur-annual-reports/fixture.ts` writes the three files with the exact headers, `;`, BOM, and integer amounts.
- **About 20 statements:**
  - one company with 7 fiscal years (only 5 load);
  - two statements for the same year (the later `created_at` wins);
  - one `UKGP` consolidated report (dropped);
  - one `THOUSANDS` statement and one `LVL` statement;
  - a non-calendar fiscal year (07-01 to 06-30);
  - a statement with no income row, and an empty `net_turnover`;
  - a negative equity;
  - a fixture `IK` (loaded, natural person) and a struck-off company (dropped).
- **Codes and names:** fixture-only codes; "Example Timber SIA", "Sample Bakery AS", "IK Test Person A".

## Tests

| File | What it proves |
|---|---|
| `packages/sources/src/lv/lv-ur-annual-reports/lv-ur-annual-reports.test.ts` | Concept mapping per column. `unit_scale` 1000 for THOUSANDS. Currency kept. Period start/end. 5-year window. Correction wins. Consolidated dropped. Struck-off dropped. Missing income row → balance facts only. Empty → no fact (not 0). Filing event date = `created_at` |
| `packages/sources/src/lv/lv-ur-annual-reports/join.test.ts` | The staging join is order-independent (shuffled line files give the same records). Unselected ids are never staged |
| `packages/ingest/src/purge.test.ts` (shared) | Day 2 adds a newer year → the oldest of 6 is purged; untouched records not rewritten |
| `packages/ingest/src/partial.test.ts` (shared) | Income file missing on day 2 → `partial`, no purge |
| `packages/ingest/src/unchanged.test.ts`, `stale.test.ts` (shared) | as titled |
| `packages/store/src/provenance.test.ts` (shared) | every fact report has a record whose sync carries `cc0-1.0` |
| `packages/domain/src/report/financials.test.ts` | "Reported in thousands" and currency render. "[year] not filed" for a missing year. NP entity facts render behind the purpose gate and never reach the verdict |

## Failure modes

| Failure | Loader does | UI shows |
|---|---|---|
| One of the three files down or changed schema | `failed` (or `partial` if the statements file loaded); no purge | S06 keeps the stored years with "as of [date]" |
| As-of older than the last content sync | `stale_skipped` | unchanged |
| As-of more than 14 days behind (2× weekly) | source `stale` | the financials header shows the date in the warning style |
| Company has no statement in the window | - | S06: NP "Not published in Latvia", or "[year] not filed" for each missing year once the company is older than that year |

## Open questions

1. **Size class for check 5 (optional refinement):** the law's terms differ by size class, which the files don't carry. The council's single 7-month window can only under-flag micro and small companies. A size rule from the statements (turnover, assets, employees, per the law's thresholds) could narrow it later; nothing blocks the slice.
2. **Consolidated reports** (`UKGP`) are dropped, so one report per company-year stays. Group figures would need a new `fact_reports.kind`, `annual_accounts_consolidated`.
3. **New names** (once): drop reasons `consolidated_report`, `struck_off_identity_only`.
