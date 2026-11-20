# lt-sodra: Sodra (State Social Insurance Fund Board) public insurer data

Covers three `SourceMeta` entries:

| Source id | Artifact(s) | Fills |
|---|---|---|
| `lt-sodra-insured` | daily insured-persons file (`Apdraustuju_skaicius.zip`) | S07.LT.01 |
| `lt-sodra-debts` | daily social-insurance debts file (`Skolos.zip`) | S08.LT.02 |
| `lt-sodra-monthly` | yearly files of monthly insurer data (`monthly-<year>.csv.zip`, current and previous year) | S07.LT.01 |

The monthly averages file (`Vidurkiai.zip`, average insured income by contract type and gender) is not read: average salary is LATER (Part C, S07), and its gender split is never stored (P3).

## Source

- Publisher: Sodra. Official page: `https://sodra.lt/viesi-draudeju-duomenys` ("Vieši draudėjo duomenys"). Files:
  - `https://sodra.lt/Failai/Apdraustuju_skaicius.zip` (one CSV inside: `APDRAUSTUJU_SKAICIUS.CSV`)
  - `https://sodra.lt/Failai/Skolos.zip` (`SKOLA.CSV`)
  - `https://atvira.sodra.lt/imones/downloads/<year>/monthly-<year>.csv.zip` (`monthly-<year>.csv`; years from 2018 exist, 2017 does not)
- Licence: `public-by-law-lt-sodra`. No licence is stated on the official page (checked 2026-11-19); the data is public under the Law on State Social Insurance, art. 15(3) ("vieši duomenys"). Attribution: "Source: Sodra, public insurer data (Law on State Social Insurance, art. 15(3))". Every item carries the council's caveat "no licence stated by the publisher". Storage: `store` (see Open questions on the licence invariant).
- Cadence and publication:
  - insured: daily; the file states "as of the start of [date]"; the file for 2026-11-20 was online before 00:00 UTC (zip member time 00:04 local);
  - debts: daily; the file lists debtors "on [date]" = the previous day; the zip member for 2026-11-18 was written at 05:47 local, and on 2026-11-20 00:00 UTC the file was still the 2026-11-18 one, so it lags about a day and a half;
  - monthly: monthly, the previous month added by the end of the current month (2026 file updated 2026-10-26 with months to September).
  Schedule all three after 07:30 UTC with the other LT sources.
- As-of (`in_file_field`):
  - insured: the date in line 1 ("Apdraustųjų skaičius YYYY-MM-DD dienos pradžiai");
  - debts: the date in line 1 ("Valstybinio socialinio draudimo fondui YYYY-MM-DD dienai skolingi draudėjai");
  - monthly: `max_date_in_data` = the last day of the latest `Mėnuo (month)` value.
  sodra.lt's `Last-Modified` header is later than its own `Date` header (unreliable): never used.
- Keys: none. Limits: none observed. Politeness: one file at a time. Zip handling: exactly one member expected; reject a member path with `/`, `\` or `..`; cap the uncompressed size at 50 MB (daily) and 400 MB (monthly); `failed` with `archive_unexpected` otherwise.
- `officialHosts`: `sodra.lt`, `www.sodra.lt`, `atvira.sodra.lt`.
- `deepLink`: `https://atvira.sodra.lt/imones/detaliai/index.html?code={recordKey}` (insured and debts; `recordKey` is the Sodra insurer code, see below; the page is Sodra's own public view of an insurer; no linking terms stated). Monthly: the same pattern with the insurer code part of the key. `orderUrl`: `null`.
- Known publisher gaps: Sodra lists days when debts were not published or may be wrong (missing bank statements, e.g. 2026-05-09/10 and 2026-05-15/16). A missing day is a `failed` or `unchanged` sync; the UI shows the last list date.

## Items

| item_id | Call | Caveat text | Empty state |
|---|---|---|---|
| S07.LT.01 | CAVEAT | Insured count from the social-insurance fund; no licence stated by the publisher | NP |
| S08.LT.02 | CAVEAT | Social-insurance fund; no licence stated by the publisher | CN |

S18.LT.02 (score inputs: social-insurance debt, insured counts; CAVEAT with the same caveat text) reads these rows and has no field of its own.

## Field map

### `lt-sodra-insured` (`APDRAUSTUJU_SKAICIUS.CSV`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| line 1 | text | sync `upstream_as_of` | - | no | regex `\d{4}-\d{2}-\d{2}`; missing → `failed` `as_of_missing` |
| `Mokesčių mokėtojo kodas` | int | the company (`lt-<code>`) | S07.LT.01 | no | check digit; party gate |
| `Draudėjo kodas` | int | `record_key` (Sodra insurer code; used by the deep link) | S07.LT.01 | no | digits |
| `Apdraustųjų skaičius` | int | report kind `daily_insured`, fact `insured_persons`; `period_end` = as-of | S07.LT.01 | no | ≥ 0 |

### `lt-sodra-debts` (`SKOLA.CSV`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| line 1 | text | sync `upstream_as_of` (the debt date) | - | no | as above |
| `Mokesčių mokėtojo kodas` | int | the company | S08.LT.02 | no | check digit; party gate |
| `Draudėjo kodas` | int | `record_key` | S08.LT.02 | no | digits |
| `Skola` | decimal, comma separator, space-padded | report kind `debt_snapshot`, fact `social_debt`; `period_end` = as-of | S08.LT.02 | no | trim, `,` → `.`; ≥ 0 |
| `Atidėta suma` | decimal | fact `social_debt_deferred` | S08.LT.02 | no | as above |

### `lt-sodra-monthly` (`monthly-<year>.csv`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `Draudėjo kodas (code)` | int | part of `record_key` | S07.LT.01 | no | digits |
| `Juridinių asmenų registro kodas (jarCode)` | int | the company | S07.LT.01 | no | empty (0.6%) → skip `no_code`; check digit; party gate |
| `Mėnuo (month)` | YYYYMM | `fact_reports.period_start`/`period_end` = first and last day of the month; part of `record_key` (year) | S07.LT.01 | no | 24-month window: months after `<as-of month - 24>` |
| `Apdraustųjų skaičius (numInsured)` | int | report kind `monthly_insured`, fact `insured_persons` | S07.LT.01 | no | ≥ 0 |
| `Vidutinis darbo užmokestis (avgWage)`, `Vidutinis darbo užmokestis II (avgWage2)` | decimal | **dropped** (`later_item`: average salary is LATER) | - | no | negative test below |
| `Apdraustųjų skaičius II (numInsured2)` | int | not read (other insured persons; no item) | - | - | - |
| `Valstybinio socialinio draudimo įmoka (tax)` | decimal | not read (contributions; no item) | - | - | - |
| `Pavadinimas (name)`, `Savivaldybė...(municipality)`, the three activity columns | | not read (name and activity come from `lt-register`) | - | - | - |

## Party gate

Every row is tied to a party: the code must pass the check digit, resolve to an `lt-rc-jar-entities` entity, and (for debts) that entity must have `natural_person = 0`.

| Source | Loaded | `natural_person_form` | `no_code` |
|---|---|---|---|
| insured (108,013 rows, 2026-11-20) | 96.6% | 3.4% (kept with the natural-person flag, see below) | 0 |
| debts (37,592 rows, 2026-11-18) | 97.0% | 3.0% (dropped, `natural_person_tax`) | 0 |
| monthly 2026 (945,868 rows) | 95.8% | 3.6% (kept, as insured) | 0.6% |

- **Debts of natural-person forms are dropped** (Part H 8: tax, arrears and debt lines tied to a natural person are HIDE). Never written: no record, report, event or log value.
- **Insured counts of natural-person forms are kept** on the entity with `natural_person = 1`: business data shown only in the facts-only variant behind the purpose gate (Part H 8 treats sole-trader business figures like S06). See Open questions.
- All codes in the daily files are 9-digit register codes (measured); natural persons who employ staff without a register entity do not appear by code.

## Identity and joins

- Company: `lt-<Mokesčių mokėtojo kodas>` (daily files) or `lt-<jarCode>` (monthly).
- `record_key`: insured and debts = the insurer code (`Draudėjo kodas`), stable and the key of Sodra's own page; monthly = `<insurer code>:<year>`, holding up to 12 monthly reports (one record per insurer and year keeps the record count at about 0.2M instead of 2.4M).
- `hashInput`: insured `[taxpayer code, count]`; debts `[taxpayer code, Skola, Atidėta suma]`; monthly `[taxpayer code, (month, numInsured) sorted]`. The as-of date is not hashed: an unchanged count keeps its record and its report `period_end` is moved to the new as-of (one UPDATE per sync).
- A code missing from the register is skipped (`code_not_in_register`) and retried next sync.

## Refresh and change

- Daily (insured, debts) and monthly (monthly file) full downloads. sha256 + `parserVersion` equal → `unchanged`. The previous year's monthly file changes rarely (2025 file last updated 2026-01-27); fetch it once a month.
- Insured: current snapshot only (no daily copies, P9); history comes from the 24-month monthly series. Measured day-over-day: 32 added, 43 removed, 1,493 changed of 108,024 (1.45%).
- Debts: current list. Newly listed company → `finora.debtor_listed` (date = debt date, data `{ band }`), removed → record purged + `finora.debtor_cleared` (data `{ band }` of the last amount); bands as in `lt-tax` (`<100` ... `>=100k` EUR). Item S08.LT.02.
- Monthly: months leaving the 24-month window are dropped from their record (January drops the oldest year's record).
- `maxPurgeShare`: insured 5%, debts 15%, monthly 55% (the January year shift).

## Size and time budget

| Source | Rows read | Records | Reports × facts | Events | 🟡 Disk |
|---|---|---|---|---|---|
| insured | 108,013 | ≈ 0.10M (incl. natural-person forms) | ≈ 0.10M × 1 | 0 | ≈ 12 MB |
| debts | 37,592 | ≈ 36,500 | ≈ 36,500 × 2 | ≈ 2,000-3,000 a day (estimate; not yet measured day over day) | ≈ 4 MB; events ≈ 30 MB a year |
| monthly (24 months) | ≈ 2.52M (2026 file: 945,868 rows for 9 months) | ≈ 0.2M | ≈ 2.4M × 1 | 0 | reports ≈ 100 MB, facts ≈ 40 MB, records ≈ 12 MB |

Total ≈ 0.17 GB plus ≈ 30 MB of events a year. 🟡 Time: downloads 0.75 MB + 0.41 MB + 2 × 12-15 MB; parse 1.8 s per monthly file and < 0.1 s per daily file (measured); write ≈ 1 min first load, seconds daily.

## Fixtures

- `APDRAUSTUJU_SKAICIUS.CSV` and `SKOLA.CSV`: **cp1257** (Windows Baltic) encoding, CRLF line ends, `;` delimiter, line 1 = the Lithuanian title with the date, line 2 = header (`Mokesčių mokėtojo kodas;Draudėjo kodas;Apdraustųjų skaičius` / `Mokesčių mokėtojo kodas;Draudėjo kodas;Skola;Atidėta suma`), line 3 = a dashed line, then rows with space-padded comma decimals (`           64,06`). Each zipped as one member.
- `monthly-<year>.csv`: UTF-8 **with BOM**, CRLF, `;`, bilingual header exactly as published: `Draudėjo kodas (code);Juridinių asmenų registro kodas (jarCode);Pavadinimas (name);Savivaldybė, kurioje registruota(municipality);Ekonominės veiklos rūšies kodas(ecoActCode);Ekonominės veiklos rūšies kodas EVRK(ecoActCodeStr);Ekonominės veiklos rūšies pavadinimas(ecoActName);Mėnuo (month);Vidutinis darbo užmokestis (avgWage);Apdraustųjų skaičius (numInsured);Vidutinis darbo užmokestis II (avgWage2);Apdraustųjų skaičius II (numInsured2);Valstybinio socialinio draudimo įmoka (tax)`.
- Content: the `lt-register` fixture companies (fixture codes, true check digit + 1 mod 10; insurer codes from a fixed fictional range); a sole proprietorship with insured persons and a debt (the debt must vanish); a row with empty `jarCode`; a company missing from the register; avgWage values that must never be stored; day-1 and day-2 debt files (one company added, one cleared); a malformed zip (two members) and one with a `../` path.

## Tests

- `packages/sources/src/lt/lt-sodra-insured/lt-sodra-insured.test.ts`: cp1257 decoding; title-line as-of; dashed line skipped; `daily_insured` report with `period_end` = as-of; record keyed on the insurer code; deep link built from it.
- `.../lt-sodra-debts/lt-sodra-debts.test.ts`: comma decimals; two facts; sole-proprietorship debt dropped (`natural_person_tax`).
- `.../lt-sodra-monthly/lt-sodra-monthly.test.ts`: BOM; 24-month window across two yearly files; one record per (insurer, year); empty `jarCode` → `no_code`.
- **LATER negative test (average salary):** `lt-sodra-monthly.test.ts` asserts that no fact, statement or event holds an avgWage value, and `web/e2e/hide-items.spec.ts` (LT case) asserts no salary appears on UI, API, MCP or export.
- **HIDE negative test (sole-trader debt):** `packages/ingest/src/lt-natural-tax.test.ts` (shared with `lt-tax`) covers the Sodra debt line.
- Zip safety: `packages/sources/src/lib/zip.test.ts` (one member, path traversal refused, size cap).
- Shared ingest tests: `party-gate.test.ts`, `history.test.ts` (debtor listed and cleared with band), `unchanged.test.ts`, `stale.test.ts` (an older title date), `purge.test.ts`, `partial.test.ts`.
- Licence: `sources/src/licences.test.ts` covers `public-by-law-lt-sodra` (see Open questions) and that the caveat text is attached to S07.LT.01, S08.LT.02 and S18.LT.02.

## Failure modes

- File missing (sodra.lt answers HTML or 404): `failed`; the UI shows the last as-of ("Checked Sodra's debtor list as of [date]") with the stale badge, never "none found" for today.
- Same title date as the last content sync with a different sha (a correction): treated as content; the as-of stays.
- Publisher gap day (debts not published): `unchanged` or `stale_skipped`; nothing cleared.
- Truncated file: below `maxPurgeShare` → `partial`; no `debtor_cleared` events.
- Encoding change (the file arrives in UTF-8): the header check fails → `failed` with `schema_mismatch`.

## Open questions

1. **Licence invariant for `public-by-law-lt-sodra`:** §4.2 invariant 1 needs `redistribution = true` for `store`. The publisher states no licence; publication is required by law, and the council made the rows CAVEAT. Legal to confirm the licence record (`attributionRequired: true`, `shareAlike: false`, `nonCommercial: false`, `redistribution: true` on the basis of art. 15(3)); otherwise these sources must be `agent-only`, which breaks S07.LT.01 and S08.LT.02 in instant profiles.
2. **Insured counts of sole proprietorships:** kept behind the purpose gate (facts-only), treated like S06. Legal to confirm, or they are dropped like the debts.
3. **Deep link terms:** atvira.sodra.lt states no linking terms; the link is to the publisher's own public page.
