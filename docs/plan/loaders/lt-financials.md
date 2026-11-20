# lt-financials: JAR financial statements, founding documents and non-filer lists (get.data.gov.lt)

Covers three `SourceMeta` entries:

| Source id | Artifact(s) | Fills |
|---|---|---|
| `lt-rc-jar-statements` | P&L key lines + balance-sheet key lines + the register UUID map (three API artifacts, one record per filed report: company, period end, template) | S06.LT.01, S13.LT.01 |
| `lt-rc-jar-documents` | founding documents + the register UUID map | S13.LT.01 |
| `lt-rc-jar-nonfilers` | companies whose statements are not in the register + the register's list of filings made after the legal term (`fa_veluojantys`) + the register UUID map | S13.LT.01 |

The list of companies with a missing auditor's opinion (`fa_nepateike_auditoriu_isvadu`) is not read: last loaded 2025-05-15 and no item needs it.

## Source

- Publisher: Registrų centras, through the State Data Agency's API. Dataset pages: `https://data.gov.lt/datasets/1666/` (P&L), `https://data.gov.lt/datasets/1806/` (balance sheet); founding documents and non-filers are listed under the same publisher (`https://get.data.gov.lt/datasets/gov/rc/jar/:ns`).
- Endpoints (Spinta UAPI; `/:format/csv` streams the whole result without a limit; no key):
  - P&L: `https://get.data.gov.lt/datasets/gov/rc/jar/pelno_ataskaitos/PelnoAtaskaita/:format/csv?select(juridinis_asmuo,template_id,standard_name,line_type_id,reiksme,laikotarpis_nuo,laikotarpis_iki,reg_date)&laikotarpis_iki>="<Y-5>-01-01"`
  - Balance sheet: the same on `.../balanso_ataskaitos/BalansoAtaskaita/...`
  - Founding documents: `.../dokumentai/Dokumentas/:format/csv?select(juridinis_asmuo,dokumento_tipas,dokumento_potipis,dok_data,dok_reg_data)`
  - Document classifiers (labels LT + EN): `.../dokumentu_tipai_potipiai/DokumentoTipas/:format/csv`, `.../DokumentoPotipis/:format/csv`
  - Non-filers: `.../fa_dokumentu_nepateike/Nepateikes/:format/csv?select(juridinis_asmuo,nepateikta_iki)`; filings after the legal term: `.../fa_veluojantys/VeluojantisPateikti/:format/csv?select(juridinis_asmuo)`
  - UUID map (shared by all three sources and by `lt-tax`): `.../iregistruoti/JuridinisAsmuo/:format/csv?select(_id,ja_kodas)` (552,531 rows)
  `<Y-5>` = the current calendar year minus 5 (2021 in 2026): the window that holds the latest 5 fiscal years.
- Licence: `cc-by-4.0` ("Creative Commons Attribution 4.0", data.gov.lt pages 1666 and 1806, verified 2026-11-19; the same publisher and licence on the document and non-filer datasets). Attribution: "Source: Registrų centras, Register of Legal Entities: financial statements (open data), CC BY 4.0". Storage: `store`.
- Cadence: stated weekly, observed monthly (loads on 2026-10-26 and 2026-10-28; documents and non-filers 2026-10-23). Scheduled **monthly** (cto §2), with a daily cheap probe (below). `publishedAtUtc`: unknown (irregular loads).
- As-of and change token: see Contract values below. The cheap probe is the contract's `changeToken` (§4.2): before downloading, `fetch` reads `<model>/:changes/-1` for each data model; if every `_cid` equals the one stored in the last content sync's `report_json`, it returns `{ unchanged: true }` without downloading (the 5-year statement pull is about 15 minutes of download). The UUID map is not part of the token: new register UUIDs do not change unchanged statements.
- Limits: none on the API for sequential requests. One `count()` on the balance-sheet table was answered by a WAF block page once: never call `count()` on the full tables; a non-CSV body (HTML) fails the fetch with `schema_mismatch`. The catalogue site `data.gov.lt` answers 429 after a few requests and is never called by the loader.
- `officialHosts`: `get.data.gov.lt`, `data.gov.lt`. `deepLink`: `null` (no per-company statement page). `orderUrl`: `null`.

### Contract values (§4.2-§4.4)

| Source | `asOf` (strongest first; the first wins today) | `maxPurgeShare` (measurement) | `purgeScope` | Record unit, hash input, sort order |
|---|---|---|---|---|
| `lt-rc-jar-statements` | 1. `portal_metadata`: the newer `_created` of the P&L and balance-sheet change logs (wins; 2026-10-28); 2. `max_date_in_data`: latest `reg_date`; 3. `http_last_modified` | **0.02**: the change feeds show 0 deletes on the loads of 2026-10-26 (balance sheet, 120,001 inserts of 10,329,853 rows) and 2026-10-27/28 (P&L, 110,903 + 9,098 inserts of 6,643,810); `removal_shares.py` | `window` on `laikotarpis_iki` ≥ `<Y-5>-01-01`: reports whose period end leaves the window are expected deletions; a report missing inside the window counts against the guard | one record per filed report = (company UUID, `laikotarpis_iki`, `template_id`); P&L and balance-sheet lines share the template (209,812 of 209,827 periods with both); hash input below; the stream is sorted by the line's own `_id`, unrelated to the company, so the parser groups through an on-disk temp table keyed (UUID, period end, template) |
| `lt-rc-jar-documents` | 1. `portal_metadata`: change-log `_created` (wins; 2026-10-23); 2. `http_last_modified`. `max_date_in_data` is not used: `dok_reg_data` holds dates up to 2046 | **0.02**: 0 deletes on the loads of 2026-03-16, 08-24 and 10-23 (16,180 to 82,866 inserts) | `full` | one record per document row; no order assumed |
| `lt-rc-jar-nonfilers` | 1. `portal_metadata`: the newer change-log `_created` of the two lists (wins; 2026-10-23); 2. `http_last_modified` | **0.02**: 0 deletes on the loads of 2025-09-03, 2026-03-16 and 2026-10-23 for non-filers, and 2025-05-15, 2025-09-03, 2026-10-23 for the after-term list (the lists only grow) | `full` | one record per (company, year) or (company, late); no order assumed |

`parserVersion` (A1): the hash of the loader module (with the duplicate and conflict rules), its field map (with the concept map below) and the generated item list. The document classifiers and the UUID map are fetched artifacts, not part of the parser.

## Items

| item_id | Call | Caveat text | Empty state |
|---|---|---|---|
| S06.LT.01 | SHOW | - | NP; "[year] not filed" |
| S13.LT.01 | SHOW | - | NP |

S18.LT.01 reads these rows (statements filed, non-filer flags) but has no field of its own.

## Field map

### `lt-rc-jar-statements` (P&L and balance-sheet rows have the same columns)

One record and one fact report per filed report: (company, period end, template). P&L and balance-sheet lines of the same filing share `template_id` and go into the same report. 786 company periods have more than one template (a filing redone on another template): each is its own record, and `domain/report` shows one report per period end, the one with the latest filing date, then the full form over the abbreviated one (both read from the `filing.annual_report` event of each record).

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `juridinis_asmuo._id` | UUID | company via the UUID map → `lt-<ja_kodas>`; part of `record_key` | S06.LT.01 | no | unresolved UUID → skip `code_not_in_register` |
| `laikotarpis_nuo` | date | `fact_reports.period_start` | S06.LT.01 | no | ISO date; ≤ period end |
| `laikotarpis_iki` | date | `fact_reports.period_end`; part of `record_key` | S06.LT.01 | no | ISO date; ≤ as-of date |
| `line_type_id` | text | fact concept (table below) | S06.LT.01 | no | unmapped ID → not read (counted `unmapped_line`) |
| `reiksme` | integer (EUR) | fact value | S06.LT.01 | no | integer; `currency` = `EUR`, `unit_scale` = 1 |
| `template_id` | text (`FS` + 4 digits) | part of `record_key`; event data `template` | S13.LT.01 | no | non-empty |
| `standard_name` | text | event data `form`: `abbreviated` when the name contains "(Trumpa)" or "(Sutrumpintas)", else `full` | S13.LT.01 | no | - |
| `reg_date` | date | event `filing.annual_report` (date = the latest `reg_date` of the record, data `{ periodEnd, template, form }`) | S13.LT.01 | no | ISO date |
| `line_name`, `template_name`, `standard_id`, `forma`, `statusas`, `_id` | | not read (`select()` leaves them out) | - | - | - |

Concept map (line IDs measured on the 2024+ pulls; one concept can have several IDs, one per statement template):

| Concept | Line IDs |
|---|---|
| `revenue` | ISLT00001, ISLT00345, ISLT00293, BSLT00606 |
| `profit_before_tax` | ISLT00017, ISLT00365, ISLT00309, BSLT00612 |
| `net_profit` | ISLT00019, ISLT00350, ISLT00310, BSLT00614, ISLT00222 |
| `non_current_assets` | BSLT00001 |
| `current_assets` | BSLT00021 |
| `total_assets` | BSLT00115 |
| `equity` | BSLT00040, BSLT00583 |
| `liabilities` | BSLT00055, BSLT00110, BSLT00467 |

`BSLT00393` (tangible fixed assets) is not read: no concept. `total_assets` is stored only when the source states it (BSLT00115); the report may show non-current + current assets as a sum with the "Derived by Finora" chip (computed in `domain/report`, never stored).

Duplicate and conflicting lines inside one record (measured: 45.7% of company periods repeat a line ID; 98% of repeats are byte-identical rows; the rest differ by template, which is now a separate record, or by filing date):
1. identical (line ID, value) rows collapse to one;
2. different values: the row with the latest `reg_date` wins (an amended filing; 0.3% of reports have more than one filing date);
3. same `reg_date`, different values: the concept is left out of the report and counted `conflicting_line`.

Window: every report whose period ends on or after `<Y-5>-01-01` (load rule 3: the latest 5 fiscal years, plus the current one when filed early). Deregistered companies: no statements (identity only), skip `struck_off_identity_only`. Natural-person forms: loaded (S06 for sole traders is CAVEAT behind the purpose gate, Part H 8; access follows the entity's `natural_person` flag).

### `lt-rc-jar-documents`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `juridinis_asmuo._id` | UUID | company via the UUID map | S13.LT.01 | no | unresolved → skip `code_not_in_register` |
| `dokumento_tipas._id` | UUID | event data `type` = classifier `kodas` (labels LT + EN from the classifier) | S13.LT.01 | no | unresolved → `type` = null, counted |
| `dokumento_potipis._id` | UUID | event data `subtype` = classifier `kodas` | S13.LT.01 | no | as above |
| `dok_data` | date | event data `documentDate` | S13.LT.01 | no | ISO date |
| `dok_reg_data` | date | event `filing.founding_document`, date = `dok_reg_data` | S13.LT.01 | no | ISO date; later than as-of + 1 day → skip `future_date` (the data holds dates up to 2046) |

The dataset holds founding documents only (articles of association, deeds and regulations, since 2024): 202,306 rows, 70,368 companies. It is not a list of all filings.

### `lt-rc-jar-nonfilers`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| non-filers `juridinis_asmuo._id` | UUID | company via the UUID map | S13.LT.01 | no | unresolved → skip |
| non-filers `nepateikta_iki` | year | event `register.nonfiler_listed`, data `{ fiscalYear, list: "not_filed" }`; S06 empty state "[year] not filed" | S13.LT.01 | no | 2015 ≤ year ≤ as-of year |
| `fa_veluojantys` `juridinis_asmuo._id` | UUID | event `register.nonfiler_listed`, data `{ fiscalYear: null, list: "filed_after_term" }` | S13.LT.01 | no | `veluojantis_iki` is 100% empty, so no year is read |
| `ja_reg_data`, `forma._id`, `statusas._id`, `veluojantis_iki` | | not read | - | - | - |

Event date for both lists: the `upstream_as_of` of the sync that first saw the row (the lists carry no date); an unchanged row keeps it.

## Party gate

Not applicable: every row is the filing company itself, keyed by the register UUID. The UUID map only contains register entities, so every resolved row is a register company or a natural-person form; natural-person forms are loaded under the facts-only rules above, not dropped, because statements are business data (Part H 8).

## Identity and joins

- Company: `juridinis_asmuo._id` → UUID map (`_id` → `ja_kodas`) → `lt-<ja_kodas>`. 100% of 2024+ statement, document and non-filer rows resolve on 2026-11-19. The map is fetched in the same sync as the data, so both are from the same load.
- The entity must already exist from `lt-rc-jar-entities`; otherwise the record is skipped (`code_not_in_register`) and retried next month.
- `record_key`: statements `<ja_kodas>:<laikotarpis_iki>:<template_id>`; documents `<ja_kodas>:<subtype>:<dok_data>:<dok_reg_data>` (documented derivation: the API `_id` is not proven stable across the publisher's full reloads); non-filers `<ja_kodas>:<nepateikta_iki>`, late filers `<ja_kodas>:late`.
- `hashInput` (`row_hash` = sha256 truncated to 16 bytes): statements = `[period_start, latest reg_date, form]` followed by every `(line_type_id, value)` pair after the duplicate rules, sorted by line ID (the group has no source order: the stream is sorted by line `_id`); documents = `[type, subtype, documentDate, dok_reg_data]`; non-filers = `[kind, fiscalYear]`.

## Refresh and change

- Monthly full pull of the 5-year window, preceded by the daily `_cid` probe. Unchanged artifacts (sha256 and `parserVersion`) → one `unchanged` sync row.
- A period that leaves the 5-year window is purged with its report (expected each January; `purgeScope: window`, so these deletions do not count against `maxPurgeShare`).
- A changed report (an amended filing) replaces its facts; no history event (financial history is the reports themselves).
- Non-filer rows disappear when the company files: purged with their events (the lists are current state; no `finora.*` event).
- `maxPurgeShare` and `purgeScope` per source: Contract values above.
- A change of storage class or licence is a full reload into the new class plus a purge from the old one (§4.2, A7).

### Check 5: annual report in the register (Part H, council and legal on the Baltic specs)

The non-filer list says a year's statements are not in the register. Check 5 compares the register with **Finora's estimate of the usual filing window**: for LT, 5 months + 30 days after the financial year ends (`domain/config/filing-windows.ts`, LT `{ months: 5, graceDays: 30 }`; architecture §5, test `domain/src/checks/filing-window.test.ts`). The soft flag reads "Annual report for [year] not in the register, [N] months after the year ended", and the window is labelled "Finora's estimate of the usual filing window". It states a fact about the register, not a legal conclusion, so it needs no lawyer; the UI, the event names and this spec never call a company's filing late or overdue, and never name a statutory date (legal, council).

Background for the estimate (secondary sources read on 2026-11-20): the ordinary general meeting approves the annual statements within 4 months of the year end (Law on Companies), and the approved set goes to the register within 30 days of approval (Civil Code art. 2.66(4)); a 2025 draft amendment would make the approval term 5 months. The council's 5 months + 30 days is therefore a generous window, which can only under-flag. A lawyer-confirmed statutory date can replace the estimate later.

## Size and time budget

Measured: P&L lines with period end 2021+ = 3,236,907; balance-sheet lines 2021+ = 5,226,601 (counts from the API on 2026-11-19); 2024+ reports (company, period end) = 316,125, of which 143,457 companies have two periods and 26,645 one.

| Source | Rows read | Records | Facts | Events | 🟡 Disk |
|---|---|---|---|---|---|
| statements | ≈ 8.46M lines | ≈ 0.8M reports | ≈ 4M after the duplicate rules (≈ 5 per report) | ≈ 0.8M `filing.annual_report` | facts 64 MB, report rows ≈ 40 MB, events ≈ 26 MB, records ≈ 48 MB |
| documents | 202,306 | 202,306 | 0 | 202,306 | ≈ 19 MB |
| non-filers | 133,068 | 133,068 | 0 | 133,068 | ≈ 12 MB |
| UUID map | 552,531 | 0 (in memory during parse) | 0 | 0 | raw cache only, ≈ 25 MB |

Total ≈ 0.23 GB of the LT budget (2 GB, P10). 🟡 First load: download dominates (the 2024+ P&L pull of 126 MB took 208 s; the 5-year pulls are about 2.5x larger: ≈ 10-15 min for both tables), parse ≈ 15 s (measured 1.7 s and 3.1 s for the 2024+ files), write ≈ 1 min; runs in the background after the LT register. Monthly refresh: the same download; daily probe: one small request per model.

## Fixtures

`packages/sources/src/lt/lt-rc-jar-statements/fixture.ts` (and the other two) write the API CSV layout: UTF-8, LF line ends, `,` delimiter, `"` quoting, header = the selected property names in API order with refs as `name._id`, for example `juridinis_asmuo._id,standard_name,line_type_id,reiksme,laikotarpis_nuo,laikotarpis_iki,reg_date`. Plus a fixture `:changes/-1` JSON body (`{"_data":[{"_cid":<n>,"_created":"<ISO>","_op":"patch",...}]}`) and a UUID map CSV `_id,ja_kodas`.

Content: the fixture companies of `lt-register` (fixture codes per the fixture rule; random UUIDs from a fixed seed). Cases: a full-form and an abbreviated-form report; one report with every concept; byte-identical duplicate lines; an amended filing (two `reg_date`s, different values); a same-date conflict (counted `conflicting_line`); a report whose period ends before the window (not loaded; a later fixture day moves the window and purges one report as an expected deletion); a deregistered company's statement (skipped); a sole proprietorship's statement (loaded, natural-person flag); an unmapped line ID; a document with a 2046 registration date; a non-filer with two years; a late filer; an unresolved UUID.

## Tests

- `packages/sources/src/lt/lt-rc-jar-statements/lt-rc-jar-statements.test.ts`: P&L and balance lines merge into one report; concept map; the four duplicate rules in order; window rule; struck-off skip; natural-person report flagged; `filing.annual_report` event per report; unmapped lines counted; every fact report carries `record_id` and the sync's licence.
- `.../lt-rc-jar-documents/lt-rc-jar-documents.test.ts`: classifier codes in event data; future-date skip; documented `record_key` derivation is stable across a reordered file.
- `.../lt-rc-jar-nonfilers/lt-rc-jar-nonfilers.test.ts`: one event per (company, year); `filed_after_term` rows without a year; a row that disappears is purged (current-state list); the S06 empty state "[year] not filed" is assembled from the event (`domain/report/assemble.test.ts` case).
- `packages/sources/src/lt/lt-uuid-map.test.ts`: shared map parsing; unresolved rows counted.
- Probe test: `lt-rc-jar-statements.fetch.test.ts` with a fake API: same `_cid` → `{ unchanged: true }` and no data request; new `_cid` → download.
- Grouping: `lt-rc-jar-statements.test.ts` shuffles the fixture lines (the source order is by line `_id`) and asserts the same records and `row_hash` values; two templates for one period give two records, and `domain/report/assemble.test.ts` shows the later filing.
- Shared ingest tests: `unchanged.test.ts`, `purge.test.ts`, `purge-guard.test.ts` (window: a January shift passes; half the reports missing inside the window ends `purge_guard`), `partial.test.ts` (a stream cut mid-file purges nothing), `stale.test.ts`, `parser-version.test.ts` (A1), `as-of.test.ts` (`portal_metadata` and `max_date_in_data` cases), and the change-token case in `lt-rc-jar-statements.fetch.test.ts`.
- `domain/src/checks/filing-window.test.ts`: the LT window for a calendar year and for a year ending 30 June; the flag text carries "Finora's estimate of the usual filing window" and none of the words late, overdue or deadline.
- Live check `lt-rc-jar-statements.live.test.ts` (nightly): endpoints return CSV with the fixture headers; the newest change log is ≤ 70 days old (two missed monthly loads); a WAF HTML body is detected as `schema_mismatch`.

## Failure modes

- API down or HTML instead of CSV: `failed`; last month's figures stay with their as-of; S06 shows "as of [date]".
- Stream cut (the 5-year pull is large): reports missing inside the window exceed `maxPurgeShare` (2%) → `partial` (`purge_guard`); nothing deleted; retried next day.
- Publisher reload with new UUIDs (the 2025-05-15 full reload touched 524,710 register rows): the map is fetched in the same sync, so joins still resolve; `record_key` uses `ja_kodas`, so no false churn.
- Stale data (no load for > 70 days, as in the register's six-month gap): the source shows the stale badge; S06 figures stay, labelled with their period ends.
- New line IDs (a new template): unmapped lines are counted in `report_json`; the live check alerts when the count exceeds 1% of lines.

## Open questions

1. **Names to add once to the shared config:** event data fields `template`, `form` on `filing.annual_report`; drop and skip reasons `unmapped_line`, `conflicting_line`, `struck_off_identity_only`, `future_date`.
2. **Concepts:** none new; `cash`, `current_liabilities` and `non_current_liabilities` are not in the LT key lines.
3. **Check 5 background:** the window is Finora's estimate by council decision, so nothing blocks the slice. Optional: read the Law on Companies and Civil Code art. 2.66(4) on e-tar.lt, and whether the 2025 amendment to 5 months was adopted; propose a new estimate to the council only if the law gives a longer term.
