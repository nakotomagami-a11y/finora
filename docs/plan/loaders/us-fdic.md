# us-fdic: FDIC BankFind Suite (banks)

Module `packages/sources/src/us/fdic/`. Research: `docs/research/us.md` §4.3, probe `research/probes/us/fdic.py`.

## Source
- Publisher: Federal Deposit Insurance Corporation. `officialHosts`: `api.fdic.gov`, `banks.data.fdic.gov`.
- Endpoints (JSON, no key): `https://api.fdic.gov/banks/institutions`, `/failures`, `/history`, `/financials`; paging with `limit` (max 10,000) and `offset`; `fields=` selects columns.
- `id`: `us-fdic-bankfind`. `licence`: `us-gov-work` (the API page states no licence; "Users are currently not required to register…"; federal work, 17 U.S.C. 105; verified partial 2026-11-19, https://api.fdic.gov/banks/docs/). `attribution`: "Source: FDIC BankFind Suite".
- `storage`: `store`. `cadence`: `weekly` (index files rebuilt about weekly: institutions 2026-11-13, financials 2026-11-16). `publishedAtUtc`: null.
- `asOf`: `[in_file_field]` — the response's `meta.index.createTimestamp`; then `[max_date_in_data]` over `REPDTE` for financials.
- `maxPurgeShare`: 0.02. `deepLink`: `https://banks.data.fdic.gov/bankfind-suite/bankfind/details/{recordKey}` (*pattern not verified*; falls back to the BankFind search page). `orderUrl`: null. `requires`: none. `limits`: `{ requestsPerSecond: 2 }` (rate-limit header 20 seen; no published number).

## Items
| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S02.US.03 | SHOW | - | — (banks only) |
| S06.US.02 | SHOW | - | — (banks only) |

## Field map
**institutions** (all 27,835, active and closed)

| Source field | Type | Target | item_id | Personal? | Transform |
|---|---|---|---|---|---|
| `CERT` | int | entity key `us-fdic-<CERT>` | resolution key | no | |
| `FED_RSSD` | int | `rssdId` | resolution key | no | 100% of active |
| `RSSDHCR`, `NAMEHCR` | int, text | holding company link (`Ownership`, derived parent) | S02.US.03 | no | 84% of active |
| `NAME` | text | `Company.name` | S02.US.03 | no | |
| `ACTIVE`, `INACTIVE`, `ENDEFYMD` | flags, date | `status`, `dissolutionDate` | S02.US.03 | no | |
| `ESTYMD` | date | `incorporationDate` | S02.US.03 | no | |
| `CITY`, `STALP`, `ZIP`, `ADDRESS` | text | `Address` | S02.US.03 | no | |
| `WEBADDR` | text | `website` | S02.US.03 | no | 98% |
| other 80+ columns | | dropped | - | - | |

**failures**: `CERT`, `FAILDATE`, `RESTYPE1`, `QBFASSET` → event `register.bank_failure` (S02.US.03). **history**: `CERT`, `EFFDATE`, `CHANGECODE_DESC` → event `register.bank_history` (S02.US.03); 13 event types seen, e.g. "Change in Legal Name", "Participated in Absorption/Consolidation/Merger". **financials** (quarterly call reports, last 5 years): `CERT`, `REPDTE`, `ASSET`, `DEP`, `EQ`, `NETINC` → `fact_reports(kind = call_report)` with concepts `total_assets`, `deposits`, `equity`, `net_profit` (S06.US.02); currency USD, `unit_scale = 1000` (FDIC reports in thousands, *verify on first build*).

## Party gate
Not applicable: every row is an insured institution (a company).

## Identity and joins
- `eid` `us-fdic-<CERT>`. Link to an SEC filer: holding company RSSD ↔ nothing in SEC files, so no automatic link; GLEIF has no RSSD. A bank is shown as its own entity; the holding company name is shown as a "Derived by Finora" parent line.
- Search: by name from the stored institutions.

## Refresh and change
- Weekly: re-download institutions (about 28k rows, `fields=` limited), failures, history; financials for the latest quarter only after the first load.
- `record_key`: `inst:<CERT>`, `fail:<CERT>:<FAILDATE>`, `hist:<CERT>` (all history rows of a bank, A8 grouping), `fin:<CERT>:<REPDTE>`. Removal: delete. History events: `finora.name_changed`, `finora.status_changed`.

## Size and time budget
27,835 institutions × 10 statements + 4,117 failures + about 4,200 active banks × 20 quarters × 4 facts ≈ 0.05 GB. First load ≈ 2 min (about 30 paged requests); weekly refresh < 1 min. Share: US.

## Fixtures
`fixtures/us/fdic/{institutions,failures,history,financials}.json` with the API envelope (`meta`, `data[].data`), 4 fictional banks with CERT in the reserved range `9900001`-`9900099` (*fixture rule: CERT ≥ 9,900,000, above any assigned certificate; checked by the `live` job*), one failed, one merged.

## Tests
`sources/src/us/fdic/fdic.test.ts` (paging, field map, thousands scaling), `ingest/src/purge.test.ts` (shared).

## Failure modes
API down: keep the last load; Stale after 14 days. Layout change: `schema_changed`, last data stays.

## Open questions
None.
