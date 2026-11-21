# ee-rik-people: e-Business Register person files (persons on the registry card, persons off the card, members)

Three `SourceMeta` entries, one parser family:

| Source id | Artifact | Cadence | What it fills |
|---|---|---|---|
| `ee-rik-card-persons` | `ettevotja_rekvisiidid__kaardile_kantud_isikud.json.zip` | daily | board members, liquidators, trustees, procurators, partners, branch managers (S03) |
| `ee-rik-offcard-persons` | `ettevotja_rekvisiidid__kandevalised_isikud.json.zip` | daily | supervisory board, auditors, audit committee, bankruptcy committee, authorised persons (S03) |
| `ee-rik-members` | `ettevotja_rekvisiidid__osanikud.json.zip` | daily | corporate members of private limited companies (S04.EE.01), corporate-member links (S17.EE.01) |

**Never fetched:** `ettevotja_rekvisiidid__kasusaajad.json.zip` (beneficial owners, S04.EE.02 HIDE). Its URL is not in the source registry, so the polite fetcher refuses it (see Tests).

## Source
- **Publisher:** Centre of Registers and Information Systems (RIK), e-Business Register open data, https://avaandmed.ariregister.rik.ee/en/downloading-open-data
- **URLs (stable):** `https://avaandmed.ariregister.rik.ee/sites/default/files/avaandmed/ettevotja_rekvisiidid__<name>.json.zip`, `<name>` = `kaardile_kantud_isikud`, `kandevalised_isikud`, `osanikud`. JSON variants only.
- **Licence:** `cc-by-4.0` (verified 2026-11-19). `storage: "store"`. **Attribution:** "Source: Centre of Registers and Information Systems (RIK), e-Business Register open data, CC BY 4.0".
- **officialHosts:** `avaandmed.ariregister.rik.ee`, `ariregister.rik.ee`. **deepLink:** `https://ariregister.rik.ee/eng/company/{entityCode}` (the company page; there is no per-person page and none is ever built). **orderUrl:** none.
- **Publication time:** 09:20-09:24 UTC on 19 Nov 2026; daily job at 09:45 UTC, after `ee-rik-basic` (the people join to its entities).
- **`parserVersion`:** sha256 of the module `packages/sources/src/ee/ee-rik-people/`, its field maps (including the role table below, which is part of the parse), and the generated item list.

**Contract values per source (§4.2).** Only strategies proved on the 19 Nov 2026 files; the files state no export date. `max_date_in_data` wins today.

| Source id | `asOf` (strongest first) | Value on 19 Nov 2026 | `purgeScope` | `maxPurgeShare` | Removal measurement |
|---|---|---|---|---|---|
| `ee-rik-card-persons` | `max_date_in_data` on `kaardile_kantud_isikud[].algus_kpv`; `http_last_modified` | 2026-11-19 | `full` | 0.02 | a role-set record (one per company) disappears only when a company loses its last loaded role or leaves the register: proxy ≤ 0.007% a day (dissolution entries, see `ee-register.md`); two-pull diff not measured yet (`diff_pulls.py diff` on the next daily file) |
| `ee-rik-offcard-persons` | `max_date_in_data` on `kaardivalised_isikud[].algus_kpv`; `http_last_modified` | 2026-11-18 | `full` | 0.02 | as above (proxy) |
| `ee-rik-members` | `max_date_in_data` on `osanikud[].algus_kpv`; `http_last_modified` | 2026-11-19 | `full` | 0.02 | as above (proxy) |

**Measured day over day (files of 19 and 20 Nov 2026, `python -I research/probes/baltics/ee/diff_pulls.py diff` on the stored snapshots):** role sets on the card: 22 removed of 381,685 entity objects (0.006%; removals follow entity deletions), 143 changed; members: 22 removed, 73 changed. `maxPurgeShare` stays 0.02.

- **Keys:** none. **Limits:** none published. Politeness as in `ee-register.md`.
- **Format:** zip with one JSON array, 4-space pretty-printed, one object per entity (all 381,685 entities, most with an empty list). Streamed by line block (`research/probes/baltics/ee/jsonstream.py`). Sizes unzipped: 1.0 GB, 0.85 GB, 0.77 GB.

## Items
Copied from `docs/plan/council/01-data.md` Part G.

| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S03.EE.01 | CAVEAT | Current roles only; past roles are not published. People appear only in this company's context | needs_purpose; then NP |
| S04.EE.01 | CAVEAT | Company members of private limited companies only; members who are private individuals are not shown (rule 1). Public limited company shareholders are held by the securities depository | LOCK / NP |
| S04.EE.02 | HIDE | - | LOCK (rule 1) |
| S17.EE.01 | CAVEAT | Company-to-company links only: shared addresses and corporate members. Registered offices of companies only; an address shared with a sole trader or private individual is not shown | — |

S04.EE.02 is named here only to say it is never loaded (see "HIDE" below). S17.EE.01 is derived in `ingest` from the corporate-member links written here.

## Field map

Roles, with English glosses written by data-baltics (the files are Estonian only):

| Code | Estonian | English | File | Loaded? |
|---|---|---|---|---|
| JUHL | Juhatuse liige | board member | card | S03 |
| JUHE, JUHJ, JUHA | juhatuse esimees / juhataja / ainuliige | board chair / managing board member / sole board member | card | S03 |
| LIKV, LIKVJ | Likvideerija / juhatuse liikmest likvideerija | liquidator / board member as liquidator | card | S03 |
| PANKR, AJUTPH, AJPH | Pankrotihaldur / ajutine pankrotihaldur (...) | bankruptcy trustee / interim trustee | card | S03 |
| PROK | Prokurist | procurator (commercial agent) | card | S03 |
| TOSAN, UOSAN, EUSOS, EUSOS2 | Täisosanik / usaldusosanik / esindama volitatud usaldusosanik | general partner / limited partner / authorised limited partner | card | S03 |
| VFILJ | Filiaali juhataja | branch manager | card | S03 |
| SJESI, ESIS, ESIS2 | seadusjärgne esindaja / esindama õigustatud isik | statutory representative / authorised representative | card | S03 |
| VALIT, FV | Valitseja / fondivalitseja | administrator / fund manager | card | S03 |
| HNKL | Haldusnõukogu liige | administrative council member | card | S03 |
| ASES, KOAS | asutuse esindusõiguslik isik / kõrgemalseisev asutus | representative of a public body / superior body | card | S03 |
| N, E | Nõukogu liige / nõukogu esimees | supervisory board member / chair | off-card | S03 |
| D | Audiitorettevõtja | audit firm | off-card | S03 |
| J, R | Revident / revisjonikomisjoni liige | auditor of a non-profit / audit committee member | off-card | S03 |
| P | Pankrotitoimkonna liige | bankruptcy committee member | off-card | S03 |
| V | Volitatud isik | authorised person | off-card | S03 |
| OSAN, O | Osanik | member (private limited company) | members | S04 (corporate only) |
| FIE | Füüsilisest isikust ettevõtja | the sole trader himself | card | **dropped** `natural_person_form` (the entity is the person) |
| KISIK, MDKPI | Kontaktisik / menetlusdokumentide kättesaamiseks pädev isik | contact person / person to receive procedural documents | card | dropped `role_not_item` |
| ORP, ARP | osade registripidaja / aktsiaraamatu pidaja | keeper of the share register / share book | card | dropped `role_not_item` |
| ETTEV, YHL, YHLLV | ettevõtja / ühistu liige (...) | entrepreneur / cooperative member | card | dropped `role_not_item` |
| A, B, S, M, L | Asutaja / asutaja (sissemakseta) / aktsionär / auditor of a contribution / liikmeskogudus | founder / founder without contribution / founding shareholder / valuation auditor / member congregation | off-card | dropped `role_not_item` |

An unknown role code: dropped `role_not_item` and counted by code in the sync report (so a new code is visible).

### Record unit, hash input and order (§3.2, §3.3, A8)
- **Record = one role set per company and source table** (§3.3): `recordKey` = `<company eid>:<source table>`, for example `ee-<code>:kaardile_kantud_isikud`. The set is the company's array in the file (`kaardile_kantud_isikud`, `kaardivalised_isikud` or `osanikud`) after the role table and the party gate have removed the lines that are not loaded. A company whose set is empty after that has no record.
- **Hash input** (`row_hash`, 16 bytes): the loaded lines in **source order** (array order in the file), each line as the normalised fields it stores, in this order: `isiku_roll`, `isiku_tyyp`, `eesnimi`, `nimi_arinimi`, `algus_kpv`, `isikukood_registrikood` (J only), `aadress_riik` (J only), then for members `osaluse_omandiliik`, `osaluse_protsent`, `osaluse_suurus`, `osaluse_valuuta`, and last the line's `kirje_id`. No code or hash field (`isikukood_hash`, `isikukood`, `valis_kood`, `synniaeg`) is ever a hash input (PS6).
- **Line identity for `finora.role_ended`:** `kirje_id` (row-local, below), kept with the record for the diff only and never written to any output, log, API, MCP or export (PS5).
- **Order relied on:** none across records (each entity object is complete). Within a set, source order defines the person and relationship positions; it is never re-sorted by name.
- **Evidence that `kirje_id` is row-local and not code-derived** (legal 7029672714, condition 1), measured 2026-11-20 with `python -I research/probes/baltics/common/role_key_check.py`: EE `kirje_id` on the card file: 528,064 rows, 528,064 distinct, numeric; 91,076 persons (by hash) hold roles in more than one company and none shares an id across companies. The off-card and members files carry `kirje_id` on every row as well (seen on 19 Nov 2026), so the same identity rule applies; their cross-company check is not yet run (same probe, other file).
- **Disputes and restrictions** (§3.3, S04a fix Q-3): no content hash of a person's line is ever computed or stored. A person-line dispute or restriction targets `{companyEid, itemId, sourceRowId}`, where `sourceRowId` is the line's `kirje_id`. The loader passes the `kirje_id`s to `writeRecord` as `lineIds`, in line order.

### Role lines (`ee-rik-card-persons`, `ee-rik-offcard-persons`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| parent `ariregistri_kood` | int | the company: `Directorship.organization` = `ee-<code>` | resolution key | no | check digit; not in the register: skip `code_not_in_register` |
| `kirje_id` | int | line identity inside the set (diff only, never output) | - | no | row-local, see the evidence above |
| `isiku_roll` | string | `Directorship.role` (code) + label from the table | S03.EE.01 | no | role table above; unmapped → dropped |
| `isiku_tyyp` | `F` / `J` | decides the holder entity: `F` → `Person`; `J` → `Organization` | S03.EE.01 | no | anything else: skip `no_code` |
| `eesnimi`, `nimi_arinimi` | string | `F`: `Person.firstName`, `Person.lastName`, `Person.name` = first + last; `J`: `Organization.name` | S03.EE.01 | **yes** for F | trim; a person name is never put in `entities_fts`, `entities_trigram`, `caption` search, URLs, logs or events |
| `isikukood_registrikood` | string | `J` only: holder = `ee-<code>` when it resolves to a register entity | S03.EE.01 (resolution key) | no for J | `F` rows: the field is empty since 1 Nov 2024; if ever non-empty on an `F` row, dropped `personal_code` |
| `algus_kpv` | `dd.mm.yyyy` | `Directorship.startDate` | S03.EE.01 | yes for F (Part H item 1: start dates of identifiable people are personal) | ISO date |
| `aadress_riik` (J only) | ISO alpha-3 | `Organization.country` for a foreign J holder without an Estonian code | S03.EE.01 | no | to ISO 3166 alpha-2 lower-case |
| `isikukood_hash` | UUID v5 | **dropped: `personal_code`** (PS6, P3) | - | yes | never a key, never a hash input, never stored; negative test |
| `isikukood` (members/BO only), `valis_kood`, `valis_kood_riik`, `synniaeg` | | **dropped: `personal_code`** (PS6, P3) | - | yes | birth dates count as personal codes here; negative test |
| `aadress_riik` (F), `aadress_ehak*`, `aadress_tanav_maja_korter`, `aadress_postiindeks`, `aadress_ads__*` | | **dropped** | - | yes (home address) | reason `home_address`; negative test |
| `email` | string | **dropped** | - | yes | reason `personal_email` (2.8% of card persons carry one); negative test |
| `osamaks`, `osamaksu_valuuta*`, `volituste_loppemise_kpv`, `lopp_kpv`, representation-rights sub-arrays (`esindusoigused`...) | | not read | - | - | `lopp_kpv` is always empty (current rows only) |
| `kaardi_*`, `kande_nr` | | not read | - | - | bookkeeping |

### Member lines (`ee-rik-members`; same record unit: one member set per company)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| parent `ariregistri_kood` | int | `Ownership.asset` = `ee-<code>` | resolution key | no | check digit; not in the register: skip |
| `isiku_tyyp` | `F` / `J` | party gate input | - | - | `F` → whole row dropped `natural_person_type` (S04.EE.01 natural-person members are HIDE + LOCK, Part H item 2) |
| `osaluse_omandiliik` | `L` sole / `Y` joint / `K` co-ownership / `KY` | party gate input | - | - | only `L` is loaded; `Y`, `K`, `KY` → dropped `joint_owners` (13 J rows in joint ownership on 19 Nov 2026) |
| `nimi_arinimi` | string | `Organization.name` of the owner (when it does not resolve) | S04.EE.01 | no (J only) | trim |
| `isikukood_registrikood` | string | `Ownership.owner` = `ee-<code>` when it resolves to a non-FIE register entity | S04.EE.01, S17.EE.01 (resolution key) | no | check digit; present on about 39,860 of the 45,708 sole-owned J rows |
| `aadress_riik` | ISO alpha-3 | `Organization.country` of a foreign owner without an Estonian code | S04.EE.01 | no | about 5,850 foreign J rows without a code |
| `osaluse_protsent` | decimal string | `Ownership.percentage` | S04.EE.01 | no | 0-100, two decimals |
| `osaluse_suurus`, `osaluse_valuuta` | decimal string, ISO currency | `Ownership.sharesValue`, `Ownership.sharesCurrency` | S04.EE.01 | no | keep `EEK` as published |
| `algus_kpv` | date | `Ownership.startDate` | S04.EE.01 | no | ISO |
| `isikukood_hash`, `valis_kood*`, `synniaeg` | | **dropped: `personal_code`** (PS6) | - | yes on F rows | F lines are dropped whole before hashing; on J lines these are not read |
| `eesnimi`, `aadress_ehak*`, `aadress_tanav_maja_korter`, `aadress_ads__*` | | **dropped** | - | yes on F rows | F lines dropped whole (`natural_person_type`); not read on J lines |
| `kirje_id` | int | line identity inside the set (diff only, never output) | - | no | as for role lines |
| `osapant_voi_tingimuslik_voorandamine`, `osa_omaniku_*`, `osapandi_*` (share pledges) | | **not read** | - | can be | share pledges are not a Part G item; the pledgee and owner fields can name private individuals |
| `kontrolli_allikas*`, `kontrolli_allika_kpv`, `grupp`, `osaluse_murdosa_*`, `volituste_loppemise_kpv`, `lopp_kpv` | | not read | - | - | |

### HIDE: beneficial owners (S04.EE.02)
- **File:** `ettevotja_rekvisiidid__kasusaajad.json.zip` (412,802 current rows on 19 Nov 2026: names, country, control method, person hash). **Never fetched**: it has no `SourceMeta`, its URL is absent from every loader, and the fetcher's per-source URL list rejects it.
- The general file's flag `esitab_kasusaajad` (has submitted beneficial owners) is not read either.
- Negative tests (§10 paths): UI, API, MCP, export and agent path, listed under Tests.

## Party gate
- **Role holders (S03):** people in a company context, not parties to prove. `F` holders become company-scoped `Person` rows behind the purpose gate (item S03.EE.01 is `personal`). `J` holders go through `ingest/src/party-gate.ts` only to decide the link: a code that resolves to a non-FIE register entity → holder = that entity; no code → an `Organization` row with name and country; a code that resolves to an FIE → line dropped `natural_person_form`.
- **Members (S04, S17):** every line goes through the gate before hashing. Loaded only when `isiku_tyyp = "J"` (the register's own type field, as Part H's final round names it) and `osaluse_omandiliik = "L"`. Dropped and counted: `natural_person_type` (F, 349,091 lines on 19 Nov 2026), `joint_owners`, `natural_person_form` (a code resolving to an FIE), `invalid_code`.
- Sole-trader entities (`natural_person = 1`) never get role rows: the card's `FIE` line is dropped.

## Identity and joins
- **Person rows** (§3.3, §3.4; `PERSON_ROWS=names_no_id`, the v1 default): `eid` = `p-<record id>-<position>`, where `record id` is the role-set record's integer id and `position` the line's 1-based position in source order within the set (never a sort by name). Internal only: never in a URL, title, log line, FTS index, export or MCP bulk list; person DTOs carry a per-response index (`p1`, `p2`, ...). It changes whenever the set changes. No HMAC is computed; `PERSON_ROWS=pseudonym` is the later, unbuilt LAWYER mode (`LAW-PSEUDONYM`). The same human in two companies is two unrelated rows (PS2).
- **What `names_no_id` loads and renders:** per loaded line, the first and last name (F) or the company name (J), the role and its English label, and the start date; rendered only through `readPurposeSection(companyEid, ...)` behind the purpose gate, with the rule 6 disclaimer. The LV switch `LV_PERSON_ROWS` does not apply to Estonia.
- **Relationship rows** (`Directorship`, `Ownership`): `eid` = `rel-<record id>-<position>`, internal, like person rows (§3.4).
- **Foreign corporate holders without an Estonian code:** `Organization` rows, `eid` = `org-<20 hex>`, sha256 of (source id, company eid, record key, line `kirje_id`) (see Open question 1), country from `aadress_riik`, caption = the name, scoped to this company and never merged across companies. Linking to GLEIF happens later by name and country only as an `unsure` judgement, never automatically.
- Corporate members with a code feed the S17.EE.01 derive step (company to company).
- Nothing that must survive a reload points at a `p-` or `rel-` id: findings, citations and `purpose_log` point at the company eid (§3.3, `store/src/person-targets.test.ts`).

## Refresh and change
- Full daily snapshot of current roles; `purgeScope: "full"`. Record = one role set per company and source table; any change to a line replaces the whole set (its Person, Directorship, Organization and Ownership rows), with new `p-` and `rel-` ids.
- **Role end (§3.3, P4, PS4):** when the set is replaced, the previous set's line identities (`kirje_id`) are compared with the new ones. Each identity that disappeared writes one `finora.role_ended` event on the company: date = this sync's as-of, data = `{ "role": "<role code>" }` ("A board member's role ended on [date]"), with no name, no `kirje_id`, no person or relationship id. A spelling fix or changed role on the same `kirje_id` writes no event. A role re-entered by the register under a new `kirje_id` reads as one ended and one new role. `PERSON_ROLE_RETENTION_DAYS=0`: the removed line leaves nothing else.
- A member line that disappears: the Ownership row goes with the set replacement; no event (owner changes are not recorded in v1).
- A set that disappears entirely (the company has no loaded lines left, or left the register): the record is purged with its rows, and a `finora.role_ended` is written per vanished role line (card and off-card sets only).
- **Purge guard:** if one sync would purge more than `maxPurgeShare` (0.02) of a source's role-set records, nothing is purged, no `finora.role_ended` is written, and the sync ends `partial` with `purge_guard` (a cut-off file must never look like mass resignations).
- Unchanged artifact and `parserVersion`: one `syncs` row of kind `unchanged`. A new `parserVersion` (for example a role moved to dropped) re-parses the cached zip as a content sync.

## Size and time budget
Row counts from the 19 Nov 2026 pull; 123 B per statement, 60 B per entity row (🟡).

| Source | Rows read | Rows loaded | Statements | Est. size |
|---|---|---|---|---|
| `ee-rik-card-persons` | 528,064 | ≈ 480,000 (minus FIE 23,360, contact and register-keeper roles ≈ 24,000) | ≈ 2.9 M (Person: first, last, name; Directorship: director, organization, role, startDate) | ≈ 0.42 GB incl. 2 entity rows per role |
| `ee-rik-offcard-persons` | 436,481 | ≈ 24,500 (N, E, D, J, R, P, V) | ≈ 0.15 M | ≈ 0.02 GB |
| `ee-rik-members` | 394,812 | ≈ 45,700 (J, sole ownership) | ≈ 0.27 M (owner, asset, percentage, value, currency, startDate) | ≈ 0.04 GB |
| records rows (one per role set: ≈ 360,000 card sets, ≈ 15,000 off-card sets, ≈ 40,000 member sets) | | ≈ 415,000 | | ≈ 0.02 GB |
| **Total** | | | ≈ 3.3 M | **≈ 0.51 GB** of the EE 3 GB (P10) |

Download 0.12 GB zipped per day for the three files. Parse time measured with stdlib Python on the research machine: 35 s, 31 s, 29 s (🟡 for the named profile). Daily refresh: three parses plus a few thousand changed rows, well within 5 minutes.

## Fixtures
- `packages/sources/src/ee/ee-rik-people/fixture.ts` writes the three zips with the exact keys, order and 4-space indentation, plus a fourth `kasusaajad` zip used only by the HIDE test (it must never be fetched).
- About 30 companies (fixture codes per the fixture id rule, shared with `ee-register` fixtures): every loaded and dropped role code; F and J holders; a J holder with an Estonian fixture code, a foreign J holder with country `FIN`; one FIE with its `FIE` card row; members F sole, J sole, J joint (`Y`), J with a code resolving to an FIE; share-pledge fields filled.
- Sentinel values on every dropped personal field: `isikukood_hash` = a fixed UUID v5, `synniaeg` = a fixed date, `email` = a fixed address under a reserved test domain, home-address fields = "Test Street 1", `valis_kood` = a fixed string. People are "Test Person A", "Test Person B"; companies "Sample Bakery OÜ", "Example Timber AS".
- Two fixture days: on day 2 one board member is removed and one member changes percentage.

## Tests
- `packages/sources/src/ee/ee-rik-card-persons/ee-rik-card-persons.test.ts`: role table mapping; F → Person + Directorship, J → Organization or a link to the fixture entity; FIE row dropped; KISIK, ORP, ARP dropped `role_not_item`; no sentinel value (hash, birth date, email, home address, foreign code) appears anywhere in the serialised `ParsedRecord`s; `dropped` counts per reason.
- `packages/sources/src/ee/ee-rik-offcard-persons/ee-rik-offcard-persons.test.ts`: founders dropped; supervisory board and audit firm loaded.
- `packages/sources/src/ee/ee-rik-members/ee-rik-members.test.ts`: only J + `L` rows produce an Ownership; F, joint and FIE-resolving rows dropped with their reasons; share-pledge fields absent from the output.
- `ingest/src/party-gate.test.ts`: the EE cases (J, F, joint, FIE code, no code).
- `ingest/src/history.test.ts` and `ingest/src/role-ended.test.ts`: fixture day 2 removes one board member: one `finora.role_ended` with `data.role` and no name, no `kirje_id`, no `p-` or `rel-` id; no row, event or log line carries the old name or id (PS4). A spelling fix on the same `kirje_id` writes no event.
- `sources/src/person-fields.test.ts` (PS6): the hash input and stored fields of the three EE person loaders contain no code-pattern field; the `isikukood_hash` and birth-date sentinels are reported as `dropped: personal_code`.
- `store/src/person-scope.test.ts` (PS2): the same fixture human on two fixture companies yields two unrelated rows, and no repository call returns both.
- `store/src/disputes.test.ts`: a dispute on fixture officer A survives the set being replaced when officer B is added.
- `store/src/person-targets.test.ts`: a citation made before a reload still resolves (it points at the company eid).
- PS5 canaries (`apps/server/src/canary.contract.test.ts`, `apps/mcp/src/canary.test.ts`, `domain/src/export/canary.test.ts`, `agents/src/canary.test.ts`, `store/src/canary.test.ts`): the fixture `p-`/`rel-` ids, the line ids and the fixture codes appear on no surface and in no table.
- **HIDE negative tests for S04.EE.02** (one per path, §10): `sources/src/registry.test.ts` asserts no source URL contains `kasusaajad`; `ingest/src/fetch-allowlist.test.ts` asserts the fetcher refuses the fixture `kasusaajad` URL; `apps/server/src/routes/report.test.ts` and `apps/mcp/src/tools/report.test.ts` assert no beneficial-owner field or S04.EE.02 value in the fixture report; `domain/src/export/export.test.ts` asserts none in the FtM export; `web/e2e/hide-items.spec.ts` asserts the S04 section shows the LOCK state for EE; `packages/agent-tools/src/filter.test.ts` (P8 canary) asserts an agent fixture that "finds" a beneficial owner is filtered before display.
- **HIDE negative test for S04.EE.01 natural-person members:** the F member sentinel name never appears in the store, the report or the export (`ingest/src/hide-members.test.ts`).
- **P3 canary:** the `isikukood_hash` and birth-date sentinels are scanned across DOM, API, MCP, export and agent output (`web/e2e/personal-codes.spec.ts`).
- `sources/src/licences.test.ts`, `sources/src/field-maps.test.ts` as in `ee-register.md`.

## Failure modes
- Source down: sync `failed`; current roles stay as they were (retention test `store/src/retention.test.ts`: a source unchanged for 40 days keeps its current officers). S03 shows its data with the as-of date.
- Schema change (a key in the field map is missing, a new person type): `failed` with `schema_changed`, nothing written. A new **personal** field appearing in the file is ignored by construction (only listed fields are read); the P3 gate scans person properties anyway.
- Truncated file: `partial`, nothing purged, no `finora.role_ended` emitted (a partial sync must never look like mass resignations).
- A cut-off file that still parses: caught by the purge guard (`partial`, `purge_guard`): no purge, no `finora.role_ended`.
- Stale as-of (`max_date_in_data` older than the last content sync): `stale_skipped`.
- UI: S03 without a purpose shows `needs_purpose`; with a purpose and no rows, NP. S04 shows LOCK "Owners: restricted in Estonia" for natural-person members, and corporate members where they exist.

## Open questions
1. **`org-` ids under the role-set record unit.** §3.4 defines `org-<20 hex>` as sha256 of (source, company eid, record key), but the record key is now the whole set (`<eid>:<table>`), so two foreign holders of one company would collide. Proposal: add the line's `kirje_id` to the hash input of the `org-` id (row-local, not code-derived).
2. **Extra drop reasons:** `role_not_item`, `home_address`, `personal_email`, `joint_owners` is already listed; plus `ee-register.md` question 1.
3. **Members' share pledges** (`osapant...` fields) are not read: no Part G item covers them, and their owner and pledgee fields can name private individuals. Proposal: keep them out unless the council adds an item with a party gate on the pledgee.
4. **Start dates of natural persons' roles** are loaded under S03.EE.01 (CAVEAT, purpose gate) per Part H item 1. Proposal: load the full date; confirm no precision cut is wanted.
5. **Closed (2026-11-20):** the cross-company check now covers all three files with `role_key_check.py`: persons off the card 436,481 rows, 436,481 distinct ids, 64,985 persons in more than one company, none sharing an id across companies; members 394,812 rows, 394,812 distinct ids, 55,468 such persons, none sharing an id. `kirje_id` is row-local in every EE person file.
