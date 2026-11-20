# us-states: NY, CO, CT and PA business registries (live-cached)

Four sources, one loader module per state (`packages/sources/src/us/state-ny/`, `state-co/`, `state-ct/`, `state-pa/`), sharing one Socrata client (`packages/sources/src/us/socrata.ts`). OR and WA are LATER (P11, register C11). FL is LATER (S01.US.04). Research: `docs/research/us.md` §2, §2.10, §2.11.

## Source

| | NY | CO | CT | PA |
|---|---|---|---|---|
| `id` | `us-ny-dos` | `us-co-sos` | `us-ct-sots` | `us-pa-dos` |
| Publisher | NY Department of State, Division of Corporations | Colorado Secretary of State | Connecticut Secretary of the State | Pennsylvania Department of State |
| Portal (`officialHosts`) | `data.ny.gov` | `data.colorado.gov` | `data.ct.gov` | `data.pa.gov` |
| Datasets | `n9v6-gdp6` Active Corporations; `3gg2-jgnp` Entity Status History; `k4vb-judh` Daily Filings | `4ykn-tg5h` Business Entities; `casm-dbbj` Transaction History; `8upq-58vz` UCC Debtors | `n7gp-d28j` Business Master; `ka36-64k6` Principals; `ah3s-bes7` Filing History; `xfev-8smz` UCC Liens | `xvd7-5r2c` Registered Businesses |
| `licence` | `ny-open-ny-terms` | `co-portal-terms` (dataset: Public Domain) | `ct-portal-terms` (master and UCC: Public Domain; principals and history: none stated) | `pa-data-policy` |
| `attribution` | "New York State Department of State" | "CDOS" plus the **required disclaimer** below | "Connecticut Secretary of the State" | "Data retrieved from data.pa.gov (https://www.data.pa.gov/)" (requested, not required) |
| `verifiedOn` | 2026-11-20, OPEN-NY Terms of Use PDF | 2026-11-20, `https://data.colorado.gov/terms` | 2026-11-20, `https://data.ct.gov/terms` | 2026-11-20, `https://data.pa.gov/data-policy` |

- **Colorado's required disclaimer** (`co-portal-terms`, shown wherever CO data appears; legal condition, hub 7029000097): "The data made available here has been modified for use from its original source, which is the State of Colorado. THE STATE OF COLORADO MAKES NO REPRESENTATIONS OR WARRANTY AS TO THE COMPLETENESS, ACCURACY, TIMELINESS, OR CONTENT OF ANY DATA MADE AVAILABLE THROUGH THIS SITE. THE STATE OF COLORADO EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE. The data is subject to change as modifications and updates are complete. It is understood that the information contained in the Web feed is being used at one's own risk."
- `storage`: `live-cached` (§3.5). Written only for an entity the user opens.
- `cacheTtl`: `{ refetchHours: 24, purgeUnviewedDays: 30 }` (`LIVE_CACHE_REFETCH_HOURS`, `PERSON_DATA_TTL_DAYS`; P5).
- `cadence`: `on-view`. `publishedAtUtc`: null (portals refresh daily, NY master monthly).
- `asOf`: `[portal_metadata]`: the dataset's `rowsUpdatedAt` (Unix seconds) from `GET https://<host>/api/views/<dataset>.json`, read in the same fetch as the rows; it renders as "as published by the portal". It is the dataset's refresh time, not a per-record date; record dates (filing, formation, status dates) are separate statements. Measured 2026-11-19/20: NY 2026-11-19, CO 2026-11-19, CT 2026-11-19, PA 2026-11-03.
- `deepLink`: null. No state publishes a stable per-entity URL that we verified; the source chip links the dataset page `https://<host>/d/<dataset>`.
- `orderUrl`: null.
- `requires`: none. Optional `SOCRATA_APP_TOKEN` (header `X-App-Token`): "requests that aren't using an application token come from a shared pool via IP address", and token requests are not throttled (https://dev.socrata.com/docs/app-tokens.html).
- `limits`: `{ requestsPerSecond: 5 }` per host. Measured latency for a name-prefix query: median 0.66-1.05 s, max 1.72 s. A 429 backs off 2, 4, 8 s, then fails the request (§7.6a rules).

### Queries (SoQL over `GET https://<host>/resource/<dataset>.json`)

| Use | Query |
|---|---|
| Search (parallel to the four portals, `$limit=20` each) | NY `$where=upper(current_entity_name) like '<PREFIX>%'`; CO `upper(entityname)`; CT `upper(name)`; PA `upper(business_name)`. `<PREFIX>` is the user's text upper-cased, with `'` doubled and `%`, `_` escaped. Results are shown, **not stored** |
| Open (writes the cache) | the entity's row by key, plus its people, history and UCC rows below |
| NY people and history | `3gg2-jgnp?corpid_num=<dos_id>`; `k4vb-judh?dos_id=<dos_id>` |
| CO history and UCC | `casm-dbbj?entityid=<entityid>`; `8upq-58vz?$where=organizationid='<entityid>' OR upper(organizationname)='<NAME>'` |
| CT people, history, UCC | `ka36-64k6?business_id=<id>`; `ah3s-bes7?account=<accountnumber>`; `xfev-8smz?$where=upper(debtor_nm_bus)='<NAME>'` |
| PA | `xvd7-5r2c?filing_number=<n>` (one row per party) |

Every query sends `$select` with exactly the columns in the field map, so unread columns (residence addresses, emails, phones) never leave the portal.

### Contract fields (milestone A.1 checklist)
- `asOf`: `[portal_metadata]` (see above).
- `purgeScope`: `full`, applied per opened entity: one re-fetch defines that entity's rows in each dataset. `maxPurgeShare`: **1.0 per entity re-fetch, only when the registry returns the entity**: one company can legitimately lose all its principals, parties or UCC lines between two views (CT terms require withdrawn records to go). An entity the registry doesn't return follows the two-miss rule in Refresh and change. The 30-day purge of unviewed entities is the P5 cache purge, not a sync purge.
- `parserVersion` (A1): the hash of the loader module, its field map and the generated item list, as in §4.4; here the module includes each dataset's `$select` column list, so adding or removing a column re-parses.
- Record unit and sort order: one record per entity per dataset (see Refresh and change).
- `personRecordKey` (people sources: NY `chairman_name`, CT `ka36-64k6`, PA party rows): the record is the company's **role set** in that dataset, `recordKey` = `<dataset>:<entity key>`, hash input = every role line (role, name) in the source's order. No person id, hash or code is computed (architecture §3.3, `PERSON_ROWS=names_no_id`). **Role-end detection:** none of the three has a row-local role id or a start date, so a line's identity is its role and its occurrence among lines with that role; `finora.role_ended` fires when the number of lines with a role falls (one event per missing line, no name), never by comparing names. A corrected spelling or reordering emits nothing.
- Share-alike events: none.

## Items

| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S01.US.02 (NY, CO, CT) | SHOW | - | NP (LEI, VAT: — when absent) |
| S01.US.03a (PA) | CAVEAT | Pennsylvania register: licence partly stated | NC |
| S02.US.01 (NY status history, CO transactions) | SHOW | - | NP; history: "Tracked by Finora since [date]" |
| S02.US.02 (CT filing history) | CAVEAT | Connecticut filing history: licence not stated on this dataset | NC |
| S03.US.03 (CT principals, PA parties, NY CEO) | CAVEAT | CT principals, PA parties and the NY CEO only; FL officers are LATER with S01.US.04 and OR representatives with S01.US.03b. People appear only in this company's context | needs_purpose; then NP |
| S09.US.01 (UCC, CO and CT) | CAVEAT | Checked UCC filings in Colorado and Connecticut only; other states not checked | CN |
| S13.US.02 (NY daily filings, CO transactions) | CAVEAT | State filing history, where the state publishes it (40% of samples) | NC |
| S13.US.03 (CT filing history) | CAVEAT | Connecticut filing history: licence not stated on this dataset | NC |

LATER, not read: S01.US.03b (OR), S01.US.04 (FL), S01.US.05 (CA, DE; `paid_only` "No free register in [state]", `orderUrl` null because neither publishes a public order page we verified), S17.US.02.

## Field map

Personal = natural-person data (purpose gate, P5 TTL). Every other column of these datasets is not selected.

**NY `n9v6-gdp6`**

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `dos_id` | digits | entity key `us-ny-<dos_id>`; `registrationNumber` | resolution key | no | `^\d{1,10}$` |
| `current_entity_name` | text | `Company.name`, caption | S01.US.02 | no | trim; required |
| `entity_type` | text | `legalForm` (verbatim) + normalised form | S01.US.02 | no | 15 values seen, e.g. DOMESTIC LIMITED LIABILITY COMPANY, DOMESTIC BUSINESS CORPORATION; table in `domain/config/legal-forms.ts` (`us-ny`) |
| `initial_dos_filing_date` | date | `incorporationDate` | S01.US.02 | no | ISO date |
| `jurisdiction` | text | `jurisdiction` | S01.US.02 | no | state or country name → ISO code |
| `county` | text | `address` (county part) | S01.US.02 | no | |
| `location_address_1`, `_2`, `location_city`, `location_state`, `location_zip` | text | `Address` of the company | S01.US.02 | no | joined; a company's registered location, not a person's home |
| `chairman_name` | text | `Person.name` in a `Directorship` (role "Chief executive officer as filed") | S03.US.03 | **yes** | only for business corporations; empty for LLCs |
| (implicit) | - | `status` = "Active" | S01.US.02 | no | the file holds active entities only |
| `dos_process_*`, `registered_agent_*`, `chairman_address_*` | | dropped (not selected) | - | - | the process and chairman addresses may be a person's address |

**NY `3gg2-jgnp` (status history)**: `corpid_num` → join key; `date_filed` + `status` (Active, Inactive, Suspended, Discontinued) → event `register.status` (S02.US.01). **NY `k4vb-judh` (daily filings)**: `filing_date`, `filing_type`, `film_num` → event `register.filing` (S13.US.02); `filer_*`, `sop_*` dropped.

**CO `4ykn-tg5h`**

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `entityid` | 11 digits | entity key `us-co-<entityid>` | resolution key | no | `^\d{11}$` |
| `entityname` | text | `Company.name` | S01.US.02 | no | |
| `entitytype` | code | `legalForm` | S01.US.02 | no | DLLC, DPC, DNC, FLLC, FPC, DLP, DLLP, FNC, DLLLP, FLP, FO, GP, DPC-PBC, ... with labels in `legal-forms.ts` (`us-co`) |
| `entitystatus` | text | `status` (verbatim) + normalised | S01.US.02 | no | 15 values: Good Standing, Delinquent, Voluntarily Dissolved, Administratively Dissolved, Withdrawn, Noncompliant, Revoked, Judicially Dissolved, Exists, Merged, Converted, Registered Agent Resigned, Effectiveness Prevented, Dissolved (Term Expired), Consolidated |
| `entityformdate` | date | `incorporationDate` | S01.US.02 | no | |
| `jurisdictonofformation` (sic) | text | `jurisdiction` | S01.US.02 | no | |
| `principaladdress1`, `principaladdress2`, `principalcity`, `principalstate`, `principalzipcode`, `principalcountry` | text | `Address` | S01.US.02 | no | |
| `agent*`, `mailing*` | | dropped | - | - | the agent is often a person |

**CO `casm-dbbj`**: `entityid`, `transactionid` (record key), `historydes`, `effectivedate` → event `register.transaction` (S02.US.01 and S13.US.02); `comment`, `name` dropped. **CO `8upq-58vz`** (UCC debtors): `fileid`, `actiontype`, `recordstatus`, `organizationname`, `organizationid` → event `register.ucc_debtor` on the company (S09.US.01) when `organizationid` equals the company's `entityid` or the normalised name matches exactly; person-debtor columns (`lastname`, `firstname`, ...) are not selected.

**CT `n7gp-d28j`**

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | portal id | join key to principals | resolution key | no | |
| `accountnumber` | text | entity key `us-ct-<accountnumber>` | resolution key | no | |
| `name` | text | `Company.name` | S01.US.02 | no | |
| `business_type` | text | `legalForm` | S01.US.02 | no | LLC, Stock, Non-Stock, Limited Partnership, LLP, Statutory Trust, B Corp, ... |
| `status` | text | `status` | S01.US.02 | no | Active, Forfeited, Dissolved, Withdrawn, Revoked, Cancelled, Merged, Expired Reservation, Rejected, Expired, Renunciated, Reserved, Domesticated, Redomesticated, Recorded |
| `date_registration` | date | `incorporationDate` | S01.US.02 | no | |
| `billingstreet`, `billingcity`, `billingstate`, `billingpostalcode`, `billingcountry` | text | `Address` | S01.US.02 | no | |
| `business_email_address`, ownership flags (woman-, veteran-, minority-, LGBTQI-owned) | | dropped | - | - | personal or sensitive |

**CT `ka36-64k6` (principals)**: `business_id` → join; `name__c` → `Person.name`; `designation` (Officer, Director, Officer;Director; empty on 84% of rows) → role (S03.US.03, **personal**). **Dropped, never selected (HIDE fields, legal rule 2, P3 home addresses):** `residence_address`, `residence_street_address_*`, `residence_city`, `residence_state`, `residence_zip_code`, `residence_country`, and the principal's business address. **CT `qh2m-n44y` (agents): not read.** **CT `ah3s-bes7`**: `account`, `filing_date`, `type`, `filing_type` → event `register.filing` (S02.US.02, S13.US.03); `organizer_name`, `name_of_incorporator` dropped. **CT `xfev-8smz`**: `id_lien_flng_nbr` (record key), `lien_status`, `cd_flng_type`, `debtor_nm_bus` → event `register.ucc_debtor` (S09.US.01); person debtor and secured-party person columns not selected.

**PA `xvd7-5r2c`** (one row per business and party)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `filing_number` | text | entity key `us-pa-<filing_number>` | resolution key | no | |
| `business_name` | text | `Company.name` | S01.US.03a | no | |
| `typeofbusinessregistration` | text | `legalForm` | S01.US.03a | no | Domestic Limited Liability Company, Domestic Business Corporation, Domestic Nonprofit Corporation, Foreign Business Corporation, ... |
| `creationdate` | date | `incorporationDate` | S01.US.03a | no | |
| `address_line1`, `address_line2`, `city`, `state`, `zip`, `shortcountyname` | text | `Address` | S01.US.03a | no | the business address |
| `party_type` + `first_name`, `middle_name`, `last_name` | text | `Person.name` with role = `party_type` | S03.US.03 | **yes** | party types: Governor, President, Organizer, Treasurer, Secretary, Vice President, General Partner, Incorporator, Member, Owner, Manager, Managing Member, ...; empty on 23% |
| `georeferenced_latitude__longitude` | | dropped | - | - | |

PA publishes no status field: `status` stays empty and the UI shows "Status: not published by Pennsylvania".

## Party gate

Not applicable to the register rows: each row is the registered entity itself, and these datasets list business entities only (no sole proprietors; trade-name files are not read). `natural_person = 0` for every state entity.

UCC debtor rows **are** party rows and go through `ingest/src/party-gate.ts`: a debtor is attached only when it is proven to be the company (CO `organizationid` equals the entity id, or an exact normalised-name match on an organisation debtor column). Person debtor columns are never selected, so a person debtor can't reach the store. Drop reasons: `ucc_name_mismatch`, `ucc_person_columns_not_read`.

## Identity and joins

- `eid` = `us-<state>-<key>`: `us-ny-<dos_id>`, `us-co-<entityid>`, `us-ct-<accountnumber>`, `us-pa-<filing_number>` (§3.4).
- No state file carries an EIN, LEI or CIK. Links to SEC or GLEIF come only from GLEIF's registration-authority id (GLEIF `RegistrationAuthorityEntityID` with the state's RA code, see `gleif.md`); never by name alone.
- A company registered in several states is several entities. The search results group them by name with the state shown; they are never merged automatically.
- A failed join leaves the entity unlinked; no error.

## Refresh and change

- No bulk load. **Open:** fetch the entity and its related rows. One record per entity per dataset (architecture A8, long-format rows grouped):
  - `record_key` = `<dataset>:<entity key>`: NY `n9v6-gdp6:<dos_id>`, `3gg2-jgnp:<dos_id>`, `k4vb-judh:<dos_id>`; CO `4ykn-tg5h:<entityid>`, `casm-dbbj:<entityid>`, `8upq-58vz:<entityid>`; CT `n7gp-d28j:<accountnumber>`, `ka36-64k6:<accountnumber>`, `ah3s-bes7:<accountnumber>`, `xfev-8smz:<accountnumber>`; PA `xvd7-5r2c:<filing_number>` (all party rows of a business are one record).
  - `hashInput`: the field-map columns of each row in the order listed above, normalised, rows sorted by their natural key (NY history `film_num|date_filed`; CO `transactionid`; CO UCC `fileid|debtorid`; CT principal `name__c|designation`; CT filing `filing_date|type|volume|pages`; CT UCC `id_lien_flng_nbr`; PA `party_type|last_name|first_name|middle_name`).
  - A change in any row rewrites that dataset's record for the entity. People: see `personRecordKey` above for role-end detection.
- **Re-fetch on view** when the cached copy is older than 24 h. Two cases (cto 7029779579, legal 7029000097):
  - **The registry returns the entity.** Its rows are replaced from the response: a line that is gone (a withdrawn or corrected CT principal, an ended role, a released UCC lien) is **deleted** (no tombstone). A removed person line emits `finora.role_ended` with no name (P4).
  - **The registry does not return the entity** (HTTP 200 with an empty result, while the same portal answers other queries). An empty response is not proof of removal, so nothing is deleted on the first miss: the cached values are **withheld from display** (not shown on any surface) and the profile reads "[State] registry did not return this company on [date]". A second miss at least 24 h later deletes the entity's rows, which meets the CT duty to drop withdrawn records while a one-off portal glitch deletes nothing. Errors (5xx, timeouts, 429) never count as a miss.
- **Purge:** entities not viewed for 30 days are deleted with all their rows (`live_cache_views`, P5).
- History events (§3.7): `finora.name_changed`, `finora.address_changed`, `finora.status_changed`, `finora.legal_form_changed` between two fetches of the same entity; `finora.role_ended`.
- Unchanged re-fetch (same row hashes): one `syncs` row of kind `unchanged`.

## Size and time budget

- Cache only: about 3-15 records per entity (entity, people, history, UCC); about 2-6 KB per entity at 123 B per statement. 1,000 opened entities ≈ 5 MB. Inside the cross-border 1 GB budget with large margin.
- Open time: 2-4 parallel queries per state, ≈ 1-2 s at the measured latency. Search: 4 parallel queries, ≈ 1-2 s; the UI shows each state's group as it arrives.

## Fixtures

- `packages/sources/src/us/socrata/fixtures/<dataset>.json`: Socrata JSON arrays with exactly the selected columns, plus `views/<dataset>.json` with `rowsUpdatedAt`.
- Fixture ids use the `FX` prefix: `us-ny-FX000001`, `us-co-FX000000001`, `us-ct-FX00001`, `us-pa-FX0000001` (§3.4). Names are obviously fictional ("Example Roofing LLC").
- The layout writer `fixtures/us/socrata.ts` emits one company per state with: a NY corporation with a chairman, a CO entity with history and one UCC debtor row, a CT company with one principal (residence columns present in the fixture file but not selected) and one withdrawn principal on the second fetch, and a PA company with two parties and no status.

## Tests

| File | Proves |
|---|---|
| `sources/src/us/state-ny/state-ny.test.ts`, `state-co.test.ts`, `state-ct.test.ts`, `state-pa.test.ts` | parse the fixtures; every statement has an item id; field map equals `meta.items` |
| `sources/src/us/socrata/select.test.ts` | every request's `$select` equals the field-map columns: residence, email, phone and agent columns are never requested (HIDE-field negative test) |
| `ingest/src/live-cache.test.ts` (shared) | fake clock: re-fetch after 24 h; day 29 survives, day 30 purged; **CT withdrawal**: a principal absent while the company is returned is deleted and a `finora.role_ended` event without a name is written; **empty re-fetch**: the first miss keeps the rows but withholds them and shows "did not return", a second miss 24 h later deletes them; a 5xx never counts as a miss |
| `web/e2e/us-co-disclaimer.spec.ts` + `domain/src/report/attribution.test.ts` | **CO disclaimer**: every report, API response and MCP response containing a CO value carries the full disclaimer text; the source chip shows it |
| `ingest/src/party-gate.test.ts` (US cases) | a UCC debtor with a different name is not attached; person debtor columns can't reach the store |
| `sources/src/licences.test.ts` | OR and WA have no enabled `live-cached` source (P11) |
| `sources/src/us/socrata/query.test.ts` | a user string with `'`, `%` and `_` is escaped; no SoQL injection |

## Failure modes

| Case | Behaviour | UI |
|---|---|---|
| Portal down or 5xx after retries | serve the cached copy if any, with its retrieval date | "Checked [state] register on [date]"; if nothing cached: `not_checked{reason: "source_down"}` |
| 429 | back off, then as above | same |
| Column renamed or missing (schema change) | the parser rejects the record; the sync is `failed` with `schema_changed`; the cache is kept | `not_checked{reason: "source_error"}` for that state |
| `rowsUpdatedAt` older than 2× cadence (daily: 2 days; NY monthly master: 62 days) | values shown with the Stale state | Stale chip |
| Search finds nothing in a state | normal result | "No match in [state]" in that state's group |

## Open questions

None for the builder. Recorded for later, not v1: OR and WA reopen only with a readable terms page (C11).
