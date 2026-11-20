# lt-avnt-bankruptcy: insolvency authority (AVNT) bankruptcy reports

One `SourceMeta`: `lt-avnt-bankruptcy`, the bankruptcy-report dataset of the Authority of Audit, Accounting, Property Valuation and Insolvency Management (AVNT).

**Dropped, with reasons:**
- Intentional bankruptcies (`datasets/gov/avnt/tyciniai_bankrotai`, 835 cases since 1994): not read. The report dataset already carries the intentional-bankruptcy date for every case opened since 2020; the older cases concern companies that are almost all struck off, which keep identity only (load rule 3). No item needs the separate list.
- Restructuring reports (`datasets/gov/avnt/imoniu_restrukturizavimas`): not read; the namespace answered HTTP 500 on 2026-11-19, and the register status (`restructuring`, from `lt-register`) carries the signal.
- Bankruptcy-report financial figures (`BankrotoAtaskaitosFinansai`): not read; no item.

The current insolvency **status** of every company comes from the daily register (`lt-rc-jar-entities`, statuses going bankrupt, bankrupt and liquidation due to bankruptcy). This source adds the dated timeline of each case.

## Source

- Publisher: AVNT. Dataset page: `https://data.gov.lt/datasets/1979/` ("Įmonių bankroto ataskaitų duomenys"). Endpoint (Spinta UAPI, no key): `https://get.data.gov.lt/datasets/gov/avnt/imoniu_bankrotas/BankrotoAtaskaitosDatos/:format/csv?select(imones_kodas,bankroto_iniciatorius,bankroto_data,apygardos_teismas,ne_teismo_tvarka,nutraukimo_data,nutraukimo_priezastis,likvidavimo_data,supaprastintas_bankrotas,nutrauktas_supaprastintas,tycinis_bankrotas,tycinio_bankroto_nutraukimas,sprendimas_del_pabaigos)`
- Licence: `cc-by-4.0` ("Creative Commons Attribution 4.0", data.gov.lt page 1979, verified 2026-11-20). Attribution: "Source: AVNT, bankruptcy reports of companies, CC BY 4.0". Storage: `store`.
- Cadence: quarterly (catalogue: "Kas ketvirtį"). Last load 2026-09-19; the newest event in the data is 2025-10-03, so the content lags about a year behind its loads. Scheduled weekly (a cheap change-log probe), content expected quarterly.
- As-of: `portal_metadata` (newest change-log `_created`) for freshness, plus `max_date_in_data` (the latest event date in the file) recorded in `report_json.contentAsOf`, which the S09 caveat line uses (see Open questions).
- Limits: none observed. Politeness: one request per sync.
- `officialHosts`: `get.data.gov.lt`, `data.gov.lt`. `deepLink`: `null`. `orderUrl`: `null`.

## Items

| item_id | Call | Caveat text | Empty state |
|---|---|---|---|
| S09.LT.01 | CAVEAT | Bankruptcy reports published up to Oct 2025 | CN |

S18.LT.01 reads the status and these events; no field of its own.

## Field map

Rows are grouped into one case per (company code, opening date) before mapping, where the opening date is the first non-empty of `bankroto_data`, `ne_teismo_tvarka`, `likvidavimo_data`, `sprendimas_del_pabaigos`. Measured: 5,937 rows → 5,631 cases; the repeated rows of a case differ mostly in the activity columns (not read) and in later dates (the case's later updates). Within a case, each date field takes the latest non-empty value; a conflicting initiator is counted `conflicting_value` and the first non-empty one is kept.

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `imones_kodas` | int | the company (`lt-<code>`); part of `record_key` | S09.LT.01 | no | check digit; party gate |
| `bankroto_data` | date | event `register.insolvency_opened`, data `{ procedure: "court", initiator, court }` | S09.LT.01 | no | ISO date |
| `ne_teismo_tvarka` | date | event `register.insolvency_opened`, data `{ procedure: "out_of_court", initiator }` | S09.LT.01 | no | ISO date |
| `supaprastintas_bankrotas` | date | event `register.insolvency_simplified` | S09.LT.01 | no | ISO date |
| `nutrauktas_supaprastintas` | date | event `register.insolvency_simplified_ended` | S09.LT.01 | no | ISO date |
| `bankroto_iniciatorius` | text (8 values) | event data `initiator` (normalised, table below) | S09.LT.01 | no | unknown value → `other`, counted |
| `apygardos_teismas` | text (5 regional courts) | event data `court` | S09.LT.01 | no | trimmed court name (an institution, not a person) |
| `likvidavimo_data` | date | event `register.liquidation`, data `{ cause: "bankruptcy" }` | S09.LT.01 | no | ISO date |
| `tycinis_bankrotas` | date | event `register.intentional_bankruptcy` | S09.LT.01 | no | ISO date |
| `tycinio_bankroto_nutraukimas` | date | event `register.intentional_bankruptcy_lifted` | S09.LT.01 | no | ISO date |
| `nutraukimo_data` | date | event `register.insolvency_closed`, data `{ reason }` | S09.LT.01 | no | ISO date |
| `nutraukimo_priezastis` | text (7 values) | event data `reason` (verbatim Lithuanian, with the EN gloss table in `domain/config/lt-insolvency.ts`) | S09.LT.01 | no | trimmed |
| `sprendimas_del_pabaigos` | date | event `register.insolvency_ended` (court decision that the bankruptcy is over) | S09.LT.01 | no | ISO date |
| `imones_pavadinimas`, `teritorijos_*`, `apskrities_*`, `teisine_forma`, `veiklos_kodas`, `veikla`, `veiklos_sekcija`, `isregistravimo_data` | | not read (`select()` leaves them out; identity, form and struck-off date come from `lt-register`) | - | - | - |

Initiator (`bankroto_iniciatorius`, counts on 2026-11-19): `Įmonės vadovas` → `company_manager` (1,929); `Valstybinė mokesčių inspekcija` → `tax_authority` (1,443); `Valstybinio socialinio draudimo fondo valdyba` → `social_insurance_fund` (1,248); `Kiti kreditoriai` → `other_creditors` (891); `Darbuotojai` → `employees` (184); `Savininkas (savininkai)` → `owners` (134); `Įmonės likvidatorius` → `liquidator` (48); `Finansų ministerija` → `ministry_of_finance` (14); empty → `unknown` (46). Categories only; no person is named.

## Party gate

Every case is an insolvency row tied to a party (`ingest/src/party-gate.ts`, LT rule): check digit (`invalid_code`), the code resolves to an `lt-rc-jar-entities` entity (`code_not_in_register`), and the entity's form is not a natural-person form (`natural_person_form`). Natural-person insolvency is HIDE in every country (Part H 9): bankruptcies of sole proprietorships and natural-person partnerships are never loaded. Measured: 97.9% loaded, 2.0% `natural_person_form` (121 rows), 1 `no_code`, 1 `invalid_code` (a 7-digit code).

## Identity and joins

- `eid` = `lt-<imones_kodas>`; the entity must exist (identity from `lt-register`; most bankrupt companies end in the deregistered file and keep identity only, while their insolvency events stay: events are not "financials").
- `record_key` = `<imones_kodas>:<opening date>` (documented derivation; the API `_id` is unique per row but a case spans several rows).
- `hashInput` = the merged case: `[opening date, procedure, initiator, court, each event date in field-map order, reason]`.

## Refresh and change

- Weekly probe, quarterly content. sha256 + `parserVersion` equal → `unchanged`.
- A changed case (a new date, for example the end decision) replaces the case's events; no `finora.*` event (the dated register events are the history).
- A case absent from a new file is purged with its events. The publisher only adds; `maxPurgeShare` = 2%, so a shrunken file ends `partial`.

## Size and time budget

5,937 rows → 5,631 cases (≈ 5,510 after the party gate) → ≈ 20,000 events (≈ 3.6 per case) at ≈ 32 B ≈ 0.7 MB, records ≈ 0.4 MB. Download 2.6 MB, parse < 0.1 s (measured). Negligible against the LT budget.

## Fixtures

API CSV layout: UTF-8, LF, `,` delimiter, `"` quoting, header = the selected columns in the order of the endpoint above. Content: about 12 cases on the `lt-register` fixture companies (fixture codes, true check digit + 1 mod 10): a court bankruptcy with liquidation and end decision; an out-of-court case; a simplified case later ended; an intentional bankruptcy and one lifted; a terminated case with a reason; one case split over three rows (activity differs, a later end date in the last row); a sole proprietorship's bankruptcy (must never load); a 7-digit code; an empty code; an unknown initiator value.

## Tests

- `packages/sources/src/lt/lt-avnt-bankruptcy/lt-avnt-bankruptcy.test.ts`: case grouping and the merge rule; one event type per date column; initiator normalisation; every event carries `record_id` and item S09.LT.01.
- **HIDE negative test (natural-person insolvency, Part H 9):** `packages/ingest/src/natural-insolvency.test.ts` (shared across countries) asserts that the sole proprietorship's case writes no record, event or log value, and that its entity's S09 shows no insolvency event on UI, API, MCP and export; the drop is counted as `natural_person_form`.
- `packages/domain/src/report/assemble.test.ts` (LT case): S09 for a company combines the register status (from `lt-register`) with these events and shows the caveat with the content as-of month.
- Shared ingest tests: `party-gate.test.ts`, `unchanged.test.ts`, `purge.test.ts` (`maxPurgeShare`), `stale.test.ts`.
- Live check `lt-avnt-bankruptcy.live.test.ts` (weekly): header unchanged; warns when the newest event is more than 15 months old.

## Failure modes

- API down or HTML: `failed`; the S09 line keeps the last load ("Checked AVNT bankruptcy reports as of [date]").
- Quarter missed (no load for > 6 months): stale badge; the register status still shows current insolvency.
- New initiator or termination reason: stored as `other` / verbatim and counted; the live check reports it.

## Open questions

1. **Caveat date:** Part G's caveat text hard-codes "up to Oct 2025". Proposal: the caveat key takes the month of `report_json.contentAsOf` ("Bankruptcy reports published up to [month]"), so it stays true after the next load. Council to confirm the wording change.
2. **New event types** for `domain/config/event-types.ts`: `register.insolvency_simplified`, `register.insolvency_simplified_ended`, `register.intentional_bankruptcy`, `register.intentional_bankruptcy_lifted`, `register.insolvency_ended` (next to `register.insolvency_opened`, `register.insolvency_closed`, `register.liquidation`).
3. **As-of basis** (`portal_metadata` plus a content as-of): review item A3.
