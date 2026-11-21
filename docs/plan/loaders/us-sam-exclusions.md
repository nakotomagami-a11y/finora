# us-sam-exclusions: SAM.gov federal exclusions (debarment)

Module `packages/sources/src/us/sam-exclusions/`. Research: `docs/research/us.md` §4.2, probe `research/probes/us/sam.py`.

> **v1 status (human ruling H5, 2026-11-21): off.** v1 uses no API keys, and SAM.gov's terms bar a keyless automated pull (legal 7029706804), so this loader is not built in v1. S11.US.01 renders `not_checked{reason: "manual_lookup", url: "https://sam.gov/search/?index=ex"}` with "Check federal exclusions on SAM.gov". The spec below stays as the design for when a key is allowed again.

## Source
- Publisher: U.S. General Services Administration, SAM.gov. `officialHosts`: `api.sam.gov`, `sam.gov`.
- Artifact: the daily public exclusions extract `SAM_Exclusions_Public_Extract_V2_<yyddd>.ZIP` (CSV inside; 2026-11-19 file: 11,898,264 bytes, 169,170 rows, 31 columns).
- **Access path, because of SAM.gov's terms** (https://sam.gov/about/terms-of-use, read 2026-11-20): "Automated data gathering, web scraping tools are prohibited"; "With permission, you may use software to connect to some SAM.gov data"; "You may also download some SAM.gov data". The permitted software path is the **Extracts API with a SAM.gov API key**: `GET https://api.sam.gov/data-services/v1/extracts?api_key=<key>&fileName=SAM_Exclusions_Public_Extract_V2_<yyddd>.ZIP` (*endpoint verify in the key-testing round*). One request a day fits the 10-a-day limit of a personal key without a SAM role.
- `id`: `us-sam-exclusions`. `licence`: `sam-gov-terms` (US Government work; terms above; `redistribution: true` for agency-entered exclusion fields, pending legal's light below). `attribution`: "Source: SAM.gov exclusions (U.S. General Services Administration)".
- **provider D1 clause:** "provider D1 Open Data may be in entity registration records last updated before April 4, 2022" and exclusion records created before that date; "You must state in writing that provider D1 is the data source"; "You may not share provider D1 Open Data in bulk". The loader reads none of the fields that could carry provider D1 data (addresses, provider-D1-derived fields), see the field map; the measured `Open Data Flag` column is empty on all 169,170 rows.
- `storage`: `store`. `cadence`: `daily`. `publishedAtUtc`: null (file dated each day).
- `asOf`: `[in_file_name]` (`_26323` = year 2026, day 323 → 2026-11-19).
- `maxPurgeShare`: 0.02. `deepLink`: null (SAM.gov exclusion pages need a session); the chip links `https://sam.gov/search/?index=ex`. `orderUrl`: null.
- `requires`: `["SAM_GOV_API_KEY"]`, which v1 does not use (H5): see the status note above.
- `limits`: `{ dailyRequests: 10 }`.

### Contract fields (milestone A.1 checklist)
- `asOf`: `[in_file_name]`.
- `purgeScope`: `full`. `maxPurgeShare`: **0.02** (floor). Measurement pending: three consecutive daily files are listed (`…_26321`, `…_26322`, `…_26323`); diffing two needs the keyed download, so it is measured in the key-testing round.
- `parserVersion` (A1): the hash of the loader module, its field map and the generated item list, as in §4.4.
- Record unit: one record per `SAM Number`, file order.
- `personRecordKey`: none (individuals are not read). Share-alike events: none.

## Items
| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S11.US.01 | SHOW | - | CN |

## Field map
Only rows with `Classification = Firm` are read (8,367 rows; 7,770 with a UEI). Individuals (133,929), vessels (1,322) and special entity designations (25,552; these are OFAC listings, covered by `sanctions.md`) are not read.

| Source field | Type | Target | item_id | Personal? | Transform |
|---|---|---|---|---|---|
| `Unique Entity ID` | 12 chars | `uei` | resolution key | no | `^[A-Z0-9]{12}$` |
| `CAGE` | 5 chars | `cageCode` | resolution key | no | |
| `SAM Number` | text | record key | resolution key | no | |
| `Name` | text | `Sanction.entity` name (matching only) | S11.US.01 | no | |
| `Exclusion Program`, `Exclusion Type` | text | `Sanction.program`, `Sanction.reason` | S11.US.01 | no | types: Prohibition/Restriction, Ineligible (Proceedings Completed), Ineligible (Proceedings Pending), Voluntary Exclusion |
| `Excluding Agency`, `CT Code` | text | `Sanction.authority` | S11.US.01 | no | e.g. HHS, OPM, DOJ, HUD |
| `Active Date`, `Termination Date`, `Record Status` | dates, text | `Sanction.startDate`, `endDate`, `status` | S11.US.01 | no | "Indefinite" termination kept verbatim |
| `State / Province`, `Country` | text | `Sanction.country` (matching only) | S11.US.01 | no | |
| `Prefix`, `First`, `Middle`, `Last`, `Suffix`, `Address 1-4`, `City`, `Zip Code`, `NPI`, `Additional Comments`, `Cross-Reference`, `Open Data Flag`, `Blank (Deprecated)` | | **dropped** | - | - | person-name parts, addresses (possible provider D1 data), and free text |

## Party gate
- Only `Classification = Firm` rows; drop reason `not_firm` (counted by classification).
- **Proven-company gate (qa #21):** a Firm row is loaded only if its name carries a legal-form token (the shared P8 list). Measured 2026-11-20: 5,260 of 8,367 firms pass; 3,107 are not loaded (`firm_without_form_token`, counted; 2,885 of them have a UEI), because they may be sole proprietors. The check line states the scope: "Checked federal exclusions (companies with a legal form in their name) as of [date]".

## Identity and joins
- Exclusions are list entries, not entities: each is a `Sanction` row linked to a profile only by **UEI** (exact; an official-ID link) or by **exact normalised name + state** (possible match → question card, never auto-confirmed).
- UEI on our entities comes only from SEC or a user-confirmed link (the SAM entity extract is LATER, S01.US.06), so most US matches start as possible matches.

## Refresh and change
Daily: download the extract, content hash, row hash per `SAM Number`. A row absent from today's file is deleted and emits `finora.exclusion_cleared` on any linked profile ("No longer on the federal exclusion list since [date]"); a new row on a linked profile emits `finora.exclusion_listed`.

## Size and time budget
5,260 firm rows × 8 statements ≈ 5 MB. Download 12 MB a day; parse < 5 s. Share: US.

## Fixtures
`fixtures/us/sam-exclusions/SAM_Exclusions_Public_Extract_V2_99001.ZIP` with the real 31-column header and 6 rows: 2 firms (one with UEI, one without), 1 individual, 1 vessel, 1 special entity designation (all three must be skipped), 1 terminated firm. Fixture UEIs start with `FX` (12 characters, never assigned).

## Tests
`sources/src/us/sam-exclusions/sam-exclusions.test.ts` (Firm filter; person-name and address columns never read), `ingest/src/exclusions-match.test.ts` (UEI match = confirmed; name + state = possible match, question card; name only in another state = no match), `ingest/src/sam-terms.test.ts` (no request to `sam.gov` without `SAM_GOV_API_KEY`; no request to the website's file-extract endpoint).

## Failure modes
No key: KEY state, "Federal exclusions: needs the SAM.gov key". API refused (429, 403): keep the last list; Stale after 2 days. Layout change: `schema_changed`.

## Open questions
None. Legal's light (hub 7029706804):
1. Only the keyed Extracts API; a keyless or scraped pull falls under the ban on automated gathering, so it stays off (`ingest/src/sam-terms.test.ts`).
2. The provider D1 restriction on agency-entered fields is not verified: the fields that might carry it (addresses and the provider-D1-derived columns) stay dropped. Showing any of them later is a LAWYER item (P13).
