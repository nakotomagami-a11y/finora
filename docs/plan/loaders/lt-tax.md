# lt-tax: State Tax Inspectorate (VMI) taxpayer register, taxes paid and tax arrears

Covers three `SourceMeta` entries:

| Source id | Artifact(s) | Fills |
|---|---|---|
| `lt-vmi-taxpayers` | taxpayer register (one API artifact) | S01.LT.01 (VAT number and status) |
| `lt-vmi-taxes-paid` | taxes paid by legal entities + the register UUID map (from `lt-financials`) | S08.LT.01 |
| `lt-vmi-arrears` | tax arrears of legal entities | S08.LT.01 |

The tax authority's other datasets (declarations, tax audits, control actions, land and property tax) are not read: no item, and the audit and control tables are pseudonymised.

## Source

- Publisher: State Tax Inspectorate (VMI); taxes paid is published by the State Data Agency from VMI data. Dataset pages: `https://data.gov.lt/datasets/607/` (taxpayer register), `https://data.gov.lt/datasets/673/` (taxes paid), `https://data.gov.lt/datasets/1202/` (arrears).
- Endpoints (Spinta UAPI, `/:format/csv` streams the whole model; no key):
  - `https://get.data.gov.lt/datasets/gov/vmi/mm_registras/MokesciuMoketojas/:format/csv?select(ja_kodas,pvm_kodas_pref,pvm_kodas,pvm_iregistruota,pvm_isregistruota)`
  - `https://get.data.gov.lt/datasets/gov/vmi/ja_mokesciai/Moketojas/:format/csv?select(mm_kodas,metai,menuo,suma,atnaujinta)&metai>=<Y-2>`
  - `https://get.data.gov.lt/datasets/gov/vmi/ja_nepriemokos/NepriemokosSuma/:format/csv?select(ja_kodas,sukurta,atnaujinta,nepriemoka,pradelsta_nepriemoka,atideta_nepriemoka)`
  - UUID map: `https://get.data.gov.lt/datasets/gov/rc/jar/iregistruoti/JuridinisAsmuo/:format/csv?select(_id,ja_kodas)` (taxes paid keys companies by the register's internal UUID, not by code)
  `<Y-2>` = the current year minus 2 (3 years: 2024-2026 in 2026).
- Licence: `cc-by-4.0` ("Creative Commons Attribution 4.0" on pages 607, 673 and 1202, verified 2026-11-19). Attribution: "Source: State Tax Inspectorate (VMI), <dataset>, CC BY 4.0"; for taxes paid "Source: State Data Agency, taxes paid by legal entities (VMI data), CC BY 4.0". Storage: `store`.
- Cadence and publication: taxpayer register daily (load 01:08 UTC on 2026-11-19); arrears daily (load 07:03 UTC, two consecutive days observed); taxes paid monthly (catalogue), last load 2026-11-17 with data to October. Schedule: taxpayers and arrears daily after 07:30 UTC; taxes paid weekly probe, monthly expected.
- As-of:
  - taxpayers: `portal_metadata` (newest change-log `_created`);
  - taxes paid: `max_date_in_data` = the last day of the latest (`metai`, `menuo`); the change log of this model answers HTTP 500, so the change-log probe is not used here;
  - arrears: `max_date_in_data` = max(`atnaujinta`), cross-checked against `portal_metadata`; the event and report date is this list date.
- Limits: none observed on sequential requests. Politeness: 2 s between requests. ETag and Last-Modified are sent and `If-Modified-Since` answers 304: used as a hint only.
- `officialHosts`: `get.data.gov.lt`, `data.gov.lt`. `deepLink`: `null` (no per-company public page found). `orderUrl`: `null`.

## Items

| item_id | Call | Caveat text | Empty state |
|---|---|---|---|
| S01.LT.01 | SHOW | - | NP (LEI, VAT: — when absent) |
| S08.LT.01 | SHOW | - | CN |

S18.LT.01 (score inputs: overdue tax arrears, taxes paid) reads these rows; it has no field of its own. The arrears check renders as "Checked the tax authority's arrears list as of [date]: none found" when the company is not on the list (CN).

## Field map

### `lt-vmi-taxpayers`

931,744 rows, one per (taxpayer, branch, activity). Collapsed to one record per company before mapping.

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `ja_kodas` | int | the company entity; `record_key` | S01.LT.01 | no | check digit; party gate (below) |
| `pvm_kodas_pref` + `pvm_kodas` | text, 9 or 12 digits | statement `vatCode` = `LT` + `pvm_kodas`; `links` row VAT ↔ `lt-<code>` | S01.LT.01 | no | digits only, length 9 or 12; when a company has several, the one with the latest `pvm_iregistruota` |
| `pvm_iregistruota` | date | statement `finora:vatRegisteredSince` | S01.LT.01 | no | ISO date |
| `pvm_isregistruota` | date | statement `finora:vatDeregisteredOn`; `finora:vatRegistered` = (empty) | S01.LT.01 | no | ISO date; future dates (the data holds dates in the next month) are kept as stated |
| `pavadinimas`, `ireg_data`, `tipo_*`, branch columns (`padalinio_*`), activity columns (`ekonomine_veikla`, `veiklos_*`, `pagrindine`), place-of-business columns (`vv_*`), group columns (`mm_grupe`, `grup_*`) | | not read (`select()` leaves them out; activity comes from `lt-lsd-activity`) | - | - | - |

### `lt-vmi-taxes-paid`

One row per company and year: taxes paid in that year up to the stated month.

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `mm_kodas._id` | UUID | company via the UUID map (it is the register UUID, not the taxpayer-register id); part of `record_key` | S08.LT.01 | no | unresolved → skip `code_not_in_register` (1.1% of rows on 2026-11-19); party gate |
| `metai` | year | `fact_reports.period_start` = `<metai>-01-01`; part of `record_key` | S08.LT.01 | no | ≥ `<Y-2>` |
| `menuo` | month | `fact_reports.period_end` = the last day of `menuo` in `metai` | S08.LT.01 | no | 1-12 |
| `suma` | decimal (EUR) | report kind `ytd_tax`, fact `taxes_paid` | S08.LT.01 | no | ≥ 0; `currency` = `EUR` |
| `atnaujinta` | date | not stored; feeds the as-of check | - | no | - |
| `pavadinimas`, `tipas`, `apskritis`, `savivaldybe`, `praeitu_metu_suma`, `einamu_metu_suma` (100% empty) | | not read | - | - | - |

### `lt-vmi-arrears`

One row per company on the list date. List-based: a company not on the list has no arrears on that date.

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `ja_kodas` | int (9 digits; 482 rows carry 10 digits) | the company; `record_key` | S08.LT.01 | no | check digit → else skip `invalid_code`; party gate |
| `nepriemoka` | decimal (EUR) | report kind `debt_snapshot`, fact `tax_arrears`; `period_end` = list date | S08.LT.01 | no | ≥ 0 |
| `pradelsta_nepriemoka` | decimal | fact `tax_arrears_overdue` | S08.LT.01 | no | ≥ 0 |
| `atideta_nepriemoka` | decimal | fact `tax_arrears_deferred` | S08.LT.01 | no | ≥ 0 |
| `sukurta` | date | event data `listedSince` on `finora:debtor_listed` (see Open questions) | S08.LT.01 | no | ISO date |
| `atnaujinta` | date | as-of (max over the file) | - | no | - |
| `atideta_pradelsta` | decimal | not read (no concept; see Open questions) | - | - | - |
| `id`, `ja_pavadinimas`, `sav_kodas` | | not read | - | - | - |

## Party gate

Every row of these three sources is a party row (`ingest/src/party-gate.ts`, the LT rule): the code must pass the check digit (`invalid_code`), resolve to an `lt-rc-jar-entities` entity (`code_not_in_register`), and that entity must have `natural_person = 0` (`natural_person_form`, recorded as `natural_person_tax`: tax, VAT and arrears lines of sole traders are HIDE, Part H 8). Measured on 2026-11-19:

| Source | Loaded | `natural_person_form` | `invalid_code` | `code_not_in_register` |
|---|---|---|---|---|
| taxpayers (rows) | 90.6% | 9.4% | 0 | 0 |
| taxes paid (rows, 2024+) | 92.8% | 6.1% | 0 | 1.1% (unresolved UUID) |
| arrears (rows) | 93.5% (29,906) | 5.0% (1,600) | 1.5% (482) | 1 row |

Counts go into `syncs.report_json` by reason. Dropped rows are never written anywhere (no record, no event, no log line with a value).

## Identity and joins

- `lt-vmi-taxpayers`, `lt-vmi-arrears`: `ja_kodas` → `lt-<code>`. `lt-vmi-taxes-paid`: `mm_kodas._id` → UUID map → `lt-<code>`.
- `record_key`: taxpayers `<ja_kodas>`; taxes paid `<ja_kodas>:<metai>`; arrears `<ja_kodas>`.
- `hashInput`: taxpayers `[vatCode, pvm_iregistruota, pvm_isregistruota]`; taxes paid `[menuo, suma]`; arrears `[nepriemoka, pradelsta_nepriemoka, atideta_nepriemoka, sukurta]` (the list date is not hashed, so an unchanged debt keeps its record; the report's `period_end` is updated to the list date on every content sync, see below).
- `links`: one VAT ↔ code row per VAT company, asserted by the taxpayer record (§6 linking).
- A company missing from the register is skipped and retried next sync.

## Refresh and change

- Daily (taxpayers, arrears) and monthly (taxes paid) full pulls; sha256 + `parserVersion` equal → one `unchanged` row.
- Arrears is a current list. Each content sync:
  - a company newly on the list → `finora.debtor_listed` (date = list date, data `{ band, listedSince }`), item S08.LT.01;
  - a company no longer on the list → its record is purged and `finora.debtor_cleared` is written (date = list date, data `{ band }` of the last amount);
  - every listed company's report `period_end` is set to the list date (one UPDATE per sync, not a re-insert), so "as of [date]" is true for unchanged rows.
  Amount bands for events (companies only, §3.7): `<100`, `100-1k`, `1k-10k`, `10k-100k`, `>=100k` EUR. Only on-list and off-list events are stored (P9); no daily copies.
- Measured churn (change feed, 2026-11-18 → 19): 875 inserts, 1,379 deletes, 4,498 patches of 31,989 rows.
- Taxes paid: a year leaving the 3-year window is purged (January). `maxPurgeShare`: taxpayers 2%, taxes paid 40% (January), arrears 15%.
- VAT changes produce no history event (not one of the §3.7 attributes).

## Size and time budget

| Source | Rows read | Records | Statements / facts | Events | 🟡 Disk |
|---|---|---|---|---|---|
| taxpayers | 931,744 | ≈ 0.27M companies (registered, non-natural; deregistered keep identity only) | ≈ 0.45M statements (VAT companies × 3) | 0 | statements ≈ 55 MB, records ≈ 16 MB, links ≈ 5 MB |
| taxes paid | 389,482 (3 years) | ≈ 0.36M | ≈ 0.36M reports, 1 fact each | 0 | ≈ 21 MB + records ≈ 22 MB |
| arrears | 31,989 | ≈ 29,900 | ≈ 29,900 reports × 3 facts | ≈ 2,300 a day (listed + cleared) | ≈ 3 MB; events ≈ 25 MB a year |

Total ≈ 0.15 GB, plus ≈ 25 MB of events a year (P9 history). 🟡 Time: download 351 MB (taxpayers, streamed in 7 s on 2026-11-19), 236 MB (taxes paid, 5 s), 7 MB (arrears); parse 4.7 s, 2.9 s and 0.1 s measured; write < 1 min. Daily refresh ≈ 1 min.

## Fixtures

API CSV layout (UTF-8, LF line ends, `,`, header = the selected property names in API order, refs as `mm_kodas._id`). Files: `MokesciuMoketojas.csv` with several rows per company (branches and activities, one with two VAT codes), `Moketojas.csv` with three years for one company and a month-10 row for the current year, `NepriemokosSuma.csv` with a 10-digit code, a sole proprietorship, a company missing from the register, a tiny amount (0.03) and a deferred amount. A day-2 arrears file adds one company and removes one (drives `debtor_listed` / `debtor_cleared`). Codes follow the fixture rule (true check digit + 1 mod 10); names are fictional ("Demo Logistics UAB"); the sole proprietorship "Test Person A individuali įmonė".

## Tests

- `packages/sources/src/lt/lt-vmi-taxpayers/lt-vmi-taxpayers.test.ts`: collapse to one record per company; VAT selection rule; `vatCode` format; `links` row; sole-proprietorship VAT dropped (`natural_person_tax`).
- `.../lt-vmi-taxes-paid/lt-vmi-taxes-paid.test.ts`: UUID map join; `ytd_tax` periods (Jan 1 to the end of `menuo`); 3-year window; unresolved UUID counted.
- `.../lt-vmi-arrears/lt-vmi-arrears.test.ts`: three facts per report; `period_end` = list date; 10-digit code → `invalid_code`.
- **HIDE negative test (sole-trader tax, Part H 8):** `packages/ingest/src/lt-natural-tax.test.ts` loads the fixture day 1 and day 2 and asserts that no record, report, fact, event or log line carries the sole proprietorship's code or amounts, and that UI, API, MCP and export for its entity show no S08 values (`web/e2e/hide-items.spec.ts` LT case).
- Shared ingest tests: `party-gate.test.ts` (one case per LT reason), `history.test.ts` (`debtor_listed` with band and `listedSince`, `debtor_cleared` on removal, no event for a dropped natural person), `unchanged.test.ts`, `purge.test.ts`, `stale.test.ts`, `domain/src/verdict/history-window.test.ts` (the 180-day rule returns `not_evaluated` on a fresh install unless Open question 1 is accepted).
- Live check `lt-vmi-arrears.live.test.ts`: header unchanged; max `atnaujinta` ≤ 2 days old on weekdays.

## Failure modes

- API down or HTML: `failed`; the S08 arrears line shows the last list date with the stale badge ("Checked ... as of [date]"), never "none found" for today.
- Arrears file empty or cut short: below `maxPurgeShare` → `partial`, no `debtor_cleared` events are written (a cut file must never clear debtors).
- Stale list (max `atnaujinta` older than the last content sync): `stale_skipped`.
- Taxes-paid change log answering 500 (as on 2026-11-19): not used; sha and as-of decide.

## Open questions

1. **Listing date from the source:** the arrears list carries `sukurta`, the date the debt entry was created (from 2023-03). P14 says the LT 180-day arrears age reads "not evaluated" until our snapshots cover the window. With `sukurta` the age is source-stated from day one. Council and cto to decide whether the 180-day rule may use `listedSince`; this spec stores it either way.
2. **Deferred overdue arrears** (`atideta_pradelsta`): no concept in the shared list; not read. Add `tax_arrears_deferred_overdue` if a check needs it.
3. **VAT number of sole proprietorships:** dropped with the rest of their tax lines (`natural_person_tax`). It is an identifier, not credit-type data; legal to confirm whether it may be shown in the facts-only variant.
4. **As-of basis** for the taxpayer register (`portal_metadata`): review item A3, as in `lt-register`.
