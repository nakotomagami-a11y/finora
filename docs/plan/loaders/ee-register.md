# ee-rik-register: e-Business Register company files (basic, general, registry-card entries, rulings, commercial pledges)

One spec for five `SourceMeta` entries that all describe the same companies and share one parser module family:

| Source id | Artifact | Cadence | What it fills |
|---|---|---|---|
| `ee-rik-basic` | `ettevotja_rekvisiidid__lihtandmed.csv.zip` | daily | the entity row, identity statements, tombstones |
| `ee-rik-general` | `ettevotja_rekvisiidid__yldandmed.json.zip` | weekly | activity, capital, fiscal year end, accounting obligation, status-since, website |
| `ee-rik-cards` | `ettevotja_rekvisiidid__registrikaardid.json.zip` | daily | register entries as events |
| `ee-rik-rulings` | `ettevotja_rekvisiidid__maarused.json.zip` | weekly | rulings that are not plain entries, as events |
| `ee-rik-pledges` | `ettevotja_rekvisiidid__kommertspandid.json.zip` | daily | commercial pledges |

People (officers, members) are in `ee-people.md`; annual reports in `ee-annual-reports.md`; the tax board in `ee-tax.md`.

## Source
- **Publisher:** Centre of Registers and Information Systems (RIK), e-Business Register open data. Official page: https://avaandmed.ariregister.rik.ee/en/downloading-open-data
- **URLs (stable, no date in the name):** `https://avaandmed.ariregister.rik.ee/sites/default/files/avaandmed/ettevotja_rekvisiidid__<name>.<ext>.zip` with `<name>.<ext>` = `lihtandmed.csv`, `yldandmed.json`, `registrikaardid.json`, `maarused.json`, `kommertspandid.json`. Use the JSON/CSV variants, never the XML twins. Never use the parquet files linked on the same page: they are a snapshot from 13 Nov 2023.
- **Licence:** `cc-by-4.0` (the page's "License information" links the CC BY 4.0 legal code; downloads require accepting the licence terms; verified 2026-11-19). `storage: "store"`.
- **Attribution** (the publisher states no wording; this is the recorded proposal): "Source: Centre of Registers and Information Systems (RIK), e-Business Register open data, CC BY 4.0".
- **officialHosts:** `avaandmed.ariregister.rik.ee`, `ariregister.rik.ee`.
- **deepLink:** `https://ariregister.rik.ee/eng/company/{recordKey}` (recordKey = the 8-digit registry code). No term restricts linking. **orderUrl:** none.
- **Publication time:** all files carried `Last-Modified` 09:17-09:24 UTC on 19 Nov 2026. Schedule daily jobs at 09:45 UTC; weekly jobs (general, rulings) on Sunday 09:45 UTC.
- **As-of inside the artifact (`AsOfRule`):** the files state none. Derive it from the data:
  - `ee-rik-basic`: max of `ettevotja_esmakande_kpv` (newest first-entry date; 2026-11-18 in the 19 Nov file).
  - `ee-rik-general`: max of `yldandmed.staatused[].algus_kpv` and `yldandmed.arinimed[].algus_kpv`.
  - `ee-rik-cards`: max of `registrikaardid[].kanded[].kpv`.
  - `ee-rik-rulings`: max of `maarused[].maaruse_kpv`.
  - `ee-rik-pledges`: max of `kommertspandiandmed[].algus_kpv`.
  Dates are `dd.mm.yyyy`; ignore values after `as-of + 2 years` (the general file holds planned period ends up to 2027-12-31). See Open questions 1 for why this is a derived as-of.
- **Keys:** none. **Limits:** none published for the files. Politeness: one file at a time, `If-Modified-Since` with the last `Last-Modified` (the server answers 304), then compare sha256 (§4.4 step 1). The CDN sends `Cache-Control: max-age=1209600`: never treat a 304 or a cache hit as proof of freshness; the as-of rule decides.
- **Format:** zip with one file. CSV: UTF-8 with BOM, `;` delimiter, `"` quoting, Estonian headers. JSON: one array, pretty-printed with a 4-space indent, one object per entity. Stream the JSON by line blocks: an object starts at a line beginning `    {` and ends at a line beginning `    }` (`research/probes/baltics/ee/jsonstream.py` is the reference). Never `JSON.parse` the whole file (the general file is 4.6 GB).

## Items
Copied from `docs/plan/council/01-data.md` Part G.

| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S01.EE.01 | SHOW | - | NP (LEI, VAT: — when absent) |
| S02.EE.01 | SHOW | - | NP; history: "Tracked by Finora since [date]" |
| S09.EE.01 | SHOW | - | CN (status and pledges; bankruptcy notices LATER; natural-person insolvency HIDE) |
| S13.EE.01 | SHOW | - | NP |
| S15.EE.01 | SHOW | - | — |
| S17.EE.01 | CAVEAT | Company-to-company links only: shared addresses and corporate members. Registered offices of companies only; an address shared with a sole trader or private individual is not shown | — |
| S18.EE.01 | SHOW | - | NC per check |

S17.EE.01 and S18.EE.01 are derived in `ingest` (§4.4 step 7) from the statements below; this spec supplies their inputs (address id, status, pledges, filing warnings). Not filled here and not read: S04.EE.02 (HIDE, see `ee-people.md`), S09 bankruptcy notices (LATER), S12.EE.* (LATER), S05.EE.01 (LATER), S16.EE.01 (LATER).

## Field map

Status codes map to `status`: `R` registrisse kantud → `active`; `L` likvideerimisel → `liquidating`; `N` pankrotis → `insolvent`; `K` kustutatud → `struck_off` (2 rows on 19 Nov 2026). Any other value: record skipped with reason `unknown_status`, counted.

Legal forms map to `legal_form` from `yldandmed.oiguslik_vorm` (general) or the text `ettevotja_oiguslik_vorm` (basic), through `domain/config/legal-forms.ts`. English labels are glosses written by data-baltics (the files are Estonian only; official English exists only in the contract API's classifier query):

| Short code | Estonian | Normalised `legal_form` | English label | natural_person |
|---|---|---|---|---|
| OÜ | Osaühing | `ee_ou` | private limited company | 0 |
| AS | Aktsiaselts | `ee_as` | public limited company | 0 |
| UÜ | Usaldusühing | `ee_uu` | limited partnership | 0 |
| TÜ | Täisühing | `ee_tu` | general partnership | 0 |
| TÜH | Tulundusühistu | `ee_tuh` | cooperative | 0 |
| FIL | Välismaa äriühingu filiaal | `ee_fil` | branch of a foreign company | 0 |
| SE | Euroopa äriühing | `ee_se` | European company (SE) | 0 |
| SCE | Euroopa ühistu | `ee_sce` | European cooperative | 0 |
| EMÜ | Euroopa majandushuviühing | `ee_emu` | European economic interest grouping | 0 |
| MTÜ | Mittetulundusühing | `ee_mtu` | non-profit association | 0 |
| SA | Sihtasutus | `ee_sa` | foundation | 0 |
| KÜ | Korteriühistu | `ee_ku` | apartment association | 0 |
| MPÜ | Maaparandusühistu | `ee_mpu` | land-improvement association | 0 |
| AMETÜ | Ametiühing | `ee_ametu` | trade union | 0 |
| ERAK | Erakond | `ee_erak` | political party | 0 |
| KOVAS | Kohaliku omavalitsuse asutus | `ee_kovas` | municipal body | 0 |
| TRAS | Täidesaatva riigivõimu asutus ... | `ee_tras` | state body | 0 |
| AVOIG | Avalik-õiguslik juriidiline isik ... | `ee_avoig` | public-law body | 0 |
| FIE | Füüsilisest isikust ettevõtja | `ee_fie` | sole trader | **1** |

An unknown form: entity loaded with `legal_form = null`, `natural_person = 0`, counted as `unknown_legal_form`, and the sync is `partial` if more than 10 occur (a register change to investigate).

### `ee-rik-basic` (CSV, one record per row; record key = `ariregistri_kood`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `ariregistri_kood` | string, 8 digits | entity `eid` = `ee-<code>`; statement `registrationNumber` | S01.EE.01 (resolution key) | no | must pass the mod-11 check (below); else skip `invalid_code` |
| `nimi` | string | statement `name`; `caption`; FTS | S01.EE.01 | no for companies; **yes for FIE** | trim. FIE (natural_person = 1): **dropped**, reason `natural_person_name`; caption = "Sole trader <code>" (EN) / "FIE <code>" (ET) |
| `ettevotja_oiguslik_vorm` | string | `legal_form` | S01.EE.01 | no | via the table above |
| `ettevotja_oigusliku_vormi_alaliik` | string | statement `legalFormSubtype` (extension) | S01.EE.01 | no | trim; empty → none (93% empty) |
| `kmkr_nr` | string `EE` + 9 digits | statement `vatCode`; `links` VAT ↔ code | S01.EE.01 (resolution key) | no | regex `^EE\d{9}$`, else drop the value (`invalid_vat`) |
| `ettevotja_staatus` | `R`/`L`/`N`/`K` | `status` + statement `status` | S02.EE.01, S09.EE.01 | no | map above |
| `ettevotja_esmakande_kpv` | `dd.mm.yyyy` | statement `incorporationDate` | S01.EE.01 | no | to ISO date |
| `asukoht_ettevotja_aadressis` | string | statement `address` (street part) | S01.EE.01 | no for companies | FIE: dropped, reason `natural_person_address` |
| `asukoha_ehak_tekstina` | string | statement `address` (locality part) | S01.EE.01 | no | FIE: dropped |
| `indeks_ettevotja_aadressis` | string | statement `postalCode` | S01.EE.01 | no | FIE: dropped |
| `ads_normaliseeritud_taisaadress` | string | statement `full` address (display) | S01.EE.01 | no | preferred display form; FIE: dropped |
| `ads_adr_id` | integer | statement `addressId` (extension) | S17.EE.01 (resolution key) | no | the national address-register id; the S17 shared-address key. FIE: dropped |
| (constant) | | statement `country` = `ee` | S01.EE.01 | no | FIE: the only address value kept |
| `asukoha_ehak_kood` | string | not read | - | - | locality text is enough |
| `ettevotja_aadress`, `ads_ads_oid` | empty | not read | - | - | always empty in the file |
| `ettevotja_staatus_tekstina`, `teabesysteemi_link` | | not read | - | - | status from the code; link from `deepLink` |

Check digit (EE registry code, same rule as the national personal code): digits d1..d8; s = Σ d_i·w_i for i = 1..7 with w = 1,2,3,4,5,6,7, mod 11; if s = 10, recompute with w = 3,4,5,6,7,8,9, mod 11, and if that is 10 use 0; valid when s = d8. All 381,685 codes in the 19 Nov 2026 file pass.

### `ee-rik-general` (JSON, one record per entity object; record key = `ariregistri_kood`)

Only the paths below are read. Everything else in the object (registry-card bookkeeping, `markused_kaardil`, `pohikirjad`, `kinnisasjad`, `kontaktisiku_aadressid`, `valismaa_ariyhing`, `info_majandusaasta_aruannetest`, ...) is skipped without being materialised: the parser walks the object and discards subtrees by key.

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `ariregistri_kood` | int | join to the `ee-rik-basic` entity | resolution key | no | check digit; a code absent from today's basic file: skip `code_not_in_register` (the basic file owns the entity) |
| `yldandmed.oiguslik_vorm` | string | cross-check of `legal_form` | S01.EE.01 | no | mismatch with basic: basic wins, counted `form_mismatch` |
| `yldandmed.staatused[]` (current row: `staatus`, `algus_kpv`) | | statement `statusSince` (extension) | S02.EE.01 | no | the row with empty `lopp_kpv`; ISO date |
| `yldandmed.teatatud_tegevusalad[]` where `on_pohitegevusala = true` and `lopp_kpv` empty: `emtak_kood`, `nace_kood` | string | statements `sector` (EMTAK code, `lang=et`), `naceCode` (extension) | S01.EE.01 | no | the main activity only; English label from the Eurostat NACE table keyed by `nace_kood` |
| `yldandmed.kapitalid[]` current row: `kapitali_suurus`, `kapitali_valuuta` | decimal string, ISO currency | statement `capital` = "<amount> <currency>" (extension) | S01.EE.01 | no | parse decimal; currency upper-case (`EUR`, legacy `EEK`) |
| `yldandmed.majandusaastad[]` current row: `maj_aasta_lopp` | `dd.mm` | statement `fiscalYearEnd` (extension) | S13.EE.01 | no | used for "[year] not filed" |
| `yldandmed.on_raamatupidamiskohustuslane` | bool | statement `accountingObligation` (extension) | S13.EE.01 | no | "[year] not filed" is only evaluated when true |
| `yldandmed.sidevahendid[]` where `liik = "WWW"` and `lopp_kpv` empty: `sisu` | string | statement `website` | S15.EE.01 | no | normalise to `https://` URL; keep at most 3; FIE: dropped (`natural_person_contact`) |
| `yldandmed.sidevahendid[]` with `liik` in (`EMAIL`, `TEL`, `MOB`, `FAX`, ...) | | **dropped, never read** | - | can be | reason `contact_not_item`; negative test below |
| `yldandmed.kustutamise_kpv` | date | not read | - | - | always empty (deleted entities are not in the file) |

### `ee-rik-cards` (JSON, one record per entity object; record key = `ariregistri_kood`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `registrikaardid[].kanded[]`: `kpv`, `kandeliik`, `kandeliik_tekstina`, `kande_nr` | | event `register.entry.<kandeliik>`, date = `kpv`, data = `{ "entryNo": kande_nr, "label": kandeliik_tekstina }` | S02.EE.01, S13.EE.01 | no | only entries with `kpv` ≥ 1 Jan of (as-of year − 5) (840,480 entries since 2021-01-01 on 19 Nov 2026). Entry types with their counts are in `baltics.md` "UI facts"; e.g. `2` first entry, `12` amendment, deletion, conversion, commercial pledge opened |
| `kaardi_piirkond`, `kaardi_nr`, `kaardi_tyyp` | | not read | - | - | bookkeeping |

### `ee-rik-rulings` (JSON, one record per entity object; record key = `ariregistri_kood`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `maarused[]`: `maaruse_nr`, `maaruse_kpv`, `maaruse_liik`, `maaruse_liik_tekstina`, `maaruse_olek`, `joustumise_kpv` | | event `register.ruling.<maaruse_liik>`, date = `maaruse_kpv`, data = `{ "no": maaruse_nr, "label": maaruse_liik_tekstina, "state": maaruse_olek, "inForce": joustumise_kpv }` | S13.EE.01, S18.EE.01 | no | skip kind `K1` "Kanne" (plain entries: they are already in `ee-rik-cards`); window as for cards (483,426 non-entry rulings since 2021-01-01) |
| the same, kinds "Hoiatusmäärus registrist kustutamiseks: majandusaasta aruanne esitamata" and "Trahvihoiatusmäärus: majandusaasta aruanne esitamata" | | additionally event `filing.overdue`, data = `{ "reason": "annual_report_not_filed" }` | S13.EE.01, S18.EE.01 | no | match on the `maaruse_liik` code: `X2` (deletion warning, unfiled annual report) and `HM` (fine warning, unfiled annual report), seen with those labels on 19 Nov 2026; the fixture asserts code and label together (77,126 deletion warnings since 2021) |
| `kande_kpv`, `lisatahtaeg`, `kandeliik*`, `joust_olek*` | | not read | - | - | |

### `ee-rik-pledges` (JSON, one record per pledge; record key = `pandi_id`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| parent `ariregistri_kood` | int | the pledging company | resolution key | no | check digit; not in the register: skip `code_not_in_register` |
| `pandi_id`, `pandi_number` | int | record key; event data `no` | S09.EE.01 | no | |
| `algus_kpv` | date | event `register.pledge`, date | S09.EE.01 | no | ISO |
| `pandi_summa`, `pandi_valuuta` | decimal string, `EUR`/`EEK` | event data `amount`, `currency` | S09.EE.01 | no | keep the currency as published (3,505 of 8,078 pledges are in EEK); never convert silently |
| `pandi_olek` | string | event data `state` | S09.EE.01 | no | only `R` (registered) seen |
| `pandi_jarjekoht` | int | event data `rank` | S09.EE.01 | no | |
| `pandipidajad[]` with `pidaja_isikuliik = "J"`: `pidaja_nimi`, `pidaja_kood` | | event data `pledgee` = name; `pledgeeEid` = `ee-<code>` when the code resolves | S09.EE.01 | no | through the party gate |
| `pandipidajad[]` with `pidaja_isikuliik = "F"` | | **dropped** | - | yes | reason `natural_person_type`; `pidaja_kood` on these rows may be a personal code: never read into any field, never logged (35 rows on 19 Nov 2026) |
| `jarjekohad[]`, `pandisummad[]`, `markused[]` | | not read | - | - | |

## Party gate
- The register rows are the entities themselves, not parties: no gate. Sole traders are entities with `natural_person = 1` (legal form `FIE`; 24,545 on 19 Nov 2026): caption = form + code, no name, no address beyond the country, no website, excluded from `entities_fts` and `entities_trigram` names (found by code only), excluded from S17 address links.
- **Pledgees** go through `ingest/src/party-gate.ts`: `pidaja_isikuliik = "J"` is the register's type field for a legal person, so the pledgee is kept; with a code that resolves to a non-FIE entity it is linked, otherwise it stays a name on the pledge event. `F` → dropped `natural_person_type`. No `pidaja_isikuliik`: dropped `no_code`.
- Counts by reason go to `syncs.report_json.dropped`.

## Identity and joins
- `eid` = `ee-<8-digit code>` from `ee-rik-basic`, which owns the entity row. The other four sources attach to it by code; a code not in the latest basic file is skipped `code_not_in_register` (it is either deleted, so it will be tombstoned, or not a register entity).
- VAT ↔ code: one `links` row per `kmkr_nr` (42.7% of active companies have one).
- LEI: joined by `gleif.md` (registration authority `RA000181`), not here.
- People and members join by the parent `ariregistri_kood` (`ee-people.md`); annual reports by `registrikood` (`ee-annual-reports.md`); tax board by `Registrikood` (`ee-tax.md`).
- S17.EE.01 derive step: companies sharing an `addressId` (registered offices only; never an address of an FIE entity) and corporate members from `ee-people.md`.

## Refresh and change
- Every file is a full snapshot of current entities (statuses R, L, N). No deltas.
- Change detection per record: `rowHash` over the normalised fields the field map reads, in table order. Unchanged hash: nothing is written.
- **Removal from `ee-rik-basic` means deletion from the register: tombstone, never delete.** The entity keeps its identity statements (name, code, form, last status, dates), gets `tombstone_since` = the as-of date of the first sync it is missing from, and an event `finora.tombstoned` (S02.EE.01: "Not in the register's open data since [date]"). Its general, cards, rulings and pledge records are purged with their statements and events (load rule 3: struck-off companies keep identity only). A tombstoned code that reappears: `tombstone_since` cleared, event `finora.status_changed`.
- History events (§3.7), emitted by comparing old and new values of a changed record: `finora.renamed` (`name`), `finora.address_changed` (`full` address), `finora.status_changed` (`status`), `finora.legal_form_changed`, `finora.capital_changed` (general). FIE entities never get `finora.renamed` or `finora.address_changed` (their names and addresses are not stored).
- Removal from the other four files: the record is purged with its rows (a pledge deleted from the register is gone; no event, the register entry event covers it).
- An unchanged artifact (same sha256): one `syncs` row of kind `unchanged`, nothing else.
- Change volume measured: 380-590 register entries per weekday, 10-45 on weekend days (mean 313 a day over 30 days). Rows changed between two consecutive basic files: not yet measured; `research/probes/baltics/ee/diff_pulls.py` holds the 19 Nov 2026 snapshots.

## Size and time budget
Measured row counts from the 19 Nov 2026 pull; bytes at 123 B per statement, 32 B per event (cto), 60 B per records row and per entities row (🟡).

| Source | Records | Statements | Events | Est. size |
|---|---|---|---|---|
| `ee-rik-basic` | 381,685 | ≈ 3.0 M (≈ 8 per company, 3 per FIE) | tombstones only | ≈ 0.39 GB incl. entities rows |
| `ee-rik-general` | 381,685 | ≈ 1.6 M (activity, NACE, capital, FY end, accounting, status-since; website 21,358) | change events | ≈ 0.22 GB |
| `ee-rik-cards` | 381,685 | 0 | ≈ 0.84 M | ≈ 0.05 GB |
| `ee-rik-rulings` | 381,668 | 0 | ≈ 0.48 M + 0.08 M `filing.overdue` | ≈ 0.04 GB |
| `ee-rik-pledges` | 8,078 | 0 | 8,078 | < 0.01 GB |
| FTS (names, codes) | | | | ≈ 0.06 GB |
| **Total** | ≈ 1.5 M | ≈ 4.6 M | ≈ 1.4 M | **≈ 0.77 GB** of the EE 3 GB (P10) |

Download per full pull: 0.30 GB zipped for these five files (basic 19 MB, general 231 MB, cards 23 MB, rulings 75 MB, pledges 1 MB). Parse time measured with stdlib Python on the research machine (🟡 for the named profile): basic 34 s, general 364 s, cards 28 s, rulings ≈ 870 s (including SQLite inserts), pledges 1 s. EE becomes searchable after `ee-rik-basic` alone (≈ 1 min). The daily job (basic + cards + pledges) fits the 5-minute refresh; general and rulings run weekly, as cto set.

## Fixtures
- `packages/sources/src/ee/ee-rik-register/fixture.ts` writes the five zips with the exact headers, key order, indentation and encodings above: `lihtandmed.csv` (UTF-8 with BOM, `;`, quoted) and four JSON arrays pretty-printed with a 4-space indent.
- About 40 entities: every status (R, L, N, K), every legal form in the table, 3 FIE, one unknown form, one code with a bad check digit, a company whose main activity changes between two fixture days, a renamed company, a company missing on day 2 (tombstone), 6 pledges (EUR and EEK; pledgees J with and without a code, one F pledgee carrying a sentinel `pidaja_kood` value), rulings of kinds K1, the two unfiled-report warnings and a report fine, contacts of every `liik` with sentinel email and phone values, and three companies sharing one `ads_adr_id` with one FIE at the same address.
- Codes follow the fixture id rule: 8-digit codes with prefix `1` (companies), `8` (associations), `9` (foundations), whose last digit is (true check digit + 1) mod 10. Names: "Sample Bakery OÜ", "Example Timber AS", "Demo Freight UÜ". No real row, code, name or address.
- Two fixture days (`day1`, `day2`) for the refresh tests.

## Tests
- `packages/sources/src/ee/ee-rik-basic/ee-rik-basic.test.ts`: parses the fixture CSV (BOM, `;`, quoting); maps every field per the table; FIE rows yield no name, no address beyond `ee`, caption "Sole trader <code>"; a bad check digit is skipped `invalid_code`; unknown status and form are counted; derived as-of = max first-entry date.
- `packages/sources/src/ee/ee-rik-general/ee-rik-general.test.ts`: the line-block streamer handles a 4-space-indented array and a final object without a trailing comma; only the listed paths are read; emails and phones never appear in any `ParsedRecord` (sentinel values searched in the serialised output); website normalised; current rows chosen by empty `lopp_kpv`.
- `packages/sources/src/ee/ee-rik-cards/ee-rik-cards.test.ts`: entries before the 5-year window are dropped; event types and dates.
- `packages/sources/src/ee/ee-rik-rulings/ee-rik-rulings.test.ts`: K1 entries skipped; unfiled-report warnings also emit `filing.overdue`.
- `packages/sources/src/ee/ee-rik-pledges/ee-rik-pledges.test.ts`: EEK kept as EEK; F pledgee dropped and its sentinel code absent from the output and the spied logger; J pledgee linked when its code resolves.
- `packages/sources/src/licences.test.ts`: all five sources `cc-by-4.0` + `store`; deep link and fetch hosts in `officialHosts`; `items` equals the field-map item ids.
- `packages/sources/src/field-maps.test.ts`: every target is a `show`/`caveat` item or a resolution key.
- Shared ingest tests this spec relies on: `ingest/src/unchanged.test.ts`, `ingest/src/stale.test.ts` (a basic file whose max first-entry date is older than the last sync is skipped), `ingest/src/partial.test.ts`, `ingest/src/purge.test.ts`, `ingest/src/history.test.ts` (rename, address, status events on fixture day 2), `ingest/src/party-gate.test.ts` (pledgee J/F/none; the FIE at a company address creates no S17 link), plus a tombstone case added to `purge.test.ts`: the company missing on day 2 keeps name, code, form and status, gets `tombstone_since`, loses its pledges and events.
- `store/src/provenance.test.ts`: every statement and event of these sources resolves to a `SourceRef` with `cc-by-4.0`, the attribution text and the deep link.

## Failure modes
- **Source down / HTTP error:** sync `failed`; the previous data stays; the Sources page shows the last content sync. Report sections render from the store with their as-of date.
- **Schema change** (a header or JSON key the field map needs is missing, or a new status or form): the parser fails the sync as `failed` with `schema_changed` naming the field; nothing is written; the health check turns red.
- **Partial or corrupt zip, truncated JSON** (the last object does not close): sync `partial`, nothing purged (§4.4 step 6).
- **Stale as-of** (derived as-of older than the last content sync): `stale_skipped`.
- **More than 1% of entities missing versus the last sync** (a truncated upstream file that still parses): treat as `partial`, purge and tombstone nothing, alert. On 19 Nov 2026 a normal day removes well under 0.1%.
- UI: a company with no record shows the Part G empty state (S01.EE.01 NP; S09.EE.01 CN "Checked: no pledges, status [status]").

## Open questions
1. **§4.4 step 2 vs this source.** The contract says the as-of date is "read inside the artifact ... never only HTTP Last-Modified", and a missing one fails the sync with `as_of_missing`. These files state no as-of date at all. This spec derives it from the newest date in the data (max first-entry date, max entry date, ...). On a day with no new registrations it equals yesterday's, which the stale check treats as "not older", so it passes. Architect to confirm the derived rule is acceptable as an `AsOfRule` kind (`max-date-in-field`).
2. **New drop reasons** not in §4.3's list: `natural_person_name`, `natural_person_address`, `natural_person_contact`, `contact_not_item`, `unknown_status`, `unknown_legal_form`, `form_mismatch`, `invalid_vat`, `schema_changed`. Architect to add them to the `DropReason` union.
3. **Extension properties** not in FtM: `legalFormSubtype`, `addressId`, `naceCode`, `capital`, `fiscalYearEnd`, `accountingObligation`, `statusSince`. They need entries in the FtM-subset extension list (`schema/ftm-subset.test.ts`).
4. **Rulings cadence.** Weekly per cto. The unfiled-report warnings then lag up to 7 days; acceptable for S18, confirm.
