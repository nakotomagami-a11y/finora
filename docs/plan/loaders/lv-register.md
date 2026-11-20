# lv-ur-register: Latvian Enterprise Register (register, name history, liquidations, reorganisations, equity capital, memorandum dates)

One spec for six artifact families of the Register of Enterprises of the Republic of Latvia (Uzņēmumu reģistrs, "UR"). Each family has its own `SourceMeta`:

| Source id | Dataset slug on data.gov.lv | File | Role |
|---|---|---|---|
| `lv-ur-register` | `uz` | `register.csv` | identity spine: every LV entity. Loads first; LV is searchable when it lands |
| `lv-ur-name-history` | `tiesibu-subjektu-vesturiskie-nosaukumi` | `register_name_history.csv` | former names (search, S02) |
| `lv-ur-liquidations` | `liquidations` | `liquidations.csv` | `register.liquidation` events |
| `lv-ur-reorganizations` | `reorganizatons` (sic, the slug is misspelt upstream) | `reorganizations.csv` | `register.reorganisation` events |
| `lv-ur-equity-capitals` | `equity-capitals` | `equity_capitals.csv` | share capital (S01) |
| `lv-ur-memorandum-dates` | `memorandum-date` | `memorandum_date.csv` | `filing.founding_document` events (S13) |

Not loaded from the same publisher, with the reason: `legal-entity-duration` (no item), `special-statuses` (no item), `area-of-activity` and `biedribu-un-nodibinajumu-darbibas-jomas` (association activity areas: no item), `farm-land`, `arbitration_*`, `political-parties`, `religious-affiliations`, `public-persons-institutions`, `interest-representatives`, `property_investment_appraisers_list`, `akf-data`, `raim-dati` (no item). People, owners and risk files have their own specs: `lv-people.md`, `lv-risk.md`. Annual reports: `lv-financials.md`. Tax authority: `lv-tax.md`.

## Source

**Publisher and URLs.**
- Publisher: Register of Enterprises of the Republic of Latvia, through the national open-data portal (CKAN) at `https://data.gov.lv`.
- Homepage: `https://www.ur.gov.lv`.
- **How to find the current file URL (shared by every `lv-ur-*` and `lv-vid-*` source):**
  1. Call `GET https://data.gov.lv/dati/api/3/action/package_show?id=<slug>`.
  2. In `result.resources[]`, take the resource whose URL basename equals the file name in the table above and whose `format` is `CSV`.
  3. Download its `url`.
  4. If no resource matches, the sync is `failed` with `resource_missing`. Nothing else is touched.
- The resource URLs (`https://data.gov.lv/dati/dataset/<uuid>/resource/<uuid>/download/<file>`) were identical on 2026-11-19 and 2026-11-20, but the loader never hard-codes them.
- `officialHosts`: `data.gov.lv`, `info.ur.gov.lv`, `www.ur.gov.lv`.

**Licence.**
- `cc0-1.0` for all six families. The "Licence" field on each dataset page reads "CC0-1.0", and CKAN `license_id` is `CC0-1.0`; verified 2026-11-19 (`docs/research/baltics.md`).
- CC0 requires no attribution, and no dataset page asks for a wording. `attribution` (shown in the UI, R16): "Source: Register of Enterprises of the Republic of Latvia, <dataset title>, data.gov.lv, CC0 1.0". The dataset titles: "Register", "Historical names", "Liquidations", "Reorganisations", "Equity capital", "Memorandum dates".
- `storage: "store"`.

**Cadence and publication time.**
- `cadence: "daily"` for all six. They are small, and an unchanged artifact costs one sync row.
- Observed regeneration: nightly at about 21:26 UTC (CKAN `last_modified` 2026-11-18T21:25, HTTP Last-Modified 2026-11-19 21:26 GMT). `publishedAtUtc: "21:40"`; the scheduler runs after it.
- The name-history file has not changed since 2025-04-02 (stale upstream). It still syncs daily: one `unchanged` row a day.

**`asOf`, `maxPurgeShare`, `purgeScope` per family.** The UR files carry no export date in a header, a column or the file name. Three strategies were proved on the 2026-11-19 and 2026-11-20 pulls, in this order:
1. `max_date_in_data` over the fields below; dates after the sync's UTC date are ignored. **This one wins today.**
2. `portal_metadata`: the CKAN resource `last_modified` from `package_show`.
3. `http_last_modified`: the HTTP header. It changes at every nightly regeneration, even when the content doesn't.

An equal as-of on a quiet day (a weekend) is normal; only an older one is `stale_skipped`.

`maxPurgeShare` = max(0.02, 5 × the measured removal share per day), from the 19 → 20 Nov content diff (`diff_pulls.py`, `baltics.md`). Every family is `purgeScope: "full"`: each daily file is the complete current state.

| Source | `max_date_in_data` fields | Value on 2026-11-19 | Removed / rows per day | `maxPurgeShare` |
|---|---|---|---|---|
| `lv-ur-register` | `registered`, `terminated` | 2026-11-17 | 0 / 490,496 (0%) | 0.02 |
| `lv-ur-name-history` | `date_to` | 2025-04-02 (stale upstream) | 0 / 90,974 | 0.02 |
| `lv-ur-liquidations` | `registered_on`, `last_modified_at` | 2026-11-17 | 13 / 9,651 (0.13%; ×5 = 0.67%) | 0.02 |
| `lv-ur-reorganizations` | `registered` | 2026-11-17 | 1 / 10,930 (0.01%) | 0.02 |
| `lv-ur-equity-capitals` | `last_modified_at` | 2026-11-17 | 31 / 144,550 (0.02%) | 0.02 |
| `lv-ur-memorandum-dates` | `registered_on` | 2026-11-17 | 13 / 150,776 (0.01%) | 0.02 |

**`parserVersion`:** sha256 of the loader module, its field map, `items.generated.ts` and the LV part of `domain/config/legal-forms.ts`. The legal-form table decides `natural_person` and the schema, so a change to it re-parses.

**Keys, limits, politeness.**
- No key and no account (`requires: []`).
- No published rate limit. The fetcher sends `User-Agent: finora/<version> (+repository URL)`, one request at a time per host, ≤ 2 requests/s (`limits.requestsPerSecond: 2`), and retries 3 times with backoff on 5xx and timeouts.
- Size caps: 400 MB for `register.csv` (129 MB measured), 50 MB for the others.

**Deep link (`deepLink`).**
- `https://info.ur.gov.lv/#/legal-entity/{entityCode}` for all six families: the company page on the register's free public portal (route `/legal-entity/:regNumber` from the portal's own route list). Linking terms are not stated; a plain link to a public government page is the default (`baltics.md`).
- `orderUrl`: `null`.

## Items

| item_id | Call | Caveat text | Empty state | Filled by |
|---|---|---|---|---|
| S01.LV.01 | SHOW | - | NP (LEI, VAT: — when absent) | name, code, legal form, registration date, address (register); share capital (equity capitals). NACE and VAT come from `lv-tax.md`; LEI from `gleif.md` |
| S02.LV.01 | SHOW | - | NP; history: "Tracked by Finora since [date]" | status, terminated date (register); former names; liquidations; reorganisations; our `finora.*` change events |
| S13.LV.01 | SHOW | - | NP | memorandum dates (`filing.founding_document`). Annual-report filings come from `lv-financials.md` |
| S17.LV.01 | CAVEAT | Company-to-company links only: shared addresses and corporate members. Registered offices of companies only; an address shared with a sole trader or private individual is not shown | — | `addressid` as the shared-address key (derived in ingest step 7). Corporate members come from `lv-people.md` |

Not filled here: S18.LV.01 (SHOW, NC per check) is computed by `domain/verdict` from the items above and those of the other LV specs. Check 1 ("pinned to a registry record") and check 2 ("status current and active") read S01.LV.01 and S02.LV.01; check 8 reads `register.liquidation`.

## Field map

Legend: **R** = resolution key; **NP** = natural-person entity (legal form in `IK`, `ZEM`, `ZVJ`, `IND`, `GIM`, see Party gate).

### `lv-ur-register` (`register.csv`, `;`, UTF-8 with BOM, English headers)

Header (exact, checked at parse): `regcode;sepa;name;name_before_quotes;name_in_quotes;name_after_quotes;without_quotes;regtype;regtype_text;type;type_text;registered;terminated;closed;address;index;addressid;region;city;atvk;reregistration_term`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `regcode` | text, 11 digits | `entity.eid` = `lv-<regcode>`; statement `registrationNumber`; record key | S01.LV.01 (R) | no | Strip spaces. 11 digits passing the check digit (Identity and joins). 9-digit legacy codes: skip, reason `legacy_code` (34,240 rows, all terminated except 3,435 media-register outlets). Other failures: skip `invalid_code` |
| `name` | text | statement `name`; `entity.caption` unless NP; FTS unless NP | S01.LV.01 | NP: yes | Trim; collapse inner whitespace. NP: caption = `<legal form> <regcode>` (e.g. "IK 4xxxxxxxxxx"), the name is not indexed in FTS or trigram and appears only behind the purpose gate |
| `regtype` | code (1 letter) | `entity.schema`: `K` → `Company`; `B`, `S`, `R`, `P`, `O`, `A`, `T` → `Organization`; `C`, `E`, `U` → `LegalEntity`; `M` (media outlets) → skip `no_item` | S01.LV.01 | no | Unknown letter → `LegalEntity`, counted `unknown_regtype` |
| `type` | code (2-3 letters) | `entity.legal_form` = `lv:<type>` via `domain/config/legal-forms.ts`; statement `legalForm`; decides `natural_person` | S01.LV.01 (R) | no | Unknown code → stored as is, counted `unknown_legal_form`, `natural_person = 0`, and a health-check warning |
| `type_text` | text (lv) | label for `legalForm` (lang `lv`) in `legal-forms.ts` only, not a statement | S01.LV.01 | no | Used to seed and check the label table; empty in 0.29% of rows |
| `registered` | date `YYYY-MM-DD` | statement `incorporationDate` | S01.LV.01 | no | ISO date; empty (0.02%) → no statement |
| `terminated` | date | statement `dissolutionDate` | S02.LV.01 | no | ISO date |
| `closed` | code `L` / `R` / blank | `entity.status` (with `terminated`) | S02.LV.01 | no | `L` → `struck_off`; `R` → `reorganised`; blank and `terminated` set (646 rows) → `struck_off`; blank and no `terminated` → `active`, then refined in ingest step 7: an open `register.liquidation` → `liquidating`; an open insolvency (`lv-risk.md`) → `insolvent`. Statement `status` holds the register's own value (`L`, `R` or `active`); the label is in the UI table |
| `address` | text | statement `address` | S01.LV.01 | NP: dropped | Active entities only (load rule 3: struck-off entities keep identity only). Append the postal code from `index` as `, LV-<index>` when present. NP: the address is reduced to the country, statement `country` = `lv`, and the text is dropped with reason `natural_person_address` |
| `index` | text, 4 digits | part of `address` | S01.LV.01 | NP: dropped | as above |
| `addressid` | int (address register id) | statement `finora:addressId` | S17.LV.01 (R) | NP: dropped | Active non-NP entities only. `0` or empty → none. Never shown; used by ingest step 7 to count companies per registered address |
| `sepa`, `name_before_quotes`, `name_in_quotes`, `name_after_quotes`, `without_quotes`, `regtype_text`, `region`, `city`, `atvk`, `reregistration_term` | - | not read | - | - | - |

Struck-off and reorganised entities (`status` ≠ `active`) get only `name`, `registrationNumber`, `legalForm`, `status`, `incorporationDate` and `dissolutionDate`.

### `lv-ur-name-history` (`register_name_history.csv`, `;`)

Header: `regcode;date_to;name`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `regcode` | text | joins to the entity `lv-<regcode>` | S02.LV.01 (R) | no | as above; an unknown code is skipped `code_not_in_register` |
| `date_to` | date | part of the record key only (the date the name stopped being used is not displayed in v1) | S02.LV.01 (R) | no | ISO date |
| `name` | text | statement `previousName`; FTS (former names) | S02.LV.01 | NP: dropped | NP entities: dropped, reason `natural_person_name` (a sole trader's former name is a person's name) |

Record key: `<regcode>|<date_to>|<sha8(name)>`. There can be several rows per company; 0.27% have an empty name, which is a counted skip.

### `lv-ur-liquidations` (`liquidations.csv`, `;`)

Header: `id;legal_entity_registration_number;liquidation_type;liquidation_type_text;date_from;grounds_for_liquidation;registered_on;last_modified_at`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | int | record key | S02.LV.01 (R) | no | - |
| `legal_entity_registration_number` | text | the event's entity | S02.LV.01 (R) | no | unknown code → `code_not_in_register` |
| `liquidation_type` | enum | event `register.liquidation`, `data.kind` | S02.LV.01 | no | `LIQUIDATION`, `ACTIVITY_TERMINATED`, `ACTIVITY_TERMINATED_BY_COURT`, `NON_REREGISTRATION`, `REFORM_OF_POLITICAL_PARTIES`, `REFORM_OF_ASSOCIATIONS`. Unknown → kept, counted `unknown_enum` |
| `liquidation_type_text` | text (lv) | UI label table only | S02.LV.01 | no | - |
| `date_from` | date | event date | S02.LV.01 | no | ISO |
| `grounds_for_liquidation` | text | dropped, reason `free_text` | - | possibly | Free text can name people (courts, liquidators) |
| `registered_on`, `last_modified_at` | date | as-of only | - | no | - |

### `lv-ur-reorganizations` (`reorganizations.csv`, `;`)

Header: `id;reorganization_type;reorganization_type_text;source_entity_regcode;final_entity_regcode;registered`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | int | record key | S02.LV.01 (R) | no | - |
| `reorganization_type` | enum | `register.reorganisation`, `data.kind` | S02.LV.01 | no | `ACQUISITION`, `TRANSFORMATION`, `SEPARATION`, `REORGANISATION`, `DIVISION`, `MERGER` |
| `source_entity_regcode`, `final_entity_regcode` | text | two events, one on each entity: `data = {kind, role: "source"/"final", other: "lv-<code>"}` | S02.LV.01 (R) | no | A missing or unknown side (0.01%) → the event is written only on the side that resolves, with `data.other = null` |
| `registered` | date | event date | S02.LV.01 | no | empty (4.7%) → the date is the sync's date, with `data.date_estimated = true` |
| `reorganization_type_text` | text (lv) | UI label table only | - | no | - |

### `lv-ur-equity-capitals` (`equity_capitals.csv`, `;`)

Header: `id;legal_entity_registration_number;equity_capital_type;equity_capital_type_text;amount;currency;date_from;last_modified_at`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `legal_entity_registration_number` + `equity_capital_type` | text | record key `<code>|<type>` | S01.LV.01 (R) | no | If a key has several rows, keep the one with the latest `date_from`, then the highest `id` |
| `equity_capital_type` | enum | which statement | S01.LV.01 | no | `PAID_UP_EQUITY` or `REGISTERED_EQUITY` → statement `capital`. `INVESTMENT`, `CONDITIONAL_EQUITY`, `EQUITY_KB`, `MINIMUM_RESERVES` → not loaded, counted `no_item` |
| `amount` | decimal | statement `capital` value | S01.LV.01 | no | Value written as `<amount> <currency>`, e.g. `2800.00 EUR`. Paid-up wins over registered when both exist |
| `currency` | `EUR` / `LVL` | part of the value | S01.LV.01 | no | LVL kept as LVL, never converted |
| `date_from` | date | `finora.capital_changed` compares on change | S01.LV.01 | no | - |
| `id`, `equity_capital_type_text`, `last_modified_at` | - | as-of only (`last_modified_at`) | - | - | - |

Active, non-NP entities only. NP entities have no capital. Share capital is SHOW as an optional S01 field that never feeds the verdict (Part H, "Calls from the Baltic loader specs", 3).

### `lv-ur-memorandum-dates` (`memorandum_date.csv`, `;`)

Header: `id;legal_entity_registration_number;document_date;registered_on`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | int | record key | S13.LV.01 (R) | no | - |
| `legal_entity_registration_number` | text | the event's entity | S13.LV.01 (R) | no | empty (0.02%) → `no_code` |
| `document_date` | date | event `filing.founding_document` date | S13.LV.01 | no | A year before 1990 (the file has typos such as year 0119) or an empty value (0.24%) → use `registered_on`, with `data.date_from_registration = true` |
| `registered_on` | date | `data.registered_on` | S13.LV.01 | no | - |

## Party gate

Not applicable to the identity rows: `register.csv` is the register itself, and every row is an entity. The natural-person rule applies to it all the same:
- **Natural-person forms** (`natural_person = 1`): `IK` (sole trader), `ZEM` (farm), `ZVJ` (fishing farm), `IND` (individual enterprise), `GIM` (family enterprise). There are 90,961 rows, 45,247 of them active. For these: caption = legal form + code; the name stays out of FTS; the address is reduced to the country; there is no `finora:addressId`, no capital and no former names.
- Liquidations, reorganisations, equity rows and memorandum rows attach to an entity code. A code that is not in `register.csv` is skipped `code_not_in_register`, and an empty code `no_code`, both counted in `syncs.report_json.dropped`.
- **S17 address rule (Part H 3):** ingest step 7 counts companies per `finora:addressId`. Any address id that also hosts an NP entity is suppressed entirely, with no count and no list. Measured on 2026-11-19: 24,662 shared addresses among active non-NP entities (44.2% of them share one; size p50 2, p95 7, max 186); 38,107 address ids are suppressed because an NP entity sits there.

## Identity and joins

**Sole traders' registration numbers are never personal codes** (legal's S04a condition; measured on the full register file of 2026-11-19, all 490,496 entities):
- Every sole-trader form (`IK`, `ZEM`, `ZVJ`, `IND`, `GIM`; 89,764 rows, active and ended) carries a register-issued code: 11 digits starting with 4, 5 or 6 and passing the register checksum, or a 9-digit legacy code (ended entities only).
- Across the whole file, 11-digit codes start only with 4 (413,448), 5 (41,541), 6 (26) or 9 (1,241). None starts with 0-3, so none can be an old-style personal code (`DDMMYY…`, a day of 01-31), and none starts with 32 (new-style codes). 9-digit legacy codes cannot match the 11-digit personal-code length.
- So no LV sole trader carries the owner's personal code as its registration number. The store's sole-trader exception covers register codes only; a sole-trader id value that matches the personal-code pattern is refused (S04i test), and the fixture world includes one such row to prove it.

- **Entity id.** `lv-<11-digit regcode>`.
- **Check digit.** Weights `9,1,4,8,3,10,2,5,7,6` over the first 10 digits, check digit = `(3 − Σ) mod 11`. A result of 10 means no valid code exists for that prefix. All 456,256 eleven-digit codes in the 2026-11-19 file pass. The implementation is `domain/src/ids/lv.ts`, shared with every LV loader.
- **Join keys.** Other LV sources join by the same code: the tax authority (`Registracijas_kods`, 98.6% found), annual reports (100%), officers and members (100%), insolvency (100%). The VAT number is `LV` + code, embedded (`lv-tax.md`). LEIs are linked by `gleif.md` via `registeredAs` = code, authority `RA000423`.
- **A failed join** (a code in another LV file that is not in `register.csv`) is a counted skip `code_not_in_register` in that file's sync. It never creates an entity.
- **Load order.** `lv-ur-register` must have a `content` sync before any other LV source writes. A dependent source whose register sync is older than its own artifact still loads, and its unknown codes are counted.

## Refresh and change

- **Full load and refresh** are the same pipeline (§4.4). `lv-ur-register` is fetched daily.
- **Unchanged test.** sha256 of the downloaded file plus `parserVersion`; both equal → one `syncs` row of kind `unchanged`, nothing else. HTTP ETag and Last-Modified change at every nightly regeneration without content changes (measured), so they are not used.
- **Record unit, hash input, sort order.** One record per file row; `row_hash` = sha256 truncated to 16 bytes, over the field-map fields in table order, normalised as written.

  | Source | `recordKey` | Hash input (in order) | Sort order relied on |
  |---|---|---|---|
  | register | `regcode` | `regcode`, `name`, `regtype`, `type`, `registered`, `terminated`, `closed`, `address`, `index`, `addressid` | none: row-wise |
  | name history | `<regcode>\|<date_to>\|<sha8(name)>` | `regcode`, `date_to`, `name` | none |
  | liquidations | `id` | `legal_entity_registration_number`, `liquidation_type`, `date_from` | none |
  | reorganisations | `id` | `reorganization_type`, `source_entity_regcode`, `final_entity_regcode`, `registered` | none |
  | equity capital | `<regcode>\|<equity_capital_type>` | the kept row's `amount`, `currency`, `date_from` | none: the parser picks the kept row per key with an in-memory map (≈ 145,000 rows; the file is unsorted, 241 contiguity breaks) |
  | memorandum dates | `id` | `legal_entity_registration_number`, `document_date`, `registered_on` | none |

- **Measured churn between two daily pulls:** register 43 added, 0 removed, 56 changed; liquidations 14 added, 13 removed; reorganisations 3 added, 1 removed; equity 55 added, 31 removed; memorandum 42 added, 13 removed.
- **Purge guard:** `maxPurgeShare` 0.02 per family (table in § Source). An empty or cut-off file ends `partial` with `purge_guard`.
- **History events** (ingest step 5, §3.7), from the old and new statements of a changed register record:
  - `name` changed → `finora.name_changed` (`data = {old, new}`; NP: no names in `data`, only `{changed: true}`);
  - `address` changed → `finora.address_changed` (NP: never emitted, there is no address);
  - `status` changed → `finora.status_changed`;
  - `type` changed → `finora.legal_form_changed`;
  - capital value changed → `finora.capital_changed` (from `lv-ur-equity-capitals`).

  Each carries item S02.LV.01.
- **Removed.**
  - A `register.csv` code that disappears (0 seen in our diff; terminated entities stay in the file with `closed` set) → the entity keeps its identity statements and gets `tombstone_since` and a `finora.tombstoned` event.
  - Liquidation, reorganisation, equity and memorandum records that disappear are deleted with their events. There are no tombstones for events, and no finora event: a lifted liquidation record is the register correcting itself.
- **Partial or interrupted** → no purge (§4.4 step 6).
- **Storage or licence class change** (A7): a full reload into the new class, then a purge from the old one. None is foreseen for these CC0 sources.

## Size and time budget

Rows from the 2026-11-19 pull (`baltics.md`, `round2.md`); 🟡 = estimated.

| Family | Rows read | Records | Statements | Events | Est. bytes |
|---|---|---|---|---|---|
| register | 490,496 | 456,256 (9-digit skipped) | ≈ 3.0 M (active ≈ 7 each, struck-off ≈ 5 each) | history only | ≈ 0.37 GB statements + 36 MB entity rows 🟡 |
| name history | 90,974 | ≈ 85,000 (NP dropped) | ≈ 85,000 | 0 | ≈ 10 MB |
| liquidations | 9,651 | 9,651 | 0 | 9,651 | < 1 MB |
| reorganisations | 10,930 | 10,930 | 0 | ≈ 21,800 | < 1 MB |
| equity capital | 144,550 | ≈ 141,000 | ≈ 141,000 | history only | ≈ 17 MB |
| memorandum dates | 150,776 | 150,776 | 0 | 150,776 | ≈ 5 MB |
| `records` rows (≈ 60 B each) | | ≈ 0.85 M | | | ≈ 51 MB |
| FTS + trigram over names and former names | | | | | ≈ 0.15 GB 🟡 |
| **Total** | | | | | **≈ 0.6 GB 🟡** |

The LV total across the five LV specs is ≈ 1.25 GB of rows, ≈ 1.6 GB with secondary indexes and FTS (🟡). That is against P10's LV ≤ 2.5 GB, leaving ≈ 0.9 GB for our own history (cto: ≈ 0.2 GB a year).

**Time, on the named machine profile** (🟡, from measured stdlib-Python parse times; `docs/plan/benchmarks.md` replaces them):
- `register.csv`: download 129 MB ≈ 45 s, parse ≈ 28 s, write ≈ 3.0 M statements ≈ 25 s, FTS ≈ 20 s. **LV searchable ≈ 2 min after start.**
- The other five families together: ≈ 15 s parse, < 10 s write.
- Daily refresh of these six: ≈ 1.5 min (download ≈ 50 s, parse of changed files ≈ 35 s, a few hundred record writes).

## Fixtures

- **Writer:** `packages/sources/src/lv/lv-ur-register/fixture.ts` generates `register.csv`, `register_name_history.csv`, `liquidations.csv`, `reorganizations.csv`, `equity_capitals.csv` and `memorandum_date.csv`.
- **Format:** the exact headers above, `;` delimiter, UTF-8 with BOM, CRLF line ends as upstream, no quoting except where a value contains `;` or `"`.
- **Rows:** about 40 register rows covering:
  - every `regtype` letter and the legal forms `SIA`, `AS`, `IK`, `ZEM`, `IND`, `KS`, `PS`, `FIL`, `BDR`;
  - each `closed` value, including blank with `terminated` set;
  - one 9-digit legacy code;
  - one code with a wrong check digit beyond the fixture variant (expected `invalid_code`);
  - an address with and without `index`;
  - two companies sharing an `addressid`, and one sole trader sharing a third `addressid` with a company (that address must be suppressed in S17);
  - one renamed company with two name-history rows;
  - a liquidation of each type, a merger with both sides, an equity row in LVL, a memorandum row with year 0119.
- **Names:** obviously fictional: "Example Timber SIA", "Sample Bakery AS", "Demo Logistics SIA", and for sole traders "IK Test Person A".
- **Codes:** fixture-only codes. Pick 11-digit codes with prefixes `40003`, `40103`, `40203`, `50003` and `90000`. Compute the true check digit `c`, skip prefixes where `c = 10`, and write `(c + 1) mod 10`. `fixtures/ids.test.ts` asserts every fixture code fails `domain/src/ids/lv.ts` and passes its fixture variant.
- **Size:** < 50 KB, committed.

## Tests

| File | What it proves |
|---|---|
| `packages/sources/src/lv/lv-ur-register/lv-ur-register.test.ts` | Parses the fixture. Every field-map row lands in the right statement, prop or event with its item id. Unread columns produce no value. 9-digit code → `legacy_code`. Bad check digit → `invalid_code`. Unknown legal form counted. `closed` mapping: L → struck_off, R → reorganised, blank+terminated → struck_off. Struck-off entities have identity props only. NP entity: caption = form + code, `natural_person = 1`, no address text, `country = lv`, no `addressId`, not in the FTS input list |
| `packages/sources/src/lv/lv-ur-register/name-history.test.ts` | `previousName` statements. NP former names dropped with `natural_person_name`. Record key stable for identical rows |
| `packages/sources/src/lv/lv-ur-register/events.test.ts` | Liquidation, reorganisation (both sides, one side unresolved), memorandum (year-0119 fallback) events, dates and `data` |
| `packages/sources/src/lv/lv-ur-register/equity.test.ts` | Paid-up beats registered. Latest `date_from` wins. LVL kept. NP: no capital |
| `packages/sources/src/lv/lv-ur-register/header.test.ts` | A renamed or missing column → parse throws `schema_changed`. An extra column → warning, parse continues |
| `packages/sources/src/lv/as-of.test.ts` | Max-date as-of per family; future dates ignored; equal as-of is not stale |
| `packages/sources/src/field-maps.test.ts` (shared) | Every target is a SHOW/CAVEAT item or a resolution key. `meta.items` equals the field-map items |
| `packages/sources/src/licences.test.ts` (shared) | `cc0-1.0` + `store` passes the invariants. Every host in `officialHosts` |
| `fixtures/ids.test.ts` (shared) | LV fixture codes fail the real check digit and pass the fixture variant |
| `packages/ingest/src/unchanged.test.ts`, `purge.test.ts`, `partial.test.ts`, `stale.test.ts` (shared) | Run with this source's fixture: unchanged file → one sync row; removed liquidation row → event deleted; interrupted sync purges nothing; older as-of skipped |
| `packages/ingest/src/history.test.ts` (shared) | Fixture day 2 renames a company, moves an address, changes capital → `finora.name_changed`, `finora.address_changed`, `finora.capital_changed`. An NP rename has no names in `data` |
| `packages/ingest/src/shared-address.test.ts` | Two companies at one `addressid` → count 2. The address shared with a sole trader → no count, no list (Part H 3) |
| `packages/store/src/provenance.test.ts` (shared) | Every statement and event from these sources has a `record_id` whose sync carries `cc0-1.0`, retrieval date and as-of |

## Failure modes

| Failure | Loader does | UI shows |
|---|---|---|
| CKAN API or download down (5xx, timeout after 3 retries) | sync `failed` (`fetch_failed`); previous data stays | Sources page: "Last checked [date]: failed". Report sections keep their data with the older as-of date, never an empty state |
| `package_show` has no matching resource | `failed` (`resource_missing`) | as above |
| Header changed (a read column renamed or missing) | `failed` (`schema_changed`); nothing written | as above, plus a health-check error naming the column |
| Partial file (truncated last line, or rows < 90% of the last content sync) | `partial`; rows written, no purge | as above |
| As-of older than the last content sync | `stale_skipped` | nothing changes |
| As-of more than 3 days behind the sync date (2× daily cadence) | content sync, source marked `stale` | each LV identity line shows "as of [date]" in the warning style |
| Name history unchanged for months | normal (`unchanged`) | S02 former names carry the as-of date of the last content sync (2025-04-02 today) |
| A company is not in the file at all | - | S01: entity not found; search falls back to other countries |

## Open questions

1. **New names** (once): status `reorganised` (closed code `R`); drop reasons `no_item`, `free_text`, `natural_person_name`, `natural_person_address`, `unknown_enum`; extension prop `finora:addressId` (needs a line in `schema/ftm-subset.test.ts`). FtM props used: `registrationNumber`, `legalForm`, `incorporationDate`, `dissolutionDate`, `status`, `address`, `country`, `previousName`, `capital`.
2. **Label tables.** Legal-form, register-type and liquidation-type labels are Latvian only in the files. Proposal: a bundled `domain/config/labels/lv.ts` (Latvian from the files plus our English gloss), counted in `parserVersion` only where the parser reads it (legal forms).
3. **Purge-guard floor on small files.** 0.02 of a few thousand records is fine here. For the 63-row sanctions-links file (`lv-risk.md`) it allows only one removal per sync. Proposal: max(share, 5 records).
