# sanctions: official sanctions lists, the LV frozen-assets list, the EU crypto warning list, and the live-only national lists

Owner: `data-osint`. Contract: `docs/architecture.md` §3-§4 (milestone A, A.1, A8). Research: `docs/research/osint.md` §1.5-§1.6 (counts, identifiers, false-positive rates), `docs/research/baltics.md` "National sanctions lists". Probes: `research/probes/osint/sanctions.mjs`, `research/probes/osint/redflags.mjs`, `research/probes/baltics/common/national_sanctions_probe.py`.

| Source id | Publisher | Artifact | Entries (measured) | Storage | Items |
|---|---|---|---|---|---|
| `eu-fsf` | European Commission (DG FISMA), Financial Sanctions Files | `csvFullSanctionsList_1_1` (CSV, `;`) | 6,267 entries, 24,792 names (2026-11-19) | `store` | S11.ALL.01 |
| `us-ofac-sdn` | US Treasury, OFAC | `SDN_ENHANCED.XML` | 19,595 entries (2026-11-20) | `store` | S11.ALL.02 |
| `us-ofac-cons` | US Treasury, OFAC | `CONS_ENHANCED.XML` (non-SDN lists) | 486 entries | `store` | S11.ALL.02 |
| `uk-sanctions-list` | UK Foreign, Commonwealth and Development Office | `UK-Sanctions-List.csv` | 6,449 entries, 58,763 name rows | `store` | S11.ALL.02 |
| `lv-fid-frozen` | Latvia Financial Intelligence Unit (FID) | XLSX on data.gov.lv | 185 rows | `store` | S11.LV.02 |
| `esma-ncasp` | ESMA, non-compliant crypto-asset service providers | `NCASP.csv` | 217 rows | `store` | S11.ALL.03 |
| live-only lists (UN, LT FNTT, Bank of Lithuania, LT gambling regulator, Latvijas Banka, LV consumer centre, EE Ministry of Foreign Affairs, Finantsinspektsioon, EE consumer protection) | various | fetched by the legal agent | - | `agent-only` | S11.ALL.05, S11.LT.01, S11.LT.02, S11.LV.03, S11.EE.01, S11.EE.02 (§9) |

The register's own sanctions-links file (S11.LV.01) is in `lv-risk.md`. The US exclusion and enforcement lists are in `us-sam-exclusions.md` and `us-enforcement.md`. UN is agent-only because its site terms forbid redistribution (`baltics.md`); it is not loaded.

## Items (Part G, copied)

| item_id | Call | Caveat text | Empty state | Filled by |
|---|---|---|---|---|
| S11.ALL.01 | SHOW | - | CN | `eu-fsf` |
| S11.ALL.02 | SHOW | - | CN | `us-ofac-sdn`, `us-ofac-cons`, `uk-sanctions-list` |
| S11.ALL.03 | SHOW | - | CN | `esma-ncasp` |
| S11.LV.02 | SHOW | - | CN | `lv-fid-frozen` |
| S11.ALL.05 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN | `un-sc` (§9) |
| S11.LT.01, S11.LT.02, S11.LV.03, S11.EE.01, S11.EE.02 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN | live-only lists (§9) |
| S11.ALL.04 (PEP, aggregated dataset) | LATER | - | KEY | no spec (connector only, CC BY-NC) |

**How the lists are used** (architecture §6, `packages/resolve/src/sanctions/`): `screenSanctions` matches a company against the stored entries, and, behind the purpose gate, its current officers against the in-memory person index (§7a; listed individuals are never stored). A match on an official identifier gives `status: "listed"`; a name match gives `status: "possible_match"` (R8, legal rule 8). The instant profile's check 9 and the legal agent's `screen_sanctions` task both call it. Matching rules are in §7.

---

## 1. `eu-fsf`: EU consolidated financial sanctions list

### Source
- Publisher: European Commission, DG FISMA. Catalogue record: `https://data.europa.eu/api/hub/search/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions`.
- Artifact: `https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw` (the token is a public constant published in the catalogue; it decodes to "token-2017"). No login.
- `officialHosts`: `webgate.ec.europa.eu`, `data.europa.eu`.
- Licence id `eu-reuse-2011-833`: Commission Decision 2011/833/EU, reuse "for commercial or non-commercial purposes", acknowledging the source and not distorting the meaning (verified 2026-11-19 at `https://eur-lex.europa.eu/eli/dec/2011/833/oj/eng` and the dataset record above; `verifiedOn` = that date and URL). Attribution: "Source: European Commission, Financial Sanctions Files (FSF), consolidated list. © European Union".
- `storage`: `store`. `cadence`: `daily`. `publishedAtUtc`: unknown; schedule at 06:00 UTC and again at 18:00 UTC (the list changes on the day a regulation is published).
- `asOf`: `[in_file_field]`: column 1 `fileGenerationDate` (same on every row).
- `deepLink`: null (no per-entry page); `sourceUrl` per entry = the entry's `Entity_Regulation_PublicationUrl` (an EUR-Lex link), which is an official host only if it is on `eur-lex.europa.eu` (add it to `officialHosts`).
- `orderUrl`: null. `requires`: none. `limits`: 1 request per sync; size cap 60 MB (measured 25.3 MB).
- `maxPurgeShare`: 0.02 (floor; removals are delistings, which are rare; no removal seen between two pulls). `purgeScope`: `full`.

### Record unit and parsing
- Format: UTF-8 without BOM, `;` separator, `"` quoting, one header row. 100+ columns; the field map below names every column read. Columns not listed are never read.
- **Record unit: one list entry** = all rows sharing `Entity_LogicalId`. The file is long-format (one row per entity × name × address × birth date × identification), so the parser groups rows by `Entity_LogicalId` in memory (about 6,300 groups; the file is not assumed sorted).
- `recordKey`: `Entity_LogicalId`.
- `hashInput`: the mapped fields of every row of the group, de-duplicated and sorted lexicographically.
- `parserVersion`: the loader module, its field map and the generated item list (architecture §4.4).

### Field map
| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `fileGenerationDate` | date | sync `upstream_as_of` | - | no | ISO date; missing → `failed as_of_missing` |
| `Entity_LogicalId` | int | `recordKey`; subject eid `sanc-eu-<id>` | S11.ALL.01 | no | digits |
| `Entity_EU_ReferenceNumber` | text | `Sanction.listingId` | S11.ALL.01 | no | trim |
| `Entity_UnitedNationId` | text | `Sanction.unId` (extension) | S11.ALL.01 | no | trim; used to show "also a UN listing" |
| `Entity_DesignationDate` | date | `Sanction.startDate` | S11.ALL.01 | no | ISO |
| `Entity_SubjectType_ClassificationCode` | enum | `enterprise` → stored `Organization`; `person` → the whole entry goes to the in-memory person index (§7a) and nothing of it is stored | S11.ALL.01 | no | other values → `skip unknown_subject_type` |
| `Entity_Regulation_Programme` | text | `Sanction.program` | S11.ALL.01 | no | trim |
| `Entity_Regulation_PublicationUrl` | url | `Sanction.sourceUrl` | S11.ALL.01 | no | kept only if on `eur-lex.europa.eu` |
| `NameAlias_WholeName` | text | `name` = the group's first non-empty `NameAlias_WholeName` in file order (the file has no primary flag), every other distinct value `alias`; persons: **not stored**: routed to the in-memory person index (§7a) | S11.ALL.01 | no (entities only stored) | trim; empty → skipped |
| `NameAlias_NameLanguage` | text | statement `lang` | - | no | ISO 639-1 where given |
| `Address_CountryIso2Code` | text | `country` | S11.ALL.01 | no | ISO lower-case; street, city, zip and PO box are **not read** |
| `BirthDate_BirthDate`, `BirthDate_Year` | date / int | persons: **not stored**: routed to the in-memory person index (§7a); birth year kept in memory only | - | - | never stored (legal, `LAW-SANCTIONS-PERSONS`) |
| `Citizenship_CountryIso2Code` | text | persons: **not stored**: routed to the in-memory person index (§7a) | - | - | never stored |
| `Identification_Number` + `Identification_TypeCode` + `Identification_CountryIso2Code` | text | `Identification` statement `{type, number, country}` | S11.ALL.01 | entities: no | **entities only**; types read: `regnumber`, `fiscalcode`, `taxid`, `imo`, `swiftbic`, `other`; number normalised (upper-case, spaces and `-./` removed). **Persons: dropped** (`person_document`): passport and national ID numbers can never be matched against register data (personal codes are never stored, P3), so they are not kept |
| every other column (remarks, gender, function, titles, places of birth, addresses beyond country) | - | dropped, never read | - | - | data minimisation |

### Party gate
Not applicable: list entries are list subjects, not party rows of a register record. No row links a list entry to a register entity at load time; links exist only as screening results at read time (§7). Listed natural persons are never stored (legal 7030162985, `LAW-SANCTIONS-PERSONS`): they exist only in the in-memory person index (§7a).

### Identity and joins
- Subject eid `sanc-eu-<Entity_LogicalId>`; sanction eid `sanc-eu-<Entity_LogicalId>-s`. Both `country: "intl"`. Never in search (`entities_fts` excludes `sanc-*`).
- Join keys used by screening: `Identification` numbers of type `regnumber`, `fiscalcode`, `taxid`, normalised, with country; names (normalised, §7).

### Refresh and change
Full file daily. Unchanged artifact and `parserVersion` → one `unchanged` sync. A delisted entry disappears from the file → its record, subject and sanction rows are deleted (purge). History: `finora.sanctions_listed` / `finora.sanctions_delisted` events are **not** produced for list entries (they are not company entities); a company's "matched on [date]" history comes from screening results stored with investigations only.

### Size and time budget
About 6,300 records; ≈ 45,000 statements (names, identifiers, dates, programmes); ≈ 6 MB at 123 B. Download 25 MB (≈ 4 MB gzip in the raw cache). Parse < 10 s (🟡, measured by the probe at about 3 s for the full CSV in Node). Cross-border budget: ≤ 1 GB (P10).

### Fixtures
`fixtures/sources/eu-fsf/csvFullSanctionsList_1_1.csv` (< 50 KB, committed): the real header, five fictional entries over 14 rows (one enterprise with a fixture LV registration number that matches the fixture company "Example Trading SIA", one enterprise with a non-Baltic number, one person with a full birth date, one with a year only, one with two aliases). Fixture `Entity_LogicalId` values are in the reserved range `900000`-`900099`; reference numbers `EU.FX.<n>`.

### Tests
`sources/src/intl/eu-fsf/eu-fsf.test.ts` (grouping, field map, person documents dropped, subject types), `sources/src/intl/eu-fsf/as-of.test.ts`, the shared licence test (`eu-reuse-2011-833`, `store`), `ingest/src/purge-guard.test.ts` (a fixture with 0 entries purges nothing).

### Failure modes
Download fails or times out → `failed`; the previous entries stay; check 9 reads "Checked EU list as of [checkedAt]" with the older date, and turns Stale after 2 days (daily cadence). Header changed (a mapped column missing) → `failed schema_changed`; nothing written. Empty or truncated file → purge guard.

### Open questions
None for the builder.

---

## 2. `us-ofac-sdn` and `us-ofac-cons`: OFAC lists (enhanced XML)

### Source
- Publisher: US Department of the Treasury, Office of Foreign Assets Control. Portal: `https://ofac.treasury.gov/sanctions-list-service`.
- Artifacts: `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ENHANCED.XML` (110.9 MB, 2026-11-20) and `.../CONS_ENHANCED.XML`. Each answers with a 302 to a signed, one-hour storage URL: follow it. `officialHosts`: `ofac.treasury.gov`, `sanctionslistservice.ofac.treas.gov`, `sanctionssearch.ofac.treas.gov`, plus a redirect-only rule: the one redirect hop from `sanctionslistservice.ofac.treas.gov` may go to any host, is fetched with the same SSRF checks, and its host is recorded on the sync; no other request may go there.
- Why the enhanced XML and not the CSV: it carries identity documents with a type and an issuing country, entity type, and dated features (birth date, nationality, establishment date) as structured elements. The CSV puts them in one free-text remarks column.
- Licence id `us-public-domain` (17 U.S.C. §105, US government work; a current Treasury licence page was not found; verified 2026-11-19 at `https://ofac.treasury.gov/sanctions-list-service`, recorded as `verifiedOn` with that URL and the basis 17 U.S.C. §105). Attribution: "Source: US Department of the Treasury, Office of Foreign Assets Control (OFAC)".
- `storage`: `store`. `cadence`: `daily` (OFAC publishes on change days; schedule 22:00 UTC). `asOf`: `[in_file_field]`: `/sanctionsData/publicationInfo/dataAsOf`.
- `deepLink`: `https://sanctionssearch.ofac.treas.gov/Details.aspx?id={recordKey}`. `orderUrl`: null. `requires`: none. `limits`: 1 request per artifact per sync; size cap 300 MB.
- `maxPurgeShare`: 0.02 (SDN, measured: two pulls a day apart, 19,595 entries, 0 removed; the non-SDN list is **interim** at the same value and the 5-record floor). `purgeScope`: `full`.

### Record unit and parsing
- Streamed with a SAX parser (a dependency such as `saxes`; the file does not fit a DOM comfortably). Namespace `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/ENHANCED_XML`.
- `referenceValues` are read first and kept as an id → value map (for `type refId` lookups).
- **Record unit: one `<entity id>`** element. `recordKey`: the `id` attribute. Order: file order; no sort assumption.
- `hashInput`: the mapped fields of the entity, de-duplicated and sorted lexicographically (as §1), so a reordering inside the XML is not a change.

### Field map
| Element | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `publicationInfo/dataAsOf` | datetime | sync `upstream_as_of` | - | no | date part |
| `entity/@id` | int | `recordKey`; eid `sanc-ofac-<id>` | S11.ALL.02 | no | digits |
| `generalInfo/entityType` | enum | `Entity` → `Organization`, `Vessel` → `Vessel`, `Aircraft` → `Airplane` (stored); `Individual` → the entry goes to the in-memory person index (§7a), nothing stored | S11.ALL.02 | no | other → `skip unknown_subject_type` |
| `sanctionsLists/sanctionsList` (+ `@datePublished`) | text | `Sanction.authority` ("SDN List", ...), `Sanction.startDate` | S11.ALL.02 | no | |
| `sanctionsPrograms/sanctionsProgram` | text | `Sanction.program` (repeated) | S11.ALL.02 | no | |
| `names/name` with `isPrimary` | text | `name` (primary), `alias` (others; `aliasType` A.K.A. / F.K.A. / N.K.A. kept as alias kind); script: Latin translations only, other scripts as `alias` with `lang`; individuals: **not stored**: routed to the in-memory person index (§7a) | S11.ALL.02 | no (entities only stored) | `formattedFullName`; `isLowQuality = true` aliases are kept but flagged `weak` and never produce a `possible_match` alone (§7) |
| `identityDocuments/identityDocument` (`type`, `documentNumber`, `issuingCountry`, `isValid`) | text | `Identification {type, number, country, valid}` | S11.ALL.02 | entities: no | **non-person subjects only**; types kept: Registration Number, Business Registration Number, Company Number, Tax ID No., Identification Number, Vessel Registration Identification, MMSI, Folio Mercantil No.; number normalised as in §1. **Persons: dropped** (`person_document`) |
| `features/feature` of type `Birthdate` | date range | individuals: **not stored**: routed to the in-memory person index (§7a); birth year in memory only | - | - | never stored |
| `features/feature` of type `Nationality Country`, `Citizenship Country` | text | individuals: **not stored**: routed to the in-memory person index (§7a) | - | - | never stored; country name → ISO 3166 via `domain/config/countries.ts` |
| `features/feature` of type `Organization Established Date` | date | `incorporationDate` | S11.ALL.02 | no | |
| `features/feature` of type `Website` | url | `website` | S11.ALL.02 | no | host only, lower-case (used to match a company's domain) |
| `addresses/address/country` | text | `country` | S11.ALL.02 | no | ISO; address parts are not read |
| everything else (gender, place of birth, vessel tonnage and flags, secondary-sanctions notes, remarks) | - | dropped, never read | - | - | |

### Party gate, identity and joins
As §1: not applicable at load. Eids `sanc-ofac-<id>` (SDN and CONS share OFAC's id space; the source id tells them apart) and `sanc-ofac-<id>-s`.

### Refresh and change
As §1. A changed entity (new alias, new program) replaces its record's rows.

### Size and time budget
About 20,000 records; ≈ 120,000 statements (≈ 15 MB). Raw cache: the latest XML gzip-compressed, ≈ 8 MB (🟡). Parse ≈ 20 s streamed (🟡; the 111 MB file is mostly reference values and translations).

### Fixtures
`fixtures/sources/us-ofac/SDN_ENHANCED.XML` (< 50 KB): the real envelope and `referenceValues` used by the fixture, six fictional entities (an `Entity` with a "Registration Number" issued by Latvia that matches a fixture company's code; an `Entity` with a website on a reserved domain; an `Individual` with birth date and nationality; a `Vessel`; an `Entity` with a low-quality alias; one alias in Cyrillic). Fixture entity ids in the reserved range `90000000`-`90000099`.

### Tests
`sources/src/us/ofac/ofac.test.ts` (streaming parse of the fixture, field map, person documents dropped, low-quality aliases flagged), `sources/src/us/ofac/redirect.test.ts` (follows the signed redirect; refuses a redirect to any other host), the licence test.

### Failure modes
As §1. The signed redirect expiring mid-download → retry once from the start; then `failed download_expired`.

### Open questions
None for the builder.

---

## 3. `uk-sanctions-list`: UK Sanctions List

### Source
- Publisher: Foreign, Commonwealth and Development Office. Page: `https://www.gov.uk/government/publications/the-uk-sanctions-list` (last updated 2026-11-17 when read).
- Artifact: `https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv` (50.5 MB). The older OFSI consolidated list closed on 2026-01-28; it is not used.
- Licence id `ogl-uk-3.0` ("All content is available under the Open Government Licence v3.0, except where otherwise stated", verified 2026-11-19 at `https://www.gov.uk/government/publications/the-uk-sanctions-list`). Attribution: "Contains public sector information licensed under the Open Government Licence v3.0. Source: UK Sanctions List, FCDO".
- `storage`: `store`. `cadence`: `daily`. `asOf`: `[in_file_field]`: line 1 `Report Date: DD-Mon-YYYY`; fallback `[max_date_in_data]` over `Last Updated`.
- `deepLink`: null. `officialHosts`: `sanctionslist.fcdo.gov.uk`, `www.gov.uk`, `assets.publishing.service.gov.uk`.
- `maxPurgeShare`: 0.02 **interim** (the floor; removals over two pulls not yet measured: the loader slice re-measures and records it in `benchmarks.md`). `purgeScope`: `full`.

### Record unit and parsing
- Format: UTF-8 with BOM, `,` separator, `"` quoting. **Line 1 is the report date, line 2 the header.** The parser asserts both.
- **Record unit: one designation** = all rows sharing `Unique ID` (one row per name variant). Grouped in memory; no sort assumption. `recordKey`: `Unique ID`. `hashInput` and `parserVersion`: as §1.

### Field map
| Column | Target | item_id | Personal? | Transform |
|---|---|---|---|---|
| line 1 | sync `upstream_as_of` | - | no | parse `DD-Mon-YYYY` |
| `Unique ID` | `recordKey`; eid `sanc-uk-<id>` | S11.ALL.02 | no | trim |
| `OFSI Group ID`, `UN Reference Number` | `Sanction.listingId` (extension props `ofsiGroupId`, `unId`) | S11.ALL.02 | no | trim |
| `Designation Type` | `Entity` → `Organization`, `Ship` → `Vessel` (stored); `Individual` → the in-memory person index (§7a), nothing stored | S11.ALL.02 | no | other → skip |
| `Name 6`, `Name 1`-`Name 5`, `Name type` | `name` for "Primary name" (case-insensitive), else `alias`; individuals: **not stored**: routed to the in-memory person index (§7a) | S11.ALL.02 | no (entities only stored) | `Name 1`..`Name 5` then `Name 6` joined with spaces; `Name type` normalised case-insensitively ("ALias" seen) |
| `Name non-latin script` | `alias` with `lang` from `Non-latin script language`; individuals: in-memory only | S11.ALL.02 | no | |
| `Regime Name` | `Sanction.program` | S11.ALL.02 | no | |
| `Date Designated` | `Sanction.startDate` | S11.ALL.02 | no | `DD/MM/YYYY` → ISO |
| `D.O.B` | individuals: **not stored**: routed to the in-memory person index (§7a); year in memory only | - | - | never stored |
| `Nationality(/ies)` | individuals: **not stored**: routed to the in-memory person index (§7a) | - | - | never stored |
| `Business registration number (s)` | `Identification {type: "registration", number, country}` | S11.ALL.02 | no | entities only; split on `;` and `,`; country from `Address Country` when single |
| `IMO number` | `Identification {type: "imo"}` | S11.ALL.02 | no | ships and entities |
| `Address Country` | `country` | S11.ALL.02 | no | ISO |
| `Website` | `website` | S11.ALL.02 | no | host only |
| `Parent company` | `Sanction.parentName` (extension) | S11.ALL.02 | no | shown as text only; never linked to a register entity at load |
| `National Identifier number`, `Passport number` and their notes | dropped (`person_document`) | - | - | |
| `UK Statement of Reasons`, `Other Information`, addresses, phone, email, gender, position, town and country of birth, ship details | dropped, never read | - | - | data minimisation; statements of reasons often describe individuals |

### Party gate, identity, refresh
As §1. Eids `sanc-uk-<Unique ID>` and `-s`.

### Size and time budget
About 6,450 records; ≈ 75,000 statements (≈ 9 MB). Raw cache ≈ 6 MB gzip (🟡). Parse ≈ 5 s (🟡).

### Fixtures
`fixtures/sources/uk-sanctions-list/UK-Sanctions-List.csv` (< 50 KB): the real two header lines with a fixture report date, five fictional designations over 11 rows (an entity with a fixture EE registry code and country EE; an individual with partial D.O.B; a ship with an IMO in the reserved `99000xx` range; "ALias" spelling; a non-Latin alias). Unique IDs `FX0001`-`FX0099`.

### Tests
`sources/src/intl/uk/uk.test.ts` (the two header lines; grouping; name assembly; documents dropped), the licence test.

### Failure modes, open questions
As §1. None.

---

## 4. `lv-fid-frozen`: Latvia FIU list of subjects with frozen assets

### Source
- Publisher: Finanšu izlūkošanas dienests (FID). Page: `https://sankcijas.fid.gov.lv/lv/iesaldetie-aktivi/sankciju-subjekti`. Dataset on data.gov.lv: `sankciju-subjektu-lidzekli-un-saimnieciskie-resursi-kas-iesaldeti-latvija`.
- URL discovery: CKAN `package_show?id=<slug>`, then the resource whose URL contains `sankciju_subjekti` (as `research/probes/baltics/common/national_sanctions_probe.py`).
- Licence id `cc0-1.0` (dataset record, verified 2026-11-20). Attribution: "Source: Financial Intelligence Unit of Latvia, sanctions subjects with frozen assets, data.gov.lv, CC0 1.0".
- `storage`: `store`. `cadence`: `weekly` (stated cadence irregular; resource last modified 2026-11-16 when read).
- `asOf`: `[in_file_field, portal_metadata]`: sheet 2, cell A1 "Informācija tabulā pēdējo reizi atjaunota DD.MM.YYYY."; else the CKAN resource `last_modified`.
- `deepLink`: the page URL above for every row. `officialHosts`: `data.gov.lv`, `sankcijas.fid.gov.lv`.
- `maxPurgeShare`: 0.05 **interim** (a 185-row list: one delisting is 0.5%; the guard's floor of 5 records, architecture §4.4, also applies; removals over two pulls not yet measured: re-measured in the loader slice). `purgeScope`: `full`.

### Record unit and parsing
- XLSX, sheet 1; the header row is the first row with at least 3 non-empty cells (as the probe); columns are matched by their leading number ("1.", "2.", ... "10."), not by full header text, so a reworded header does not break the parser.
- **Record unit: one row.** The list has no row id. `recordKey` = sha256 (truncated to 16 hex) of the normalised column 1 (subject) + column 2 (birth date or registration number) + column 6 (listed person). Documented derivation; it changes only if those fields change, which is a re-listing. `hashInput`: the mapped columns (2-5, 7-10) in column order. `parserVersion`: as §1.

### Field map
| Column | Target | item_id | Personal? | Transform |
|---|---|---|---|---|
| sheet 2 A1 | sync `upstream_as_of` | - | no | date `DD.MM.YYYY` |
| 1 "Sankciju subjekts, kā līdzekļi ... iesaldēti" | party name (gate below) | S11.LV.02 | gated | trim, quotes normalised |
| 2 "Dzimšanas datums / reģistrācijas Nr." | party gate input; for companies the **register code** | S11.LV.02 | gated | an 11-digit LV code (check digit) → company; a date → natural person (dropped); other text → foreign registration number |
| 3 "Valstspiederība / reģistrācijas valsts" | country of the party | S11.LV.02 | no | country names → ISO |
| 4 "Iesaldēto līdzekļu ... veids" | event `register.frozen_assets`, `data.assetTypes[]` | S11.LV.02 | no | split on `;` |
| 5 "... iesaldēšanas pamatojums" | `data.ground` | S11.LV.02 | no | the FID's wording (for example ownership or control by a listed person) |
| 6 "Sankciju sarakstā iekļautās personas vārds, uzvārds vai nosaukums" | **dropped** (`listed_person_name`) | - | yes | not stored and not shown; the event says "controlled or owned by a person on the [regime] list" (legal: R, `LAW-LV-FIU-PERSON`) |
| 7 "Datums, no kura spēkā ir sankcijas ..." | `data.sanctionsFrom` | S11.LV.02 | no | `DD.MM.YYYY.` → ISO |
| 8 "Normatīvais akts ..." | `data.legalAct` | S11.LV.02 | no | e.g. a regulation number |
| 9 "FID pārbaudīts" | `data.checkedNote` | S11.LV.02 | no | trim |
| 10 "Datums, kad FID pirmo reizi publicējis ..." | event `date` | S11.LV.02 | no | ISO |

### Party gate
Through `ingest/src/party-gate.ts`. A row loads only if column 2 is an LV register code that resolves to a register entity with a non-natural-person legal form (the event attaches to that company, `lv-<code>`), or a foreign party whose column 1 name carries a legal-form token (`domain/config/legal-forms.ts`, the same list as the court-party masking: Ltd, LLC, AO, OOO, GmbH, AS, SIA, ...), stored as an `Organization` `sanc-lvfid-<recordKey>` for screening, like §1. Every other row is dropped: column 2 is a birth date (`natural_person`); an LV code that does not resolve (`code_unresolved`); a foreign row without a legal-form token, even with an identifier, because a foreign number proves nothing under the party gate and could be a person's id (`unproven_party`). `registrationNumber` values of loaded foreign rows are scanned for personal-code patterns like person properties (P3). 🟢 Measured on the 185 rows: 97% carry a birth date or a registration number.

### Identity and joins
Direct: the LV code is the company's eid. This is the only list that names Baltic companies by register code in a field (FNTT does too, but is agent-only). A row on this list is shown on the company's S11 as a fact from the register of frozen assets, not as a name match.

### Refresh and change
Full file. A row that disappears is a delisting: the event is deleted (purge), and the company gets `finora.frozen_assets_cleared` (a company-level history event; data: date, legal act).

### Size and time budget
≤ 200 events; < 1 MB. Download < 100 KB.

### Fixtures
Generated at test time by `fixtures/sources/lv-fid/write-xlsx.ts` (an XLSX is a binary, so it is not committed): both sheets, the real column numbering, rows for a fixture LV company (fixture check-digit rule), a foreign company, and a natural person with a birth date (must be dropped).

### Tests
`sources/src/lv/fid/fid.test.ts` (header detection by column number; party gate: LV company loaded; foreign company with a form token loaded; foreign row with an id but no form token dropped `unproven_party`; person dropped; unresolved code dropped; column 6 never stored), `ingest/src/party-gate.test.ts` (shared), the licence test.

### Failure modes
The CKAN resource URL moves → found again by `package_show`. Sheet 2 missing → as-of from portal metadata (`as_of_basis: portal_metadata`).

### Open questions
None: column 6 stays dropped (legal 7030162985, `LAW-LV-FIU-PERSON`).

---

## 5. `esma-ncasp`: ESMA non-compliant crypto-asset service providers

### Source
- Publisher: European Securities and Markets Authority. Page: `https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica`. Artifact: `https://www.esma.europa.eu/sites/default/files/2024-12/NCASP.csv` (39 KB; "Last update: 18 November 2026" on the page; ESMA says the CSV moves into its IT systems, so the URL is found from the page if it changes).
- Licence id `esma-reuse-notice`: "Reproduction of all information on this site (ESMA Library) is authorised except as otherwise stated", source to be acknowledged (`https://www.esma.europa.eu/legal-notice`, verified 2026-11-19). Attribution: "Source: ESMA, interim MiCA register of non-compliant entities".
- `storage`: `store`. `cadence`: `weekly`. `asOf`: `[max_date_in_data]` over `ae_lastupdate`.
- `deepLink`: null (cite the CSV). `officialHosts`: `www.esma.europa.eu`.
- `maxPurgeShare`: 0.05 **interim** (small list; the 5-record floor applies; re-measured in the loader slice). `purgeScope`: `full`.

### Record unit and field map
- UTF-8 with BOM, `,` separator, `"` quoting. **Record unit: one row.** `recordKey`: `ae_lei` when present; else sha256-16 of `ae_competentAuthority` + `ae_commercial_name` + `ae_website`. `hashInput`: the mapped columns in column order. `parserVersion`: as §1.

| Column | Target | item_id | Personal? | Transform |
|---|---|---|---|---|
| `ae_lastupdate` | sync as-of (max) | - | no | `DD/MM/YYYY` |
| `ae_competentAuthority`, `ae_homeMemberState` | `Sanction.authority`, `Sanction.country` | S11.ALL.03 | no | |
| `ae_lei_name`, `ae_commercial_name` | `name`, `alias` of an `Organization` `sanc-esma-<recordKey>` | S11.ALL.03 | no | |
| `ae_lei` | `leiCode` | S11.ALL.03 | no | ISO 17442 check |
| `ae_website` | `website` (host) | S11.ALL.03 | no | lower-case host; matched against a company's register or confirmed domain |
| `ae_reason`, `ae_infrigment`, `ae_decision_date` | `Sanction.reason`, `Sanction.startDate` | S11.ALL.03 | no | |
| `ae_comments` | dropped | - | - | free text, may name persons |

### Party gate, refresh, budget
Not applicable (list subjects). Full file. < 1 MB.

### Fixtures and tests
`fixtures/sources/esma-ncasp/NCASP.csv` (3 fictional rows, one with a fixture LEI using the fixture mod-97 variant, one with a reserved-domain website). `sources/src/intl/esma-ncasp/esma.test.ts`.

### Failure modes, open questions
As §1. None.

---

## 6. Shared: what every list entry becomes

| Row | Schema | eid | Props (only these) |
|---|---|---|---|
| list subject (stored) | `Organization`, `Vessel` or `Airplane`; **never `Person`** | `sanc-<list>-<id>` | `name`, `alias` (with kind and `weak`), `country`, `website`, `leiCode`, `Identification[]`, `incorporationDate` |
| sanction | `Sanction` | `sanc-<list>-<id>-s` | `entity` (→ subject), `authority`, `program`, `startDate`, `listingId`, `unId`, `sourceUrl`, `reason` (ESMA only) |

- Every statement's `item_id` is the list's S11 item. No stored statement is personal: listed individuals are never stored (§7a).
- `sanc-*` entities are excluded from `entities_fts`, `entities_trigram`, `links`, export and every list endpoint; they are reachable only through `screenSanctions` results.
- Test: `sources/src/intl/sanctions-no-persons.test.ts` loads the three fixtures (each with individuals) and asserts no `Person` entity, no birth date and no nationality statement in any table, and no individual's name in any statement.

---

## 7. Screening (`packages/resolve/src/sanctions/`)

Built once per sync into an in-memory index (and rebuilt after each content sync of any list).

1. **Normalise** a name: Unicode NFKD, strip diacritics, lower-case, non-alphanumerics to spaces, drop legal-form tokens (per-language list in `domain/config/legal-forms.ts`, the same list the court-party masking uses), sort tokens. (`osint.md` §1.6; probe `normalise()`.)
2. **Candidates:** entries sharing the rarest token of the input; `weak` aliases alone never produce a candidate.
3. **Name match:** exact normalised equality, or similarity ≥ 0.90 (Levenshtein ratio on the sorted-token strings). Kind must agree: companies against the stored `Organization` entries; officers against the in-memory person index only (§7a).
4. **Official-ID confirmation** (R8 `listed`): for a company, any `Identification` of a registration or tax type whose normalised number equals the company's registry code, VAT number or LEI, **and whose issuing country equals the company's country** (an identifier with no issuing country gives `possible_match`, never `listed`, since bare numbers collide across countries; an LEI needs no country); or an LV FID row on the company's code; or the ESMA LEI equal to the company's LEI. For a person there is no official-ID confirmation in v1 (no personal codes are stored), so officers can only be `possible_match`; the index's birth year and nationality may be shown in the match card at query time and are never stored with the result.
5. **Second-identifier exclusion:** a name match is marked `ruled_out` (and shown in the match card as such) only when the entry carries an official identifier of a registration type, issued by the company's own country, whose number differs from the company's code. An address country never rules anything out. Persons are never ruled out automatically (no officer birth dates are stored).
6. **Output:** per list, entries with `status: "listed" | "possible_match" | "ruled_out"`, the matched name, the identifiers side by side (designer's match card), the list's `checkedAt` and `asOf`.
7. **Measured noise** (`osint.md` §1.6): name-only exact matches hit 0.22% of 5,000 random EE company names and 0.06% of 5,000 random LV officer names, all on generic names; fuzzy matching at 0.90 added none. Step 5 removes most company hits; the rest become `sanctions_match` questions in an investigation, and a `possible_match` line in the instant profile.

8. **Officers** (behind the purpose gate): a current officer's name is screened against the in-memory person index only (§7a). A hit is `possible_match` with the signal `officer_sanctions_possible_match` (severity `point_to_check`, rule `sanctions_unsure`; `agents.md` §6.2a). In an investigation the legal agent may ask `sanctions_match` with the person-kind options "Same person" / "Different person" / "Not sure".
9. **Sole traders and natural-person subjects** get no agents and no verdict (R5). Their facts-only profile screens the subject's own name against the person index behind the purpose gate and shows at most "possible match, needs review", never a level.
10. **MCP and API:** the name-only form of `screen_sanctions` (`agents.md` §4.1) searches the stored organisation entries only; it never reaches the person index and never returns an individual.

Tests: `resolve/src/sanctions.test.ts`, one named case per rule: `listed-by-registration-and-country`, `bare-number-is-possible-match`, `lei-listed`, `lv-fid-code-listed`, `esma-lei-listed`, `name-exact-possible-match`, `name-fuzzy-090`, `weak-alias-alone-no-match`, `ruled-out-by-own-country-id`, `address-country-never-rules-out`, `officer-possible-match-only`, `sole-trader-no-level`, `mcp-name-only-no-persons`; `resolve/src/sanctions.noise.test.ts` (a generated set of 2,000 fictional company names with no list overlap produces no `listed` and fewer than 1% `possible_match`).

---

## 7a. The in-memory person index (officer screening, live only)

Legal (7030162985, `LAW-SANCTIONS-PERSONS`): listed natural persons may be used for screening **live only**. No natural-person row is stored.

- **At parse:** every individual entry is dropped from the store with drop reason `person_entry` (counted in the sync report) and handed to the index instead.
- **What:** for every individual on the EU, OFAC (SDN and non-SDN) and UK lists: entry id, list, normalised name and aliases, programme, listing date, birth year (when given) and nationality. Held in the server process's memory (`packages/resolve/src/sanctions/person-index.ts`), never written to the store, a cache file, a log line or an export. It is a `live-no-store` view (architecture §3.5) of the same artifacts the entity loaders parse.
- **Built:** in the same parse as the entity loaders (one download per list per day). On boot, the index is empty until the next sync or an on-demand download completes (about 1 minute for the three lists). Until then, officer screening reports "Officers not screened yet: lists loading" and check 9 says so in its coverage note.
- **Raw cache:** the three list sources keep **no raw artifact** on disk (`rawCache: false`), because the files contain the individuals. A new `parserVersion` re-downloads (25 + 111 + 50 MB, daily anyway).
- **Used by:** `screenSanctions` for a company's current officers, only behind the purpose gate (P2), in the instant profile's check 9 and the legal agent's `screen_sanctions` task.
- **What is kept from a match:** in an investigation, a finding cites `{ list, entryId, listDate }` and the status (`possible_match`); no name, birth date or nationality from the list is stored with it. The instant profile stores nothing.
- **Tests:** `resolve/src/sanctions/person-index.test.ts` (sentinel names and birth dates never reach the store, the filesystem or the logger, spied; a match yields only the citation fields; empty-index state), `ingest/src/raw-cache.test.ts` (no artifact kept for the three list sources).

## 8. Questions answered by legal

1. **Listed natural persons:** not stored; live, in-memory screening only (§7a). Birth date and nationality are used in memory only. LAWYER row `LAW-SANCTIONS-PERSONS` decides whether a stored name and alias would be acceptable later.
2. **LV FID column 6:** dropped and never shown (`LAW-LV-FIU-PERSON`).

## 9. Live-only lists (`agent-only`, used by `check_live_list`)

No loader, no stored row: the legal agent fetches the official publication at query time (`docs/plan/agents.md` §4.4) and keeps only the investigation document. `SourceMeta` entries exist so the licence registry, the source page and the citations know them.

| Source id | Item | URL | Licence id (verified) | `officialHosts` | Notes |
|---|---|---|---|---|---|
| `un-sc` | S11.ALL.05 | `https://scsanctions.un.org/resources/xml/en/consolidated.xml` (302 to a signed blob) | `un-site-terms`: personal, non-commercial use, no redistribution (`baltics.md`) | `scsanctions.un.org`, `unsolprodfiles.blob.core.windows.net` (redirect only) | 1,002 of 1,007 entries also appear on EU, UK or OFAC lists (`osint.md` §3) |
| `lt-fntt` | S11.LT.01 | `https://fntt.lrv.lt/en/international-financial-sanctions/a-list-of-sanctioned-subjects/` | `none-stated` | `fntt.lrv.lt` | 16 companies, each with a company code: a code match is `listed` |
| `lt-lb-sites` | S11.LT.02 | `https://www.lb.lt/illegalwww?export=csv` | `lb-credit-source` ("please cite the Bank of Lithuania as the source") | `www.lb.lt` | domain match |
| `lt-gambling` | S11.LT.02 | `https://blokuojama.lpt.lt/wp-content/uploads/bankams.txt` | `none-stated` | `blokuojama.lpt.lt` | domain match |
| `lv-bank-warnings` | S11.LV.03 | Latvijas Banka warning page (news page with the list) | `all-rights-reserved-link-quote` | `www.bank.lv` | name and domain |
| `lv-ptac` | S11.LV.03 | `https://registri.ptac.gov.lv/register/suspicious-internet-and-communication`, `https://registri.ptac.gov.lv/registri/melnais-saraksts` | `all-rights-reserved-link-quote` | `registri.ptac.gov.lv` | name, code where printed, domain |
| `ee-mfa` | S11.EE.01 | `https://www.vm.ee/en/list-subjects-sanction-government-republic-protect-estonias-security-and-interests-and-against` | `none-stated` | `www.vm.ee` | names only: never `listed` (R8) |
| `ee-fi-alerts` | S11.EE.02 | `https://www.fi.ee/en/alerts` (keyword search) | `none-stated` | `www.fi.ee` | name, domain |
| `ee-ttja` | S11.EE.02 | `https://jvis.ttja.ee/modules/tarbijavaidluskomisjoni-otsused/mustnimekiri` | `none-stated` | `jvis.ttja.ee` | name |

Licence invariants (architecture §4.2): `none-stated`, `un-site-terms` and `all-rights-reserved-link-quote` have `redistribution: false`, which allows only `agent-only`; the licence test proves none of them can be set to `store`.
