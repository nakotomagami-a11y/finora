# lv-ur-officers, lv-ur-members: Latvian Enterprise Register people and owners

Two loaded artifact families and three that are **never fetched**:

| Source id | Dataset slug | File | Loaded? |
|---|---|---|---|
| `lv-ur-officers` | `officers` | `officers.csv` | yes: current officers (S03.LV.01) |
| `lv-ur-members` | `members` | `members.csv` | yes: **corporate members only** (S04.LV.01, S17.LV.01) |
| - | `members` | `members_joint_owners.csv` | **never fetched** (joint owners are natural persons) |
| - | `patiesie-labuma-guveji` | `beneficial_owners.csv` | **never fetched**: HIDE S04.LV.02 |
| - | `stockholders` | (private in CKAN since Nov 2026) | **never fetched**: HIDE S04.LV.03 |

## Source

- **Publisher:** Register of Enterprises of the Republic of Latvia, via `https://data.gov.lv`.
- **URL discovery:** `package_show?id=officers` and `package_show?id=members`, then the resource whose URL basename is `officers.csv` or `members.csv`. This is the same procedure as in `lv-register.md` § Source. The fetcher refuses the basenames `members_joint_owners.csv` and `beneficial_owners.csv` and the slugs `patiesie-labuma-guveji` and `stockholders`: a hard-coded denylist in `packages/sources/src/lv/denylist.ts`, tested.
- **Licence:** `cc0-1.0`, "CC0-1.0" on both dataset pages, verified 2026-11-19.
- **Attribution:** "Source: Register of Enterprises of the Republic of Latvia, Officers / Members, data.gov.lv, CC0 1.0".
- **Storage:** `store`.
- **Cadence:** `daily`. Regenerated nightly at about 21:26 UTC; `publishedAtUtc: "21:40"`.
- **As-of:** the maximum of `last_modified_at` (date part) and `registered_on` for officers; the maximum of `last_modified_at` and `registered_on` for members. Dates after the sync date are ignored. This is the same rule as `lv-register.md`.
- **Keys and limits:** no key; ≤ 2 requests/s; size cap 100 MB each (40 MB and 25 MB measured).
- **Deep link:** the company page `https://info.ur.gov.lv/#/legal-entity/{entityCode}` (see `lv-register.md` Open question 2). `officialHosts`: `data.gov.lv`, `info.ur.gov.lv`.

## Items

| item_id | Call | Caveat text | Empty state | Filled by |
|---|---|---|---|---|
| S03.LV.01 | CAVEAT | Current roles only; past roles are not published. People appear only in this company's context | needs_purpose; then NP | officers |
| S04.LV.01 | CAVEAT | Company members only; members who are private individuals are not shown (rule 1) | LOCK / NP | members typed `LEGAL_ENTITY` or `FOREIGN_ENTITY` |
| S04.LV.02 | HIDE | - | LOCK (rule 1) | **nothing**: `beneficial_owners.csv` is never fetched |
| S04.LV.03 | HIDE | - | LOCK (rule 1) | **nothing**: the joint-stock shareholder dataset is never fetched; the LOCK is keyed on legal form `AS` |
| S17.LV.01 | CAVEAT | Company-to-company links only: shared addresses and corporate members. Registered offices of companies only; an address shared with a sole trader or private individual is not shown | — | corporate members (company → company link) |

S18.LV.01 check 3 ("Officers on record") reads S03.LV.01. Check 4 ("Owners on record") counts as not run in LV (Part H, final round): about 91% of companies have no corporate member to show.

## Field map

### `lv-ur-officers` (`officers.csv`, `;`, UTF-8 with BOM)

Header: `id;uri;at_legal_entity_registration_number;entity_type;position;governing_body;name;latvian_identity_number_masked;birth_date;legal_entity_registration_number;rights_of_representation_type;representation_with_at_least;registered_on;last_modified_at`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | int | record key | S03.LV.01 (R) | no | Unique in the file (0 duplicates measured) |
| `at_legal_entity_registration_number` | text, 11 digits | `Directorship.organization` → `lv-<code>` | S03.LV.01 (R) | no | Check digit. A code not in the register → skip `code_not_in_register` |
| `entity_type` | enum | which holder entity | S03.LV.01 | no | `NATURAL_PERSON` (282,262 rows) → `Person` entity `p-<20 hex>` (§3.3: HMAC of `lv-ur-officers` + company eid + record key). `LEGAL_ENTITY` (1,007) → the company `lv-<legal_entity_registration_number>`. `FOREIGN_ENTITY` (61) → an `Organization` holder, see Open question 1 |
| `name` | text | `Person.name` (natural person) or `Organization.name` (foreign entity); not read for `LEGAL_ENTITY` (the linked company has its own name) | S03.LV.01 | NATURAL_PERSON: yes | Trim. Never in FTS, caption, URL or a `finora.*` event |
| `position` | enum | `Directorship.role` | S03.LV.01 | no | 15 values: `BOARD_MEMBER`, `CHAIR_OF_BOARD`, `OWNER`, `LIQUIDATOR`, `MEMBER`, `REPRESENTATIVE_MANAGER`, `ADMINISTRATOR`, `CO_OWNER`, `AUTHORISED_REPRESENTATIVE`, `PRESIDENT`, `MANAGER`, `ESTATE_TRUSTEE`, `MANAGING_DIRECTOR`, `CHAIR_OF_SUPERVISORY_BOARD`, `REPRESENTATIVE_OF_THE_LIQUIDATOR`. Empty (29%, mostly association executive bodies and sole traders) → role from `governing_body`, else `unspecified`. Unknown → kept, counted `unknown_enum` |
| `governing_body` | enum | `Directorship.summary` = body code (UI label table) | S03.LV.01 | no | `EXECUTIVE_BOARD`, `EXECUTIVE_BODY`, `MANAGEMENT_BODY`, `LIQUIDATION_COMMITTEE`, `DIRECTORATE`, `EXECUTIVE_COMMITTEE`, `SUPERVISORY_BOARD`, `STAFF_COMMITTEE`, `SENATE`, `AUDITOR`; empty allowed |
| `rights_of_representation_type` | enum | `Directorship.description` = signing-rights code (UI label: "signs alone", "signs with all", "with at least N") | S03.LV.01 | no | 8 values (`INDIVIDUALLY`, `WITH_ALL`, `WITH_AT_LEAST`, combinations) |
| `representation_with_at_least` | int | appended to the signing-rights code (`WITH_AT_LEAST:2`) | S03.LV.01 | no | 0 → omitted |
| `registered_on` | date | `Directorship.startDate` | S03.LV.01 | NATURAL_PERSON: yes (a dated role of an identifiable person) | ISO; empty (0.03%) → none |
| `legal_entity_registration_number` | text | the holder company for `LEGAL_ENTITY` rows | S03.LV.01 (R) | no | A code that is not in the register, or has an NP form → the row is loaded as a role held by "a company" with no link, counted `code_not_in_register` |
| `latvian_identity_number_masked` | text `DDMMYY-*****` | **dropped** | - | yes | reason `personal_code` (P3). For 97% of rows the visible digits are a birth date. Never read into memory beyond the drop counter |
| `birth_date` | text | **dropped** | - | yes | reason `birth_date` (P3) |
| `uri` | empty | not read | - | - | 100% empty |
| `last_modified_at` | datetime | as-of only | - | no | - |

Officer rows of sole traders and other NP entities (39,469 rows, mostly `OWNER` of an `IK`) load like any other. The company is `natural_person = 1`, so the whole report is the facts-only variant behind the purpose gate (P6).

### `lv-ur-members` (`members.csv`, `;`, UTF-8 with BOM; limited companies, SIA, only)

Header: `id;uri;at_legal_entity_registration_number;entity_type;name;latvian_identity_number_masked;birth_date;legal_entity_registration_number;number_of_shares;share_nominal_value;share_currency;date_from;registered_on;last_modified_at`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | int | record key | S04.LV.01 (R) | no | 12 duplicate ids in the 2026-11-19 file: the second occurrence gets key `<id>~<sha8(row)>`, counted `duplicate_key` |
| `entity_type` | enum | **party gate**, below | S04.LV.01 | - | `LEGAL_ENTITY` (11,220) and `FOREIGN_ENTITY` (5,547) pass. `NATURAL_PERSON` (169,601) and `JOINT_OWNERS` (167) are dropped before any other field is read |
| `at_legal_entity_registration_number` | text | `Ownership.asset` → `lv-<code>` | S04.LV.01 (R) | no | check digit; must be in the register |
| `legal_entity_registration_number` | text | `Ownership.owner` → `lv-<code>` (`LEGAL_ENTITY`) | S04.LV.01, S17.LV.01 (R) | no | Must resolve to a register entity with a non-NP form (party gate) |
| `name` | text | `Organization.name` for `FOREIGN_ENTITY` holders | S04.LV.01 | no (gate passed) | Trim. For `LEGAL_ENTITY`, not read (the linked company's name is used) |
| `number_of_shares` | decimal | `Ownership.sharesCount` | S04.LV.01 | no | - |
| `share_nominal_value` | decimal | `Ownership.sharesValue` | S04.LV.01 | no | - |
| `share_currency` | `EUR` / `LVL` | `Ownership.sharesCurrency` | S04.LV.01 | no | LVL kept |
| `date_from` | date | `Ownership.startDate` | S04.LV.01 | no | - |
| `latvian_identity_number_masked`, `birth_date` | text | **dropped** | - | yes | Only reachable for natural persons, who are dropped by the gate first. Counted `personal_code` / `birth_date` anyway if a corporate row carries one |
| `uri`, `registered_on`, `last_modified_at` | - | as-of only (`registered_on`, `last_modified_at`) | - | - | - |

**Ownership percentage** is derived in ingest step 7: (`sharesCount` × `sharesValue`) ÷ the company's `capital` (from `lv-ur-equity-capitals`), shown with the "Derived by Finora" chip. It is never computed from the sum of all members, because that would need natural persons' holdings. No capital → no percentage.

### HIDE fields (never fetched or dropped)

| Item | What | How it is kept out | Negative test |
|---|---|---|---|
| S04.LV.02 beneficial owners | `beneficial_owners.csv` (slug `patiesie-labuma-guveji`) | Fetcher denylist; no `SourceMeta`; no field map | `packages/sources/src/lv/denylist.test.ts` (fetcher refuses the slug and basename); `apps/web/e2e/hide-s04-lv-02.spec.ts`, `apps/server/src/routes/hide.test.ts`, `apps/mcp/src/hide.test.ts`, `packages/domain/src/export/export.test.ts`, `packages/agents/src/filters/hide.test.ts` (an agent fixture that "finds" a beneficial owner is filtered, P8); all seeded with a canary BO name and masked code |
| S04.LV.03 joint-stock shareholders | the `stockholders` dataset (private) | denylist; the S04 LOCK keyed on legal form `AS` | same five files, case `S04.LV.03`; the UI shows LOCK for a fixture `AS` |
| S04.LV.01 natural-person members | `members.csv` rows with `entity_type` = `NATURAL_PERSON` or `JOINT_OWNERS` | dropped by the party gate before field read; no person entity created | `packages/sources/src/lv/lv-ur-members/lv-ur-members.test.ts` (no `Person`, no name in any parsed output); the five surface tests, case "natural-person member" |
| S04.LV.01 joint owners | `members_joint_owners.csv` | denylist | `denylist.test.ts` |
| P3 personal codes and birth dates | `latvian_identity_number_masked`, `birth_date` in both files | dropped in the parser; the personal-code gate scans person props for `\d{6}-[\d*]{5}` and drops matches (§4.4 step 3) | `lv-ur-officers.test.ts` (the fixture masked-code canary, `FIXTURE_LV_MASKED_CANARY` from `fixtures/canaries.ts`, never appears in parsed output); `packages/ingest/src/personal-code-gate.test.ts`; the P3 canary scan across DOM, API, MCP, export and agent output |

## Party gate

- **Officers.** Not a party list: each row is a role inside the company. Natural-person officers become company-scoped `Person` rows (§3.3). They are never linked across companies, and no code or hash is kept, so no S17 person link can exist.
- **Members.** `ingest/src/party-gate.ts`, in this order:

  | Condition | Outcome | Drop reason |
  |---|---|---|
  | `entity_type = NATURAL_PERSON` | dropped | `natural_person_type` |
  | `entity_type = JOINT_OWNERS` | dropped | `joint_owners` |
  | `LEGAL_ENTITY` with an empty code | dropped | `no_code` |
  | `LEGAL_ENTITY` whose code fails the check digit | dropped | `invalid_code` |
  | `LEGAL_ENTITY` whose code is not in the register | dropped | `code_not_in_register` (1 measured) |
  | `LEGAL_ENTITY` whose code has an NP form (`IK`, `ZEM`, `ZVJ`, `IND`, `GIM`) | dropped | `natural_person_form` (304 measured) |
  | `LEGAL_ENTITY` otherwise | loaded, linked company → company | - (10,915 measured) |
  | `FOREIGN_ENTITY` | loaded as a foreign `Organization` holder | - (5,547) |

- Counts by reason go to `syncs.report_json.dropped`. Measured: 13,011 companies have at least one corporate member.

## Identity and joins

- **Company eids:** `lv-<11 digits>`, with the check digit from `lv-register.md`.
- **Person eid:** `p-` + HMAC-SHA256(install key, `lv-ur-officers` + company eid + record key), first 20 hex characters (§3.3).
- **Foreign holder eid:** see Open question 1.
- **Joins:** officers and members join to `lv-ur-register` by `at_legal_entity_registration_number` (100% found on 2026-11-19). Corporate members join to the holder company by `legal_entity_registration_number`. A failed join is a counted skip and never creates an entity.
- The holder link of a corporate member is a `links`-free relationship (`Ownership`), not an official-ID link.

## Refresh and change

- **Cadence:** daily. Content hash first (unchanged → one sync row); then a row hash over the field-map fields.
- **Measured churn per day:** officers 130 added, 102 removed, 1 changed; members 113 added, 83 removed, 12 changed. Only the corporate subset reaches the store, so about 10% of the member churn.
- **Removed officer record** (§3.7, P4): the person row and its `Directorship` are deleted, and an event `finora.role_ended` is written on the company with `date` = the sync date and `data = {role, body}`. There is no name and no person key. Item S03.LV.01.
- **Removed member record:** the `Ownership` is deleted, and `finora.role_ended` is written with `data = {role: "corporate_member", holder: "lv-<code>"}` (company data). Natural-person member removals are never seen, because they are never loaded.
- **Retention:** `PERSON_ROLE_RETENTION_DAYS = 0` (P4), so nothing about an ended role survives except the event.
- **No tombstones** in these two families.
- **Partial or interrupted** → no purge, so no false `role_ended` events.

## Size and time budget

| Family | Rows read | Records | Entities | Statements | Events | Est. bytes |
|---|---|---|---|---|---|---|
| officers | 283,330 | 283,330 | ≈ 282,000 `Person` + 283,000 `Directorship` | ≈ 1.4 M (name, organization, director, role, startDate, signing rights) | ≈ 100/day `role_ended` | ≈ 0.17 GB statements + 45 MB entity rows + 17 MB records |
| members (corporate) | 186,535 | ≈ 16,500 | ≈ 16,500 `Ownership` + ≈ 5,500 foreign `Organization` | ≈ 0.11 M | ≈ 10/day | ≈ 15 MB |
| **Total** | | | | | | **≈ 0.25 GB 🟡** |

This fits within the LV ≤ 2.5 GB budget (LV total ≈ 1.6 GB, see `lv-register.md`).

**Time** 🟡: parse officers ≈ 24 s, members ≈ 25 s (stdlib Python, measured); write ≈ 1.5 M rows ≈ 15 s. Daily refresh ≈ 1 min with download.

## Fixtures

- **Writer:** `packages/sources/src/lv/lv-ur-officers/fixture.ts` and `packages/sources/src/lv/lv-ur-members/fixture.ts`, with the exact headers, `;` delimiter, BOM and CRLF.
- **Officers:** about 30 rows:
  - every `position` value, an empty position with each `governing_body`;
  - each `rights_of_representation_type`;
  - one `LEGAL_ENTITY` officer with a fixture company code, one `FOREIGN_ENTITY` officer;
  - an `OWNER` of a fixture `IK`;
  - masked codes generated by `fixtures/canaries.ts` at test time (one legacy-style `DDMMYY` canary, one new-style canary starting `32`; never written literally in docs or fixtures on disk);
  - a `birth_date` on the foreign row.
- **Members:** about 25 rows: each `entity_type`; a `LEGAL_ENTITY` holder whose code is an `IK` (→ `natural_person_form`); one whose code is not in the fixture register; a duplicate `id`; an LVL holding.
- **Names:** persons "Test Person A", "Test Person B"; companies "Example Timber SIA", "Demo Holding AS"; the foreign holder "Sample Holdings Ltd".
- **Codes:** fixture-only codes per the fixture id rule (`lv-register.md`).
- **Size:** < 50 KB.

## Tests

| File | What it proves |
|---|---|
| `packages/sources/src/lv/lv-ur-officers/lv-ur-officers.test.ts` | Field map per row. Person eids are HMACs with the fixed fixture key, and differ for the same name in two companies. No masked code or birth date anywhere in the parsed output (canary). Role fallback for an empty position. `LEGAL_ENTITY` officer links to the company. Signing rights encoded |
| `packages/sources/src/lv/lv-ur-members/lv-ur-members.test.ts` | Gate outcomes, one case per `entity_type` and per drop reason, with counts. Natural-person and joint-owner rows produce no entity, no statement and no name. Duplicate key handled. `Ownership` props |
| `packages/sources/src/lv/denylist.test.ts` | The fetcher refuses `patiesie-labuma-guveji`, `stockholders`, `beneficial_owners.csv` and `members_joint_owners.csv` (throws before any request) |
| `packages/ingest/src/party-gate.test.ts` (shared) | LV cases: `NATURAL_PERSON`, `JOINT_OWNERS`, `LEGAL_ENTITY` ok / NP form / unknown, `FOREIGN_ENTITY`. A fixture sole trader at a company address creates no S17 link |
| `packages/ingest/src/history.test.ts` (shared) | Day 2 removes a board member → `finora.role_ended` with `{role, body}`; no name, no eid in `data`; person row gone |
| `packages/ingest/src/ownership-percent.test.ts` | Percentage from capital; no capital → none; never uses natural-person holdings |
| `packages/store/src/retention.test.ts` (shared) | A source unchanged for 40 days keeps its current officers |
| HIDE surface tests (S04.LV.02, S04.LV.03, natural-person members): `apps/web/e2e/hide-s04-lv-02.spec.ts`, `apps/web/e2e/hide-s04-lv-03.spec.ts`, `apps/server/src/routes/hide.test.ts`, `apps/mcp/src/hide.test.ts`, `packages/domain/src/export/export.test.ts`, `packages/agents/src/filters/hide.test.ts` | LOCK shown, no value on any surface, agent output filtered |
| P3 canary: `apps/web/e2e/no-personal-codes.spec.ts` and the API, MCP and export equivalents | the masked-code canaries from `fixtures/canaries.ts` and any `DDMMYY` birth-date pattern from the fixtures never appear |

## Failure modes

| Failure | Loader does | UI shows |
|---|---|---|
| Download down | `failed`; previous officers stay | S03 keeps "as of [date]"; Sources page shows the failure |
| Header changed, or `entity_type` has an unknown value | `failed` (`schema_changed`); an unknown `entity_type` value is never loaded (fail closed: the gate only passes listed values) | as above |
| Partial file | `partial`; no purge, no `role_ended` events | as above |
| Stale as-of | `stale_skipped` | nothing changes |
| Company has no officer rows | - | S03: NP ("Not published in Latvia") after the purpose gate |
| Company has only natural-person members | - | S04: LOCK "Not shown in Latvia: restricted by rule 1" |

## Open questions

1. **Foreign corporate holders and foreign officers (§3.4 has no eid rule for them).** There are 5,547 `FOREIGN_ENTITY` member rows and 61 officer rows with a name and often no code. Proposal: `org-<20 hex>` = SHA-256 of (`lv-ur-members` + company eid + record key), scoped to the one company like persons. These are company data, so no HMAC is needed. They are never merged across companies in v1; GLEIF linking may later attach an LEI. Architect: confirm or give the rule.
2. **FtM props:** `Directorship.summary` for the governing body and `Directorship.description` for signing rights are uses of generic props. Confirm, or add `finora:governingBody` and `finora:signingRights` extensions.
3. **New drop reasons:** `duplicate_key`, `unknown_enum`, `birth_date`, `personal_code` (the brief lists the party-gate reasons only).
