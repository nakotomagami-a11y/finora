# lv-ur-officers, lv-ur-members: Latvian Enterprise Register people and owners

Two loaded artifact families and three that are **never fetched**:

| Source id | Dataset slug | File | Loaded? |
|---|---|---|---|
| `lv-ur-officers` | `officers` | `officers.csv` | yes: current officers (S03.LV.01), one role set per company |
| `lv-ur-members` | `members` | `members.csv` | yes: **corporate members only** (S04.LV.01, S17.LV.01), one member set per company |
| - | `members` | `members_joint_owners.csv` | **never fetched** (joint owners are natural persons) |
| - | `patiesie-labuma-guveji` | `beneficial_owners.csv` | **never fetched**: HIDE S04.LV.02 |
| - | `stockholders` | (private in CKAN since Nov 2026) | **never fetched**: HIDE S04.LV.03 |

## Source

**Publisher, URLs, licence, attribution, storage.**
- Publisher: Register of Enterprises of the Republic of Latvia, via `https://data.gov.lv`.
- URL discovery: `package_show?id=officers` and `package_show?id=members`, then the resource whose URL basename is `officers.csv` or `members.csv`. This is the procedure in `lv-register.md` § Source.
- The fetcher refuses the basenames `members_joint_owners.csv` and `beneficial_owners.csv` and the slugs `patiesie-labuma-guveji` and `stockholders`. This is a hard-coded denylist in `packages/sources/src/lv/denylist.ts`, tested.
- Licence: `cc0-1.0` ("CC0-1.0" on both dataset pages, verified 2026-11-19). Attribution: "Source: Register of Enterprises of the Republic of Latvia, Officers / Members, data.gov.lv, CC0 1.0". `storage: "store"`.

**Cadence:** `daily`. Regenerated nightly at about 21:26 UTC; `publishedAtUtc: "21:40"`.

**`asOf`** (ordered; all three strategies proved on the 2026-11-19 and 2026-11-20 pulls):
1. `max_date_in_data`: officers `last_modified_at` (date part) and `registered_on`; members `last_modified_at` and `registered_on`. Dates after the sync date are ignored. **Wins today:** 2026-11-17 for both.
2. `portal_metadata`: the CKAN resource `last_modified` from `package_show` (2026-11-18T21:25 on the 19 Nov pull).
3. `http_last_modified`: the HTTP header. It changes nightly even when the content doesn't.

A quiet day can leave the max date unchanged. That is not `stale_skipped`; only an older date is.

**`maxPurgeShare`:** **0.02** for both sources.
- Measured 19 → 20 Nov: officers 102 rows removed of 283,330 (0.036%), members 83 of 186,565 (0.044%).
- A role-set record is removed only when a company loses *all* its lines, which is at most those numbers out of 208,286 officer sets (≤ 0.05%) and about 13,000 corporate-member sets.
- 5 × 0.05% = 0.25%, under the floor, so the floor applies.

**`purgeScope`:** `full`. The daily file is the complete current state.

**`parserVersion`:** sha256 of the loader module, its field map, `items.generated.ts`, the LV legal-form table (`domain/config/legal-forms.ts`, LV part, used by the members party gate) and the value of `LV_PERSON_ROWS`. Changing the switch therefore re-parses from the raw cache, with no code change.

**Keys and limits:** no key; ≤ 2 requests/s; size cap 100 MB each (40 MB and 25 MB measured).

**Deep link and hosts:** `deepLink` is `https://info.ur.gov.lv/#/legal-entity/{entityCode}`, the company page (§4.2 allows `{entityCode}`). `officialHosts`: `data.gov.lv`, `info.ur.gov.lv`.

## Items

| item_id | Call | Caveat text | Empty state | Filled by |
|---|---|---|---|---|
| S03.LV.01 | CAVEAT | Current roles only; past roles are not published. People appear only in this company's context | needs_purpose; then NP | officers |
| S04.LV.01 | CAVEAT | Company members only; members who are private individuals are not shown (rule 1) | LOCK / NP | members typed `LEGAL_ENTITY` or `FOREIGN_ENTITY` |
| S04.LV.02 | HIDE | - | LOCK (rule 1) | **nothing**: `beneficial_owners.csv` is never fetched |
| S04.LV.03 | HIDE | - | LOCK (rule 1) | **nothing**: the joint-stock shareholder dataset is never fetched; the LOCK is keyed on legal form `AS` |
| S17.LV.01 | CAVEAT | Company-to-company links only: shared addresses and corporate members. Registered offices of companies only; an address shared with a sole trader or private individual is not shown | — | corporate members (company → company link) |

- S18.LV.01, check 3 ("Officers on record"), reads S03.LV.01. In `role_counts` mode it runs on counts and start dates.
- Check 4 ("Owners on record") counts as not run in LV (Part H, final round).
- `LAW-LV-OFFICERS` (§3.3): officer names are interim CAVEAT behind the purpose gate.

## Field map

### `lv-ur-officers` (`officers.csv`, `;`, UTF-8 with BOM)

Header: `id;uri;at_legal_entity_registration_number;entity_type;position;governing_body;name;latvian_identity_number_masked;birth_date;legal_entity_registration_number;rights_of_representation_type;representation_with_at_least;registered_on;last_modified_at`

**Record unit:** one role set per company. `recordKey` = `lv-<at_legal_entity_registration_number>|officers`: 208,286 sets on 2026-11-19. Each file row is one **role line** of its set.

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `id` | int | **line identity inside the diff only** (role-end detection); never stored in a value, never output | S03.LV.01 (R) | no | Unique in the file. Row-local, not code-derived (evidence under Identity and joins) |
| `at_legal_entity_registration_number` | text, 11 digits | the set's company; `Directorship.organization` → `lv-<code>` | S03.LV.01 (R) | no | Check digit (`lv-register.md`). Not in the register → the line is skipped `code_not_in_register` |
| `entity_type` | enum | the holder | S03.LV.01 | no | `NATURAL_PERSON` (282,262 rows) → `Person` row `p-<record id>-<position>`. `LEGAL_ENTITY` (1,007) → the company `lv-<legal_entity_registration_number>`. `FOREIGN_ENTITY` (61) → `Organization` `org-<20 hex>` (§3.4; see Identity and joins). Any other value: the line is dropped `unknown_enum` (fail closed) |
| `name` | text | `Person.name` (in `names_no_id` mode) or `Organization.name` (foreign entity). Not read for `LEGAL_ENTITY` | S03.LV.01 | NATURAL_PERSON: yes | NFC, trim, collapse whitespace. In `role_counts` mode a natural person's name is **not read**: no `Person` row, dropped `lv_person_rows_role_counts`. Never in FTS, caption, URL, log line or event |
| `position` | enum | `Directorship.role` | S03.LV.01 | no | 15 values: `BOARD_MEMBER`, `CHAIR_OF_BOARD`, `OWNER`, `LIQUIDATOR`, `MEMBER`, `REPRESENTATIVE_MANAGER`, `ADMINISTRATOR`, `CO_OWNER`, `AUTHORISED_REPRESENTATIVE`, `PRESIDENT`, `MANAGER`, `ESTATE_TRUSTEE`, `MANAGING_DIRECTOR`, `CHAIR_OF_SUPERVISORY_BOARD`, `REPRESENTATIVE_OF_THE_LIQUIDATOR`. Empty (29%) → `unspecified`. Unknown → `unspecified`, counted `unknown_enum` (closed set, S05 review SEC-2) |
| `governing_body` | enum | `Directorship.summary` = body code (UI label table) | S03.LV.01 | no | 10 values (`EXECUTIVE_BOARD`, `EXECUTIVE_BODY`, `MANAGEMENT_BODY`, `LIQUIDATION_COMMITTEE`, `DIRECTORATE`, `EXECUTIVE_COMMITTEE`, `SUPERVISORY_BOARD`, `STAFF_COMMITTEE`, `SENATE`, `AUDITOR`); empty allowed. Unknown → not stored, counted `unknown_enum` |
| `rights_of_representation_type` + `representation_with_at_least` | enum + int | `Directorship.description` = signing-rights code (`WITH_AT_LEAST:2`) | S03.LV.01 | no | Tokens `INDIVIDUALLY`, `WITH_AT_LEAST`, `WITH_ALL`, `WITH_CHAIR`, `WITH_DEPUTY_CHAIR`, joined by `/`; the count is 0-99, 0 → omitted. Any other token or count → not stored, counted `unknown_enum` |
| `registered_on` | date | `Directorship.startDate` | S03.LV.01 | NATURAL_PERSON: yes | ISO; empty (0.03%) → none |
| `legal_entity_registration_number` | text | the holder company of a `LEGAL_ENTITY` line | S03.LV.01 (R) | no | Not in the register, or an NP form → the line shows "a company" with no link, counted `code_not_in_register` / `natural_person_form` |
| `latvian_identity_number_masked` | text `DDMMYY-*****` | **`dropped: personal_code`** (PS6) | - | yes | Never a key, never a hash input, never stored. For 97% of rows the visible digits are a birth date |
| `birth_date` | text | **`dropped: personal_code`** (PS6, P3) | - | yes | as above |
| `uri` | empty | not read | - | - | 100% empty |
| `last_modified_at` | datetime | as-of only | - | no | - |

**Role-line rendering by mode** (`LV_PERSON_ROWS`, PS7; v1 default `names_no_id` per §3.3):

| Mode | Loads | Renders (behind the purpose gate, rule 6 disclaimer) |
|---|---|---|
| `names_no_id` (interim default) | one `Person` row per natural-person line (`p-<record id>-<position>`, name only); one `Directorship` row per line (`rel-<record id>-<position>`: role, body, signing rights, start date, organization, director); company and foreign holders as above | the role table: name, role, body, signing rights, start date. Person DTOs carry a per-response index (`p1`, `p2`, …), never the eid |
| `role_counts` | no `Person` rows; one `Directorship` row per line with role, body, signing rights and start date and **no director** for natural persons; company holders linked as in the other mode | counts per role and the start dates, e.g. "Board: 3 members, since [dates]". The LOCK line "Officer names: pending a legal review". Officer sanctions screening counts as not run ("Officers not screened: names not loaded") |

Officer lines of sole traders and other NP entities (39,469 rows, mostly `OWNER` of an `IK`) load like the others. The company has `natural_person = 1`, so its whole report is the facts-only variant (P6).

### `lv-ur-members` (`members.csv`, `;`, UTF-8 with BOM; limited companies, SIA, only)

Header: `id;uri;at_legal_entity_registration_number;entity_type;name;latvian_identity_number_masked;birth_date;legal_entity_registration_number;number_of_shares;share_nominal_value;share_currency;date_from;registered_on;last_modified_at`

**Record unit:** one corporate-member set per company. `recordKey` = `lv-<at_legal_entity_registration_number>|members`: about 13,000 sets. Lines that fail the party gate are dropped **before** the set is built, so person data never enters a record or a hash. A company with no corporate member has no record.

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `entity_type` | enum | **party gate** (first field read) | S04.LV.01 | - | `LEGAL_ENTITY` (11,220) and `FOREIGN_ENTITY` (5,547) continue. `NATURAL_PERSON` (169,601) and `JOINT_OWNERS` (167) are dropped before any other field is read |
| `id` | int | line identity inside the diff only; input to the foreign holder's `org-` id | S04.LV.01 (R) | no | 12 duplicate ids in the 2026-11-19 file: lines stay distinct by position, counted `duplicate_key` |
| `at_legal_entity_registration_number` | text | the set's company; `Ownership.asset` | S04.LV.01 (R) | no | check digit; must be in the register |
| `legal_entity_registration_number` | text | `Ownership.owner` → `lv-<code>` (`LEGAL_ENTITY`) | S04.LV.01, S17.LV.01 (R) | no | must resolve to a non-NP register entity (party gate) |
| `name` | text | `Organization.name` of a `FOREIGN_ENTITY` holder, and `Ownership.owner` → its `org-` row | S04.LV.01 | no (gate passed) | trim; not read for `LEGAL_ENTITY`. The owner link is S04, not S17: an `org-` row is scoped to one company and never merged, so it cannot join two companies in the S17 network, which links register entities only |
| `number_of_shares` | decimal | `Ownership.sharesCount` | S04.LV.01 | no | - |
| `share_nominal_value` | decimal | `Ownership.sharesValue` | S04.LV.01 | no | - |
| `share_currency` | `EUR` / `LVL` | `Ownership.sharesCurrency` | S04.LV.01 | no | LVL kept. Any other value must be an ISO 4217 code; otherwise the share value is not stored, counted `unknown_enum` |
| `date_from` | date | `Ownership.startDate` | S04.LV.01 | no | - |
| `latvian_identity_number_masked`, `birth_date` | text | **`dropped: personal_code`** | - | yes | only on gated-out person lines; counted anyway if a corporate line carries one |
| `uri`, `registered_on`, `last_modified_at` | - | as-of only (`registered_on`, `last_modified_at`) | - | - | - |

`Ownership` rows are `rel-<record id>-<position>`. **Ownership percentage** is derived in ingest step 7: (`sharesCount` × `sharesValue`) ÷ the company's `capital` (`lv-register.md`; share capital is SHOW, Part H calls 3). It carries the "Derived by Finora" chip, is never computed from natural persons' holdings, and is absent when there is no capital.

### HIDE fields (never fetched or dropped)

| Item | What | How it is kept out | Negative test |
|---|---|---|---|
| S04.LV.02 beneficial owners | `beneficial_owners.csv` (slug `patiesie-labuma-guveji`) | fetcher denylist; no `SourceMeta`; no field map | `packages/sources/src/lv/denylist.test.ts`; `apps/web/e2e/hide-s04-lv-02.spec.ts`, `apps/server/src/routes/hide.test.ts`, `apps/mcp/src/hide.test.ts`, `packages/domain/src/export/export.test.ts`, `packages/agents/src/filters/hide.test.ts` (an agent fixture that "finds" a beneficial owner is filtered, P8); seeded with a canary owner name and masked code |
| S04.LV.03 joint-stock shareholders | the `stockholders` dataset (private) | denylist; S04 LOCK keyed on legal form `AS` | the same five files, case `S04.LV.03`; the UI shows LOCK for a fixture `AS` |
| S04.LV.01 natural-person members | `members.csv` lines with `NATURAL_PERSON` or `JOINT_OWNERS` | dropped by the party gate before any other field is read | `lv-ur-members.test.ts` (no person row, name or hash input from them); the five surface tests, case "natural-person member" |
| S04.LV.01 joint owners | `members_joint_owners.csv` | denylist | `denylist.test.ts` |
| P3/PS6 person codes and birth dates | `latvian_identity_number_masked`, `birth_date` | `dropped: personal_code` in the parser; not in any hash input; the personal-code gate also scans person props for `\d{6}-[\d*]{5}` | `sources/src/person-fields.test.ts` (PS6); `lv-ur-officers.test.ts` (the canary from `fixtures/canaries.ts` never appears in parsed output or hash input); `store/src/canary.test.ts` and the surface canary tests (PS5) |

## Party gate

- **Officers.** Not a party list: each line is a role inside the company. Person rows exist only inside one company's set, and no code, hash or id joins them across companies (PS2).
- **Members.** `ingest/src/party-gate.ts`, in this order:

  | Condition | Outcome | Drop reason | Measured |
  |---|---|---|---|
  | `entity_type = NATURAL_PERSON` | dropped | `natural_person_type` | 169,601 |
  | `entity_type = JOINT_OWNERS` | dropped | `joint_owners` | 167 |
  | `LEGAL_ENTITY`, empty code | dropped | `no_code` | 0 |
  | `LEGAL_ENTITY`, failed check digit | dropped | `invalid_code` | 0 |
  | `LEGAL_ENTITY`, code not in register | dropped | `code_not_in_register` | 1 |
  | `LEGAL_ENTITY`, NP form (`IK`, `ZEM`, `ZVJ`, `IND`, `GIM`) | dropped | `natural_person_form` | 304 |
  | `LEGAL_ENTITY` otherwise | loaded, company → company link | - | 10,915 |
  | `FOREIGN_ENTITY` | loaded as `org-` holder | - | 5,547 |

  Counts go to `syncs.report_json.dropped`.

## Identity and joins

- **Company eids:** `lv-<11 digits>`, with the check digit from `lv-register.md`.
- **Person rows:** `p-<record id>-<position>`, where position is the line's 1-based position in **source order** within the set (§3.3). The file is in ascending `id` order (verified on 2026-11-19), so source order equals ascending `id`. The parser preserves the file order and never sorts by name.
- **Relationship rows:** `rel-<record id>-<position>`.
- **Foreign holders and officers:** `org-<20 hex>` = sha256(source id, company eid, record key, line `id`), first 20 hex characters. This is company data, scoped to the company and never merged. The line `id` is added because a set record has many lines (§3.4 lists source, company eid and record key; see Open question 1).
- **Role-line identity (§3.3, qa S1):** officer `id` and member `id`, used only inside the diff, never in any output. **Evidence that the officer `id` is row-local and not code-derived** (legal 7029672714 condition 1), measured 2026-11-20 with `python -I research/probes/baltics/common/role_key_check.py`:
  - 283,330 rows, 283,330 distinct, numeric;
  - 43,635 persons (name + masked code) hold roles in more than one company, and none shares an id across companies;
  - 1 of 263,859 ids contains the masked code's six visible digits (chance level);
  - rank correlation of id vs those digits is +0.04 (near zero; ids follow registration order).
- **Joins:** both files join to `lv-ur-register` by `at_legal_entity_registration_number` (100% found on 2026-11-19). A failed join is a counted skip and never creates an entity.

## Refresh and change

**Hash input and sort order.**
- Officers' `hashInput` = for each line in source order: `id`, `entity_type`, `position`, `governing_body`, normalised `name` (omitted in `role_counts` mode and for `LEGAL_ENTITY` lines), `legal_entity_registration_number`, `rights_of_representation_type`, `representation_with_at_least`, `registered_on`.
- Members' `hashInput` = for each corporate line in source order: the line id (or `""` when nulled), `entity_type`, `legal_entity_registration_number`, `name` (foreign only), and the parsed share count, nominal value, currency (only a known one) and start date.
- No code or birth-date field is in either. `row_hash` = sha256 truncated to 16 bytes.
- The files are **not grouped by company** (officers: 18,837 contiguity breaks; members: 7,314), so the parser groups lines through a temp table keyed by company, keeping each line's file row number, then emits sets in company-code order.

**Change detection.**
- Content hash plus `parserVersion` first (unchanged → one sync row).
- A changed set replaces all its rows: `Person`, `Directorship` or `Ownership`, and `org-` holders.
- Measured churn per day: officers 130 lines added, 102 removed, 1 changed; members 113, 83, 12. Only the corporate subset reaches the store, about 10% of the member churn.

**`finora.role_ended`** (§3.3, P4, PS4).
- The diff compares the old and new sets' line identities (officer `id`, member `id`). A line identity that disappears emits `finora.role_ended` on the company, with `date` = sync date.
  - Officers: `data = {role, body}`.
  - Members: `data = {role: "corporate_member", holder: "lv-<code>"}`, which is company data.
- No name and no id goes into `data`.
- A name spelling fix or a role-title change on the same `id` emits nothing.
- The previous set's line identities are needed for the diff (Open question 2).

**Disputes and restrictions** (§3.3, S04a fix Q-3): no content hash of a person's line is ever computed or stored. A person-line dispute or restriction targets `{companyEid, itemId, sourceRowId}`, where `sourceRowId` is the officer or member `id`. The loader passes these ids to `writeRecord` as `lineIds`, in line order (`null` where a row has none, which is then targeted by role).

**Other rules.**
- Retention: `PERSON_ROLE_RETENTION_DAYS = 0` (P4).
- No tombstones.
- A partial or interrupted sync purges nothing and emits no `role_ended`.
- The purge guard (`maxPurgeShare` 0.02) stops an empty or cut-off file from ending every role.

## Size and time budget

| Family | Rows read | Records | Rows written | Est. bytes |
|---|---|---|---|---|
| officers (`names_no_id`) | 283,330 | 208,286 sets | ≈ 282,000 `Person` + 283,000 `Directorship` entities, ≈ 1.4 M statements | ≈ 0.17 GB statements + 45 MB entity rows + 12 MB records |
| officers (`role_counts`) | 283,330 | 208,286 | ≈ 283,000 `Directorship`, ≈ 1.1 M statements | ≈ 0.15 GB |
| members (corporate) | 186,535 | ≈ 13,000 sets | ≈ 16,500 `Ownership` + ≈ 5,500 `org-` holders, ≈ 0.11 M statements | ≈ 15 MB |
| **Total** | | | | **≈ 0.25 GB 🟡** |

This is within the LV ≤ 2.5 GB budget; the LV total is ≈ 1.6 GB (`lv-register.md`).

**Time 🟡:** parse officers ≈ 24 s and members ≈ 25 s (stdlib Python, measured), plus the temp-table grouping ≈ 10 s; write ≈ 1.5 M rows ≈ 15 s. A daily refresh is ≈ 1 min with the download; about 100 sets change a day.

## Fixtures

- **Writers:** `packages/sources/src/lv/lv-ur-officers/fixture.ts` and `packages/sources/src/lv/lv-ur-members/fixture.ts`. They use the exact headers, `;`, BOM and CRLF, and write rows **not grouped by company**, with ascending ids, as upstream.
- **Officers:** about 30 rows:
  - every `position` value; an empty position with each `governing_body`; each signing-rights type;
  - a `LEGAL_ENTITY` officer and a `FOREIGN_ENTITY` officer;
  - an `OWNER` of a fixture `IK`;
  - "Test Person A" in two fixture companies (must give two unrelated rows);
  - masked codes from `fixtures/canaries.ts`, generated at test time;
  - a day-2 variant: a spelling fix on one id, one removed line, one added line.
- **Members:** about 25 rows: each `entity_type`; a `LEGAL_ENTITY` holder whose code is an `IK`; one not in the fixture register; a duplicate `id`; an LVL holding.
- **Names and codes:** "Example Timber SIA", "Demo Holding AS", foreign holder "Sample Holdings Ltd". Fixture-only codes per the (c + 1) mod 10 rule (`lv-register.md`).
- **Size:** < 50 KB.

## Tests

| File | What it proves |
|---|---|
| `packages/sources/src/lv/lv-ur-officers/lv-ur-officers.test.ts` | One record per company from unsorted rows. `p-<record id>-<position>` follows file order, not name order. Field map per line. Both `LV_PERSON_ROWS` modes (no names in `role_counts`). Canary absent from output and `hashInput`. Unknown `entity_type` dropped |
| `packages/sources/src/lv/lv-ur-members/lv-ur-members.test.ts` | Gate outcomes, one case per type and reason, with counts. Gated-out lines never reach `hashInput`. `org-` id rule. Duplicate ids |
| `packages/sources/src/lv/denylist.test.ts` | The fetcher refuses the BO, stockholder and joint-owner slugs and files before any request |
| `packages/sources/src/person-fields.test.ts` (shared, PS6) | No code-pattern field in the stored fields or the hash input of either LV loader |
| `packages/ingest/src/role-ended.test.ts` (shared) | A spelling fix on the same id → no event. A removed id → one `finora.role_ended` with `{role, body}` and no name or id |
| `packages/ingest/src/history.test.ts` (shared, PS4) | After the role disappears, no row, event or log line carries the old name or id |
| `packages/store/src/disputes.test.ts` (shared) | Dispute officer A; add officer B (the set is replaced): A stays suppressed, B shows |
| `packages/store/src/person-scope.test.ts`, `person-targets.test.ts` (shared, PS2) | The same fixture human in two companies → two unrelated rows. A citation survives a reload |
| `packages/domain/src/report/lv-people.test.ts` (shared, PS7) | `role_counts` renders counts and dates only. No LV name on UI, API, MCP, export or agent tools |
| `packages/ingest/src/purge-guard.test.ts` (shared) | An empty `officers.csv` deletes nothing → `purge_guard` |
| `packages/ingest/src/party-gate.test.ts` (shared) | The LV member cases. A fixture sole trader at a company address creates no S17 link |
| HIDE surface tests (S04.LV.02, S04.LV.03, natural-person members) and the PS5 canary tests (`apps/server/src/canary.contract.test.ts`, `apps/mcp/src/canary.test.ts`, `domain/src/export/canary.test.ts`, `agents/src/canary.test.ts`, `store/src/canary.test.ts`) | LOCK shown, no value, no person eid, line id or code on any surface |

## Failure modes

| Failure | Loader does | UI shows |
|---|---|---|
| Download down | `failed`; previous sets stay | S03 keeps "as of [date]"; Sources page shows the failure |
| Header changed, or an unknown `entity_type` | `failed` (`schema_changed`); unknown types are never loaded (the gate passes listed values only) | as above |
| Partial file, or more than 2% of sets would be purged | `partial` (`purge_guard`); no purge, no `role_ended` | as above, plus a Settings notice |
| Stale as-of | `stale_skipped` | nothing changes |
| Company has no officer lines | - | S03: NP after the purpose gate |
| Company has only natural-person members | - | S04: LOCK "Not shown in Latvia: restricted by rule 1" |
| `LV_PERSON_ROWS` switched | content sync from the raw cache (new `parserVersion`); every set is rewritten | names appear or disappear on the next read |

A storage-class or licence-class change (A7) is a full reload into the new class and a purge from the old one (`ingest/src/class-change.test.ts`); none is foreseen for these CC0 sources.

## Open questions

1. **`org-` id input:** §3.4 lists (source, company eid, record key). With a set record, one record holds several foreign holders, so this spec adds the line `id`. Architect: confirm.
2. **Where the previous set's line identities live for the role-end diff.** §3.3 says they are used "only inside the diff" but names no store. Proposal: an internal `records.line_ids` BLOB (sorted 8-byte truncated hashes of the line ids). It is never read by any query path, export or API, and is covered by the PS5 store canary test.
3. **New names** (once): drop reasons `lv_person_rows_role_counts`, `duplicate_key`, `unknown_enum`; FtM props `Directorship.summary` (governing body) and `Directorship.description` (signing rights). Confirm these, or add the extensions `finora:governingBody` and `finora:signingRights`.

## S05 review changes (SEC-2, SEC-9, M6)

- Only closed-set values are stored: an unknown position is `unspecified`; an unknown governing body or signing right is not stored; each is counted `unknown_enum`. A free-text name in any of those columns never reaches the store, in either mode.
- A line id with the shape of a personal code (any Baltic shape, the LV hyphenated form, or a person row id) is nulled in `lineIds` and in the hash input, counted `personal_code` (legal). The foreign holder's `org-` id then uses the line's position.
- The officers' hash input holds the stored values (closed-set role, body, signing right, parsed start date), not the raw columns.
- A foreign officer (`FOREIGN_ENTITY`) loads only through the party gate, like a member: a party the gate proves a company keeps its company name, in both `LV_PERSON_ROWS` modes; an unproven one is dropped as `party_not_proven` in every mode (legal on SEC-9).
- No LV file is kept in the raw cache (`rawCache: false`); a mode switch re-fetches. Tested by the data-dir and raw-dir byte scan after a full LV fixture load in both modes (`fixtures/lv-byte-scan.test.ts`).
- **Line ids (N1 in the security re-check):** only the register's shape is kept, at most 10 digits (the 2026-11 files hold 1-8), so no 11-digit personal code and no longer run holding one can pass. Anything else is nulled and counted: `personal_code` for a digit run, `free_text` otherwise.
- **Foreign holders known only by name (T2 in the security re-check; legal 7093040951):** the register's `FOREIGN_ENTITY` type is not proof of a company on its own. The name must carry a company-form word of three letters or more (`namesCompany`, as the FID gate), or end, as the last of two words or more, in a short form spelt as companies write it: `OÜ`, `OU`, `AS`, `AB`, `Oy`, `OY`, `AG`, `SA`, `S.A.`, `BV`, `B.V.`, `NV`, `N.V.` (`endsWithShortCompanyForm`). Otherwise a member line is dropped whole and an officer line keeps its role with no holder, both counted `unproven_party`. Only the company name is ever stored. Measured on the 2026-11 files before the rule was built: none of the 451,863 names typed `NATURAL_PERSON` passes the short-form rule. With it, 1,673 of 5,547 foreign member lines and 24 of 61 foreign officer lines are dropped (3,459 and 38 without it). Accepted residual (legal 7093048120): a person typed `FOREIGN_ENTITY` whose surname is a listed form, spelt as the form, would pass. The measurement cannot count that case, because the file has no ground truth for a mistyped person, and the names measured are mostly Latvian. The case rule refuses "Test Person As", but a person name written in capitals and ending in a listed form ("TEST PERSON AS") would pass: the safety rests on the measurement, not on the case rule (qa 7096076259). A future file with person names in capitals needs the count re-run. A second named residual (legal 7115277370, U2): `Oy` is listed in its company spelling, which is also how a surname is written, so a person typed `FOREIGN_ENTITY` whose mixed-case name ends in "Oy" would pass. The measurement covered it (0 of 451,863), and a re-count on any fresh file counts every listed form in every spelling the rule accepts, mixed-case `Oy` included, not only capitals; any person name passing switches the rule off through the trigger and is reported to legal. Re-measured after the NFC and trailing-mark NITs: still 0 of 451,863.
- **The re-count trigger (legal 7096149394, qa 7096154351):**
  - In `names_no_id`, the officers parse counts three numbers over the natural-person names it reads anyway: names, names the short-form rule would admit, and names in capitals (`ParseContext.onCheck`, the sync report's `checks`). No name is kept, reported or logged. In `role_counts` no name is read and no check runs; `data status` says "short-form rule: not checked in role_counts".
  - The check trips when any person name would pass the rule, or more than 1% are in capitals (2026-11 baseline: 0 and 0.02%). The parent then sets a boolean in `main.store_meta` (`lv_short_forms_off`), and from the next run every job's `LoaderConfig.lvShortCompanyForms` is false. The flag is read once per run, before any job is built, so a run never changes its own config. The loaders stay pure and never read the store.
  - It is switched back on only by `finora-cli data short-forms on`, after a counts-only re-count on fresh files, posted to legal. That command also records the newest sync id, so a tripping report from before it never trips the rule again.
  - **Durable (U1):** at the start of every `data sync`, before any job is built, the latest officers content sync newer than the last switch-on is read; if its counts trip, the rule is switched off. A run that died after its officers sync committed, before the end-of-run trip, is caught by the next run.
  - **Fails closed (U3):** the switch lives in `user.settings`, which backups keep (no main table is backed up), and it reads as off unless its value is "0". A store that never tripped starts with it on; a trip recorded before U3 in `main.store_meta` is still honoured.
  - **What it does not cover (qa 7096154351, legal 7096165934):** the counters watch the LV natural-person names. A change in how foreign names are written shows only on `FOREIGN_ENTITY` lines, which are already 26-38% in capitals, so neither counter would move. The trigger catches a register-wide switch to capitals; it does not cover the residual case, a person typed `FOREIGN_ENTITY` whose name ends in a listed form. That case rests on the measurement alone.
