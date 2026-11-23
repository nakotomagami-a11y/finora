# lv-ur-insolvency, lv-ur-securing-measures, lv-ur-suspensions, lv-ur-sanctions-links: Latvian register risk files

| Source id | Dataset slug | File | Rows (2026-11-19) |
|---|---|---|---|
| `lv-ur-insolvency` | `maksatnespejas-procesi` | `insolvency_legal_person_proceeding.csv` | 18,070 |
| `lv-ur-securing-measures` | `securing-measures` | `securing_measures.csv` | 34,337 |
| `lv-ur-suspensions` | `suspensions-prohibitions` | `suspensions_prohibitions.csv` | 10,602 |
| `lv-ur-sanctions-links` | `sanctions` | `sanctions.csv` | 63 |

The tax authority's own activity-suspension list is in `lv-tax.md` (`lv-vid-suspensions`). The FIU frozen-assets list (S11.LV.02) is in `sanctions.md` (data-osint).

## Source

- **Publisher:** Register of Enterprises of the Republic of Latvia (it also keeps the Insolvency Register), via `https://data.gov.lv`.
- **URL discovery:** `package_show?id=<slug>`, then the resource whose URL basename matches the file, as in `lv-register.md` § Source. The insolvency dataset also lists a legacy XLSX link on `dati.ur.gov.lv` dated 2020: ignored (only the CSV basename is accepted).
- **Licence:** `cc0-1.0` on all four dataset pages, verified 2026-11-19.
- **Attribution:** "Source: Register of Enterprises of the Republic of Latvia, Insolvency proceedings / Securing measures / Suspensions and prohibitions / Sanctions, data.gov.lv, CC0 1.0".
- **Storage:** `store`.
- **Cadence:** `daily` (cto §2). Regenerated nightly at about 21:26 UTC; `publishedAtUtc: "21:40"`.
- **`asOf`**: three strategies, proved on the 2026-11-19 and 2026-11-20 pulls, in this order:
  1. `max_date_in_data` over the field below, ignoring dates after the sync date. **This one wins today.**
  2. `portal_metadata`: the CKAN resource `last_modified`.
  3. `http_last_modified`: changes nightly.

  Securing measures and suspensions have no registration-time field, so a quiet week can leave the date unchanged. That is not stale; only an older date is.
- **`maxPurgeShare`** = max(0.02, 5 × the measured removal share per day, 19 → 20 Nov). **`purgeScope: "full"`** for all four: each file is the complete current state.

  | Source | `max_date_in_data` field | Value on 2026-11-19 | Removed / rows per day | `maxPurgeShare` |
  |---|---|---|---|---|
  | insolvency | `entry_created_on` | 2026-11-17 | 0 / 18,073 | 0.02 |
  | securing measures | `date_from` | 2026-11-17 | 35 / 34,363 (0.10%; ×5 = 0.51%) | 0.02 |
  | suspensions | `date_from` | 2026-11-17 | 4 / 10,605 (0.04%) | 0.02 |
  | sanctions links | `registered_on` | 2026-10-20 | 0 / 63 | 0.02 (with 58 records this allows 1 removal per sync; see Open questions) |

- **`parserVersion`:** sha256 of the loader module, its field map, `items.generated.ts` and the LV part of `domain/config/legal-forms.ts` (used by the party gate).
- **Keys and limits:** no key; ≤ 2 requests/s; size cap 50 MB each.
- **Deep links:**
  - All four: the company page `https://info.ur.gov.lv/#/legal-entity/{entityCode}`.
  - The portal also has `/legal-entity/:regNumber/insolvency/:proceedingId`. It replaces the insolvency link once a manual check confirms that it takes the file's `proceeding_id` (Open questions).
- `officialHosts`: `data.gov.lv`, `info.ur.gov.lv`, `manas.tiesas.lv` (the Court Administration portal, link target only for S09 case numbers; never fetched. The host timed out from our probe machine on 2026-11-20, so confirm the case-search URL pattern in a browser before the slice: Open questions).

## Items

| item_id | Call | Caveat text | Empty state | Filled by |
|---|---|---|---|---|
| S09.LV.01 | SHOW | - | CN | insolvency proceedings, securing measures, suspensions (and `lv-vid-suspensions`) |
| S11.LV.01 | SHOW | - | CN | sanctions-links file |

Checks fed (Part B): check 8 (insolvency, liquidation, pledges and securing measures) reads S09.LV.01. Its hard flags are an open insolvency (`INSOLVENCY` form, no end date) and an activity suspension; its soft flag is an open securing measure. Check 9 (sanctions and watchlists) reads S11.LV.01. Rule 8 applies: the UI says "The register records a link to a party on [list]", never "sanctioned".

Not here: S10.LV.01 (courts) is **LATER with MANUAL** (Part G): check 10 is not possible in LV in v1, and the coverage line reads "Court cases: check manually at [portal]", never "none found". The court case numbers stored below (insolvency `court_case_initial_number`, securing measures `case_number`) are company-level facts shown on their S09 events with a link to the court portal; they do not count as check 10. The portal host `manas.tiesas.lv` is in this spec's `officialHosts`.

## Field map

### `lv-ur-insolvency` (`;`, UTF-8 with BOM)

Header: `proceeding_id;debtor_name;debtor_registration_number;debtor_cleaned_name;debtor_address;proceeding_started_on;proceeding_ended_on;proceeding_form;proceeding_type;proceeding_subtype;proceeding_resolution_type;proceeding_resolution_name;entry_created_on;court_case_initial_number;court_code;court_name;creditor_applications_deadline_date;creditor_applications_deadline_in_days;creditor_applications_deadline_in_weeks;creditor_applications_deadline_in_months;creditor_applications_deadline_in_years;legislation_number;legislation_version`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `proceeding_id` | int | record key | S09.LV.01 (R) | no | - |
| `debtor_registration_number` | text | the subject entity (party gate) | S09.LV.01 (R) | no | check digit; gate below |
| `proceeding_started_on` | date | event `register.insolvency_opened`, date | S09.LV.01 | no | ISO |
| `proceeding_ended_on` | date | event `register.insolvency_closed`, date | S09.LV.01 | no | empty (4.5%) → the proceeding is open: no closed event |
| `proceeding_form` | enum | `data.form` on both events | S09.LV.01 | no | `INSOLVENCY`, `LEGAL_PROTECTION`, `OUT_OF_COURT_LEGAL_PROTECTION`. Unknown → `unspecified`, counted `unknown_enum` (closed set, S05 review SEC-2). Only an open `INSOLVENCY` sets entity status `insolvent` (ingest step 7); an open legal protection is shown as an event, not a status |
| `proceeding_type` | enum | `data.scope` | S09.LV.01 | no | `NATIONAL`, `CROSS_BORDER` |
| `proceeding_subtype` | enum | `data.subtype` | S09.LV.01 | no | `MAIN`, `SECONDARY`; 99.6% empty |
| `proceeding_resolution_type` | code (e.g. `M06`) | `data.resolution` on the closed event | S09.LV.01 | no | 35 codes; labels in the UI table |
| `proceeding_resolution_name` | text (lv) | label table seed only, not stored per row | S09.LV.01 | no | - |
| `court_case_initial_number` | text | `data.courtCase` on the opened event | S09.LV.01 | no | trim |
| `court_name` | text | `data.court` on the opened event | S09.LV.01 | no | a court name (a public body) |
| `entry_created_on` | date | as-of | - | no | - |
| `debtor_name`, `debtor_cleaned_name` | text | not read | - | - | The register file has the name |
| `debtor_address` | text | not read | - | - | - |
| `court_code`, `creditor_applications_deadline_*`, `legislation_number`, `legislation_version` | - | not read | - | - | No item |

### `lv-ur-securing-measures` (`;`)

Header: `id;legal_entity_registration_number;securing_measure_type;securing_measure_type_text;type_details;date_from;case_number;institution_identifier;institution_registration_number;institution_name`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | int | record key | S09.LV.01 (R) | no | - |
| `legal_entity_registration_number` | text | the subject entity | S09.LV.01 (R) | no | empty (2.1%) → `no_code`; gate below |
| `securing_measure_type` | enum | event `register.securing_measure`, `data.kind` | S09.LV.01 | no | `PROHIBITION` (ban on register changes), `LIEN` (attachment), `ATTACHMENT` (arrest). Empty (78) → `unspecified`. Unknown → `unspecified`, counted `unknown_enum` (closed set, S05 review SEC-2) |
| `date_from` | date | event date | S09.LV.01 | no | ISO |
| `case_number` | text | `data.case` | S09.LV.01 | no | trim |
| `institution_registration_number` | text | `data.authorityCode` = the code when it passes the LV check digit. A public body sits in the public-persons register, not the enterprise register, so this is a bare code, never an `lv-` entity reference that would stay unresolved (S05 ruling 4) | S09.LV.01 | no | 71.7% empty. Many imposing institutions are sworn bailiffs, who are natural persons |
| `institution_name` | text | **dropped** | - | possibly | reason `free_text`: bailiffs are named personally |
| `type_details` | text | **dropped** | - | possibly | reason `free_text` |
| `securing_measure_type_text`, `institution_identifier` | - | not read | - | - | - |

### `lv-ur-suspensions` (`;`)

Header: `id;legal_entity_registration_number;suspension_code;suspension_code_text;date_from;ground_for`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | int | record key | S09.LV.01 (R) | no | - |
| `legal_entity_registration_number` | text | the subject entity | S09.LV.01 (R) | no | gate below |
| `suspension_code` | enum | event `register.suspension`, `data.kind`; `data.authority = "ur"` | S09.LV.01 | no | `ECONOMIC_ACTIVITY_SUSPENDED` (the register's record of a tax-authority suspension), `ACTIVITY_SUSPENDED`, `PROHIBITION_ON_PUBLIC_ACTIVITY` |
| `date_from` | date | event date | S09.LV.01 | no | ISO |
| `ground_for` | text | **dropped** | - | possibly | `free_text` |
| `suspension_code_text` | - | not read | - | - | - |

### `lv-ur-sanctions-links` (`;`)

Header: `id;registered_on;entity_type;name;birth_date;latvian_identity_number_masked;nationality;legal_form_code;legal_entity_registration_number;legal_entity_name;legal_entity_country;position;position_text_lv;position_text_en;sanctions_subject_legal_form_code;sanctions_subject_registration_number;sanctions_subject_name;list;list_text;program;entry_date;legal_base;legal_base_url`

The *sanctions subject* (`sanctions_subject_*`) is the Latvian register entity. The *party* (`entity_type`, `name`, `legal_entity_*`) is the sanctioned person or entity linked to it in `position`.

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | int | record key | S11.LV.01 (R) | no | - |
| `sanctions_subject_registration_number` | text | the event's entity (party gate on the subject) | S11.LV.01 (R) | no | gate below |
| `position` | enum | event `register.sanctions_link`, `data.role` | S11.LV.01 | no | `BENEFICIAL_OWNER`, `SHAREHOLDER`, `MEMBER_OF_THE_BOARD`, `CHAIRPERSON_OF_THE_BOARD`, `FOUNDER`, `OWNER`, `PARTNER`, `PERSON_ACTUALLY_EXERCISING_CONTROL`, `BENEFICIARY_CONTROL_LEGAL_ENTITY`, `HUSBAND`; empty (3%) → `unspecified`. Unknown → `unspecified`, counted `unknown_enum` (closed set, S05 review SEC-2). `data.role` is shown, but the BO and shareholder role names don't disclose who the owner is |
| `entity_type` | enum | `data.partyType` = `person` / `company` / `foreign_company` | S11.LV.01 | no | `NATURAL_PERSON`, `LEGAL_ENTITY`, `FOREIGN_ENTITY` |
| `legal_entity_registration_number` | text | `data.party` = `lv-<code>` for `LEGAL_ENTITY` parties that resolve to a non-NP register entity | S11.LV.01 | no | - |
| `legal_entity_name`, `legal_entity_country` | text | for `FOREIGN_ENTITY` and unresolved company-form `LEGAL_ENTITY` parties: the name on an `Organization` (`org-<20 hex>`) in its own typed party with `needs: 0`, referenced as `data.party`; `data.partyCountry` only as an ISO 3166-1 alpha-2 code (see § S05 security re-check) | S11.LV.01 | no | trim; ISO country lower-case |
| `list` | enum | `data.list` | S11.LV.01 | no | `ES_SANCTIONS` (EU), `LV_SANCTIONS` (national), `SDN_OFAC_SANCTIONS` |
| `program` | text | `data.programme` | S11.LV.01 | no | e.g. `RUSSIA-EO14024`, `BLR` |
| `entry_date` | date | event date | S11.LV.01 | no | ISO |
| `legal_base_url` | text | `data.legalBaseUrl` (citation link) | S11.LV.01 | no | only if the host is on the allowlist for links (an EU or LV official journal); else dropped `link_host` |
| `name`, `nationality` | text | **dropped** | - | yes | reason `natural_person_party`. The party's identity comes from the official lists in `sanctions.md`, not from this file |
| `birth_date`, `latvian_identity_number_masked` | text | **dropped** | - | yes | `birth_date`, `personal_code` (P3) |
| `registered_on` | date | as-of; `data.registeredOn` | S11.LV.01 | no | - |
| `legal_form_code`, `position_text_lv`, `position_text_en`, `sanctions_subject_legal_form_code`, `sanctions_subject_name`, `list_text`, `legal_base` | - | not read | - | - | Labels come from the UI table |

## Party gate

`ingest/src/party-gate.ts` runs on the subject of every row: insolvency debtors, securing-measure and suspension subjects, and sanctions-link subjects.

| Subject | Outcome | Reason | Measured (2026-11-19) |
|---|---|---|---|
| empty code | dropped | `no_code` | securing 728; sanctions 2 |
| failed check digit | dropped | `invalid_code` | 0 |
| code not in `lv-ur-register` | dropped | `code_not_in_register` | sanctions 1 |
| code with an NP form (`IK`, `ZEM`, `ZVJ`, `IND`, `GIM`) | dropped | **insolvency:** `natural_person_insolvency` (Part H 9) · **securing measures and suspensions:** `natural_person_form`: HIDE by council call 1 (Part H, "Calls from the Baltic loader specs") · **sanctions links:** `natural_person_form` | insolvency 409; securing 1,357; suspensions 2,983; sanctions 2 |
| any other register entity | loaded | - | insolvency 17,661; securing 32,252; suspensions 7,619; sanctions 58 |

The sanctions-link *party* gets a second check: natural-person parties keep only their type and role, never their name. A `LEGAL_ENTITY` party is linked only if its code resolves to a non-NP register entity.

## Identity and joins

- Subjects join to `lv-ur-register` by the 11-digit code (check digit from `lv-register.md`). Every row attaches to an existing `lv-<code>` entity; these files never create entities.
- **Status derivation** (ingest step 7, shared with `lv-register.md`): an entity with at least one open `INSOLVENCY` proceeding and register status `active` gets `status = insolvent`.

## Refresh and change

- **Cadence:** daily. Unchanged = the same sha256 and `parserVersion` → one sync row.
- **Record unit:** one record per file row. `recordKey`: insolvency `proceeding_id`; the other three `id`. `row_hash` = sha256 truncated to 16 bytes, over the field-map fields in table order:
  - insolvency: `debtor_registration_number`, `proceeding_started_on`, `proceeding_ended_on`, `proceeding_form`, `proceeding_type`, `proceeding_subtype`, `proceeding_resolution_type`, `court_case_initial_number`, `court_name`;
  - securing measures: `legal_entity_registration_number`, `securing_measure_type`, `date_from`, `case_number`, `institution_registration_number`;
  - suspensions: `legal_entity_registration_number`, `suspension_code`, `date_from`;
  - sanctions links: the subject code, `position`, `entity_type`, the party code or foreign name and country, `list`, `program`, `entry_date`, `legal_base_url`.

  No sort order is relied on (row-wise). Dropped fields (names, birth dates, masked codes, free text) are never hash input.
- **Measured churn per day:** insolvency 3 added, 2 changed; securing measures 61 added, 35 removed; suspensions 7 added, 4 removed; sanctions 0.
- **Insolvency** rows are kept by the register with end dates. A changed row (proceeding ended) replaces its events: `register.insolvency_closed` appears, and `finora.status_changed` follows from the derived status.
- **A securing measure or suspension that disappears has been lifted:** the register keeps no end date. Its event is deleted with the record, and the loader writes `finora.securing_measure_lifted` (or `finora.suspension_lifted`) on the company, with `date` = sync date and `data = {kind, from: <original date_from>}` (Open question 1). So "an open securing measure" is always the current file, and history shows when it went away.
- A removed sanctions-link row → its event is deleted and `finora.sanctions_link_removed` is written (Open question 1).
- **No tombstones.** A partial or interrupted sync, or one stopped by the purge guard, purges nothing, so no false "lifted" events.
- **Storage or licence class change** (A7): a full reload into the new class and a purge from the old one. None is foreseen (CC0).

## Size and time budget

| Family | Records | Events | Est. bytes |
|---|---|---|---|
| insolvency | 17,661 | ≈ 34,500 (opened + closed) | ≈ 1.1 MB events + 1.1 MB records |
| securing measures | 32,252 | 32,252 | ≈ 1.0 + 1.9 MB |
| suspensions | 7,619 | 7,619 | ≈ 0.3 + 0.5 MB |
| sanctions links | 58 | 58 | < 0.1 MB |
| **Total** | ≈ 57,600 | ≈ 74,400 | **≈ 6 MB** |

**Time** 🟡: parse < 3 s in total (insolvency 1.1 s, securing 0.3 s measured); write < 2 s; daily refresh < 15 s including download.

## Fixtures

- **Writers:** `packages/sources/src/lv/lv-ur-insolvency/fixture.ts`, `lv-ur-securing-measures/fixture.ts`, `lv-ur-suspensions/fixture.ts`, `lv-ur-sanctions-links/fixture.ts`. Exact headers, `;`, BOM.
- **Insolvency:** each form, one open `INSOLVENCY` (status becomes `insolvent`), one closed with resolution `M06`, one debtor that is a fixture `IK` (dropped), one cross-border.
- **Securing measures:** each type, one empty type, one empty code, one fixture `IK` subject; an `institution_name` "Test Person B, sworn bailiff" (must be dropped).
- **Suspensions:** each code; an IK subject.
- **Sanctions links:**
  - a natural-person party ("Test Person C", the masked-code canary from `fixtures/canaries.ts`, a birth date): only type and role survive;
  - a `LEGAL_ENTITY` party with a fixture code;
  - a `FOREIGN_ENTITY` party "Sample Trading LLC";
  - each list value;
  - a `legal_base_url` on an allowed host and one on another host.
- **Codes:** fixture-only codes; companies "Example Timber SIA", "Demo Freight AS".

## Tests

| File | What it proves |
|---|---|
| `packages/sources/src/lv/lv-ur-insolvency/lv-ur-insolvency.test.ts` | Opened/closed events with `data`. Open proceeding → no closed event. NP debtor dropped `natural_person_insolvency`. Unread columns absent |
| `packages/sources/src/lv/lv-ur-securing-measures/lv-ur-securing-measures.test.ts` | Event per type. Bailiff name and `type_details` dropped. Empty code → `no_code`. NP subject dropped |
| `packages/sources/src/lv/lv-ur-suspensions/lv-ur-suspensions.test.ts` | Event per code; `ground_for` dropped |
| `packages/sources/src/lv/lv-ur-sanctions-links/lv-ur-sanctions-links.test.ts` | Natural-person party: no name, birth date or code in any output (canary). Legal party linked. Foreign party name kept. URL host allowlist |
| `packages/ingest/src/party-gate.test.ts` (shared) | LV risk cases, one per row of the gate table |
| `packages/ingest/src/status-derive.test.ts` | Open insolvency → `insolvent`; closed → back to the register status, with `finora.status_changed` |
| `packages/ingest/src/lifted.test.ts` | Day 2 drops a securing measure → event deleted, `finora.securing_measure_lifted` written. A partial day-2 sync writes none |
| `packages/ingest/src/purge.test.ts`, `unchanged.test.ts`, `partial.test.ts`, `stale.test.ts` (shared) | Run on these fixtures |
| `packages/domain/src/verdict/lv-risk.test.ts` | Open insolvency and an activity suspension → Serious concerns. An open securing measure → Points to check. A sanctions link → check 9 shows the register line, worded per rule 8 |

## Failure modes

| Failure | Loader does | UI shows |
|---|---|---|
| Download down, or schema changed | `failed`; previous events stay | S09/S11 lines keep "Checked [source] as of [date]: none found" or the events, with the older date |
| Partial file | `partial`; no purge, no "lifted" events | as above |
| Stale as-of | `stale_skipped` | as above |
| As-of more than 3 days behind | source `stale` | the check line shows its date in the warning style; check 8 still runs on the stored data, with the date |
| No row for the company | - | CN: "Checked Insolvency Register as of [date]: none found" (and the same for securing measures and suspensions) |

## Open questions

1. **New names** (once): event types `register.sanctions_link`, `finora.securing_measure_lifted`, `finora.suspension_lifted`, `finora.sanctions_link_removed`. Without the "lifted" events, history cannot show that a measure went away (the register keeps no end date). Drop reasons: `natural_person_insolvency`, `natural_person_party`, `free_text`, `link_host`.
2. **Insolvency deep link:** a one-time manual check that the portal's `/insolvency/:proceedingId` route takes the file's `proceeding_id`. Until then the link is the company page.
3. **Closed: purge-guard floor.** The architect adopted `max(ceil(share × records), 5)` (§4.4 step 6, `7d7f1d0`), so the 58-record sanctions-links file may lose up to 5 per sync.
4. **Court portal link:** the Court Administration portal (`manas.tiesas.lv`) timed out from our probe machine on 2026-11-20. Before the slice, open it in a browser and record the case-search URL pattern for a case number; until then the S09 events show the case number as text with no link.

## S05 review changes (SEC-2, M6)

- Every enum that reaches event data is a closed set: proceeding form, type and subtype, securing-measure type, suspension code, sanctions-link role and list. Unknown → `unspecified`, counted `unknown_enum`. The insolvency resolution is kept only in the register's code shape (`M06`, `T14`).
- Case numbers (`court_case_initial_number`, `case_number`) are kept only as digits with capital letters and separators (`/`, `.`, `-`, `_`, space), at most 40 characters; anything else is dropped as `free_text`, so a name in the column is never stored.
- A sanctions-link party's country is kept only as an ISO 3166-1 alpha-2 code (N5, below).
- No LV file is kept in the raw cache (`rawCache: false`): the files hold natural persons. Each file streams to the sync's work dir and is parsed from there in chunks.

## S05 security re-check (N2-N5)

- **Case numbers (N2):** kept only when every letter run is a known code (`C`, `L`, `NOS`, `NP`, `NNVP`, `P`, each seen 20 or more times in the 2026-11 files), with digits and separators; anything else is dropped as `free_text`.
- **Court and programme (N3):** `court_name` is kept only from the 46 courts in the 2026-11 file, and `program` only from its 7 programmes; anything else is not stored, counted `unknown_enum`. The insolvency hash holds the stored values only.
- **A counterparty known by name (N4):** a `FOREIGN_ENTITY`, or a `LEGAL_ENTITY` with a company form and no usable code, becomes an `Organization` (`org-<20 hex>`, name only) in its own party, typed with the register's entity type, with `needs: 0`. It loads only when the party gate proves its type a company and the link's subject is proven too. The event holds `party: org-…`, never the name. An unproven counterparty's id is refused for good, never retried as `reference_unresolved`.
- **Country (N5):** `partyCountry` is kept only as an ISO 3166-1 alpha-2 code.
