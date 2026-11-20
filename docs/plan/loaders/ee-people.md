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
- **officialHosts:** `avaandmed.ariregister.rik.ee`, `ariregister.rik.ee`. **deepLink:** `https://ariregister.rik.ee/eng/company/{companyCode}` (the company page; there is no per-person page and none is ever built). **orderUrl:** none.
- **Publication time:** 09:20-09:24 UTC on 19 Nov 2026; daily job at 09:45 UTC, after `ee-rik-basic` (the people join to its entities).
- **As-of (`AsOfRule`):** derived, as in `ee-register.md` Open question 1: max of the role rows' `algus_kpv` (and `kontrolli_allika_kpv` for members).
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

### Role rows (`ee-rik-card-persons`, `ee-rik-offcard-persons`; one record per role row, record key = `kirje_id`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| parent `ariregistri_kood` | int | the company: `Directorship.organization` = `ee-<code>` | resolution key | no | check digit; not in the register: skip `code_not_in_register` |
| `kirje_id` | int | record key; input of the person and relationship ids | - | no | stable per role row |
| `isiku_roll` | string | `Directorship.role` (code) + label from the table | S03.EE.01 | no | role table above; unmapped → dropped |
| `isiku_tyyp` | `F` / `J` | decides the holder entity: `F` → `Person`; `J` → `Organization` | S03.EE.01 | no | anything else: skip `no_code` |
| `eesnimi`, `nimi_arinimi` | string | `F`: `Person.firstName`, `Person.lastName`, `Person.name` = first + last; `J`: `Organization.name` | S03.EE.01 | **yes** for F | trim; a person name is never put in `entities_fts`, `entities_trigram`, `caption` search, URLs, logs or events |
| `isikukood_registrikood` | string | `J` only: holder = `ee-<code>` when it resolves to a register entity | S03.EE.01 (resolution key) | no for J | `F` rows: the field is empty since 1 Nov 2024; if ever non-empty on an `F` row, dropped `personal_code` |
| `algus_kpv` | `dd.mm.yyyy` | `Directorship.startDate` | S03.EE.01 | yes for F (Part H item 1: start dates of identifiable people are personal) | ISO date |
| `aadress_riik` (J only) | ISO alpha-3 | `Organization.country` for a foreign J holder without an Estonian code | S03.EE.01 | no | to ISO 3166 alpha-2 lower-case |
| `isikukood_hash` | UUID v5 | **dropped** | - | yes | reason `person_hash` (P3); negative test |
| `isikukood` (members/BO only), `valis_kood`, `valis_kood_riik`, `synniaeg` | | **dropped** | - | yes | reason `personal_code` / `birth_date` (P3); negative test |
| `aadress_riik` (F), `aadress_ehak*`, `aadress_tanav_maja_korter`, `aadress_postiindeks`, `aadress_ads__*` | | **dropped** | - | yes (home address) | reason `home_address`; negative test |
| `email` | string | **dropped** | - | yes | reason `personal_email` (2.8% of card persons carry one); negative test |
| `osamaks`, `osamaksu_valuuta*`, `volituste_loppemise_kpv`, `lopp_kpv`, representation-rights sub-arrays (`esindusoigused`...) | | not read | - | - | `lopp_kpv` is always empty (current rows only) |
| `kaardi_*`, `kande_nr` | | not read | - | - | bookkeeping |

### Member rows (`ee-rik-members`; one record per row, record key = `kirje_id`)

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
| `eesnimi`, `isikukood_hash`, `valis_kood*`, `synniaeg`, `aadress_ehak*`, `aadress_tanav_maja_korter`, `aadress_ads__*` | | **dropped** | - | yes on F rows | F rows are dropped whole; on J rows these are empty or not personal, and are not read |
| `osapant_voi_tingimuslik_voorandamine`, `osa_omaniku_*`, `osapandi_*` (share pledges) | | **not read** | - | can be | share pledges are not a Part G item; the pledgee and owner fields can name private individuals |
| `kontrolli_allikas*`, `kontrolli_allika_kpv`, `grupp`, `osaluse_murdosa_*`, `volituste_loppemise_kpv`, `lopp_kpv` | | not read | - | - | |

### HIDE: beneficial owners (S04.EE.02)
- **File:** `ettevotja_rekvisiidid__kasusaajad.json.zip` (412,802 current rows on 19 Nov 2026: names, country, control method, person hash). **Never fetched**: it has no `SourceMeta`, its URL is absent from every loader, and the fetcher's per-source URL list rejects it.
- The general file's flag `esitab_kasusaajad` (has submitted beneficial owners) is not read either.
- Negative tests (§10 paths): UI, API, MCP, export and agent path, listed under Tests.

## Party gate
- **Role holders (S03):** these are people in a company context, not parties to prove; the gate does not apply to `F` holders, which are stored as company-scoped `Person` rows behind the purpose gate (item S03.EE.01 is `personal`). `J` holders go through `ingest/src/party-gate.ts` only to decide the link: code resolves to a non-FIE register entity → holder = that entity; no code → an `Organization` row with name and country; code that resolves to an FIE → dropped `natural_person_form`.
- **Members (S04, S17):** every row goes through the gate. Loaded only when `isiku_tyyp = "J"` (the register's own type field, as Part H's final round names it) and `osaluse_omandiliik = "L"`. Dropped and counted: `natural_person_type` (F, 349,091 rows on 19 Nov 2026), `joint_owners`, `natural_person_form` (a code resolving to an FIE), `invalid_code`.
- Sole-trader entities (`natural_person = 1`) never get role rows: the card's `FIE` row is dropped.

## Identity and joins
- **Person rows:** `eid` = `p-` + HMAC-SHA256(install key, source id + company eid + `kirje_id`), first 20 hex characters (§3.3). The same human in two companies is two unrelated rows. The register's `isikukood_hash` would link them; it is dropped before the record leaves `parse`, so the store never sees it.
- **Relationship rows** (`Directorship`, `Ownership`): `eid` = `rel-` + HMAC-SHA256(install key, "rel" + source id + company eid + `kirje_id`), 20 hex. See Open question 1.
- **Foreign corporate holders without an Estonian code:** `Organization` rows, `eid` = `org-` + sha256(source id + company eid + `kirje_id`), 20 hex, country from `aadress_riik`, caption = the name. Linking to GLEIF happens later by name and country only as an `unsure` judgement, never automatically.
- Corporate members with a code feed the S17.EE.01 derive step (company to company).

## Refresh and change
- Full daily snapshot of current role rows. Record = one role or member row, keyed by `kirje_id`; `rowHash` over the fields read.
- **A role row that disappears** (§4.4 step 6, P4): the Person and Directorship rows are deleted, and one event `finora.role_ended` is written on the company: date = this sync's as-of, data = `{ "role": "<role code>" }` ("A board member's role ended on [date]"), with no name and no person key. `PERSON_ROLE_RETENTION_DAYS=0`.
- A member row that disappears: the Ownership row is deleted; no event (the company-level history covers corporate ownership via the next sync's state; owner changes for natural persons are never recorded).
- A changed row (same `kirje_id`, new values): rows replaced, no event. A role re-entered by the register gets a new `kirje_id`: seen as one ended and one new role.
- Unchanged artifact: one `syncs` row of kind `unchanged`.

## Size and time budget
Row counts from the 19 Nov 2026 pull; 123 B per statement, 60 B per entity row (🟡).

| Source | Rows read | Rows loaded | Statements | Est. size |
|---|---|---|---|---|
| `ee-rik-card-persons` | 528,064 | ≈ 480,000 (minus FIE 23,360, contact and register-keeper roles ≈ 24,000) | ≈ 2.9 M (Person: first, last, name; Directorship: director, organization, role, startDate) | ≈ 0.42 GB incl. 2 entity rows per role |
| `ee-rik-offcard-persons` | 436,481 | ≈ 24,500 (N, E, D, J, R, P, V) | ≈ 0.15 M | ≈ 0.02 GB |
| `ee-rik-members` | 394,812 | ≈ 45,700 (J, sole ownership) | ≈ 0.27 M (owner, asset, percentage, value, currency, startDate) | ≈ 0.04 GB |
| records rows | | ≈ 550,000 | | ≈ 0.03 GB |
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
- `ingest/src/history.test.ts`: day 2 writes one `finora.role_ended` with `data.role` and no name, no person key, no `p-` id; the Person row is gone.
- `ingest/src/person-id.test.ts` (shared): the same fixture human on two companies gets two unrelated `p-` ids; the fixed fixture HMAC key gives stable ids.
- **HIDE negative tests for S04.EE.02** (one per path, §10): `sources/src/registry.test.ts` asserts no source URL contains `kasusaajad`; `ingest/src/fetch-allowlist.test.ts` asserts the fetcher refuses the fixture `kasusaajad` URL; `apps/server/src/routes/report.test.ts` and `apps/mcp/src/tools/report.test.ts` assert no beneficial-owner field or S04.EE.02 value in the fixture report; `domain/src/export/export.test.ts` asserts none in the FtM export; `web/e2e/hide-items.spec.ts` asserts the S04 section shows the LOCK state for EE; `packages/agent-tools/src/filter.test.ts` (P8 canary) asserts an agent fixture that "finds" a beneficial owner is filtered before display.
- **HIDE negative test for S04.EE.01 natural-person members:** the F member sentinel name never appears in the store, the report or the export (`ingest/src/hide-members.test.ts`).
- **P3 canary:** the `isikukood_hash` and birth-date sentinels are scanned across DOM, API, MCP, export and agent output (`web/e2e/personal-codes.spec.ts`).
- `sources/src/licences.test.ts`, `sources/src/field-maps.test.ts` as in `ee-register.md`.

## Failure modes
- Source down: sync `failed`; current roles stay as they were (retention test `store/src/retention.test.ts`: a source unchanged for 40 days keeps its current officers). S03 shows its data with the as-of date.
- Schema change (a key in the field map is missing, a new person type): `failed` with `schema_changed`, nothing written. A new **personal** field appearing in the file is ignored by construction (only listed fields are read); the P3 gate scans person properties anyway.
- Truncated file: `partial`, nothing purged, no `finora.role_ended` emitted (a partial sync must never look like mass resignations).
- More than 2% of role rows missing versus the last sync: treated as `partial` (no purge, no events), alert.
- UI: S03 without a purpose shows `needs_purpose`; with a purpose and no rows, NP. S04 shows LOCK "Owners: restricted in Estonia" for natural-person members, and corporate members where they exist.

## Open questions
1. **Relationship ids.** §3.4 defines ids for companies and persons but not for `Directorship`, `Ownership` or a foreign `Organization` without a code. This spec proposes `rel-<20 hex>` (HMAC, because the record is person-scoped) and `org-<20 hex>` (plain sha256). Architect to confirm or replace.
2. **New drop reasons:** `role_not_item`, `person_hash`, `birth_date`, `home_address`, `personal_email` (plus `ee-register.md` question 2).
3. **Members' share pledges** (`osapant...` fields) are not read: no Part G item covers share pledges, and their owner and pledgee fields can name private individuals. If the council wants them in S09.EE.01, they need a new item and a party gate on the pledgee.
4. **Directorship start dates of natural persons** are loaded under S03.EE.01 (CAVEAT, purpose gate) per Part H item 1. Confirm nothing more (for example, a precision cut to month) is wanted.
