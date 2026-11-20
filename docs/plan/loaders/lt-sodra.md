# lt-sodra: Sodra (State Social Insurance Fund Board) public insurer data, read live by the money agent

**No loader.** Sodra is `agent-only` (council 7029948837, legal 7029941385, gate 1; `01-data.md` Parts A, G, H; architecture §3.5). Legal could not confirm a licence record ("public by law" is not a licence, and the publisher states none), so nothing from Sodra is stored. The money agent reads the two daily files live through the shared tool `read_live_source` (`docs/plan/agents.md` §4.4b, owned by data-osint), and the instant profile shows "Social-insurance data: checked when you investigate". This spec holds the **file facts** the tool needs: URLs, format, as-of, the fields it returns, the party gate, fixtures and tests. The trigger to bring Sodra back into the instant profile is the publisher's quoted terms (`LAW-SODRA-LICENCE` in `docs/plan/lawyer-register.md`).

| Source id | Artifact | Fills (agent path only) |
|---|---|---|
| `lt-sodra-insured` | daily insured-persons file (`Apdraustuju_skaicius.zip`) | S07.LT.01 (latest count) |
| `lt-sodra-debts` | daily social-insurance debts file (`Skolos.zip`) | S08.LT.02, S18.LT.02 |

**Not read in v1:**
- The yearly files of monthly insurer data (`https://atvira.sodra.lt/imones/downloads/<year>/monthly-<year>.csv.zip`, 143 MB a year unzipped): too large for a live read, and a 24-month line would be stored history. The file facts are kept at the end ("Deferred: `lt-sodra-monthly`") for the day a licence record allows `store`.
- The monthly averages file (`Vidurkiai.zip`): average salary is LATER (Part C, S07), and its gender split is never read (P3).

## Source

- Publisher: Sodra. Official page: `https://sodra.lt/viesi-draudeju-duomenys` ("Vieši draudėjo duomenys"). Files:
  - `https://sodra.lt/Failai/Apdraustuju_skaicius.zip` (one member: `APDRAUSTUJU_SKAICIUS.CSV`)
  - `https://sodra.lt/Failai/Skolos.zip` (one member: `SKOLA.CSV`)
- Licence: `public-by-law-lt-sodra`. No licence is stated on the official page (checked 2026-11-19); the data is public under the Law on State Social Insurance, art. 15(3) ("vieši duomenys"). Licence record: `attributionRequired: true`, `shareAlike: false`, `nonCommercial: false`, `redistribution: false` (not established), so §4.2 invariant 3 requires `agent-only`, `live-no-store` or `connector-cache`; the council chose `agent-only`. Attribution: "Source: Sodra, public insurer data (Law on State Social Insurance, art. 15(3))". Caveat on every item: "Social-insurance fund, read at query time; no licence stated by the publisher".
- Storage: `agent-only`. The tool keeps the downloaded file in process memory for the rest of its publication day (one download per publication day, never written to disk, cache or log); an investigation keeps only the requested company's row as an investigation `document`, under the R11 TTL (`agents.md` §4.4b).
- Cadence and publication:
  - insured: daily; line 1 states "as of the start of [date]"; the 2026-11-20 file was online before 00:00 UTC (zip member time 00:04 local);
  - debts: daily; line 1 lists debtors "on [date]", the previous day; the member for 2026-11-18 was written at 05:47 local (03:47 UTC) on 2026-11-19, and at 04:12 UTC on 2026-11-20 the file was still that one, so it lags 1-2 days.
- Keys: none. Limits: none observed. Politeness: one file at a time, at most one download per file per publication day per install. Zip handling, in memory only: exactly one member expected; reject a member path with `/`, `\` or `..`; cap the uncompressed size at 50 MB; a tool error `archive_unexpected` otherwise.
- `officialHosts`: `sodra.lt`, `www.sodra.lt`, `atvira.sodra.lt`.
- `deepLink`: `https://atvira.sodra.lt/imones/detaliai/index.html?code={recordKey}`, `recordKey` = the Sodra insurer code (Sodra's own public page of an insurer; no linking terms stated). The citation uses it. `orderUrl`: `null`.
- Known publisher gaps: Sodra lists days when debts were not published or may be wrong (missing bank statements, e.g. 2026-05-09/10 and 2026-05-15/16). The tool reports the file's own date; it never claims a newer one.

### Contract values (§4.2, agent-only)

| Source | `asOf` (strongest first; the first wins today) | `maxPurgeShare` | `purgeScope` | Unit the tool returns |
|---|---|---|---|---|
| `lt-sodra-insured` | 1. `in_file_field`: the date in line 1 ("Apdraustųjų skaičius YYYY-MM-DD dienos pradžiai") (wins). sodra.lt's `Last-Modified` is later than its own `Date` header, so `http_last_modified` is not listed | n/a (nothing stored) | n/a | the company's rows (one per insurer code) |
| `lt-sodra-debts` | 1. `in_file_field`: the date in line 1 ("Valstybinio socialinio draudimo fondui YYYY-MM-DD dienai skolingi draudėjai") (wins) | n/a | n/a | the company's rows |

`parserVersion` does not apply (no records). The tool's parser is versioned with the agent-tools package; a parser change is a code change with its tests.

The citation's `asOf` is the file's line-1 date with `as_of_basis: in_file_field`; `retrievedAt` is the tool's fetch time.

## Items

| item_id | Call | Caveat text | Empty state |
|---|---|---|---|
| S07.LT.01 | CAVEAT (agent path only, live, not stored) | Social-insurance fund, read at query time; no licence stated by the publisher | AGENT ("Social-insurance data: checked when you investigate") |
| S08.LT.02 | CAVEAT (agent path only, live, not stored) | as above | AGENT |
| S18.LT.02 | CAVEAT (agent path only, live, not stored) | as above | AGENT |

In the instant profile, LT check 7 runs on the tax-authority arrears (S08.LT.01, `lt-tax.md`). The money agent adds social-insurance debts and fires the signal `social_insurance_debt` (`agents.md`).

## Field map

What `read_live_source` returns for one company. Nothing is written to `finora.db` or `finora-sa.db`.

### `lt-sodra-insured` (`APDRAUSTUJU_SKAICIUS.CSV`)

| Source field | Type | Tool output | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| line 1 | text | `asOf` | - | no | regex `\d{4}-\d{2}-\d{2}`; missing → tool error `as_of_missing` |
| `Mokesčių mokėtojo kodas` | int | match key (the pinned company's code) | S07.LT.01 | no | check digit; party gate |
| `Draudėjo kodas` | int | `recordKey` for the deep link | S07.LT.01 | no | digits |
| `Apdraustųjų skaičius` | int | `insuredPersons` | S07.LT.01 | no | ≥ 0 |

### `lt-sodra-debts` (`SKOLA.CSV`)

| Source field | Type | Tool output | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| line 1 | text | `asOf` (the debt date) | - | no | as above |
| `Mokesčių mokėtojo kodas` | int | match key | S08.LT.02 | no | check digit; party gate |
| `Draudėjo kodas` | int | `recordKey` | S08.LT.02 | no | digits |
| `Skola` | decimal, comma separator, space-padded | `socialDebt` | S08.LT.02 | no | trim, `,` → `.`; ≥ 0 |
| `Atidėta suma` | decimal | `socialDebtDeferred` | S08.LT.02 | no | as above |

## Party gate

The tool is called for one pinned company. It answers only when the code passes the check digit and resolves to an `lt-rc-jar-entities` entity in the store; otherwise it returns `code_not_in_register` and no row.
- **Debts of natural-person forms are never returned** (Part H 8: debt lines tied to a natural person are HIDE; legal 7029923420 item 1). For an entity with `natural_person = 1`, the debts lookup returns `not_applicable` and the row is never placed in a document.
- **Insured counts of natural-person forms** are returned only for the facts-only variant behind the purpose gate, as an aggregate per company (legal 7029923420 item 3).
- Measured shares, for scale: of the insured file (108,013 rows, 2026-11-20) 3.4% are natural-person forms; of the debts file (37,592 rows, 2026-11-18) 3.0%. All codes in both files are 9-digit register codes.

## Identity and joins

- Company: `lt-<Mokesčių mokėtojo kodas>`, the investigation's pin. The tool never searches by name.
- The insurer code (`Draudėjo kodas`) is only the deep-link key.

## Refresh and change

- No refresh job and no history. The tool downloads a file on first use in a publication day and keeps it in memory until the next publication day or an app restart.
- No `finora.debtor_listed` / `finora.debtor_cleared` events (they would be stored values). The finding reads "On Sodra's debtor list on [date]: [amount]" or "Checked Sodra's debtor list as of [date]: not listed".
- A change of storage class (for example to `store`, once a licence record allows it) is a migration (§4.2, A7): a new loader slice with records, and `lt-sodra-monthly` can come with it.

## Size and time budget

Nothing on disk. Memory while cached: ≈ 108,000 insured rows and ≈ 37,000 debt rows, about 10 MB together. Time: downloads 0.75 MB + 0.41 MB, parse under 0.1 s each (measured with Python's csv module), so the first call of the day adds a second or two; later calls answer from memory (cto 7029957075).

## Fixtures

- `APDRAUSTUJU_SKAICIUS.CSV` and `SKOLA.CSV`: **cp1257** (Windows Baltic) encoding, CRLF line ends, `;` delimiter, line 1 = the Lithuanian title with the date, line 2 = header (`Mokesčių mokėtojo kodas;Draudėjo kodas;Apdraustųjų skaičius` / `Mokesčių mokėtojo kodas;Draudėjo kodas;Skola;Atidėta suma`), line 3 = a dashed line, then rows with space-padded comma decimals (`           64,06`). Each zipped as one member.
- Content: the `lt-register` fixture companies (fixture codes: true check digit c written as (c + 1) mod 10; insurer codes from a fixed fictional range); a sole proprietorship with insured persons and a debt (the debt must never reach a document); a company missing from the register; sentinel amounts (for example `424242,42`) for the no-store test; day-1 and day-2 files; a header-only file; a malformed zip (two members) and one with a `../` path.

## Tests

- `agent-tools/src/social-insurance.test.ts` (architect's name, slice S10): the tool reads both fixture files live and returns the pinned company's values with `asOf` from line 1; a spied filesystem, store and logger see no sentinel amount and no fixture code (nothing written); a second call the same day makes no second download; a new publication day downloads again.
- Party gate in the same file: a sole proprietorship's debt is never returned (`not_applicable`); its insured count is returned only with a purpose; a code not in the register returns `code_not_in_register`.
- Parsing: cp1257 decoding, the title-line as-of, the dashed line skipped, comma decimals, deep link from the insurer code (`packages/sources/src/lt/lt-sodra/lt-sodra.parse.test.ts`, pure parser shared by the tool).
- HIDE negative test (sole-trader debt): covered on the agent path by the P8 canary (`agents/src/canary.test.ts`) and in `packages/ingest/src/lt-natural-tax.test.ts` (shared with `lt-tax`) for UI, API, MCP and export.
- Report states: `domain/src/report/assemble.test.ts` (LT): S07.LT.01, S08.LT.02 and S18.LT.02 show the AGENT state "Social-insurance data: checked when you investigate" in the instant profile, never "none found".
- Zip safety: `packages/sources/src/lib/zip.test.ts` (one member, path traversal refused, size cap, in memory only).
- Licence: `sources/src/licences.test.ts`: `public-by-law-lt-sodra` with `redistribution: false` is refused for `store` and accepted for `agent-only`.

## Failure modes

- sodra.lt down, HTML or 404: the tool returns an error; the money agent records "Social-insurance data: not checked (the source did not answer)", never "not listed".
- Same title date with a different sha (a correction): the newer download replaces the in-memory copy.
- Publisher gap day: the old file is served; the finding carries the file's own date.
- Truncated or header-only file, or an encoding change (header check fails): tool error `schema_mismatch`; never "not listed".

## Deferred: `lt-sodra-monthly` (only with a `store` licence record)

`https://atvira.sodra.lt/imones/downloads/<year>/monthly-<year>.csv.zip` (UTF-8 with BOM, CRLF, `;`, bilingual header). Record unit: one row = one (insurer code, month); record key `<insurer code>:<YYYYMM>`; the file is ordered by insurer code with months inside (117,768 insurer runs in 945,868 rows of 2026), no grouping needed. Fields: `Draudėjo kodas (code)` (key), `Juridinių asmenų registro kodas (jarCode)` (company; empty in 0.6% → `no_code`), `Mėnuo (month)` (period), `Apdraustųjų skaičius (numInsured)` → `monthly_insured` / `insured_persons`, S07.LT.01; `avgWage` and `avgWage2` dropped (`later_item`); other columns not read. `purgeScope: periods_in_file`; `maxPurgeShare` not measured (interim 0.02); as-of `max_date_in_data` on `Mėnuo (month)`, then `http_last_modified`. ≈ 2.4M records for 24 months, ≈ 0.28 GB.

## Open questions

1. **Debt-file removal share:** irrelevant while `agent-only`; measure two consecutive debt files before any move to `store`.
2. **Names to add once to the shared config:** licence id `public-by-law-lt-sodra`; tool errors `archive_unexpected`, `not_applicable`.
