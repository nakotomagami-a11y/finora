# lt-sodra: Sodra (State Social Insurance Fund Board) public insurer data, live and not stored

Covers two `SourceMeta` entries, both `live-no-store`:

| Source id | Artifact | Fills |
|---|---|---|
| `lt-sodra-insured` | daily insured-persons file (`Apdraustuju_skaicius.zip`) | S07.LT.01 (latest count) |
| `lt-sodra-debts` | daily social-insurance debts file (`Skolos.zip`) | S08.LT.02 |

**Storage decision (Part H, Baltic-spec call 2):** legal cannot confirm a licence record for Sodra ("public by law" is not a licence), so `store` is refused for now. The product requirement is a deterministic daily fetch held in memory only (`live-no-store`, as with the EE debtor list), so the social-insurance debt check stays in the $0 instant profile. Both daily files are small (0.4-0.8 MB zipped, 2 MB unzipped) and fit a live fetch.

**Not loaded in v1:**
- The yearly files of monthly insurer data (`https://atvira.sodra.lt/imones/downloads/<year>/monthly-<year>.csv.zip`, 143 MB a year unzipped): too large for `live-no-store`, and storing them needs the licence record. S07.LT.01's 24-month line shows `not_checked{reason: "later"}` with "Not checked: licence question pending"; the latest count still shows. The field map for the day it is cleared is kept at the end of this spec ("Deferred: `lt-sodra-monthly`").
- The monthly averages file (`Vidurkiai.zip`): average salary is LATER (Part C, S07), and its gender split is never stored (P3).

## Source

- Publisher: Sodra. Official page: `https://sodra.lt/viesi-draudeju-duomenys` ("Vieši draudėjo duomenys"). Files:
  - `https://sodra.lt/Failai/Apdraustuju_skaicius.zip` (one member: `APDRAUSTUJU_SKAICIUS.CSV`)
  - `https://sodra.lt/Failai/Skolos.zip` (one member: `SKOLA.CSV`)
- Licence: `public-by-law-lt-sodra`. No licence is stated on the official page (checked 2026-11-19); the data is public under the Law on State Social Insurance, art. 15(3) ("vieši duomenys"). Licence record: `attributionRequired: true`, `shareAlike: false`, `nonCommercial: false`, `redistribution: false` (not established), so §4.2 invariant 3 allows `live-no-store`. Attribution: "Source: Sodra, public insurer data (Law on State Social Insurance, art. 15(3))". Every item carries the council's caveat "no licence stated by the publisher". Storage: `live-no-store`.
- Cadence and publication:
  - insured: daily; line 1 states "as of the start of [date]"; the 2026-11-20 file was online before 00:00 UTC (zip member time 00:04 local);
  - debts: daily; line 1 lists debtors "on [date]", the previous day; the member for 2026-11-18 was written at 05:47 local (03:47 UTC) on 2026-11-19, and at 04:12 UTC on 2026-11-20 the file was still that one, so it lags 1-2 days.
  Schedule both after 07:30 UTC with the other LT sources, and once at app start (memory is empty after a restart).
- Keys: none. Limits: none observed. Politeness: one file at a time. Zip handling, in memory only (no file is written): exactly one member expected; reject a member path with `/`, `\` or `..`; cap the uncompressed size at 50 MB; `failed` with `archive_unexpected` otherwise.
- `officialHosts`: `sodra.lt`, `www.sodra.lt`, `atvira.sodra.lt`.
- `deepLink`: `https://atvira.sodra.lt/imones/detaliai/index.html?code={recordKey}`, `recordKey` = the Sodra insurer code (Sodra's own public page of an insurer; no linking terms stated). `orderUrl`: `null`.
- Known publisher gaps: Sodra lists days when debts were not published or may be wrong (missing bank statements, e.g. 2026-05-09/10 and 2026-05-15/16). A missing day keeps the last list in memory with its date.

### Contract values (§4.2-§4.4)

| Source | `asOf` (strongest first; the first wins today) | `maxPurgeShare` (measurement) | `purgeScope` | Record unit, hash input, sort order |
|---|---|---|---|---|
| `lt-sodra-insured` | 1. `in_file_field`: the date in line 1 ("Apdraustųjų skaičius YYYY-MM-DD dienos pradžiai") (wins). sodra.lt's `Last-Modified` is later than its own `Date` header, so `http_last_modified` is not listed | **0.02**: 43 removed of 108,024 between the files of 2026-11-19 and 2026-11-20 (0.04%; 32 added, 1,493 changed), × 5 = 0.002 | `full` | one in-memory entry per row, keyed by the insurer code; no order assumed |
| `lt-sodra-debts` | 1. `in_file_field`: the date in line 1 ("Valstybinio socialinio draudimo fondui YYYY-MM-DD dienai skolingi draudėjai") (wins) | **0.234, interim by proxy**: not yet measured (the file did not regenerate between our pulls of 2026-11-19 and 2026-11-20 04:12 UTC). The comparable VMI arrears list removes up to 4.68% a day (`lt-tax`), so its 0.234 is used; a flat 0.02 would refuse a normal day. Measure: `diff_pulls.py snapshot` on two consecutive `SKOLA.CSV` files (key `Mokesčių mokėtojo kodas`, `--skip 1`, cp1257), then `diff`; set 5 × the removed share | `full` | one in-memory entry per row, keyed by the insurer code; no order assumed |

How the contract applies in `live-no-store` (§3.5): there are no records, `row_hash`, statements, facts or events. A sync parses the file into a fresh in-memory index (taxpayer code → values) and swaps it in only when the sync completes; the purge guard compares the new row count with the previous index's (counts only, kept in `syncs.report_json`): a file that would drop more than `maxPurgeShare` of the entries is refused, the previous index stays, and the sync ends `partial` with `purge_guard`. The one `syncs` row per attempt holds counts, as-of and `as_of_basis`, never values. `checkedAt` (A5) is the latest `content` or `unchanged` sync.

`parserVersion` (A1): the hash of the loader module, its field map and the generated item list. In `live-no-store` there is no raw cache to re-parse from, so a new `parserVersion` re-downloads (1.2 MB).

## Items

| item_id | Call | Caveat text | Empty state |
|---|---|---|---|
| S07.LT.01 | CAVEAT | Insured count from the social-insurance fund; no licence stated by the publisher | NP |
| S08.LT.02 | CAVEAT | Social-insurance fund; no licence stated by the publisher | CN |

S18.LT.02 (score inputs: social-insurance debt, insured counts; same caveat) reads the in-memory index through the same read path; no field of its own.

## Field map

Targets are in-memory values served through `SourcedValue` with the source's `SourceRef`; nothing is written to `finora.db`.

### `lt-sodra-insured` (`APDRAUSTUJU_SKAICIUS.CSV`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| line 1 | text | sync `upstream_as_of` | - | no | regex `\d{4}-\d{2}-\d{2}`; missing → `failed` `as_of_missing` |
| `Mokesčių mokėtojo kodas` | int | index key → company `lt-<code>` | S07.LT.01 | no | check digit; party gate |
| `Draudėjo kodas` | int | entry key (deep link) | S07.LT.01 | no | digits |
| `Apdraustųjų skaičius` | int | value of kind `daily_insured`, concept `insured_persons`, period end = as-of | S07.LT.01 | no | ≥ 0 |

### `lt-sodra-debts` (`SKOLA.CSV`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| line 1 | text | sync `upstream_as_of` (the debt date) | - | no | as above |
| `Mokesčių mokėtojo kodas` | int | index key → company | S08.LT.02 | no | check digit; party gate |
| `Draudėjo kodas` | int | entry key (deep link) | S08.LT.02 | no | digits |
| `Skola` | decimal, comma separator, space-padded | value of kind `debt_snapshot`, concept `social_debt`, period end = as-of | S08.LT.02 | no | trim, `,` → `.`; ≥ 0 |
| `Atidėta suma` | decimal | concept `social_debt_deferred` | S08.LT.02 | no | as above |

## Party gate

Every row is tied to a party: the code must pass the check digit, resolve to an `lt-rc-jar-entities` entity in the store, and (for debts) that entity must have `natural_person = 0`. Measured:

| Source | Kept | `natural_person_form` | other |
|---|---|---|---|
| insured (108,013 rows, 2026-11-20) | 96.6% | 3.4% (kept with the natural-person flag, see below) | 0 |
| debts (37,592 rows, 2026-11-18) | 97.0% | 3.0% (dropped, `natural_person_tax`) | 0 |

- **Debts of natural-person forms are dropped** (Part H 8: debt lines tied to a natural person are HIDE): never placed in the index, never logged; counted only.
- **Insured counts of natural-person forms are kept** in the index for the entity with `natural_person = 1`, shown only in the facts-only variant behind the purpose gate (Part H 8 treats sole-trader business figures like S06). See Open questions.
- All codes in both files are 9-digit register codes (measured).

## Identity and joins

- Company: `lt-<Mokesčių mokėtojo kodas>`. The entity must exist in the store (from `lt-register`); otherwise the row is skipped (`code_not_in_register`) and retried at the next fetch.
- Entry key: the insurer code (`Draudėjo kodas`), also the deep-link key.
- No hash input (no records); the swap-in is all or nothing.

## Refresh and change

- Daily download into memory, plus one at app start. Equal sha256 and `parserVersion` → `unchanged` (one `syncs` row; the index stays).
- Insured: current value only; no history is kept (P9 snapshots are stored history, which `live-no-store` forbids). The 24-month line waits for `lt-sodra-monthly` (deferred).
- Debts: current list only. **No `finora.debtor_listed` / `finora.debtor_cleared` events** (as for the EE debtor list in `live-no-store`, A4): an event would be a stored value. The S08 line reads "On Sodra's debtor list on [date]" or "Checked Sodra's debtor list as of [date]: none found", using the in-memory index and `checkedAt`.
- A change of storage class or licence (for example to `store`, once legal confirms a licence record) is a full reload into the new class plus a purge from the old location (§4.2, A7); for this source the old location is memory, so the first `store` sync simply writes the records, and `lt-sodra-monthly` can be enabled with it.

## Size and time budget

Nothing on disk. Memory: ≈ 108,000 insured entries and ≈ 36,500 debt entries, about 10 MB together. 🟡 Time: downloads 0.75 MB + 0.41 MB; parse < 0.1 s each (measured with Python's csv module); index swap in milliseconds. Available a few seconds after app start.

## Fixtures

- `APDRAUSTUJU_SKAICIUS.CSV` and `SKOLA.CSV`: **cp1257** (Windows Baltic) encoding, CRLF line ends, `;` delimiter, line 1 = the Lithuanian title with the date, line 2 = header (`Mokesčių mokėtojo kodas;Draudėjo kodas;Apdraustųjų skaičius` / `Mokesčių mokėtojo kodas;Draudėjo kodas;Skola;Atidėta suma`), line 3 = a dashed line, then rows with space-padded comma decimals (`           64,06`). Each zipped as one member.
- Content: the `lt-register` fixture companies (fixture codes: true check digit c written as (c + 1) mod 10; insurer codes from a fixed fictional range); a sole proprietorship with insured persons and a debt (the debt must never enter the index); a company missing from the register; sentinel amounts (for example `424242,42`) used by the no-store test; day-1 and day-2 files (one debtor added, one cleared); a header-only file; a malformed zip (two members) and one with a `../` path.

## Tests

- `packages/sources/src/lt/lt-sodra-insured/lt-sodra-insured.test.ts`: cp1257 decoding; title-line as-of; dashed line skipped; index entry per company; deep link from the insurer code.
- `.../lt-sodra-debts/lt-sodra-debts.test.ts`: comma decimals; two values; sole-proprietorship debt dropped (`natural_person_tax`).
- **No-store test:** `ingest/src/live-no-store.test.ts` (LT cases) loads both fixtures with a spied filesystem and logger: no store row, raw-cache file or log line contains a sentinel amount or a fixture code; only the `syncs` row with counts is written.
- **Swap and guard:** `ingest/src/live-no-store.test.ts`: a header-only debts file is refused (`purge_guard`), the day-1 index still answers; a normal day-2 file swaps in.
- **HIDE negative test (sole-trader debt):** `packages/ingest/src/lt-natural-tax.test.ts` (shared with `lt-tax`) covers the Sodra debt line on UI, API, MCP and export.
- **Report states:** `domain/src/report/assemble.test.ts` (LT): S07 shows the latest count and `not_checked{reason: "later"}` for the 24-month line; S08.LT.02 shows "Checked ... as of [date]" from `checkedAt`; after a restart with the fetch failing, S08.LT.02 shows "Not checked" (never "none found").
- Zip safety: `packages/sources/src/lib/zip.test.ts` (one member, path traversal refused, size cap, in-memory only).
- Shared tests: `party-gate.test.ts`, `as-of.test.ts` (`in_file_field` case), `stale.test.ts` (an older title date keeps the current index), `class-change.test.ts` (A7: a flip to `store` writes records; a flip back purges them).
- Licence: `sources/src/licences.test.ts`: `public-by-law-lt-sodra` with `redistribution: false` is accepted for `live-no-store` and refused for `store`; the caveat text is attached to S07.LT.01, S08.LT.02 and S18.LT.02.

## Failure modes

- sodra.lt down, HTML or 404: `failed`; the previous index stays (if the app has one since start) with its as-of and the stale badge; after a restart with no successful fetch the items show "Not checked" (NC), never "none found".
- Same title date with a different sha (a correction): parsed and swapped in; the as-of stays.
- Publisher gap day: the old file stays online (`unchanged`) or an older date arrives (`stale_skipped`); the index is kept.
- Truncated or header-only file: refused by the guard (`partial`, `purge_guard`).
- Encoding change (the file arrives in UTF-8): the header check fails → `failed` with `schema_mismatch`.

## Deferred: `lt-sodra-monthly` (enabled only with a `store` licence record)

`https://atvira.sodra.lt/imones/downloads/<year>/monthly-<year>.csv.zip` (UTF-8 with BOM, CRLF, `;`, bilingual header). Record unit: one row = one (insurer code, month); record key `<insurer code>:<YYYYMM>`; the file is ordered by insurer code with months inside (117,768 insurer runs in 945,868 rows of 2026), no grouping needed. Fields: `Draudėjo kodas (code)` (key), `Juridinių asmenų registro kodas (jarCode)` (company; empty in 0.6% → `no_code`), `Mėnuo (month)` (period), `Apdraustųjų skaičius (numInsured)` → `monthly_insured` / `insured_persons`, S07.LT.01; `avgWage` and `avgWage2` dropped (`later_item`); other columns not read. `purgeScope: periods_in_file` (months present in the two yearly files pulled); `maxPurgeShare` not measured (interim 0.02; measure by diffing two monthly pulls); as-of `max_date_in_data` on `Mėnuo (month)`, then `http_last_modified` (atvira.sodra.lt's header matched the file, 2026-10-26). ≈ 2.4M records for 24 months, ≈ 0.28 GB.

## Open questions

1. **Legal to confirm that `live-no-store` meets its position** for Sodra (Part H call 2), and whether a licence record can ever allow `store` (then `lt-sodra-monthly` and debtor events follow).
2. **Insured counts of sole proprietorships:** kept behind the purpose gate (facts-only), treated like S06. Legal to confirm, or they are dropped like the debts.
3. **Debts `maxPurgeShare`:** measure two consecutive debt files and replace the proxy (0.234).
4. **Names to add once to the shared config:** licence id `public-by-law-lt-sodra`; drop reasons `natural_person_tax`, `archive_unexpected`.
