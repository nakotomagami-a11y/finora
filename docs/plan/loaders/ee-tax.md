# ee-emta-tax: Tax and Customs Board (EMTA) taxes paid and tax debtors

Two `SourceMeta` entries, both share-alike and both switched by `SHARE_ALIKE_MODE` (§3.5):

| Source id | Artifacts | What it fills | `store` mode (default) | `live-no-store` mode |
|---|---|---|---|---|
| `ee-emta-taxes` | `tasutud_maksud_kaesolev_aasta.csv` (current and previous year), `tasutud_maksud_varasemad_aastad.csv` (older years) | S07.EE.01 employees, S08.EE.01b taxes paid | `share-alike-store` (`finora-sa.db`) | **not fetched**; both items show "Not checked: licence question pending (live-no-store mode)" |
| `ee-emta-debtors` | `maksuvolglaste_nimekiri.csv` | S08.EE.01a tax debtors, S18.EE.01 input | `share-alike-store` (`finora-sa.db`) | fetched into memory only; served from memory; never written |

## Source
- **Publisher:** Maksu- ja Tolliamet (Estonian Tax and Customs Board), page "Statistika ja avaandmed": https://www.emta.ee/ariklient/amet-uudised-ja-kontakt/uudised-pressiinfo-statistika/statistika-ja-avaandmed
- **URLs: share links that are not guaranteed stable** (`https://ncfailid.emta.ee/s/<token>/download/<file name>`). `fetch` reads the page above and takes the hrefs on host `ncfailid.emta.ee` ending in `/download/<file name>` for the three CSV names (the xlsx twins are ignored). A name missing from the page fails the sync with `url_discovery_failed` (reference: `research/probes/baltics/ee/fetch_emta.py`).
- **Licence:** `cc-by-sa-3.0`, per the dataset entries on the national portal https://andmed.eesti.ee ("Maksu- ja Tolliamet - Tasutud maksud, käive ja töötajate arv" and "Maksu- ja Tolliamet - Juriidilistest isikutest maksuvõlglaste nimekiri"); the EMTA page itself names no licence and says open data is free to use, reuse and share. Verified 2026-11-19. `shareAlike = true`, so licence invariant 2 (§4.2) requires `share-alike-store` or `live-no-store`.
- **Attribution** (the publisher states no wording; recorded proposals):
  - taxes: "Source: Estonian Tax and Customs Board, taxes paid, turnover and employees, CC BY-SA 3.0"
  - debtors: "Source: Estonian Tax and Customs Board, list of tax debtors, CC BY-SA 3.0"
  Single-company responses carry the attribution and the licence link (P1).
- **officialHosts:** `www.emta.ee`, `ncfailid.emta.ee`, `apps.emta.ee`. **deepLink:** none (the real-time lookup `https://apps.emta.ee/saqu/public/taxdebt` takes the code in a form; it may be shown as a plain "check live" link, no parameter). **orderUrl:** none.
- **Cadence and publication time:**
  - debtors: stated daily ("Uuendame tabelit kodulehel üks kord päevas"); `Last-Modified` 05:05 UTC on 19 Nov 2026. Job daily at 05:30 UTC. `cadence: "daily"`.
  - taxes: stated quarterly, "igale kvartalile järgneva kuu 10. kuupäeval" (on the 10th of the month after the quarter; the working day before if the 10th is a weekend or holiday); the 10 Oct 2026 file had `Last-Modified` 06:22 UTC. Job at 07:00 UTC on days 8-12 of every month; most runs end `unchanged`. `cadence: "monthly"` (cto's table).
- **Contract values (§4.2):**

  | Source id | `asOf` (strongest first) | Value seen | `purgeScope` | `maxPurgeShare` | Removal measurement |
  |---|---|---|---|---|---|
  | `ee-emta-taxes` | `in_file_field` `Andmete seis` (same on every row; more than one value fails `schema_changed`); `http_last_modified` | 2026-10-10; header 2026-10-10 06:22 UTC | `periods_in_file`: purge only inside the (year, quarter) periods that have a non-empty column in the files, so quarters we already hold and that left the files stay as our history | 0.02 | companies leave the file when they are deleted from the register: 217 of 153,997 companies in the 2026 Q3 rows were no longer in the register 40 days later (≈ 0.14%, so ≈ 0.3% per quarterly refresh); 5 x 0.3% = 1.6%, below the 2% floor |
  | `ee-emta-debtors` | `in_file_field` `Andmed on seisuga`; `http_last_modified` | 2026-11-19; header 2026-11-19 05:05 UTC | `full` | 0.02 interim | not measured: one pull held. Measure with `python -I research/probes/baltics/ee/diff_pulls.py diff` between the stored 19 Nov snapshot and the next day's, over at least 10 working days including a tax due date (the 10th or 20th). Daily exits from the list may exceed 0.4% around due dates; a guard hit then ends `partial` (safe, nothing deleted) and the value is raised to 5 x the measured share |

  `in_file_field` wins today for both. `checkedAt` (A5) comes from the latest `content` or `unchanged` sync, so "Checked: not on the tax board's debtor list" reads as checked today even on a day the file did not change.
- **`parserVersion`:** sha256 of `packages/sources/src/ee/ee-emta-tax/`, its field maps and the generated item list; the `SHARE_ALIKE_MODE` value is not part of it (a mode switch is a storage-class change, below).
- **Record units and order (A8):** `ee-emta-taxes`: one record per CSV row (one taxpayer and year), `recordKey` = `<Registrikood>:<Aasta>`, hash input = the read fields in field-map order with each quarter's three values in quarter order. `ee-emta-debtors`: one record per row, `recordKey` = `Registrikood`. `row_hash` 16 bytes. No sort order is relied on; a repeated key is skipped `duplicate_key` (1 duplicate code in the 19 Nov debtor file).
- **Keys:** none. **Limits:** none published. Politeness: page read once per run, then one download per file; `If-None-Match` with the stored ETag (the server sends ETag and `Last-Modified`), then sha256 decides (§4.4 step 1).
- **Format:**
  - taxes: UTF-8 without BOM, `,` delimiter, every field quoted, Estonian headers, whole euros as integer strings, empty string for "no value". Header: `"Andmete seis","Registrikood","Nimi","Liik","Maakond","Tegevusala","Aasta","Riiklikud maksud I kv","Riiklikud maksud II kv","Riiklikud maksud III kv","Riiklikud maksud IV kv","Tööjõumaksud I kv",...,"Tööjõumaksud IV kv","Käive I kv",...,"Käive IV kv","Töötajate arv I kv",...,"Töötajate arv IV kv"`. One row per taxpayer and year.
  - debtors: UTF-8 without BOM, `;` delimiter, header quoted, decimal comma (`1234,56`). Header: `"Andmed on seisuga";"Registrikood";"Nimi";"Maksuvõlg";"sh vaidlustatud";"sh tasumisgraafikus";"Tasumisgraafiku lõppkuupäev";"Vanima tasumata nõude tasumise tähtpäev"`.

## Items
Copied from `docs/plan/council/01-data.md` Part G.

| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S07.EE.01 | CAVEAT | Quarterly, from the tax board (CC BY-SA); board members are not counted | "N employees on [date]" / "No employee count from the tax board for [quarter]" / "Paid no state taxes in [year]: not in the tax board's file" / "Not checked: licence question pending (live-no-store mode)" |
| S08.EE.01a (tax debtors) | SHOW | - | CN |
| S08.EE.01b (taxes paid) | CAVEAT | Taxes paid for 39.1% of active companies; share-alike licence | NP / "Not checked: licence question pending (live-no-store mode)" |
| S18.EE.01 | SHOW | - | NC per check |

S18.EE.01 reads the debtor facts (and, in `store` mode, `finora.debtor_listed` age) through `domain/verdict`; nothing extra is loaded for it.

## Field map

### `ee-emta-taxes` (record key = `<Registrikood>:<Aasta>`, one record per CSV row)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `Andmete seis` | date | `syncs.upstream_as_of` | - | no | same value on every row |
| `Registrikood` | string | entity `ee-<code>` | resolution key | no | 8 digits + check digit, else skip `invalid_code` (non-residents carry other codes); party gate below |
| `Liik` | string | party gate input | - | - | `FIE` → row dropped `natural_person_tax` (7,091 rows in the 2025-2026 file); `Mitteresident` rows normally fail the code check |
| `Aasta` | int | quarter periods | S07.EE.01, S08.EE.01b | no | keep quarters inside the window (the latest 8 quarters that have data in the files: 2024 Q4 to 2026 Q3 on 10 Oct 2026) |
| (per quarter q in the window, for a row that exists) | | one `fact_reports` row: `kind = 'quarterly_tax'`, `period_start`/`period_end` = the calendar quarter, `currency = 'EUR'` | S07.EE.01, S08.EE.01b | no | written even when all four values are empty, so the domain can tell "in the file, no count" from "not in the file" |
| `Riiklikud maksud <q> kv` | integer string | fact `taxes_paid` | S08.EE.01b | no | empty → no fact (never 0) |
| `Tööjõumaksud <q> kv` | integer string | fact `labour_taxes` | S08.EE.01b | no | empty → no fact |
| `Töötajate arv <q> kv` | integer string | fact `employees` | S07.EE.01 | no | empty → no fact. The count is "people working on the last day of the quarter per the employment register, not counting board or supervisory-board members" (EMTA page); it is never 0 in the file |
| `Käive <q> kv` | integer string | **not read** | - | - | no Part G item (see Open questions) |
| `Nimi` | string | **not read** | - | yes for FIE | the register owns the name |
| `Maakond`, `Tegevusala` | string | not read | - | - | the register owns them |

S07.EE.01 states, computed in `domain/report` from these rows: a fact `employees` for the latest quarter → "N employees on [quarter-end date] (employment register, board members not counted)"; a report for the quarter without that fact → "No employee count from the tax board for [quarter]"; no report in the latest year → "Paid no state taxes in [year]: not in the tax board's file". On 10 Oct 2026, for 296,058 active business-form companies: 26.9% / 31.1% / 42.0%. EMTA warns the figures "cannot be used to calculate an average salary": no salary is derived.

### `ee-emta-debtors` (record key = `Registrikood`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `Andmed on seisuga` | date | `syncs.upstream_as_of`; `fact_reports.period_end` | S08.EE.01a | no | `kind = 'debt_snapshot'`, `currency = 'EUR'` |
| `Registrikood` | string | entity `ee-<code>` | resolution key | no | check digit; party gate below (12 non-numeric codes → `invalid_code`) |
| `Maksuvõlg` | decimal comma | fact `tax_arrears` | S08.EE.01a | no | ≥ 100 by the publisher's rule; parse `,` as decimal point |
| `sh vaidlustatud` | decimal comma | fact `tax_arrears_disputed` | S08.EE.01a | no | 0 is a real value here (the column is always filled) |
| `sh tasumisgraafikus` | decimal comma | fact `tax_arrears_deferred` | S08.EE.01a | no | the part in a payment schedule |
| `Vanima tasumata nõude tasumise tähtpäev` | date | fact `tax_arrears_age_days` = days from this date to the as-of date | S08.EE.01a, S18.EE.01 | no | new concept, see Open questions |
| `Tasumisgraafiku lõppkuupäev` | date | not read | - | - | no item |
| `Nimi` | string | not read | - | can be | the register owns the name; never read, so the ~8 natural-person names among the unregistered codes are never touched |

## Party gate
Both files go through `ingest/src/party-gate.ts`, row by row, against the main store's register entities (read-only; the share-alike store never writes there):
- **Loaded:** the code resolves to an `ee-` entity from `ee-rik-basic` that is not tombstoned and whose legal form is not `ee_fie`.
- **Dropped and counted:** `invalid_code`; `code_not_in_register` (debtors: 298 rows on 19 Nov 2026, mostly entities registered only with the tax board, of which about 8 name natural persons); `natural_person_form` (a code resolving to an FIE: 0 rows in the debtor list, which publishes legal persons only); `natural_person_tax` (`Liik = FIE` in the taxes file).
- So a natural person's tax or arrears line is never loaded (Part H item 8, P6), in either mode.

## Identity and joins
- Code → `ee-<code>` only; no other join. The register must have loaded first in the same boot; if the register is not loaded yet, the tax sync waits (it is scheduled after `ee-rik-basic`).
- In `store` mode the rows live in `finora-sa.db`, whose tables mirror the main ones but **key every row on the entity's public `eid` (text)**, never on `finora.db` integer ids (A6): `records`, `fact_reports` and `events` carry `entity_eid` instead of `entity_id`, so a rebuild of either file cannot break the join (`store/src/share-alike-rebuild.test.ts`). The share-alike store holds no `entities` rows of its own; the read path joins on `eid` at query time.

## Refresh and change

### Mode `share-alike-store` (default, `SHARE_ALIKE_MODE=store`)
- **Taxes:** each content sync re-reads both files; a record (company + year) whose `rowHash` changed has its quarterly reports and facts replaced; quarters leaving the window are purged. The older-years file rarely changes: its unchanged sha256 is enough for an `unchanged` sync of that artifact, but records span the window, so the parse always includes both files when either changed.
- **Debtors:** one `debt_snapshot` report per listed company, replaced daily (no daily copies, P9). History events, written to **`finora-sa.db`'s `events`** (they are derived from share-alike rows, so P1 keeps them out of the main store):
  - a code that appears: `finora.debtor_listed`, date = as-of, data = `{ "band": "<band>" }` with band `100-999`, `1000-9999`, `10000-99999` or `100000+` (companies only; natural persons never reach this step);
  - a code that disappears from a complete sync: the record and its report are purged and `finora.debtor_cleared` is written, date = as-of. "No longer on the debtor list since [date]" reads `not_evaluated{trackedSince}` until our snapshots cover the window (P14).
- An unchanged file and `parserVersion`: one `syncs` row of kind `unchanged` (in the main store's `syncs`, counts only; it holds no share-alike value).
- **Storage-class change** (§4.2, A7): flipping `SHARE_ALIKE_MODE`, or a licence change for these sources, is a migration: the next sync is a full reload into the new class, then every row of these sources is purged from the old location, and the class in force is recorded on each sync (`ingest/src/class-change.test.ts`).
- Export, the bulk API and bulk MCP tools never read `finora-sa.db` (P1).

### Mode `live-no-store` (`SHARE_ALIKE_MODE=live-no-store`)
- **Taxes:** not fetched. S07.EE.01 and S08.EE.01b render `not_checked{reason: "later"}` with "Not checked: licence question pending (live-no-store mode)" (§3.5: large files in this mode).
- **Debtors:** fetched at boot and daily at 05:30 UTC, **streamed into memory** (the polite fetcher is called with the raw cache disabled for this source, so no artifact file is written), parsed and party-gated in memory into a map `ee-<code> → { arrears, disputed, deferred, ageDays, asOf }`. The read path for S08.EE.01a and S18.EE.01 reads the map. The previous map is replaced only after a complete parse.
- Never written in this mode: no `finora-sa.db`, no `records`, `fact_reports`, `facts` or `events` row, no raw-cache file, no temp file, no log line or error message containing a code, amount or date from the file. `syncs` gets one row with counts and the as-of date only (§3.5 allows it). No `finora.debtor_listed`/`cleared` events, so "no longer on the debtor list since" is `not_evaluated` in this mode.
- Before the first successful fetch after boot, and when a fetch fails: S08.EE.01a renders `not_checked{reason: "source_unavailable"}`, never "Checked: no tax debt".
- **Switching modes:** at boot in `live-no-store`, an existing `finora-sa.db` is detached and deleted, and the raw-cache files of both sources are deleted (one log line naming the file, no values). Switching back to `store` starts a fresh share-alike store at the next refresh; debtor history is then "tracked since" that day.

## Size and time budget
Measured on the 10 Oct 2026 taxes file and the 19 Nov 2026 debtor list; 16 B per fact, 32 B per event, 60 B per report and records row (🟡).

| What (`store` mode, `finora-sa.db`) | Rows | Est. size |
|---|---|---|
| Taxes: company-year records in the window, after the gate | ≈ 0.45 M | ≈ 0.03 GB |
| Taxes: quarterly reports (8 quarters, gated) | ≈ 1.2 M | ≈ 0.07 GB |
| Taxes: facts (`taxes_paid`, `labour_taxes`, `employees`; ≈ 2 per report) | ≈ 2.4 M | ≈ 0.04 GB |
| Debtors: records, reports, 4 facts each | 19,622 | < 0.01 GB |
| Debtor events (≈ 50-200 a day, 🟡) | ≈ 50,000 a year | < 0.01 GB a year |
| **Total** | | **≈ 0.15 GB** of the 0.25 GB share-alike budget (P10) |

**Retained quarters (cto 7029931479).** Quarters that roll out of the file are kept as our history (`periods_in_file`), count against `HISTORY_MAX_GB`, and at ≈ 19 MB a quarter would fill the 0.25 GB share-alike cap within about five quarters. So when a quarter leaves the file, the loader **collapses that company-year into one annual report** (kind `annual_tax`, concepts `taxes_paid` and `labour_taxes` summed, `employees` = the mean of the quarters present, `period_start`/`period_end` = the year) in `finora-sa.db`, and deletes the four quarterly reports. The collapsed report keeps the `record_id` of the last quarterly record it absorbed, so its provenance stays the publisher's. About 4x smaller; the EE slice checks the share-alike store's size against its cap. Test: `packages/sources/src/ee/ee-emta-taxes/collapse.test.ts` (a fixture year with four quarters, then a file without that year: one annual report with the summed facts, no quarterly rows left, provenance intact; a partial year collapses only the quarters present).

`live-no-store` mode: 0 bytes on disk; the debtor map takes about 3 MB of memory.

Download: taxes 156 MB for both files (only on publication days; otherwise one page read and two ETag checks); debtors 1.3 MB daily. Parse time measured with stdlib Python on the research machine: taxes 23 s + 31 s, debtors under 1 s (🟡 for the named profile).

## Fixtures
- `packages/sources/src/ee/ee-emta-tax/fixture.ts` writes the EMTA statistics page HTML (with the three CSV hrefs and their xlsx twins), the two taxes CSVs and the debtor CSV with the exact headers, delimiters, quoting, number formats (integers for taxes, decimal comma for debtors) and no BOM.
- Rows for fixture companies (codes per the fixture id rule, shared with the register fixtures): a company with all four values in every quarter; one with taxes but an empty employee count; one present in 2025 only; an FIE row (`Liik = FIE`) with sentinel amounts; a non-resident with a non-numeric code; debtor rows for a company with a payment schedule and a disputed part, for a code not in the fixture register, for a code with a bad check digit, and for an FIE code.
- **Sentinels:** distinctive amounts (for example 7777777 and 123456,78) and a distinctive date on the share-alike rows, used by the negative tests to search the main store, the export, logs and the filesystem.
- Two fixture days for the debtor list: day 2 adds one company and drops another.

## Tests
CI runs every test below in both modes (`SHARE_ALIKE_MODE=store` and `live-no-store`), as §3.5 requires.
- `packages/sources/src/ee/ee-emta-taxes/ee-emta-taxes.test.ts`: URL discovery from the fixture page; header and number parsing; one report per quarter for an existing row, even when empty; empty cells give no fact; turnover never read; FIE rows dropped `natural_person_tax`; window of 8 quarters.
- `packages/sources/src/ee/ee-emta-debtors/ee-emta-debtors.test.ts`: decimal comma; the four facts; `tax_arrears_age_days`; name column never read (sentinel name absent from the output).
- `ingest/src/party-gate.test.ts`: EE debtor and taxes cases (register company, not in register, bad check digit, FIE code, `Liik = FIE`).
- `ingest/src/share-alike.test.ts` (`store` mode): after a full fixture load the main store contains no sentinel value and no row whose sync belongs to an `ee-emta-*` source, except `syncs` rows; `finora-sa.db` holds the reports, facts and debtor events; day 2 writes one `finora.debtor_listed` and one `finora.debtor_cleared`, both in `finora-sa.db`.
- `ingest/src/live-no-store.test.ts` (`live-no-store` mode): with a spied filesystem and logger, a debtor sync writes no file, no store row other than a counts-only `syncs` row, and no log line containing a sentinel; the taxes source is never fetched (fetcher spy); the read path serves the sentinel debtor from memory; after a simulated restart and before a fetch the item is `not_checked{source_unavailable}`; at boot an existing `finora-sa.db` is deleted.
- `store/src/share-alike-rebuild.test.ts`: rebuild `finora.db` from fixtures; the `finora-sa.db` rows still attach by `eid`.
- `ingest/src/class-change.test.ts`: switch `store` → `live-no-store` → `store` on the fixture; afterwards no row of these sources remains in the old location.
- `ingest/src/as-of.test.ts`: both fixtures sync with `as_of_basis = in_file_field`; a taxes file with two `Andmete seis` values fails `schema_changed`.
- `ingest/src/purge-guard.test.ts`: a debtor file with half the rows ends `purge_guard` and writes no `finora.debtor_cleared`; a taxes file purges only inside its periods (`periods_in_file`).
- `domain/src/export/export.test.ts`: the FtM export, the bulk API and the bulk MCP tool contain no sentinel value in either mode.
- `apps/server/src/routes/report.test.ts`: a single-company report carries the CC BY-SA attribution and licence link on S07/S08 values (`store` mode) and the "Not checked: licence question pending (live-no-store mode)" state for S07.EE.01 and S08.EE.01b (`live-no-store`).
- `domain/src/report/workforce-ee.test.ts`: the three S07 states from the fixture rows; no salary computed.
- `domain/src/verdict/history-window.test.ts` (shared): "no longer on the debtor list since" is `not_evaluated` on a fresh install and in `live-no-store`.
- `packages/sources/src/licences.test.ts`: `cc-by-sa-3.0` has `shareAlike = true`; both sources are `share-alike-store` in the registry, and the registry resolves them to `live-no-store` when the mode is set; never `store`.

## Failure modes
- EMTA page or file host down: sync `failed`; `store` mode keeps the last data with its as-of date; `live-no-store` keeps the last in-memory map until the process restarts, then `not_checked{source_unavailable}`.
- A share link changed and the page no longer lists a file name: `failed` with `url_discovery_failed`.
- Header change: `failed` with `schema_changed`, nothing written.
- Stale as-of (older than the last content sync): `stale_skipped`.
- A debtor list far shorter than yesterday's: the purge guard (`maxPurgeShare`) ends the sync `partial` with `purge_guard`: nothing purged, no `finora.debtor_cleared` events (a truncated file must never look like mass repayment). In `live-no-store` the same check keeps the previous in-memory map.
- UI: S08.EE.01a with no row → CN "Checked: not on the tax board's debtor list ([checkedAt date])"; S08.EE.01b and S07.EE.01 per the states above.

## Open questions
1. **New concept `tax_arrears_age_days`** (days since the oldest unpaid due date, at the list's as-of date). It is the only age signal the EE list gives; S18 can use it. If the concept list should not grow, drop the column instead.
2. **Taxable turnover (`Käive`)** is not read: no Part G item covers it, though the shared concept list has `taxable_turnover`. It is a quarterly revenue signal for companies without published annual figures. Council to decide whether S08.EE.01b (or a new item) shows it.
3. **`taxes_paid` vs `state_taxes`.** EMTA's "Riiklikud maksud" is the sum of all state taxes paid; this spec maps it to `taxes_paid` (the cross-country headline) and leaves `state_taxes` unused for EE. Confirm.
4. **Extra drop reasons:** `natural_person_tax` (in the shared list), `duplicate_key`, `url_discovery_failed`. Proposal: add the last two to the unions.
