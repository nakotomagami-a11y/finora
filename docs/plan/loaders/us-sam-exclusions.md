# us-sam-exclusions: SAM.gov federal exclusions (debarment)

Module `packages/sources/src/us/sam-exclusions/`. Research: `docs/research/us.md` §4.2, probe `research/probes/us/sam.py`.

## Source
- Publisher: U.S. General Services Administration, SAM.gov. `officialHosts`: `api.sam.gov`, `sam.gov`.
- Artifact: the daily public exclusions extract `SAM_Exclusions_Public_Extract_V2_<yyddd>.ZIP` (CSV inside; 2026-11-19 file: 11,898,264 bytes, 169,170 rows, 31 columns).
- **Access path, because of SAM.gov's terms** (https://sam.gov/about/terms-of-use, read 2026-11-20): "Automated data gathering, web scraping tools are prohibited"; "With permission, you may use software to connect to some SAM.gov data"; "You may also download some SAM.gov data". The permitted software path is the **Extracts API with a SAM.gov API key**: `GET https://api.sam.gov/data-services/v1/extracts?api_key=<key>&fileName=SAM_Exclusions_Public_Extract_V2_<yyddd>.ZIP` (*endpoint verify in the key-testing round*). One request a day fits the 10-a-day limit of a personal key without a SAM role.
- `id`: `us-sam-exclusions`. `licence`: `sam-gov-terms` (US Government work; terms above; `redistribution: true` for agency-entered exclusion fields, pending legal's light below). `attribution`: "Source: SAM.gov exclusions (U.S. General Services Administration)".
- **D&B clause:** "D&B Open Data may be in entity registration records last updated before April 4, 2022" and exclusion records created before that date; "You must state in writing that D&B is the data source"; "You may not share D&B Open Data in bulk". The loader reads none of the fields that could carry D&B data (addresses, DUNS-derived fields), see the field map; the measured `Open Data Flag` column is empty on all 169,170 rows.
- `storage`: `store`. `cadence`: `daily`. `publishedAtUtc`: null (file dated each day).
- `asOf`: `[in_file_name]` (`_26323` = year 2026, day 323 → 2026-11-19).
- `maxPurgeShare`: 0.02. `deepLink`: null (SAM.gov exclusion pages need a session); the chip links `https://sam.gov/search/?index=ex`. `orderUrl`: null.
- `requires`: `["SAM_GOV_API_KEY"]` (**deferred: key pending**, register C7). Without it: `not_checked{reason: "needs_key"}`.
- `limits`: `{ dailyRequests: 10 }`.

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
| `Prefix`, `First`, `Middle`, `Last`, `Suffix`, `Address 1-4`, `City`, `Zip Code`, `NPI`, `Additional Comments`, `Cross-Reference`, `Open Data Flag`, `Blank (Deprecated)` | | **dropped** | - | - | person-name parts, addresses (possible D&B data), and free text |

## Party gate
- Only `Classification = Firm` rows; drop reason `not_firm` (counted by classification).
- A firm whose name has no legal-form token may be a sole proprietor: it is loaded as a list entry, but a match to a profile is shown only as "possible match, needs review" (S11 rule: a hit needs a second identifier).

## Identity and joins
- Exclusions are list entries, not entities: each is a `Sanction` row linked to a profile only by **UEI** (exact; an official-ID link) or by **exact normalised name + state** (possible match → question card, never auto-confirmed).
- UEI on our entities comes only from SEC or a user-confirmed link (the SAM entity extract is LATER, S01.US.06), so most US matches start as possible matches.

## Refresh and change
Daily: download the extract, content hash, row hash per `SAM Number`. A row absent from today's file is deleted and emits `finora.exclusion_cleared` on any linked profile ("No longer on the federal exclusion list since [date]"); a new row on a linked profile emits `finora.exclusion_listed`.

## Size and time budget
8,367 firm rows × 8 statements ≈ 8 MB. Download 12 MB a day; parse < 5 s. Share: US.

## Fixtures
`fixtures/us/sam-exclusions/SAM_Exclusions_Public_Extract_V2_99001.ZIP` with the real 31-column header and 6 rows: 2 firms (one with UEI, one without), 1 individual, 1 vessel, 1 special entity designation (all three must be skipped), 1 terminated firm. Fixture UEIs start with `FX` (12 characters, never assigned).

## Tests
`sources/src/us/sam-exclusions/sam-exclusions.test.ts` (Firm filter; person-name and address columns never read), `ingest/src/exclusions-match.test.ts` (UEI match = confirmed; name + state = possible match, question card; name only in another state = no match), `ingest/src/sam-terms.test.ts` (no request to `sam.gov` without `SAM_GOV_API_KEY`; no request to the website's file-extract endpoint).

## Failure modes
No key: KEY state, "Federal exclusions: needs the SAM.gov key". API refused (429, 403): keep the last list; Stale after 2 days. Layout change: `schema_changed`.

## Open questions
For `legal` (light needed before this slice ships):
1. Is the keyed Extracts API enough "permission" under "With permission, you may use software to connect to some SAM.gov data"? Interim: yes, keyed only; no keyless download (the probe used the website's file endpoint once for research).
2. Are the agency-entered exclusion fields above (name, agency, type, dates, UEI, CAGE) free of "D&B Open Data"? Interim: addresses dropped; no D&B attribution needed for the remaining fields.
