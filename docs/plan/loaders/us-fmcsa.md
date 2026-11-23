# us-fmcsa: FMCSA carriers and freight brokers

Module `packages/sources/src/us/fmcsa/`. Research: `docs/research/us.md` §4.10, probe `research/probes/us/fmcsa.py`.

## Source
- Publisher: Federal Motor Carrier Safety Administration (U.S. Department of Transportation). `officialHosts`: `data.transportation.gov`, `safer.fmcsa.dot.gov`.
- Datasets (portal API, no key): Company Census `az4n-8mr2` (4,533,061 rows, 147 columns); Carrier (Licensing & Insurance) `6eyk-hxee` (1,860,604); Revocation `sa6p-acbp` (1,529,083). All updated 2026-11-19 (daily).
- `id`: `us-fmcsa-brokers` and `us-fmcsa-carriers` (below). `licence`: `us-gov-work` (portal metadata states no licence; federal work, 17 U.S.C. 105). `verifiedOn`: 2026-11-19, `https://data.transportation.gov/d/az4n-8mr2` (licence field empty in the dataset metadata). `attribution`: "Source: FMCSA, U.S. Department of Transportation".
- **Two source ids, one storage class each (§3.5):** `us-fmcsa-brokers` (`store`, bulk, filtered to active broker authority) and `us-fmcsa-carriers` (`live-cached`, `cacheTtl` `{ refetchHours: 24, purgeUnviewedDays: 30 }`). Both share the parser and field map below. `cadence`: `daily`. `publishedAtUtc`: null (portal refresh time observed overnight).
- `asOf`: `[portal_metadata]` (`rowsUpdatedAt`), then `[max_date_in_data]` over census `mcs150_date`.
- `deepLink`: `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string={recordKey}` (*pattern not verified*). `orderUrl`: null. `requires`: none (no app token in v1, H5). `limits`: `{ requestsPerSecond: 5 }`.

### Contract fields (milestone A.1 checklist)
- `asOf`: `[portal_metadata, max_date_in_data]`.
- `purgeScope`: brokers `full`; carriers per opened entity (as `us-states.md`). `maxPurgeShare`: brokers **0.02** (floor; the daily removal share of the 25,081 active brokers is measured over two consecutive pulls at build time); carriers 1.0 per entity re-fetch.
- `parserVersion` (A1): the hash of the loader module, its field map and the generated item list, as in §4.4; here the module includes the legal-form token list used by the party gate.
- Record unit: one record per USDOT number, grouping its L&I, census and revocation rows; sorted by `dot_number`.
- `personRecordKey`: none (officer names are dropped; sole-proprietor carriers are reduced, not stored as persons). Share-alike events: none.

## Items
| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S01.US.07 | CAVEAT | Licence data for carriers and brokers (FMCSA) only; the OR and WA licence sources are LATER (P11) | — |
| S07.US.02 | SHOW | - | — (carriers only) |
| S11.US.02 | SHOW | - | CN |

## Field map
**Carrier L&I `6eyk-hxee`** (bulk filter `broker_stat = 'A'`; carriers fetched by `dot_number` on view)

| Source field | Target | item_id | Personal? | Transform |
|---|---|---|---|---|
| `dot_number` | entity key `us-dot-<dot_number>`; `dotNumber` | resolution key | no | digits |
| `docket_number` | `mcNumber` | resolution key | no | e.g. `MC000000` |
| `legal_name`, `dba_name` | `Company.name`, `alias` | S01.US.07 | no | |
| `common_stat`, `contract_stat`, `broker_stat` | `licence` statements: "Common carrier authority: active", "Broker authority: active" | S01.US.07 | no | A = active, I = inactive, N = none |
| `bond_file`, `bipd_file`, `cargo_file` | `licence` detail: "Broker bond on file", insurance on file | S01.US.07 | no | Y/N |
| `bus_street_po`, `bus_city`, `bus_state_code`, `bus_zip_code` | `Address` | S01.US.07 | no | the business address |

**Census `az4n-8mr2`** (by `dot_number`, for the entities above)

| Source field | Target | item_id | Personal? | Transform |
|---|---|---|---|---|
| `power_units`, `total_drivers`, `mcs150_date` | `fact_reports(kind = fleet)`: `power_units`, `drivers`, period end = `mcs150_date` | S07.US.02 | no | self-reported on form MCS-150 |
| `business_org_desc` | party gate only | resolution key | no | CORPORATION, INDIVIDUAL, PARTNERSHIP, or empty |
| `company_officer_1`, `company_officer_2` | **dropped** | - | - | S03 for carriers is not a Part G item; officer names are not loaded |
| `email_address`, `phone`, `cell_phone`, `fax` | **dropped** (never selected) | - | - | contact data of often one-person carriers |
| `safety_rating`, the legacy vendor id column | dropped | - | - | |

**Revocation `sa6p-acbp`**: `docket_number`, `type_license`, `order1_serve_date`, `order2_type_desc` → event `register.authority_revoked` (S11.US.02), last 5 years.

## Party gate
Many carriers and some brokers are one-person businesses (sole proprietors: natural persons, legal rule 5). The census field `business_org_desc` is filled on only 7% of active carriers (measured 2026-11-20: CORPORATION 95,458, INDIVIDUAL 50,989, PARTNERSHIP 4,843, empty 2,097,094), so it can't be the only test. Rule, in `ingest/src/party-gate.ts`:
- **Company** (`natural_person = 0`) if `business_org_desc` is CORPORATION or PARTNERSHIP, or the legal name carries a legal-form token (LLC, L.L.C., INC, CORP, CORPORATION, CO, COMPANY, LTD, LP, LLP, PLLC, PC; the P8 token list).
- **Natural person** (`natural_person = 1`) otherwise, including every INDIVIDUAL: caption "Carrier, USDOT [number]" or "Broker, MC [number]", address reduced to the country (Part H item 7), `legal_name` and `dba_name` **not stored** (a sole proprietor's business name is often the person's name), no fleet facts, facts-only variant (P6), never in a verdict; drop reason `natural_person_carrier` for the reduced fields.

## Identity and joins
`eid` `us-dot-<dot_number>`. No EIN or state id in the files; links to state entities or SEC filers only by an exact normalised name **and** state, shown as "possible same company" (never merged, never an official-ID link). Search by name, USDOT and MC number.

## Refresh and change
- **Brokers and freight forwarders: bulk, daily.** Filter `broker_stat = 'A'` (25,081 active brokers, 2026-11-19). `record_key` = `dot:<dot_number>` with L&I, census and revocation rows grouped per entity (A8); `hashInput` = those rows' field-map columns in table order.
- **Carriers: on view**, like `us-states.md` (live query by USDOT number, MC number or name; cached with the same 24 h re-fetch and 30-day purge). Active carrier authorities number 402,107 (any of common, contract or broker active), too many to bulk-load for a niche item.
- Removal: a broker that leaves the filter is deleted with `finora.status_changed` "Broker authority no longer active since [date]". History events: `finora.status_changed`, `finora.name_changed`.

## Size and time budget
Brokers: ≈ 25,000 entities × 8 statements ≈ 0.03 GB. Carriers: cache only (≈ 3 KB per opened carrier). First load ≈ 1 min (about 30 paged portal query requests of 1,000 rows); daily refresh ≈ 30 s.

## Fixtures
`fixtures/us/fmcsa/*.json` (portal JSON arrays) with 4 fictional entities: a broker with a bond, a carrier with fleet facts, a sole-proprietor carrier (must be reduced), and a revoked authority. USDOT fixture numbers ≥ 9,900,000,000 (above any assigned number).

## Tests
`sources/src/us/fmcsa/fmcsa.test.ts` (filters, field map; email and phone columns never selected), `ingest/src/party-gate.test.ts` (sole proprietor → natural person reductions: country-only address, no name stored), `ingest/src/live-cache.test.ts` (FMCSA carrier cases: 24 h re-fetch, 30-day purge, the two-miss rule as in `us-states.md`).

## Failure modes
Portal down: keep the last load; Stale after 2 days. Schema change: `schema_changed`.

## Open questions
None.
