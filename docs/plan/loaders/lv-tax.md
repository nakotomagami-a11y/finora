# lv-vid-*: Latvian State Revenue Service open data (taxes paid, employees, rating, VAT payers, activity suspensions)

| Source id | Dataset slug on data.gov.lv | File | Rows (2026-11-19) |
|---|---|---|---|
| `lv-vid-taxes-quarterly` | `nodoklu-maksataju-taksacijas-ceturksni-samaksato-vid-administreto-nodoklu-kopsummas` | `pdb_samaksato_nodoklu_kopsummas_cet.csv` | 462,376 |
| `lv-vid-taxes-yearly` | `komersantu-ieprieksejos-tris-taksacijas-gados-samaksato-vid-administreto-nodoklu-kopsummas` | `pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv` | 291,512 |
| `lv-vid-rating` | `nodoklu-maksataju-reitings` | `reitings_uznemumi.csv` | 145,690 |
| `lv-vid-vat-payers` | `pvn-maksataji` | `pdb_pvnmaksataji_odata.csv` | 285,909 |
| `lv-vid-suspensions` | `saimnieciskas-darbibas-apturesana` | `pdb_saimndarbibaaptureta_odata.csv` | 72,990 |

**Dropped:** the minimum-wage employer list (`pdb_dd_minalgasmaksataji_odata`). No Part G item and none of the 11 checks uses it, and it lists natural-person employers by name and part of the personal code. It is never fetched (fetcher denylist, `packages/sources/src/lv/denylist.ts`). The tax debtor database (per query, behind a CAPTCHA) is never automated: S08.LV.01's debt amount is a MANUAL empty state (see Items).

## Source

- **Publisher:** State Revenue Service of the Republic of Latvia (Valsts ieņēmumu dienests, "VID"), via `https://data.gov.lv`.
- **URL discovery:** `package_show?id=<slug>`, then the CSV resource by basename (`lv-register.md` § Source).
- **Licence:** `cc0-1.0` (CKAN `license_id` "CC0-1.0" on all five datasets, verified 2026-11-19).
- **Attribution:** "Source: State Revenue Service of Latvia, <dataset title>, data.gov.lv, CC0 1.0".
- **Storage:** `store`.
- **Cadence:**
  - `weekly` for the taxes, rating and VAT files (cto §2). None changed in 24 h. The quarterly file updates about a month after each quarter (Q3 2026 file dated 2026-11-03); the yearly file once a year; the rating file about monthly (dated 2026-11-11); the VAT file is regenerated daily at about 06:01 UTC.
  - `daily` for `lv-vid-suspensions`: an activity suspension is a hard flag (Part B), the file is 7.5 MB, and CKAN showed it modified 2026-11-19 06:01.
  - `publishedAtUtc: "06:30"` for all five.
- **As-of:**

  | Source | As-of rule |
  |---|---|
  | quarterly | the newest quarter in `Taksacijas_gads_ceturksnis`, as its period end (Q3 2026 → 2026-09-30) |
  | yearly | the newest `Taksacijas_gads`, as Dec 31 |
  | rating | `Informacijas_atjaunosanas_datums`: one stated date in every row (the only LV file with a real as-of field) |
  | VAT | the maximum of `Registrets` and `Izslegts`, ignoring dates after the sync date (the file holds removal dates up to 2053) |
  | suspensions | the maximum of `Lemuma_datums` |

- **Keys and limits:** no key; ≤ 2 requests/s; size cap 100 MB per file.
- **Deep link:** none per record (VID has no per-company page). Every record links to the company page `https://info.ur.gov.lv/#/legal-entity/{entityCode}`.
- **Manual lookup** for S08.LV.01 (debt amount): `not_checked{reason: "manual_lookup", url: "https://www.vid.gov.lv/lv/nodoklu-paradnieki"}`.
- `officialHosts`: `data.gov.lv`, `info.ur.gov.lv`, `www.vid.gov.lv`.

## Items

| item_id | Call | Caveat text | Empty state | Filled by |
|---|---|---|---|---|
| S01.LV.01 | SHOW | - | NP (LEI, VAT: — when absent) | VAT number (VAT payers); NACE activity code (yearly file) |
| S07.LV.01 | CAVEAT | Employees from tax filings, quarterly; covers 54-58% of active companies | NP | `employees` from the quarterly file (the yearly file's average for full years) |
| S08.LV.01 | CAVEAT | Taxes paid for 56% of active companies; debt amounts are not open data | MANUAL (amount); CN (rating) | taxes paid (quarterly, yearly); the rating, shown verbatim as "Tax authority's rating: [value]" |
| S09.LV.01 | SHOW | - | CN | tax-authority activity suspensions |

Checks fed:
- **Check 7 (arrears):** in LV, rating C → Points to check. Tax data alone never reaches Serious.
- **Check 8:** an activity suspension with no restoration decision on an active company → Serious concerns (Part B).
- **Check 6:** not fed from here.

Average salary (S07) is LATER: the social-contribution column is read only into `labour_taxes`, never divided into a salary.

## Field map

All five files are `,`-delimited, every field double-quoted, UTF-8 with BOM, with Latvian headers. Amounts in the two tax files are in thousand EUR with a `.` decimal point.

### `lv-vid-taxes-quarterly`

Header: `"Registracijas_kods","Nosaukums","Taksacijas_gads_ceturksnis","Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR","Taja_skaita_PVN_iemaksa","Taja_skaita_PVN_atmaksa","Taja_skaita_IIN_summa","Taja_skaita_VSAOI_summa","Videjais_nodarbinato_personu_skaits_cilv"`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `Registracijas_kods` | text | `fact_reports.entity_id` → `lv-<code>`; record key part | S08.LV.01 (R) | no | 11 digits plus check digit; a letter-prefixed code (16 rows) → `invalid_code`; not in register (6,363) → `code_not_in_register`; NP form (36,220) → `natural_person_tax` |
| `Taksacijas_gads_ceturksnis` | text, e.g. `2026. gada 3. ceturksnis` | `period_start` / `period_end` of a `quarterly_tax` report; record key part | S08.LV.01 | no | regex `^(\d{4})\. gada ([1-4])\. ceturksnis$`; no match → skip `bad_period` |
| `Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR` | decimal | `taxes_paid` | S08.LV.01 | no | `currency = EUR`, `unit_scale = 1000`; value as published |
| `Taja_skaita_PVN_iemaksa` | decimal | `vat_paid` | S08.LV.01 | no | as above |
| `Taja_skaita_IIN_summa` + `Taja_skaita_VSAOI_summa` | decimal | `labour_taxes` = their sum (personal income tax withheld + social contributions) | S08.LV.01 | no | the sum is documented in `concepts.ts`; both empty → no fact |
| `Videjais_nodarbinato_personu_skaits_cilv` | int | `employees` | S07.LV.01 | no | 0 stored as 0. The UI says "0 employees reported", not "none" |
| `Nosaukums`, `Taja_skaita_PVN_atmaksa` | - | not read | - | - | VAT refund: no concept (Open question 3) |

### `lv-vid-taxes-yearly`

Header: `"Registracijas_kods","Nosaukums","Taksacijas_gads","Uznemejdarbibas_forma","Pamatdarbibas_NACE_kods","Juridiska_adrese_ATVK_kods","Juridiska_adrese_ATVK_nosaukums","Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR","Taja_skaita_IIN","Taja_skaita_VSAOI","Videjais_nodarbinato_personu_skaits_cilv"`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `Registracijas_kods` | text | entity; record key part | S08.LV.01 (R) | no | as above (NP 22,568; not in register 3,332) |
| `Taksacijas_gads` | int | an `annual_tax` report for Jan 1 to Dec 31 of the year; record key part | S08.LV.01 | no | 4 digits |
| `Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR` | decimal | `taxes_paid` | S08.LV.01 | no | `unit_scale = 1000` |
| `Taja_skaita_IIN` + `Taja_skaita_VSAOI` | decimal | `labour_taxes` (sum) | S08.LV.01 | no | - |
| `Videjais_nodarbinato_personu_skaits_cilv` | int | `employees` | S07.LV.01 | no | - |
| `Pamatdarbibas_NACE_kods` | text, 4 digits | statement `classification` = `NACE:<dd>.<dd>` (e.g. `4120` → `NACE:41.20`), from the newest year only | S01.LV.01 | no | `?` placeholders (3,377) and anything that is not 4 digits after trimming a trailing `.` → no statement, counted `bad_nace` |
| `Nosaukums`, `Uznemejdarbibas_forma`, `Juridiska_adrese_ATVK_kods`, `Juridiska_adrese_ATVK_nosaukums` | - | not read | - | - | the register carries name, form and address |

### `lv-vid-rating`

Header: `"Registracijas_kods","Nosaukums","Reitings","Skaidrojums","Informacijas_atjaunosanas_datums"`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `Registracijas_kods` | text | entity; record key | S08.LV.01 (R) | no | NP form (3,515) → `natural_person_tax` |
| `Reitings` | enum | statement `finora:taxAuthorityRating` | S08.LV.01 | no | `A` good compliance, `B` needs improvement, `C` violations, `N` inactive taxpayer, `J` newly registered. Unknown → kept, `unknown_enum` |
| `Skaidrojums` | text (lv) | the label table (`lv`, verbatim) | S08.LV.01 | no | the UI shows "Tax authority's rating: [letter] ([Latvian text]; [English gloss])" |
| `Informacijas_atjaunosanas_datums` | date `DD.MM.YYYY` | as-of; statement-level date in `report_json` | S08.LV.01 | no | parsed to ISO |
| `Nosaukums` | - | not read | - | - | - |

### `lv-vid-vat-payers`

Header: `"Numurs","Nosaukums","Aktivs","Registrets","Buvniecibas_pazime","PVN139_2_pazime","Izslegts"`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `Numurs` | text `LV` + 11 digits | record key; statement `vatCode` (when active); `links` VAT ↔ code (ingest §6) | S01.LV.01 (R) | no | Prefix `LV` required. The code part must pass the check digit and be in the register (not: 6,747 → `code_not_in_register`). NP form (25,923) → `natural_person_tax` (Open question 2). Several rows per number (12 duplicates): merged, active if any row is active |
| `Aktivs` | `ir` / `nav` | active → `vatCode` statement; inactive → no statement | S01.LV.01 | no | - |
| `Registrets`, `Izslegts` | date ` DD.MM.YYYY ` (space-padded) | as-of only | - | no | trim, then parse |
| `Nosaukums`, `Buvniecibas_pazime`, `PVN139_2_pazime` | - | not read | - | - | - |

### `lv-vid-suspensions`

Header: `"Registracijas_kods","Nosaukums","Lemuma_datums","Aizliegts_veikt_darijumus_no","Aizliegts_veikt_darijumus_lidz","Lemuma_par_atjaunosanu_datums"`

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `Registracijas_kods` | text, **wrapped in single quotes** (`'4000…'`) | entity; record key part | S09.LV.01 (R) | no | strip `'` and spaces; check digit; not in register (51) → `code_not_in_register`; NP form (0 measured) → `natural_person_tax` |
| `Lemuma_datums` | date ` DD.MM.YYYY ` | event `register.suspension` date; `data.authority = "vid"`; record key part | S09.LV.01 | no | trim and parse; bad → skip `bad_date` |
| `Aizliegts_veikt_darijumus_no` | date | `data.bannedFrom` | S09.LV.01 | no | empty (1.5%) allowed |
| `Aizliegts_veikt_darijumus_lidz` | date | `data.bannedUntil` | S09.LV.01 | no | empty (10.3%) allowed |
| `Lemuma_par_atjaunosanu_datums` | date | `data.restoredOn` | S09.LV.01 | no | empty (94.7%) → not restored |
| `Nosaukums` | - | not read | - | - | - |

A suspension is **open** when `restoredOn` is empty and `bannedUntil` is empty or not yet past (domain rule, `domain/verdict/lv-risk.ts`). It is a hard flag only for an active company.

## Party gate

Not a party list. Every row is the tax record of the entity named by its code, but the natural-person rules apply (Part H 8, rule 5):

| Condition | Outcome | Reason |
|---|---|---|
| code fails format or check digit | skip | `invalid_code` |
| code not in `lv-ur-register` | skip | `code_not_in_register` |
| code has an NP form (`IK`, `ZEM`, `ZVJ`, `IND`, `GIM`) | the row is **dropped**: tax, rating, VAT and suspension lines of natural persons are HIDE | `natural_person_tax` |
| otherwise | loaded | - |

Counts by reason go to `syncs.report_json.dropped`.

## Identity and joins

- Entity `lv-<code>`, with the check digit from `lv-register.md`.
- VAT `LV` + code is embedded. The `links` row (VAT ↔ code) is written by official-ID linking, with the VAT record as the asserting record.
- Join rates to the register (2026-11-19): quarterly 98.6%, rating 100%, VAT 97.6%, suspensions 99.9%.

## Refresh and change

- **Weekly** for the taxes, rating and VAT files; **daily** for suspensions. Content hash first; unchanged → one sync row (the usual case for the taxes files).
- **Record keys:** quarterly `<code>|<YYYY>Q<n>`; yearly `<code>|<YYYY>`; rating `<code>`; VAT `<Numurs>`; suspensions `<code>|<Lemuma_datums ISO>`.
- **Purge scope for the two tax files** (Open question 1): only records whose period appears in the current file are purge candidates. When the publisher drops 2026 Q1 from the file, our stored 2026 Q1 report stays, so S07's 24-month line and the taxes-by-year table build up from install day.
- **History events:**
  - a changed rating → `finora.tax_rating_changed` (`data = {old, new}`; Open question 4);
  - a VAT number turning inactive or disappearing → `finora.vat_deregistered`;
  - a removed suspension row (the register of decisions corrected) → event deleted, `finora.suspension_lifted`, the same type as in `lv-risk.md`.
- **No tombstones.** Partial or interrupted → no purge.

## Size and time budget

| Source | Records | Reports / statements / events | Facts | Est. bytes |
|---|---|---|---|---|
| quarterly | 419,793 | 419,793 reports | ≈ 1.68 M (4 per report) | ≈ 27 + 17 + 25 MB |
| yearly | 265,612 | 265,612 reports + ≈ 140,000 NACE statements | ≈ 0.8 M (3 per report) | ≈ 13 + 11 + 16 + 17 MB |
| rating | 142,175 | 142,175 statements | - | ≈ 17 + 9 MB |
| VAT | ≈ 253,000 | ≈ 110,000 `vatCode` statements (active only) | - | ≈ 14 + 15 MB |
| suspensions | 72,939 | 72,939 events | - | ≈ 2 + 4 MB |
| **Total** | | | | **≈ 0.19 GB 🟡** |

The yearly row is written at load. Tax history grows by about 155,000 quarterly reports a quarter (≈ 25 MB per quarter, ≈ 0.1 GB a year), and that counts against `HISTORY_MAX_GB`. The LV total is ≈ 1.6 GB (`lv-register.md`) within LV ≤ 2.5 GB.

**Time** 🟡 (measured stdlib-Python parse):
- Download ≈ 135 MB ≈ 45 s.
- Parse: quarterly 48 s, yearly 25 s, rating 2.5 s, VAT 21 s, suspensions ≈ 5 s.
- Write ≈ 3.5 M rows ≈ 25 s.
- First load ≈ 3 min in the background. The weekly refresh is usually `unchanged` for the tax files; the daily suspensions sync takes < 15 s.

## Fixtures

- **Writers:** `packages/sources/src/lv/lv-vid-taxes-quarterly/fixture.ts`, `lv-vid-taxes-yearly/fixture.ts`, `lv-vid-rating/fixture.ts`, `lv-vid-vat-payers/fixture.ts`, `lv-vid-suspensions/fixture.ts`.
- **Format:** the exact headers, `,` delimiter, every field quoted, BOM. VAT and suspension dates space-padded, suspension codes wrapped in `'…'`, as upstream.
- **Rows:**
  - three quarters for 4 companies; an `IK` row (dropped); a letter-prefixed code; a bad quarter label;
  - two years with a NACE change, a `?` NACE;
  - every rating letter;
  - a VAT number with two rows (one active); an inactive number; an `IK` VAT number;
  - an open suspension, a restored one, one with `bannedUntil` in the past.
- **Codes and names:** fixture-only codes; "Example Timber SIA", "Demo Logistics SIA", "IK Test Person A".

## Tests

| File | What it proves |
|---|---|
| `packages/sources/src/lv/lv-vid-taxes-quarterly/lv-vid-taxes-quarterly.test.ts` | Quarter parsing and periods. `unit_scale` 1000. `labour_taxes` = IIN + VSAOI. Employees 0 kept. NP row dropped `natural_person_tax`. Letter code → `invalid_code`. Refund column never read |
| `packages/sources/src/lv/lv-vid-taxes-yearly/lv-vid-taxes-yearly.test.ts` | Annual report. NACE formatting `NACE:41.20` from the newest year. `?` → `bad_nace` |
| `packages/sources/src/lv/lv-vid-rating/lv-vid-rating.test.ts` | Rating statement. As-of from `Informacijas_atjaunosanas_datums`. Unknown letter counted |
| `packages/sources/src/lv/lv-vid-vat-payers/lv-vid-vat-payers.test.ts` | Merge of duplicate numbers. Inactive → no `vatCode`. Padded dates. Future removal dates ignored for as-of |
| `packages/sources/src/lv/lv-vid-suspensions/lv-vid-suspensions.test.ts` | Quote-stripped codes. Event `data`. Open vs restored vs expired (domain rule) |
| `packages/sources/src/lv/denylist.test.ts` | The minimum-wage slug and file are refused by the fetcher |
| `packages/ingest/src/purge-scope.test.ts` | Day 2 file holds only Q2-Q3: the stored Q1 report survives. Day 2 without a company's Q3 row → that one record is purged |
| `packages/ingest/src/history.test.ts` (shared) | Rating B → C → `finora.tax_rating_changed`. VAT deactivation event |
| `packages/domain/src/verdict/lv-tax.test.ts` | Rating C → Points to check, never Serious. Open VID suspension on an active company → Serious. Struck-off company with an old suspension → no flag. No tax lines for an `IK` on any surface (the HIDE negative test for Part H 8: UI, API, MCP, export) |
| `packages/ingest/src/unchanged.test.ts`, `stale.test.ts`, `partial.test.ts` (shared) | as titled |

## Failure modes

| Failure | Loader does | UI shows |
|---|---|---|
| Download or CKAN down; schema changed | `failed`; stored data stays | S08 and S07 keep their periods with "as of [date]" |
| Quarter label format changed | every row `bad_period` → the sync is `failed` (more than 50% skipped is a failure, not a content sync) | as above |
| Stale as-of (older quarter or rating date) | `stale_skipped` | unchanged |
| Rating date more than 62 days old (2× the observed monthly cadence) | source `stale` | "Tax authority's rating: [value], as of [date]" in the warning style |
| Company has no tax row | - | S08: "Taxes paid: not in the tax authority's file for [period]"; debt amount always MANUAL "Check manually at [official site]" |
| No rating row | - | S08 rating: CN "Checked State Revenue Service rating as of [date]: none found" |

## Open questions

1. **Purge scope by period (architecture §4.4 step 6: "records whose key is absent from the temp table are deleted").** For publishers that roll periods out of the file (the tax authority publishes 3 quarters and 2 years at a time), the contract as written deletes our only copy of the older periods. Proposal: a `SourceMeta.purgeScope: "all" | "periods-in-artifact"` (default `all`), with `ingest/src/purge-scope.test.ts`. The same applies to the LT and EE period files.
2. **VAT numbers of sole traders.** A VAT number is a resolution key, not a tax amount, but this spec drops it for NP entities under `natural_person_tax` (Part H 8, conservative). Council: confirm, or keep it as identity.
3. **VAT refunds:** `Taja_skaita_PVN_atmaksa` has no concept, so it is not read. Add `vat_refunded` only if an item needs it.
4. **New names:** event types `finora.tax_rating_changed` and `finora.vat_deregistered`; statement prop `finora:taxAuthorityRating` (extension); drop reasons `natural_person_tax` (from the brief), `bad_period`, `bad_nace`, `bad_date`. FtM prop for NACE: `classification` (confirm, or use `sector`).
5. **Average salary:** LATER per Part G. When it ships (LV, 10 or more employees), it would derive from social contributions ÷ 0.3409 ÷ employees ÷ 3 per month: a "Derived by Finora" value from facts already stored, with no loader change.
