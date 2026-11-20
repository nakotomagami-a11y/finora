# ee-rik-annual-reports: e-Business Register annual-report open data (report list and key figures)

Two `SourceMeta` entries, one module:

| Source id | Artifact | What it fills |
|---|---|---|
| `ee-rik-ar-reports` | `1.aruannete_yldandmed_kuni_<DDMMYYYY>_<n>.zip` (one CSV: the list of submitted reports) | one `fact_reports` row per report, `filing.annual_report` events |
| `ee-rik-ar-figures` | `4.<year>_aruannete_elemendid_kuni_<DDMMYYYY>_<n>.zip`, one zip per report year (one CSV: key figures, long format) | the facts of each report |

Files `2.EMTAK_myygitulu_...` (revenue by activity) and `3.myygitulu_geograafiline_...` (revenue by country) fill no Part G item: not fetched.

## Source
- **Publisher:** Centre of Registers and Information Systems (RIK), e-Business Register open data, section "Annual reports data" of https://avaandmed.ariregister.rik.ee/en/downloading-open-data
- **URLs: there is no stable alias.** File names carry the cut-off date and a duplicate counter, for example `/sites/default/files/1.aruannete_yldandmed_kuni_31102026_1.zip`. Tested 2026-11-20: the name without date or counter returns 404; `/jsonapi`, `/sitemap.xml` and the files directories return 404; the counter is not predictable (`_0` one month, `_1` the next); old monthly files stay online (the September file still returned 200). **So `fetch` reads the download page** (`/en/downloading-open-data`, fallback `/et/avaandmete-allalaadimine`), takes every href matching `^/sites/default/files/([14])\.(?:(\d{4})_)?(aruannete_yldandmed|aruannete_elemendid)_kuni_(\d{8})(?:_\d+)?\.zip$`, groups them by family (`1`, and `4` + year), and keeps the newest cut-off date per family. A family missing from the page, or two hrefs with the same family and cut-off, fails the sync with `url_discovery_failed`.
- **Load window (load rule 3):** the five newest report years on the page (2021-2025 on 20 Nov 2026), so five `4.<year>` zips plus the `1.` zip. When a new year appears, the oldest year's figures are purged with its reports.
- **Licence:** `cc-by-4.0` (verified 2026-11-19, same page and licence link as the register). `storage: "store"`. **Attribution:** "Source: RIK, e-Business Register annual-report open data, CC BY 4.0".
- **officialHosts:** `avaandmed.ariregister.rik.ee`, `ariregister.rik.ee`. **deepLink:** `https://ariregister.rik.ee/eng/company/{entityCode}` (no per-report page). **orderUrl:** none (full reports in PDF/XBRL exist only through the contract API; not in v1).
- **Cadence:** stated "initially updated once a month". Observed: files cut at 31 Oct 2026, `Last-Modified` 9 Nov 2026 11:49 UTC. Schedule: read the download page daily at 12:00 UTC (about 48 KB); fetch the zips only when a family's cut-off date is newer than the last content sync's. `cadence: "monthly"`.
- **Contract values (§4.2), both sources:**

  | Field | Value |
  |---|---|
  | `asOf` (strongest first) | `in_file_name`: the cut-off date in the zip name (`kuni_31102026` → 2026-10-31); `max_date_in_data` on the reports CSV's `esitatud_kpv` (2026-10-31 in the October files; must be ≤ the cut-off, else `schema_changed`); `http_last_modified` (2026-11-09 11:49 UTC). `in_file_name` wins today. No in-file export date exists |
  | `purgeScope` | `window`: the window field is `aruandeaasta` (report year), the five newest years on the page. Reports of a year that leaves the window are expected deletions and do not count against the guard; reports missing inside the window do |
  | `maxPurgeShare` | 0.02. Not measured as a two-pull diff (one monthly file held; diff the November and December files with `research/probes/baltics/ee/diff_pulls.py snapshot <file> report_id` then `diff`). Proxy: the files keep reports of deleted companies (45,370 such codes), so upstream removals are near 0; our own removals are reports of companies that left the register in a month, about 0.1-0.3% (217 of 153,997 companies in the tax file left the register in 40 days), so 5 x share stays under 2% |
  | `parserVersion` | sha256 of `packages/sources/src/ee/ee-rik-annual-reports/`, its field map, the element → concept table, the table-precedence list and the generated item list |
- **Keys:** none. **Limits:** none published. Politeness as in `ee-register.md`.
- **Format:** zip with one CSV: UTF-8 with BOM, `;` delimiter, `"` quoting, Estonian headers, values as decimal strings (`"946.0"`), dates `dd.mm.yyyy`. Headers:
  - reports: `"report_id";"taidetud_aruanne_report_id";"registrikood";"õiguslik vorm";"staatus";"aruandeaasta";"kas konsolideeritud?";"period_start";"period_end";"esitatud_kpv";"kas auditeeritud?";"valitud aruanne kategooria";"minimaalne kategooria andmete alusel";"auditi töövõtu liik";"audiitori otsuse tüüp";"modifikatsioon asjaolu rõhutamine";"modifikatsioon muu asjaolu";"modifikatsioon tegevuse jatkuvus";"Audiitorettevõtja (AEV)"`
  - figures: `"report_id";"tabel";"elemendi_label";"elemendi_nimetus";"vaartus"`

## Items
Copied from `docs/plan/council/01-data.md` Part G.

| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S06.EE.01 | SHOW | - | NP; "[year] not filed" |
| S13.EE.01 | SHOW | - | NP |

Sole traders do not file annual reports in these files (0 reports carry an FIE code), so the sole-trader S06 rule (Part H item 8) has nothing to act on here.

## Field map

**Record unit, hash input and order (§3.2, A8).** One record per `report_id`, owned by `ee-rik-ar-reports`; `recordKey` = `report_id`. The record joins the report's row in the reports CSV with all its rows in the matching `4.<year>` figures CSV (long format, one row per element).
- **Order relied on:** the figures CSV is grouped by `report_id` (cto verified). The parser streams it group by group; a `report_id` that reappears after its group closed fails the sync with `schema_changed` (no silent merge). The reports CSV is not assumed sorted: its window rows (≈ 1.18 M) are staged in a temp table keyed by `report_id` first, then each figure group looks up its report; reports with no figure group are emitted after the figures pass.
- **Hash input** (`row_hash`, 16 bytes): the reports-CSV fields in field-map order, then the selected (concept, value) pairs sorted by concept id, then `figuresPublished` and `liquidation`.

### `ee-rik-ar-reports` (record key = `report_id`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `report_id` | int | record key; joins the figures | - | no | unique in the file |
| `registrikood` | string, 8 digits | entity `ee-<code>` | resolution key | no | check digit (see `ee-register.md`); code not in the register or tombstoned: skip `code_not_in_register` (45,370 codes in the files belong to companies no longer in the register) |
| `aruandeaasta` | int | window filter; `fact_reports` grouping | S06.EE.01 | no | keep only the load window |
| `period_start`, `period_end` | `dd.mm.yyyy` | `fact_reports.period_start`, `period_end` | S06.EE.01 | no | ISO; 7.2% of latest reports do not end on 31 Dec |
| (constant) | | `fact_reports.kind = 'annual_accounts'`, `currency = 'EUR'`, `unit_scale = 1` | S06.EE.01 | no | the open data is in euros, not thousands |
| `esitatud_kpv` | date | event `filing.annual_report`, date = `esitatud_kpv` | S13.EE.01 | no | ISO |
| `kas konsolideeritud?` | `Jah`/`Ei` | event data `consolidated` (bool) | S13.EE.01 | no | the figures are non-consolidated either way (publisher's note) |
| `kas auditeeritud?` | `Jah`/`Ei` | event data `audited` (bool) | S13.EE.01 | no | |
| `audiitori otsuse tüüp` | string | event data `auditOpinion` (Estonian label) | S13.EE.01 | no | empty for 96.4% |
| `valitud aruanne kategooria` | string | event data `sizeCategory` (micro / small / medium / large) | S13.EE.01 | no | map the Estonian labels (Mikroettevõtja, Väikeettevõtja, Keskmise suurusega ettevõtja, Suurettevõtja) |
| (derived) | | event data `figuresPublished` (bool) | S06.EE.01 | no | false when the report has only `tabel = "PDF"` rows: the report was filed as PDF and has no open figures (1.3% of FY2025 reports, 38% of large-company reports). S06 then shows "Filed [date]; figures not in the open data (PDF filing)" |
| `taidetud_aruanne_report_id`, `õiguslik vorm`, `staatus`, `minimaalne kategooria ...`, `auditi töövõtu liik`, `modifikatsioon ...` | | not read | - | - | status and form come from the register |
| `Audiitorettevõtja (AEV)` | string | not read | - | can be | no item; an audit firm can carry a person's name |

One report per company and year was observed (0 duplicates for 2021-2025). If two reports share a company and fiscal period end, keep the one with the later `esitatud_kpv` (then the higher `report_id`) as the `fact_reports` row; both keep their `filing.annual_report` event; count `duplicate_period`.

### `ee-rik-ar-figures` (no records of its own: rows are folded into the report record of the same `report_id`)

Element → concept (`packages/domain/src/config/concepts.ts`), item S06.EE.01, never personal:

| `elemendi_nimetus` | Concept | Note |
|---|---|---|
| `Revenue` | `revenue` | companies |
| `TotalAnnualPeriodProfitLoss` | `net_profit` | fallback `TotalProfitLoss` when absent |
| `TotalProfitLossBeforeTax` | `profit_before_tax` | |
| `Assets` | `total_assets` | |
| `Equity` | `equity` | |
| `CurrentAssets` | `current_assets` | |
| `NonCurrentAssets` | `non_current_assets` | |
| `CurrentLiabilities` | `current_liabilities` | |
| `NonCurrentLiabilities` | `non_current_liabilities` | |
| `CashAndCashEquivalents` | `cash` | |
| `AverageNumberOfEmployeesInFullTimeEquivalentUnits` | `employees_avg` | full-time equivalents |

Not read: `RetainedEarningsLoss`, `IssuedCapital`, `LaborExpense`, `EmployeeExpense`, `DepreciationAndImpairmentLossReversal*`, `SurplusDeficitFromOperatingActivities`, `NetSurplusDeficitForPeriod`, `NetAssets`, `LiabilitiesAndNetAssets`, `TotalRevenue`, `BusinessIncome` (non-profit lines), every `*Consolidated` element, and the empty element of `PDF` rows. `liabilities` is not published as one element and is **not derived** (a sum would be a Finora number without a "Derived" chip; see Open questions).

**Table precedence.** The same element can appear in several tables of one report (212,525 repeats in the FY2025 file, for example `RetainedEarningsLoss` in the balance sheet and in the profit-allocation proposal). For each (report, element) take the value from the first table in this order, and ignore the rest:
1. `Bilanss`, `Bilanss, detailne`, `Bilanss, kasvava likviidsuse järjekorras`, `Konsolideerimata bilanss`, `Kasumiaruanne skeem 1`, `Kasumiaruanne skeem 2`, `Konsolideerimata kasumiaruanne (skeem 1)`, `Konsolideerimata kasumiaruanne (skeem 2)`, `Tulemiaruanne`, `Lisa: Tööjõukulud` (the labour-cost note, which carries the average employees);
2. liquidation statements: `Likvideerimise algbilanss`, `Likvideerimise vahebilanss`, `Lõppbilanss`, their `, detailne` variants, `Likvideerimiseelne kasumiaruanne (skeem 1)`, `(skeem 2)`, `Likvideerimise kasumiaruanne`, `Likvideerimiseelne tulemiaruanne`; a report whose values come only from these gets event data `liquidation: true`.
Never used: `Konsolideeritud ...` tables, `Kasumi jaotamise ...`, `Kahjumi katmise ...`, `Rahavoogude aruanne ...`, `PDF`. An unknown table name: ignored and counted `unknown_table` (by name in the sync report).

`vaartus`: parse as a decimal (dot separator); empty or non-numeric → the fact is skipped (`invalid_value`), never 0.

## Party gate
Not applicable: a report belongs to the company whose code it carries; no other party is named. Codes that do not resolve to a live (non-tombstoned) register entity are skipped `code_not_in_register`.

## Identity and joins
- `registrikood` → `ee-<code>`; the register (`ee-register.md`) must have loaded first. A report for a code the register does not hold today is not loaded and not kept for later (load rule 3; history starts at install).
- Figures join reports on `report_id`. A figure row whose `report_id` is not in the window's reports is skipped `orphan_figure`.
- "[year] not filed" (S06 empty state) is computed in `domain/report`, not here: for a company with `accountingObligation = true` and a `fiscalYearEnd` (both from `ee-rik-general`), year Y is "not filed" when no report for Y exists and the filing deadline has passed (6 months after the fiscal year end; the deadline is to be confirmed against the Commercial Code before the slice, see Open questions). The register's own warning rulings (`filing.overdue`, `ee-register.md`) are shown next to it as the source's statement.

## Refresh and change
- Full re-publication monthly; `purgeScope: "window"` on `aruandeaasta`. Record = one report (`report_id`), `row_hash` as defined under Field map.
- A changed report (corrected figures): its `fact_reports` row and facts are replaced; no event beyond the existing `filing.annual_report`.
- A year leaving the window: its reports are purged with their facts and events, as expected deletions (not counted by the purge guard).
- A report missing inside the window: purged, counted against `maxPurgeShare` (0.02); above it, nothing is purged and the sync ends `partial` with `purge_guard`.
- When only some family files are newer (for example a new `4.2025` but the same `1.`), all six artifacts of the window are still parsed together, because records span both families; the content hash is over all six.
- Unchanged page (same cut-off dates) and the same `parserVersion`: no download, one `syncs` row of kind `unchanged`. A new `parserVersion`: the six zips are re-parsed from the raw cache (kept as downloaded).

## Size and time budget
Measured on the files cut at 31 Oct 2026 (🟡: 16 B per fact and 32 B per event from cto; 60 B per `fact_reports` and records row).

| What | Rows | Est. size |
|---|---|---|
| Reports in the window for register entities | 1,180,111 | `fact_reports` ≈ 0.07 GB, records ≈ 0.07 GB |
| Facts (11 concepts; about 8-9 per report with figures) | ≈ 10 M | ≈ 0.16 GB |
| `filing.annual_report` events | 1,180,111 | ≈ 0.04 GB |
| **Total** | | **≈ 0.34 GB** of the EE 3 GB (P10) |

Download per refresh: about 0.15 GB zipped (the `1.` file 21 MB plus five figure files of 20-24 MB). Parse time measured with stdlib Python on the research machine: reports 68 s, each figure file 25-61 s (about 4.5 min for the window; 🟡 for the named profile). This runs monthly and in the background after the register, so it does not touch the 5-minute daily budget.

## Fixtures
- `packages/sources/src/ee/ee-rik-annual-reports/fixture.ts` writes:
  - a download page HTML with the Annual reports block: hrefs for two cut-off months, counters `_0` and `_1`, an unrelated `2.` and `3.` href, and the daily register hrefs (so the regex is proven selective);
  - the `1.` zip and six `4.<year>` zips (one year outside the window), with the exact headers, BOM, `;` and quoting.
- About 25 reports for fixture companies (codes per the fixture id rule, shared with the register fixtures): a micro company with a calendar year; one with a fiscal year ending 30 June; a PDF-only report; a liquidation-only report; a report whose `RetainedEarningsLoss` appears in two tables with different values; a report for a code not in the fixture register; a figure with an empty value; a report whose `TotalAnnualPeriodProfitLoss` is missing but `TotalProfitLoss` is present.
- Two fixture months: in month 2 one report's revenue changes and the oldest year leaves the window.

## Tests
- `packages/sources/src/ee/ee-rik-ar-reports/ee-rik-ar-reports.test.ts`: URL discovery from the fixture page picks the newest cut-off per family and rejects `2.`/`3.` and daily files; a page missing a family fails with `url_discovery_failed`; as-of from the file name; the window keeps five years; codes not in the register are skipped and counted.
- `packages/sources/src/ee/ee-rik-ar-figures/ee-rik-ar-figures.test.ts`: element → concept map; table precedence picks the balance-sheet value; `TotalProfitLoss` fallback; consolidated, cash-flow and allocation tables ignored; empty value skipped, never 0; PDF-only report gives `figuresPublished: false` and no facts.
- `packages/sources/src/licences.test.ts`, `packages/sources/src/field-maps.test.ts`: as in `ee-register.md`.
- `ingest/src/purge.test.ts` (shared): month 2 removes the old year's reports and facts and updates the changed revenue.
- `ingest/src/unchanged.test.ts`: same cut-off dates → no download, one `unchanged` sync.
- `ingest/src/as-of.test.ts`: the fixture syncs with `as_of_basis = in_file_name`; a figures group that reappears after closing fails `schema_changed`.
- `ingest/src/purge-guard.test.ts` (window case): month 2 dropping the oldest year passes; a month 2 file missing half of one year's reports ends `purge_guard`.
- `ingest/src/parser-version.test.ts`: same zips with a changed element → concept table are re-parsed from the raw cache.
- `domain/src/report/not-filed.test.ts`: "[year] not filed" for an obliged company with no report after the deadline; no such line for a company without accounting obligation or before the deadline.
- `store/src/provenance.test.ts`: every fact report resolves to a `SourceRef` with `cc-by-4.0` and the attribution text.

## Failure modes
- Download page unreachable or changed so that no family matches: `failed` with `url_discovery_failed`; the previous figures stay with their as-of date.
- A zip URL from the page returns 404 (renamed between page read and download): retry the page once, then `failed`.
- Header change in either CSV: `failed` with `schema_changed`.
- Truncated CSV (an unclosed quote, or a file that parses but lacks many reports): `partial`; the purge guard keeps every report in the window.
- Cut-off date older than the last content sync: `stale_skipped`. No strategy yields a date: `failed` with `as_of_missing`.
- UI: no report for a year → S06 NP or "[year] not filed"; a PDF-only report → "Filed [date]; figures not in the open data (PDF filing)".

## Open questions
1. **`liabilities`** is in the shared concept list but is not one element here. Options: leave it empty for EE (this spec), or derive `current_liabilities + non_current_liabilities` with the "Derived by Finora" chip. Council or architect to choose.
2. **Filing deadline for "[year] not filed".** This spec assumes 6 months after the fiscal year end (from the Commercial Code's annual-report rule); it was not read on the primary text during research. To be verified before the S06 slice.
3. **Non-profit lines** (`TotalRevenue`, `NetSurplusDeficitForPeriod`, ...) are not read: the concept list has no `total_income`. If S06 should show non-profits' income, a new concept is needed.
4. **Extra drop reasons and sync reasons:** `url_discovery_failed` (a sync failure kind), `duplicate_period`, `unknown_table`, `invalid_value`, `orphan_figure`. Proposal: add them to the unions.
5. **Classifier labels:** the size-category and audit-opinion labels are Estonian; English glosses by data-baltics. Proposal: ship them in `domain/config/` like the register labels (`ee-register.md` question 4).
