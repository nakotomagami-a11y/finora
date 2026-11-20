# lt-register: Register of Legal Entities (JAR) daily files and Statistics Lithuania activity codes

Covers four `SourceMeta` entries:

| Source id | Artifact(s) | Fills |
|---|---|---|
| `lt-rc-jar-entities` | `JAR_IREGISTRUOTI.csv` + `JAR_ISREGISTRUOTI.csv` (one source, two artifacts, one record per company code) | S01.LT.01, S02.LT.01 |
| `lt-rc-jar-bodies` | `JAR_VALDYMAS.csv` | S03.LT.01 |
| `lt-rc-jar-capital` | `JAR_KAPITALAS.csv` | S01.LT.01 |
| `lt-lsd-activity` | Statistics Lithuania activity table + the EVRK classifier (two API artifacts) | S01.LT.01 |

Legal-form and status labels (LT and EN) come from the register's API classifiers and are committed as config, not loaded at run time (see Identity and joins). The JAR non-governmental-organisation file (`JAR_NVO.csv`) is not read: no item needs it.

Why one source for registered + deregistered: a company moves from the first file to the second when it is struck off. As one source keyed on the company code, that move is a changed record (status → `struck_off`, a `finora.status_changed` event), never a purge of the entity.

## Source

**`lt-rc-jar-entities`, `lt-rc-jar-bodies`, `lt-rc-jar-capital`**
- Publisher: Registrų centras (the state enterprise that keeps JAR). Official dataset pages: `https://data.gov.lt/datasets/1484/` (registered entities), `https://data.gov.lt/datasets/1564/` (management bodies). Files:
  - `https://www.registrucentras.lt/aduomenys/?byla=JAR_IREGISTRUOTI.csv`
  - `https://www.registrucentras.lt/aduomenys/?byla=JAR_ISREGISTRUOTI.csv`
  - `https://www.registrucentras.lt/aduomenys/?byla=JAR_VALDYMAS.csv`
  - `https://www.registrucentras.lt/aduomenys/?byla=JAR_KAPITALAS.csv`
  These are the stable URLs the data.gov.lt pages list as their CSV distributions. Do not use the API copy of the register (`get.data.gov.lt/datasets/gov/rc/jar/iregistruoti`) for identity: its loads are irregular (gaps up to six months, newest load 28 days old on 2026-11-19).
- Licence: `cc-by-4.0` ("Creative Commons Attribution 4.0" on data.gov.lt pages 1484 and 1564, verified 2026-11-19). Attribution (no wording stated by the publisher; recorded in `baltics.md` round 2): "Source: Registrų centras, Register of Legal Entities (open data), CC BY 4.0". Storage: `store`.
- Cadence: daily. `publishedAtUtc`: unknown (the files had not regenerated at 00:00 UTC on 2026-11-20); schedule after 07:00 UTC with the other LT sources and rely on the as-of check. As-of: see Contract values below (`formavimo_data`, the same date on every row). A file whose `formavimo_data` is older than the last content sync is `stale_skipped`.
- Keys: none. Limits: none observed. Politeness: one file at a time, 2 s between files, `User-Agent` from the shared polite fetcher. No HTTP validators are sent (no ETag, no Last-Modified, `Cache-Control: private`), so change detection is the artifact sha256 only.
- `officialHosts`: `www.registrucentras.lt`, `data.gov.lt`.
- `deepLink`: `null`. The free search page (`https://www.registrucentras.lt/jar/p/index.php`) needs a form post with a check number and allows 100 searches a day, so there is no per-company URL. The report links the search page as a plain "Search the register" link.
- `orderUrl` (the only allowed `paid_only` target, Part H): `https://www.registrucentras.lt/paslauga/jar-israsas` (the register's own page for ordering electronic JAR extracts; `.../paslauga/jar-israsu-uzsakymas` redirects there). Used by S03.LT.01 names and S04.LT.01.

**`lt-lsd-activity`**
- Publisher: State Data Agency (Statistics Lithuania). Dataset pages: `https://data.gov.lt/datasets/2088/` (economic activities and institutional sectors of legal entities), `https://data.gov.lt/datasets/1927/` (EVRK 2 classifier). Endpoints:
  - `https://get.data.gov.lt/datasets/gov/lsd/cl/ja_asmenys/JuridinisAsmuo/:format/csv?select(_id,kodas,veikla,veikla_atnaujinta)`
  - `https://get.data.gov.lt/datasets/gov/lsd/cl/evrk/EkonominesVeiklosRusis/:format/csv?select(_id,kodas,pavadinimas_lt,pavadinimas_en)`
- Licence: `cc-by-4.0` ("Creative Commons Attribution 4.0" on data.gov.lt pages 2088 and 1927, verified 2026-11-20). Attribution: "Source: State Data Agency (Statistics Lithuania), economic activities of legal entities and EVRK 2, CC BY 4.0". Storage: `store`.
- Cadence: daily (catalogue: "Kasdien"); newest load 2026-11-19 12:52 UTC. As-of: see Contract values below.
- Keys: none. The API streams a whole model without a limit (the 552,531-row table took 88 s). Politeness: sequential, 2 s apart. ETag and Last-Modified are sent and `If-Modified-Since` answers 304; use it as a hint only.
- `officialHosts`: `get.data.gov.lt`, `data.gov.lt`. `deepLink`: `null`. `orderUrl`: `null`.

**Why the activity code comes from Statistics Lithuania:** it covers 97.3% of active companies, every code resolves in the classifier, and the classifier has English labels for all of them. The tax-payer register (activity on 83.5% with the social-insurance file) and the social-insurance file (Lithuanian labels only) are not used for activity.

### Contract values (§4.2-§4.4)

| Source | `asOf` (strongest first; the first wins today) | `maxPurgeShare` (measurement) | `purgeScope` | Record unit, hash input, sort order |
|---|---|---|---|---|
| `lt-rc-jar-entities` | 1. `in_file_field`: column `formavimo_data` (wins; the files send no Last-Modified, so there is no second strategy) | **0.02**: removal 0 of 550,482 codes over 48 days (every code in the API copy of 2026-10-02 is in the daily union of 2026-11-19); a strike-off is a change, not a removal | `full` | one record per company code across both files; hash input in Identity and joins; no order assumed (records are independent; a code in both files keeps the deregistered row, counted `duplicate_code`) |
| `lt-rc-jar-bodies` | 1. `in_file_field`: `formavimo_data` (wins) | **0.02**: removals are strike-offs, 618 in 48 days of 235,095 rows = 0.005% a day | `full` | one record per company (one row each); no order assumed |
| `lt-rc-jar-capital` | 1. `in_file_field`: `formavimo_data` (wins) | **0.02**: removals are strike-offs of limited companies (same measurement, ≤ 0.005% a day) | `full` | one record per company; no order assumed |
| `lt-lsd-activity` | 1. `portal_metadata`: `_created` of the newest change-log entry, `.../ja_asmenys/JuridinisAsmuo/:changes/-1` (wins; 2026-11-19 12:52 UTC); 2. `http_last_modified` (same timestamp on 2026-11-19) | **0.02**: the change feed shows 0 deletes on the loads of 2026-11-17, 18 and 19 (53-74 inserts and 85-274 patches a day of 552,531 rows; `removal_shares.py`); records also leave when a company is struck off (≈ 13 a day) | `full` | one record per company code (registered entities only); the activity table is sorted by its `_id`, the classifier is read into memory first, so no order is assumed |

**Measured day over day (files of 19 and 20 Nov 2026, `python -I research/probes/baltics/lt/diff_pulls.py` with `--fields` excluding `formavimo_data`):** registered file 236,455 → 236,506, 65 added, 14 moved to the deregistered file, 64 changed (0.06%); management bodies 65 added, 14 removed, 56 changed. Hashing `formavimo_data` would mark 100% of rows changed every day, so the hash inputs exclude it (as above).

`parserVersion` (A1) for all four: the hash of the loader module, its field map and the generated item list, plus, for `lt-rc-jar-entities` and `lt-rc-jar-bodies`, the generated LT tables in `legal-forms.ts` and `statuses.ts` (the natural-person form set and the status mapping change what is stored). The EVRK classifier is a fetched artifact, not part of the parser.

## Items

| item_id | Call | Caveat text | Empty state |
|---|---|---|---|
| S01.LT.01 | SHOW | - | NP (LEI, VAT: — when absent) |
| S02.LT.01 | SHOW | - | NP; history: "Tracked by Finora since [date]" |
| S03.LT.01 | CAVEAT | Role facts only; names are not in Lithuania's open data | needs_purpose; PAID (names) |

Not filled here but derived from these rows by other parts of the system: S09.LT.01 (insolvency status, with `lt-bankruptcy`), S17.LT.01 (shared registered offices, derive step), S18.LT.01 (status checks). S04.LT.01 is LATER (`paid_only`, order link above): nothing is read for it.

## Field map

### `lt-rc-jar-entities` (both files; `JAR_ISREGISTRUOTI.csv` has `isreg_data` instead of the three status columns)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `ja_kodas` | int, 9 digits | entity `eid` = `lt-<ja_kodas>`; statement `registrationNumber` | S01.LT.01 | no | 9 digits, mod-11 check digit (below); else skip `invalid_code` |
| `ja_pavadinimas` | text | statement `name`; entity `caption` | S01.LT.01 | yes for natural-person forms | trim, collapse spaces, keep the register's quotes. **Natural-person forms: dropped** (`natural_person_name`), caption = "<legal form label> <code>" |
| `adresas` | text | statement `address` (registered office, full text) | S01.LT.01 | yes for natural-person forms | trim. **Natural-person forms: dropped** (`natural_person_address`); statement `country` = `lt` instead. **Deregistered rows: not read** (load rule 3) |
| `ja_reg_data` | date | statement `incorporationDate` | S01.LT.01 | no | ISO date |
| `form_kodas` | int | entity `legal_form` = `lt-<form_kodas>`; `natural_person` from the table below; statement `legalForm` | S01.LT.01 | no | must exist in `legal-forms.ts`, else skip `unknown_legal_form` |
| `form_pavadinimas` | text | not read (labels come from config) | - | - | - |
| `stat_kodas` | int | entity `status` (normalised, table below); statement `status` | S02.LT.01 | no | unknown code → skip `unknown_status` |
| `stat_pavadinimas` | text | not read (truncated Lithuanian labels; labels come from config) | - | - | - |
| `stat_data_nuo` | date | statement `finora:statusSince` | S02.LT.01 | no | ISO date |
| `isreg_data` (deregistered file) | date | statement `dissolutionDate`; entity `status` = `struck_off` | S02.LT.01 | no | ISO date |
| `formavimo_data` | date | sync `upstream_as_of` | - | no | equal on every row, else the file is `failed` with `as_of_inconsistent` |

Not in the files and never stored: names of managers, members or owners (they are not published).

### `lt-rc-jar-bodies` (`JAR_VALDYMAS.csv`)

One row per company. Only the role facts in Part C are read ("has a manager since [date]", board yes/no); flags that are 0 write nothing.

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `ja_kodas` | int | the company entity (`lt-<code>`); `record_key` | S03.LT.01 | no | check digit; must exist in `lt-rc-jar-entities`, else skip `code_not_in_register` |
| `obj_pav`, `ja_pavadinimas` | text | not read | - | - | - |
| `vadovas` | 0/1 | statement `finora:hasManager` = true when 1 | S03.LT.01 | yes (an identifiable manager) | - |
| `vad_org_nuo` | date | statement `finora:managerSince` | S03.LT.01 | yes | ISO date; read only when `vadovas` = 1 |
| `vad_lytis` | M / V / empty | **dropped** (`gender`, P3) | - | yes | negative test below |
| `valdyba`, `vald_org_nuo` | 0/1, date | `finora:hasBoard` = true, `finora:boardSince` | S03.LT.01 | yes | as above |
| `taryba`, `tar_org_nuo` | 0/1, date | `finora:hasCouncil` = true, `finora:councilSince` | S03.LT.01 | yes | as above |
| `steb_taryba`, `steb_tar_org_nuo` | 0/1, date | `finora:hasSupervisoryBoard` = true, `finora:supervisoryBoardSince` | S03.LT.01 | yes | as above |
| `vyr_sk_*`, `mot_sk_*`, `nd_apie_lyt_sk_*` (9 columns) | int | **dropped** (`gender`, P3: counts by gender) | - | yes | negative test below |
| `kiti_valdymo_organai` | 0/1 | not read (no item) | - | - | - |
| `formavimo_data` | date | sync `upstream_as_of` | - | no | as above |

Rows of natural-person forms are dropped whole (`natural_person_form`): the manager of a sole proprietorship is its owner.

### `lt-rc-jar-capital` (`JAR_KAPITALAS.csv`, private and public limited companies only)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `ja_kodas` | int | the company entity; `record_key` | S01.LT.01 | no | check digit; must exist in `lt-rc-jar-entities` |
| `ist_kapitalas` | decimal | statement `finora:shareCapital` (decimal string): an optional S01 field, SHOW (Part H, Baltic-spec call 3), never a verdict input | S01.LT.01 | no | > 0 |
| `valiuta` | text | statement `finora:shareCapitalCurrency` | S01.LT.01 | no | `Eur` → `EUR`, `Lt` → `LTL`; other → skip `unknown_currency` |
| `ist_kap_nuo` | date | statement `finora:shareCapitalSince` | S01.LT.01 | no | ISO date |
| `ja_pavadinimas`, `adresas`, `ja_reg_data`, `form_kodas`, `form_pavadinimas` | | not read (duplicates of the entities file) | - | - | - |
| `formavimo_data` | date | sync `upstream_as_of` | - | no | as above |

### `lt-lsd-activity`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| activity table `kodas` | int | the company entity; `record_key` | S01.LT.01 | no | check digit; must exist in `lt-rc-jar-entities`, else skip `code_not_in_register` |
| activity table `veikla._id` | UUID | resolved through the classifier to statement `sector` = EVRK code (2-6 digits) | S01.LT.01 | no | unresolved UUID → skip the statement, count `activity_unresolved` |
| activity table `veikla_atnaujinta` | date | statement `finora:sectorSince` | S01.LT.01 | no | ISO date |
| classifier `kodas`, `pavadinimas_lt`, `pavadinimas_en` | text | the activity label lookup (see Open questions: where labels live) | S01.LT.01 | no | 2,302 rows; codes of 1-6 characters |
| activity table `evrk_2_1._id`, `evrk_2_1_data`, `nuosavybes_forma`, `veikiantis`, `iregistruotas`, `isregistruotas`, `sektorius._id` | | not read (no item; EVRK 2.1 is the next classification version, see Open questions) | - | - | - |

Natural-person forms: the activity statement is kept (it is business data, not credit-type data) and shown only in the facts-only variant.

### Normalised status (`stat_kodas` → entity `status`)

| Codes | Register meaning (official EN label) | `status` |
|---|---|---|
| 0 | No legal proceedings | `active` |
| 7, 9 | Under liquidation; liquidation being initiated | `liquidating` |
| 5, 13 | Going bankrupt | `insolvent` |
| 6 | Bankrupt | `insolvent` |
| 26 | Liquidation due to bankruptcy | `insolvent` |
| 4 | Under restructuring (court restructuring) | `restructuring` |
| 1, 2, 3, 8, 16-32 | Reorganisation, reformation, division, cross-border merger, division or conversion, registered office transfer | `reorganising` |
| row in `JAR_ISREGISTRUOTI.csv` | Deregistered (statuses 10, 11, 12 are not in the file) | `struck_off` |

Counts on 2026-11-19: 231,716 / 2,308 / 1,794 / 58 / 579 / 316,076.

### Natural-person legal forms (`natural_person = 1`)

`810` Individual Enterprise (sole proprietorship), `811`, `812` (its branch and representative office), `210` General Partnership, `211`, `212`, `220` Limited Partnership, `221`, `222`. These are the forms the publisher itself anonymises in its API datasets. `820` (Individual Enterprise established by a legal entity) is **not** natural-person. 13,386 registered and 156,874 deregistered entities on 2026-11-19.

### Check digit (`ja_kodas`)

Digits d1..d9. s = (1·d1 + 2·d2 + ... + 8·d8) mod 11; if s = 10, s = (3·d1 + 4·d2 + ... + 9·d7 + 1·d8) mod 11; if still 10, s = 0. Valid when s = d9. All 552,531 codes in the two files pass. Shared helper: `packages/domain/src/ids/lt.ts` (`isValidLtCode`, `ltFixtureCode`).

## Party gate

Not applicable: these files describe companies only, with no party rows. They are what the gate checks against: a party code is "proven a company" in Lithuania when it resolves to an `lt-rc-jar-entities` entity with `natural_person = 0` (all LT party files: `lt-tax`, `lt-sodra`, `lt-bankruptcy`).

## Identity and joins

**Sole traders' codes are never personal codes** (legal's S04a condition; measured 2026-11-19): every individual enterprise (individuali įmonė, 13,045 registered) and its branches carry a 9-digit register code (first digit 1, 2 or 3). Lithuanian personal codes have 11 digits, so a sole trader's id can never be one.

- `eid` = `lt-<ja_kodas>`. The code is issued for life; no code appears in both files (0 overlap measured).
- `record_key`: `lt-rc-jar-entities` = `ja_kodas`; bodies, capital, activity = `ja_kodas`.
- `hashInput` (fixed order; `row_hash` = sha256 truncated to 16 bytes): entities = `[file, ja_pavadinimas, adresas, ja_reg_data, form_kodas, stat_kodas, stat_data_nuo, isreg_data]` (the name and address of natural-person forms are hashed but not stored, so a change still emits no event with personal content: see history below); bodies = the 8 role columns read; capital = `[ist_kapitalas, valiuta, ist_kap_nuo]`; activity = `[veikla code, veikla_atnaujinta]`.
- Bodies, capital and activity rows whose code is not in `lt-rc-jar-entities` are skipped (`code_not_in_register`) and retried on the next sync. Sync order within LT: entities first, then the rest (§4.5: the country is searchable once entities land).
- Labels: `packages/domain/src/config/legal-forms.ts` gets an LT table (form code → LT label, EN label, `naturalPerson`) and `statuses.ts` an LT table (code → normalised status, LT and EN labels), generated once by `scripts/gen-lt-classifiers.mjs` from `get.data.gov.lt/datasets/gov/rc/jar/formos_statusai/Forma` and `.../Statusas` (CC BY 4.0, attribution in the generated file header). 168 forms and 31 statuses; re-run when the register adds one (a row with an unknown code is skipped and counted as `unknown_legal_form` / `unknown_status`, visible in `data status`).
- `links`: none here (LEI comes from GLEIF `registeredAs` with authority `RA000430`; VAT from `lt-tax`).

## Refresh and change

- Daily full files. Unchanged sha256 (and unchanged `parserVersion`, review item A1) → one `unchanged` sync row, nothing else.
- Removal: a code absent from both entity files is deleted with its rows (it should not happen; the register keeps deregistered codes). `maxPurgeShare` and `purgeScope` per source: Contract values above. A normal day has about 40 new registrations and 13 moves to the deregistered file and no removal from the union.
- History events (§3.7), emitted by comparing the old and new record of an entity:
  - `finora.name_changed` (old and new name; companies only, never natural-person forms), `finora.address_changed` (companies only), `finora.status_changed` (old and new normalised status and `stat_kodas`), `finora.legal_form_changed`, all item S02.LT.01;
  - `finora.capital_changed` (old and new amount and currency), item S02.LT.01;
  - `finora.role_ended` from bodies: a flag going 1 → 0, or a `*Since` date changing (a new appointment), writes "a [manager | board | council | supervisory board] role ended on [sync date]" with no name, item S03.LT.01.
  - Natural-person forms emit only `finora.status_changed` and `finora.legal_form_changed`.
- No tombstones: deregistered companies stay in the deregistered file.
- A change of storage class or licence for any of these sources is a full reload into the new class plus a purge from the old one (§4.2, A7).

## Size and time budget

Measured row counts (2026-11-19), 🟡 sizes at 123 B per statement and about 60 B per record row:

| Source | Rows read | Records | Statements | Events per day (typical) |
|---|---|---|---|---|
| entities | 552,531 | 552,531 | ≈ 3.4M (registered ≈ 7 each, deregistered ≈ 5-6 each; natural-person forms 4) | ≈ 115 (2,048 new, 618 struck off, 2,901 status changes in 48 days) |
| bodies | 235,095 | ≈ 221,700 (natural-person forms dropped) | ≈ 0.5M (manager flag + date 225,308; board 17,177; council 2,872; supervisory 191) | a few dozen |
| capital | 102,641 | 102,641 | ≈ 0.31M | a few |
| activity | 552,531 read, ≈ 236,000 kept (registered entities) | ≈ 236,000 | ≈ 0.46M | 0 (no event) |

Total ≈ 4.7M statements ≈ 0.58 GB, records ≈ 1.1M ≈ 0.07 GB, FTS (names of ≈ 383,000 non-natural entities) ≈ 0.1 GB: ≈ 0.75 GB of the LT budget of 2 GB (P10). 🟡 First load: download ≈ 125 MB from registrucentras.lt (seconds) + 77 MB from the API (88 s); parse < 3 s for the four register files (measured 0.3-0.6 s each with Python's csv module); write ≈ 1 min. LT becomes searchable ≈ 1-2 min after start (entities only). Daily refresh ≈ 1 min.

## Fixtures

`packages/sources/src/lt/<source-id>/fixture.ts` writes byte-exact layouts:
- `JAR_IREGISTRUOTI.csv`: UTF-8, no BOM, `|` delimiter, `"` quoting with doubled quotes inside names, LF line ends, header `ja_kodas|ja_pavadinimas|adresas|ja_reg_data|form_kodas|form_pavadinimas|stat_kodas|stat_pavadinimas|stat_data_nuo|formavimo_data`.
- `JAR_ISREGISTRUOTI.csv`: header `ja_kodas|ja_pavadinimas|adresas|ja_reg_data|form_kodas|form_pavadinimas|isreg_data|formavimo_data`.
- `JAR_VALDYMAS.csv`: header `ja_kodas|obj_pav|ja_pavadinimas|vadovas|vad_org_nuo|vad_lytis|valdyba|vald_org_nuo|vyr_sk_valdyboje|mot_sk_valdyboje|nd_apie_lyt_sk_valdyboje|steb_taryba|steb_tar_org_nuo|vyr_sk_steb_taryboje|mot_sk_steb_taryboje|nd_apie_lyt_sk_steb_taryboje|taryba|tar_org_nuo|vyr_sk_taryboje|mot_sk_taryboje|nd_apie_lyt_sk_taryboje|kiti_valdymo_organai|formavimo_data`.
- `JAR_KAPITALAS.csv`: header `ja_kodas|ja_pavadinimas|adresas|ja_reg_data|form_kodas|form_pavadinimas|ist_kap_nuo|ist_kapitalas|valiuta|formavimo_data`.
- API CSVs (`lt-lsd-activity`): `,` delimiter, UTF-8, header = the selected property names with refs as `veikla._id`; the classifier with `kodas,pavadinimas_lt,pavadinimas_en`.

Content: about 30 entities. Names like "Demo Logistics UAB", "Example Timber AB", "Sample Bakery MB"; a sole proprietorship "Test Person A individuali įmonė" (its name and address must never appear in output); addresses "Example st. 1, Sample town". Codes follow the fixture rule: true check digit c, written digit (c + 1) mod 10, with realistic prefixes (`30` for recent companies, `1` for older ones), e.g. `309900001`, `309900019`, `309900026`, `110990008` (`ltFixtureCode` generates them; `fixtures/ids.test.ts` asserts each fails `isValidLtCode` and passes the fixture variant). Rows cover: every normalised status, one deregistered company, one natural-person form in each file, one company present in bodies but missing from entities, a name with `""` quotes, a manager since-date change between two fixture days, one gender value and gender counts (to prove they are dropped), capital in `Eur` and `Lt`, an unknown form code, an invalid check digit, and an activity UUID missing from the classifier. Day 1 and day 2 variants drive the refresh tests.

## Tests

- `packages/sources/src/lt/lt-rc-jar-entities/lt-rc-jar-entities.test.ts`: parses both files; field map; status table (one row per normalised value); deregistered rows carry identity only (no address statement); natural-person form → `natural_person = 1`, caption "<form> <code>", no `name` or `address` statement, `country` = `lt`, drops counted; invalid check digit → `invalid_code` skip; `formavimo_data` → `upstream_as_of`; inconsistent `formavimo_data` → `failed`.
- `packages/sources/src/lt/lt-rc-jar-bodies/lt-rc-jar-bodies.test.ts`: only flags = 1 write statements; **HIDE / P3 negative test:** the fixture's `vad_lytis` and gender-count values never appear in any statement, event, report, export, API or MCP response (`gender` drop counted); natural-person rows dropped; code missing from entities → `code_not_in_register`.
- `packages/sources/src/lt/lt-rc-jar-capital/lt-rc-jar-capital.test.ts`: currency mapping, `> 0` rule, unknown currency skip.
- `packages/sources/src/lt/lt-lsd-activity/lt-lsd-activity.test.ts`: classifier join, unresolved UUID counted, labels LT and EN exposed through the label lookup, deregistered codes not loaded.
- `packages/sources/src/lt/policy.test.ts` (slice S08): every LT field-map target is a `show`/`caveat` item or a resolution key; `items` equals the field-map items; S04.LT.01 has no field.
- `packages/domain/src/ids/lt.test.ts`: the check-digit algorithm on hand-made codes, including both s = 10 branches.
- Shared ingest tests this source relies on: `ingest/src/unchanged.test.ts`, `purge.test.ts`, `purge-guard.test.ts` (a header-only entities file deletes nothing), `parser-version.test.ts` (a new natural-person form in the generated table re-parses the unchanged file), `as-of.test.ts` (`in_file_field` and `portal_metadata` cases), `partial.test.ts`, `stale.test.ts` (older `formavimo_data`), `history.test.ts` (rename, address change, struck-off move as `finora.status_changed`, `finora.role_ended` without a name, no rename event for a natural-person form), `party-gate.test.ts` (the LT rule: a code of form 810 is not a company).
- HIDE negative test for S04.LT.01 (LATER, nothing loaded): `web/e2e/hide-items.spec.ts` asserts the LT owners section shows only the PAID empty state with the `orderUrl` link and no member data on UI, API, MCP and export.
- Live check: `lt-rc-jar-entities.live.test.ts` (nightly): the four files answer 200, headers match the fixture headers, `formavimo_data` ≤ 2 days old, and the fixture codes are still unassigned.

## Failure modes

- registrucentras.lt down or answering HTML (it serves an HTML page for unknown file names): the header check fails → `failed` with `schema_mismatch`; yesterday's data stays; S01/S02 show the last as-of with the stale badge.
- Header change (added, removed or renamed column): `failed` with `schema_mismatch` and the diff of headers in `report_json`; no partial load.
- Truncated file (connection cut): row count below `maxPurgeShare` threshold → `partial` with `purge_guard`, nothing deleted.
- File not regenerated (same `formavimo_data` as yesterday, same sha): `unchanged`. A `formavimo_data` older than 2 days: the source shows "as of [date]" with the stale badge; the health check flags it.
- API down for `lt-lsd-activity`: activity keeps the last values; S01 shows them with their as-of. A 429 from `data.gov.lt` (the catalogue, not the API) never affects loading.

## Open questions

1. **Where classifier labels live:** legal forms (168) and statuses (31) are proposed as generated config; EVRK labels (2,302 rows, LT + EN) are too many for config. Proposal: a `labels` intern table (`scheme`, `code`, `lang`, `label`, `record_id`) written by `lt-lsd-activity`.
2. **Names to add once to the shared config:**
   - extension properties (`schema/ftm-subset.test.ts`): `finora:statusSince`, `finora:hasManager`, `finora:managerSince`, `finora:hasBoard`, `finora:boardSince`, `finora:hasCouncil`, `finora:councilSince`, `finora:hasSupervisoryBoard`, `finora:supervisoryBoardSince`, `finora:shareCapital`, `finora:shareCapitalCurrency`, `finora:shareCapitalSince`, `finora:sectorSince`;
   - normalised statuses: `restructuring`, `reorganising`;
   - drop and skip reasons: `natural_person_name`, `natural_person_address`, `gender`, `unknown_legal_form`, `unknown_status`, `unknown_currency`, `activity_unresolved`, `duplicate_code`, `as_of_inconsistent`.
3. **Sole-proprietorship names not stored:** dropped (`natural_person_name`), beyond §3.1's list, because the name is the owner's name and the publisher anonymises it in its own API datasets. Legal to confirm.
4. **EVRK 2.1:** Statistics Lithuania already publishes an EVRK 2.1 code (97.3% of active companies). This spec loads EVRK 2 (`veikla`), the code the tax and social-insurance files use; switch when the national classification switches.
