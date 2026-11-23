# gleif: GLEIF LEI records (golden copy)

Module `packages/sources/src/intl/gleif/`. Research: `docs/research/us.md` §4.9 (data-us) and the LEI coverage in `baltics.md` (data-baltics).

## Source
- Publisher: Global Legal Entity Identifier Foundation. `officialHosts`: `goldencopy.gleif.org`, `api.gleif.org`, `search.gleif.org`.
- Endpoints:
  - Publish list: `https://goldencopy.gleif.org/api/v2/golden-copies/publishes/latest` → JSON with the URL of the full LEI-CDF CSV (`…-gleif-goldencopy-lei2-golden-copy.csv.zip`).
  - Full file measured 2026-11-19 16:00: 510,551,864 bytes zipped, 3,499,919 records, 338 columns.
- `id`: `intl-gleif-lei`. `licence`: `cc0-1.0` ("The data available through the Access Service are provided under the CC0 licence", https://www.gleif.org/en/meta/lei-data-terms-of-use, verified 2026-11-20). `attribution`: none required; the source chip reads "Global LEI Foundation (GLEIF)". Don't suggest GLEIF endorses Finora; no GLEIF logo.
- `storage`: `store`. `cadence`: `weekly` (GLEIF publishes three times a day; v1 takes the full file once a week, see the cadence choice below). `publishedAtUtc`: "00:00, 08:00, 16:00" (file names carry the time).
- `asOf`: `[in_file_name]` (`20261119-1600-…` → 2026-11-19T16:00Z), then `[max_date_in_data]` over `Registration.LastUpdateDate`.
- `deepLink`: `https://search.gleif.org/#/record/{recordKey}`. `orderUrl`: null. `requires`: none. `limits`: one full download a week. The raw cache drops the full file after a successful load (§4.5).

### Contract fields (milestone A.1 checklist)
- `asOf`: `[in_file_name, max_date_in_data]` (file name time stamp, then `Registration.LastUpdateDate`).
- `purgeScope`: `full`. `maxPurgeShare`: **0.02**. Measurement: LEIs are re-statused (LAPSED, RETIRED), not removed from the golden copy, so the weekly removal share is expected near 0; two consecutive weekly files settle it at build time (S04 benchmark), and the floor of 2% applies until then.
- `parserVersion` (A1): the hash of the loader module, its field map and the generated item list, as in §4.4; here the module includes the registration-authority code table.
- Record unit: one record per LEI (`record_key` = LEI), file order; no grouping needed.
- `personRecordKey`: none (no person rows; sole-proprietor LEIs are not loaded).
- Share-alike events: none.
- **Cadence choice:** weekly full file only in v1, not daily deltas. A delta file can't define what was removed, so purge would need a second source id; a weekly full load keeps one source with `purgeScope: full` and stays current under the 2x-cadence rule (14 days). Daily deltas are a later optimisation. Accepted by cto (7029779579, 7029790440): the weekly job runs outside the 5-minute daily budget and is staggered so it never shares a window with the EE weekly general-data parse. v1 downloads only the LEI file (≈ 0.5 GB); the relationship and reporting-exception files are not fetched (S05 LATER).

## Items

| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S01.ALL.01 | SHOW | - | NP (LEI: — when absent) |
| S01.ALL.02 | SHOW | - | NP (LEI: — when absent) |

S01.ALL.02 is the LEI record itself (LEI, legal name, status, renewal). S01.ALL.01 is the LEI shown on a register entity's identity block through the official-ID link. LATER, not read: S05.ALL.01 (relationship records and reporting exceptions; the `rr` and `repex` files are not downloaded).

## Field map

Rows are kept only when `Entity.LegalAddress.Country` or `Entity.LegalJurisdiction` is LT, LV, EE, US or US-xx (core profile filter). All other columns are not read.

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `LEI` | 20 chars | entity key `lei-<LEI>`; `leiCode` | resolution key | no | ISO 17442: `^[A-Z0-9]{18}[0-9]{2}$`, mod-97 check = 1 |
| `Entity.LegalName` | text | `LegalEntity.name` | S01.ALL.02 | no | `xmllang` → `lang` |
| `Entity.OtherEntityNames.OtherEntityName.1..5` with `.type` = PREVIOUS_LEGAL_NAME | text | `previousName` | S01.ALL.02 | no | other types (trading, transliterated) dropped |
| `Entity.LegalAddress.Country`, `.Region`, `.City`, `.PostalCode`, `.FirstAddressLine` | text | `Address` | S01.ALL.02 | no | legal entities only (see party gate) |
| `Entity.LegalJurisdiction` | ISO code | `jurisdiction` | S01.ALL.02 | no | e.g. `US-DE`, `LV` |
| `Entity.LegalForm.EntityLegalFormCode` | ELF code | `legalForm` | resolution key | no | ISO 20275 code |
| `Entity.EntityCategory` | enum | party gate only | resolution key | no | GENERAL, FUND, BRANCH, SOLE_PROPRIETOR, RESIDENT_GOVERNMENT_ENTITY, INTERNATIONAL_ORGANIZATION |
| `Entity.EntityStatus` | enum | `status` | S01.ALL.02 | no | ACTIVE, INACTIVE |
| `Entity.RegistrationAuthority.RegistrationAuthorityID`, `.RegistrationAuthorityEntityID` | text | link key (official-ID link to a register entity) | resolution key | no | see joins |
| `Registration.RegistrationStatus` | enum | `leiStatus` | S01.ALL.02 | no | ISSUED, LAPSED, RETIRED, DUPLICATE, ANNULLED, PENDING_TRANSFER, PENDING_ARCHIVAL |
| `Registration.LastUpdateDate`, `Registration.NextRenewalDate` | dates | `modifiedAt`, `leiRenewalDate` | S01.ALL.02 | no | a LAPSED status is shown as "LEI not renewed since [date]" |
| every other column (headquarters address, successor entity, managing LOU, validation sources, …) | | dropped | - | - | |

## Party gate
`Entity.EntityCategory = SOLE_PROPRIETOR` means a natural person acting in business (legal rule 5): the record is **not loaded** and counted as `natural_person_lei`. Measured in the 2026-11-19 file: US 223, EE 21, LT 4, LV 2. Every other category is an organisation. FUND rows are loaded (they are legal entities, often 10% owners of US issuers).

## Identity and joins
- `eid` = `lei-<LEI>` for an LEI with no register match. When the registration-authority pair matches a loaded register entity, the LEI becomes a `links` row (LEI ↔ registry code, asserted by this record) and the register entity shows it (S01.ALL.01); the `lei-*` entity is not created.
- Registration-authority codes (measured in the 2026-11-19 file, by legal jurisdiction):

| Register | RA code | Entity-id shape | Measured |
|---|---|---|---|
| LV Enterprise Register | RA000423 | 11 digits | 4,155 of 4,450 LV |
| LT Register of Legal Entities | RA000430 | 9 digits | 5,173 of 5,392 LT |
| EE e-Business Register | RA000181 | 8 digits | 30,508 of 30,619 EE |
| NY Department of State | RA000628 | 6-7 digits (`dos_id`) | 13,523 of 16,877 US-NY |
| CO Secretary of State | RA000599 | 11 digits (`entityid`) | 2,797 of 3,211 US-CO |
| CT Secretary of the State | RA000600 | 7 digits | 2,572 of 3,314 US-CT |
| PA Department of State | RA000632 | 6-7 digits (`filing_number`) | 7,407 of 9,265 US-PA |
| none given | RA999999 | - | US 44,426: never linked |

- US state entities are live-cached (`us-states.md`): the link is made when the state entity is opened, by looking up its id in the stored GLEIF rows. CIK ↔ LEI: GLEIF holds no CIK, so SEC filers link to an LEI only through a state registration (most large companies are Delaware, RA000602, not loaded): the S01.ALL.01 empty state is common for US public companies.
- A pair whose entity id doesn't resolve leaves the LEI as its own `lei-*` entity (searchable by name and LEI); never matched by name.

## Refresh and change
- Weekly full load. `record_key` = LEI; `hashInput` = the field-map columns in table order; unchanged rows write nothing.
- Removal: an LEI missing from a full file is deleted (GLEIF normally keeps them with a status, so the purge guard at 2% catches broken files).
- History events: `finora.name_changed`, `finora.status_changed` (for example ISSUED → LAPSED) between syncs.

## Size and time budget
- Kept rows: about 406,000 (US 365,812; EE 30,619; LT 5,392; LV 4,450) minus about 250 sole proprietors.
- About 9 statements per row ≈ 3.6 M statements ≈ 0.45 GB at 123 B. Share of the cross-border 1 GB budget: ≈ 0.45 GB.
- Full parse of 3.5 M rows (filtering 89% away): ≈ 3-5 min, estimated (the probe's single pass over the zip completed in minutes; not timed separately), once a week in the background.

- **Streaming and memory (cto, 7062368907):** GLEIF runs in its own long-lived worker lane (loader meta `lane: "gleif"`, architect `581b1e5`) and uses the **streamed-artifact path** (fetch to file, streamed sha256, streamed raw cache); the 486.9 MB zip is never held in memory, and it is above the 512 MiB in-memory cap anyway. The CSV is parsed row by row from the zip, and rows outside LT, LV, EE and the US are discarded as they stream, so they are never held. **Acceptance: peak RSS ≤ 1 GB on the real file, recorded in `benchmarks.md`.**

- **Zip reader from file (built in S15g, `@finora/formats`).** Measured on the 2026-11-19 file: one member, deflate (method 8), 510,551,556 bytes packed and **5,090,164,310 bytes unpacked**, so the reader must support **Zip64** (sizes and offsets at or above 4 GiB read as `0xFFFFFFFF`; take them from the Zip64 end record and the extra field; throw on a Zip64 marker it can't resolve, never read a wrong offset). It reads the central directory from the end of the file with positioned reads and inflates the member as a stream. It keeps the in-memory reader's review fixes, each with a test (data-osint 7075336258): unsafe member paths refused and only the wanted name read; a duplicate wanted member throws; member and total caps checked on the declared size and enforced while inflating by counting output bytes (the cap for this source allows 6 GiB unpacked); a running CRC32 checked at the end; the local header signature checked and an unknown method refused; one shared budget across reads. Tests build a small Zip64 archive from parts, since a real 4 GiB fixture can't be committed.

## Fixtures
- `fixtures/intl/gleif/lei2-golden-copy.csv` with the real header (338 columns; generated from the column list, not copied) and 12 rows: one per RA code above, one RA999999, one LAPSED, one SOLE_PROPRIETOR (must be dropped), one FUND, one non-target country (must be filtered).
- Fixture LEIs: 18 characters + 2 check digits that **fail** mod 97 (§3.4: the fixture variant), so they can never be real LEIs; the LEI validator runs in fixture mode for the `fixtures` profile (accepts only the failing variant) and production mode otherwise (rejects it); `fixtures/ids.test.ts` checks both.

## Tests
| File | Proves |
|---|---|
| `sources/src/intl/gleif/gleif.test.ts` | country filter; field map = `meta.items`; previous names only from PREVIOUS_LEGAL_NAME |
| `ingest/src/party-gate.test.ts` (GLEIF case) | a SOLE_PROPRIETOR row is not loaded and counted |
| `resolve/src/lei-link.test.ts` | each RA code links to its register entity; RA999999 never links; no name matching |
| `ingest/src/purge.test.ts` (shared) | the 2% guard stops a full file that would delete more |
| `sources/src/intl/gleif/gleif-stream.test.ts` | the loader reads the zip as a stream (no full-file buffer), filters while streaming, and stays under the RSS budget; the real-file run is recorded in `benchmarks.md` |

## Failure modes
| Case | Behaviour | UI |
|---|---|---|
| Publish list unreachable | keep the last load; sync `failed` | LEI with "as of [date]"; Stale after 14 days |
| Column renamed | sync `failed` with `schema_changed` | last good data stays |

## Open questions
None.
