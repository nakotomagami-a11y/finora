# Baltic data research: Lithuania, Latvia, Estonia

Phase 1 research by the `data-baltics` seat. Every number here was measured on real downloads and API calls on 19-20 Nov 2026. Every licence was read on the official page, and the date checked is recorded. Probe scripts are in `research/probes/baltics/{lt,lv,ee,common}/`. Downloads and the entity-level sample profiles stay in the gitignored `research/.cache/`. This doc names no company or person. The field-by-field data dictionary is [baltics-dictionary.md](baltics-dictionary.md). Conventions (section IDs, grades, templates) are in [README.md](README.md).

## Summary

1. **Latvia and Estonia publish almost a full company report as free daily bulk files.**
   - LV: everything is CC0 on data.gov.lv. That covers the register, officers, limited-company members, beneficial owners, financial statements back to 2006, insolvency, securing measures, tax-authority taxes, employees and rating, procurement and EU funds.
   - EE: the register files (companies, officers, members, beneficial owners, pledges, annual-report key figures 2019-2025) are CC BY 4.0. The tax board's quarterly taxes and daily tax-debtor list are **CC BY-SA 3.0**, and procurement and official notices are CC BY-SA. Share-alike data must stay licence-tagged and out of any CC0 or CC BY export.
2. **Lithuania is strong on money and weak on people.** The register publishes daily files with no names of managers, members or owners anywhere: only a "has a manager" flag, a since-date, gender and member counts. Taxes paid, daily tax arrears, daily social-insurance debts and insured counts, monthly average wages and statement key lines are all open. The government data portal's datasets are CC BY 4.0. The social-insurance files state no licence; they are public by law.
3. **People are identified differently in each country.**
   - LV: name + masked personal code. For 97.1% of person rows that carry a masked code, the code still reveals the birth date.
   - EE: name + a pseudonymous hash, the same across all files. Personal codes were removed on 1 Nov 2024.
   - LT: no people at all.
4. **Owners.**
   - LV limited-company members are open.
   - **LV joint-stock shareholders were withdrawn**: the dataset went private after the Constitutional Court judgment of 9 Nov 2026.
   - **Beneficial owners are still published in bulk** in LV (200,800 rows, daily) and EE (412,802 rows, daily). Whether we may show them is a legal call (CJEU C-37/20, C-601/20).
   - LT: counts only, last loaded 2025-09.
5. **Tax debt.**
   - LT: daily arrears list (tax) plus social-insurance debts. 22.0% of active companies have some overdue debt: 11.8% tax arrears, 15.4% social-insurance debt, 5.2% both.
   - EE: daily debtor list, debts of EUR 100 and over. 6.2% of active companies are on it.
   - **LV: amounts are not open.** The lookup needs name + code and sits behind a CAPTCHA. The open proxy is the tax-authority rating C, which covers 5.4% of active companies.
6. **No history in the LV and EE bulk files.** They carry current roles only: ended roles vanish, and deleted EE companies vanish. Finora must keep its own daily snapshots to show changes ("CEO left", "owner changed").
7. **Courts: no joinable open data in any of the three countries.** Agents search court portals at query time.
8. **Sanctions:**
   - EU consolidated list: grade A, CC BY 4.0.
   - UN list: grade C. Its site terms forbid redistribution, so agents fetch it live.
   - LV national frozen-assets list: A, CC0.
   - LT and EE national lists: HTML only, grade C.
9. **Volumes are small, and changes are smaller.**
   - LV: 1.03 GB per full pull.
   - EE: 0.52 GB zipped (10 GB unzipped).
   - LT: about 1.1 GB with the 2024+ statements.
   - Between two daily LV pulls, 0.01-0.2% of rows changed per file.

## Coverage at a glance

Grade (README scale) and population fill rate per section. Each country uses its own active-company population:
- LT: 188,099 active companies of business legal forms.
- LV: 154,704 active Commercial Register entities.
- EE: 296,057 active companies of business forms.

Details are in the display matrix at the end.

| Section | LT | LV | EE |
|---|---|---|---|
| S01 Identity | A · 100% | A · 100% | A · 98.3% |
| S02 Status and history | A · 100% (no history) | A · 100% (name history stale) | B · 100% (no history) |
| S03 People | C · roles only, 0% names | A · 97.8% | A · 97.4% |
| S04 Owners | C · counts only | A members 90.8% · BO X? 90.4% · JSC D | A members 97.3% · BO X? 95.0% · AS shareholders D |
| S05 Group | D | C · 11.0% | C · 9.8% |
| S06 Financials | B · 72.7% | A · 74.1% | A · 71.6% |
| S07 Workforce | C · 48.6% (wage 18.8%; licence unstated) | B · 57.8% (wage derived) | B · 26.9% (no wage) |
| S08 Taxes and arrears | A · taxes 76.5%, tax arrears daily; social-insurance debts C | B · taxes 56%, rating 91.8%, no debt amounts | B · taxes 39.1%, debtors daily |
| S09 Insolvency, pledges, notices | B | A · 12.3% have an event | A · pledges 1.6%, notices |
| S10 Courts | D | C · metadata only, not joinable | D |
| S11 Sanctions | A (EU) · C (UN, national) | A (EU, national) · C (UN) | A (EU) · C (UN, national) |
| S12 Public money | C · 4.5% + 3.2% | A · 2.6% + 2.6% | B · 1.2% + Kohesio |
| S13 Filings and events | B · 87.9% | B · 74% | A · 83.3% |
| S17 Network | C · addresses only | B · 49.1% (name + masked code) | A · 97.2% (person hash) |
| S18 Score inputs | A | A | B |

S14 (securities), S15 (web) and S16 (news) are not in the Baltic registers. S15 has incidental website fields only: LV under 3%, EE 6.3% of active business-form companies (5.6% of all active entities). These sections belong to the osint area.

## Answers to the feasibility doc's open questions

1. **Licence of get.data.gov.lt:** **CC BY 4.0**, shown on each dataset page on data.gov.lt. Verified 2026-11-19 for the register, management bodies, P&L, balance sheet, taxes paid, tax arrears, taxpayer register, bankruptcy, member counts, EU funds 2014-2020 and pre-2017 procurement. The post-2017 procurement page was not read; that dataset has no supplier codes anyway.
2. **Licence and bulk URL of the LT social-insurance data:**
   - **No licence statement.** The data is "public data" under the Law on State Social Insurance, art. 15(3).
   - Bulk URLs: `https://sodra.lt/Failai/{Apdraustuju_skaicius,Skolos,Vidurkiai}.zip` (daily), and `https://atvira.sodra.lt/imones/downloads/<year>/monthly-<year>.csv.zip` (monthly history).
   - Grade B until the legal seat or the publisher settles the licence.
3. **Latvian procurement data licence:** **CC0-1.0**, from the data.gov.lv records of the procurement bureau's datasets. Daily JSON at `open.iub.gov.lv`.
4. **Estonian tax-authority data licence:**
   - **CC BY-SA 3.0**, per the dataset entries on the national portal andmed.eesti.ee. The tax board's own page says the data is free "to use, reuse and share" without naming a licence.
   - Share-alike, so it is tagged per record and excluded from any CC0 or CC BY export.
5. **Is Estonian beneficial-owner open data still published?**
   - **Yes.** The file was updated 19 Nov 2026: 412,802 current rows with name, country, control method and a person hash, but no personal code.
   - The register's own API restricts the same data to authorities and approved users.
   - Display is a legal call.
6. **What the Latvian Constitutional Court ruling (9 Nov 2026) covers, as seen in the data:**
   - The joint-stock **shareholder** dataset is now private: `package_show` returns "Authorization Error" and the page returns 404. None of the 765 active joint-stock companies has member rows.
   - Limited-company (SIA) **members** are still published.
   - **Beneficial owners** are still published. Concealment on request has been possible since 1 July 2026, and we could not see whether concealed owners drop out of the bulk file.
   - The legal reading belongs to the legal memo.
7. EDGAR 8-K item numbers: the `data-us` area.

**Corrections to the feasibility table:**
- LV tax debtors are confirmed ❌: query only, behind a CAPTCHA.
- EE procurement is verified as CC BY-SA 3.0, not "unverified".
- EE VAT numbers are in the register files: 42.7% of active companies have one.
- LT procurement after May 2023 has no open supplier codes.
- LT EU funds for 2021-2027 come only through Kohesio.
- LT property arrests in open data are pseudonymised and stale, so they are unusable.

## For the legal memo

These items need a legal call before display. The data layer should enforce each per field:

1. **Beneficial owners, LV and EE:** bulk-published and CC0 / CC BY, yet CJEU C-37/20 and C-601/20 ended general public access under the AML directive. LV allows concealment on request since 1 July 2026. Candidate grade X.
2. **LV masked personal code:** for 97.1% of person rows that carry a masked code (91-97% of all person rows, depending on the file), the visible first six digits are the date of birth.
3. **EE person hash:** pseudonymous, not anonymous; it links one person across companies. Never reverse it.
4. **EE officer rows:** 2.8% carry a personal email and 4.2% a home address. The loader must drop both.
5. **Sole-trader names** are personal names in all three countries:
   - LT: individual enterprises and partnerships of natural persons.
   - LV: forms `IK`, `ZEM`, `ZVJ`, `IND`, `GIM`.
   - EE: form FIE, 24,545 entities.
   - The same applies to natural-person winners in LV procurement and natural-person bankruptcy notices in EE.
6. **Share-alike data:** the EE tax board, procurement and notices are CC BY-SA 3.0 / 4.0.
7. **No stated licence:** LT social-insurance files (public by law).
8. **UN sanctions list:** UN site terms grant "personal, non-commercial use, without any right to resell or redistribute".
9. **LV tax-debtor lookup:** use is restricted by law to the purposes of the law on taxes and fees, and it sits behind a CAPTCHA. We do not automate it.
10. **LV official notices** (the official gazette): reuse needs a written agreement and fees. We do not load them.

## Freshness, size and change volume

Asked by `cto`. "Current" follows council clarification 1 (no older than 2x the stated cadence).

| Source | Stated / observed cadence | Latest data seen | Current? | Bytes per full pull | Parse | Changed per day | Validators |
|---|---|---|---|---|---|---|---|
| LT register daily files | daily / daily | 2026-11-19 | yes | 124.5 MB (4 files) | < 0.6 s each | 2,048 new, 618 deregistered, 2,901 status changes in 48 days (vs the API copy) | none (as-of column) |
| LT register on the API | monthly / irregular, gaps up to 6 months | 2026-10-02 | **no** | 146 MB | 1.7 s | change feed | ETag, Last-Modified, 304 |
| LT statements (2024+) | weekly / monthly | 2026-10-28 load | no (annual data) | 126 + 226 MB | 1.7 + 3.1 s | change feed | ETag, Last-Modified |
| LT taxpayer register | daily / daily | 2026-11-19 | yes | 351 MB | 4.7 s | 2,000-22,000 patches | ETag, Last-Modified |
| LT taxes paid | monthly / monthly | Oct 2026 | yes | 236 MB | 2.9 s | monthly | Last-Modified |
| LT tax arrears | daily / daily | 2026-11-19 | yes | 6.8 MB | 0.1 s | 6,700-7,400 | ETag, Last-Modified |
| LT social insurance | daily + monthly | 2026-11-19 | yes | 2.6 MB zipped daily; 12 MB yearly | 1.8 s | pending second pull | ETag; Last-Modified unreliable |
| LT bankruptcy reports | quarterly / quarterly load | event 2025-10-03 | load yes, content a year behind | small | - | - | ETag, Last-Modified |
| LT member counts | monthly / last load 2025-09 | 2025-09-04 | **no** | 40 MB | 0.4 s | - | ETag, Last-Modified |
| LV register | daily / nightly ~21:26 UTC | 2026-11-17 | yes | 129 MB | 28 s | 43 added, 56 changed | ETag + Last-Modified, but both change every night: diff by content |
| LV officers | daily / daily | 2026-11-17 | yes | 40 MB | 24 s | 130 added, 102 removed, 1 changed | same |
| LV members | daily / daily | 2026-11-17 | yes | 25 MB | 25 s | 113 added, 83 removed, 12 changed | same |
| LV beneficial owners | daily / daily | 2026-11-17 | yes | 18 MB | 1.3 s | 139 added, 107 removed | same |
| LV insolvency | daily / daily | 2026-11-16 | yes | 6 MB | 1.1 s | 3 added, 2 changed | same |
| LV securing measures | daily / daily | - | yes | 7 MB | 0.3 s | 61 added, 35 removed | same |
| LV financial statements (4 files) | daily / daily | 2026-11-18 | yes | 521 MB | 5.3 min | 40-55 statements | same |
| LV name history | daily / unchanged | 2025-04-02 | **no** | small | - | 0 | same |
| LV tax authority (quarterly, rating, VAT) | quarterly, ~monthly, daily | Q3 2026; 2026-11-11; 2026-11-19 | yes | 46 + 14 + 29 MB | 48 + 2.5 + 21 s | 0 in 24 h | same |
| LV procurement (daily JSON) | daily / daily | 2026-11-18 | yes | ~1.2 MB per day | - | one file per day | per-day file |
| EE register (9 daily files) | daily / daily | 2026-11-19 (same day) | yes | 0.52 GB zipped, 10.1 GB unzipped | general data 364 s; rulings 872 s; persons 20-35 s each | pending second file; ~400-590 register entries per weekday | Last-Modified, ETag, 304; CDN max-age 14 days |
| EE annual reports | monthly / monthly | cut 2026-10-31 | yes | 0.14 GB zipped | 4-68 s per file | monthly | Last-Modified |
| EE tax board taxes | quarterly / quarterly | Q3 2026 (10 Oct) | yes | 156 MB | 23 + 31 s | quarterly | Last-Modified |
| EE tax debtors | daily / daily | 2026-11-19 | yes | 1.3 MB | < 1 s | pending | Last-Modified |
| EE procurement | monthly / monthly | Oct 2026 | yes | 335 MB per 12 months | seconds per month | monthly | - |
| GLEIF | 3x daily + deltas | 2026-11-19 16:00 | yes | 510.6 + 24.5 + 62.9 MB | 151 s (all three, Baltic filter) | LastDay delta: LT 34, LV 18, EE 128 | ETag, Last-Modified, deltas |
| EU sanctions | on change | 2026-10-23 | yes | 25.9 MB | 1.8 s | 0 (identical pulls) | Last-Modified |
| UN sanctions | on change | 2026-11-19 | yes | 2.2 MB | 0.3 s | 0 | ETag, Last-Modified |
| LV national frozen-assets list | irregular | 2026-11-16 | yes | 33 KB | < 1 s | - | CKAN last_modified |
| Kohesio | snapshot folders, months apart | 2026-10-23 | slow (national data reaches it months late) | 108 MB (Baltic CSVs) | 29 s | LT 2021-27 unchanged March-October | none (dated folder) |

Two-day diffs for LT and EE: the 19 Nov snapshots are stored, and each country's `diff_pulls.py diff` runs against the next pull. The numbers go into this table when they exist.

## IDs, joins and people

Asked by `architect`. Per-source answers are under each entry below (lines a-k); this table is the cross-country summary.

| Question | LT | LV | EE |
|---|---|---|---|
| Company key | `ja_kodas`, 9 digits, mod-11 check digit (the personal-code algorithm); 552,531 of 552,531 valid; issued for life, no reuse observed | `regcode`, 11 digits; weights 9,1,4,8,3,10,2,5,7,6, check = (3 - sum) mod 11; 456,256 of 456,256 valid; 9-digit legacy journal codes | 8 digits, mod-11 check digit (weights 1-7,1 then 3-9,1,2); 100% valid; first digit 1 companies and sole traders, 7 state, 8 associations, 9 foundations |
| VAT number | mapped via the taxpayer register (`pvm_kodas`); 64.4% of active business-form companies | embedded: `LV` + regcode; 50.5% of active are VAT payers | separate number (`EE` + 9 digits), mapped in the register; 42.7% of active |
| LEI (GLEIF, register code on 98-99.7% of LEI records) | `RA000430`; 2.5% of active | `RA000423`; at most 2.9% of active | `RA000181`; 30,632 LEI records |
| Same key in tax, social-insurance and statement files | yes; the API's taxes-paid table uses the register's internal UUID (98.9% resolve) | yes: 98.6% (quarterly taxes), 100% (rating, statements) | yes, 100% |
| Row IDs for people, owners, pledges | none: one management row per company | `id` per officer, member, beneficial owner and measure row (stable across two pulls; 12 duplicate member ids) | `kirje_id` per person, pledge and card row; `pandi_id`; `maaruse_nr` |
| Person identity | none | name + masked code `DDMMYY-*****` (birth date for 97.1% of coded rows); foreigners: birth date; same format in every file | name + `isikukood_hash` (UUID v5 of the personal code), the same across the card, member and beneficial-owner files; foreigners: birth date |
| Natural-person legal forms | individual enterprise, general and limited partnerships of natural persons; self-employed people are not in the register | `IK`, `ZEM`, `ZVJ`, `IND`, `GIM` | FIE (sole trader) |
| Change feed | daily full files; the API has a `/:changes` feed | daily full snapshots, no deltas | daily full snapshots; the change list is only in the contract API |
| Terminated entities | move to the deregistered file | stay, with a terminated date and closure code | stay while in liquidation or bankruptcy; **vanish when deleted** |
| As-of date | `formavimo_data` column; social-insurance files have an as-of line | not stated: CKAN `last_modified` or max date in the data | HTTP Last-Modified only; annual reports carry the cut-off in the file name |
| History | current name, address and status only | current roles only (ended roles vanish); name history file stale; statements back to 2006 | current roles only; no deleted companies; statements 2019-2025 |
| Deep link to an official page | none (the search form needs a check number) | unknown (the official lookup site is a single-page app) | `https://ariregister.rik.ee/eng/company/<code>`, given per entity |
| Labels in English | legal forms and statuses yes; activity labels Lithuanian | role and type enums in English; legal forms Latvian | Estonian only in the files; NACE codes next to EMTAK give English via Eurostat |

**What this means for the loader:**
- Validate every code with its check digit.
- Derive our own change history from daily snapshots.
- Key LV people on (name, masked code) and EE people on the hash, and accept that LV keys can collide (same name and birth date).
- Never key on an LT person: there is none.

## Lithuania (LT)

- **The register is open and daily, but has no people.** The Register of Legal Entities (JAR) publishes daily
  CSV files direct from Registrų centras with name, code, legal form, status and full address text. The copy of
  the same data on the national API (get.data.gov.lt) is loaded irregularly: its newest load is 28 days old and the
  change log shows gaps of up to six months. Use the daily files.
- **No names of managers, members or beneficial owners anywhere in open data** (confirmed). The open files give
  only: "has a manager" + since-date + the manager's gender, board/council flags with member counts by gender, and
  counts of members by type (natural/legal, domestic/foreign; last loaded 2025-09). Names are paid extracts.
- **Money data is strong:** P&L and balance sheet key lines (13 P&L lines, 9 balance lines, not full statements),
  annual taxes paid, daily tax arrears, daily social-insurance debts, daily insured-person counts, monthly average
  wage (only where > 3 insured), VAT status, bankruptcy reports.
- **Weak:** procurement (open supplier codes end in May 2023), EU funds (2014-2020 period only), courts (no bulk),
  pledges and property arrests (open data is pseudonymised and stale since 2023), official notices (not found as
  open data).
- **Licence:** every data.gov.lt dataset page checked shows "Creative Commons Attribution 4.0" (CC BY 4.0). The
  Sodra daily files carry no licence statement; they are public by law (Law on State Social Insurance, art. 15(3)).

### JAR daily files (Registrų centras)
- Publisher and official URL: Registrų centras, `https://www.registrucentras.lt/aduomenys/?byla=<FILE>.csv`
  (FILE = JAR_IREGISTRUOTI, JAR_ISREGISTRUOTI, JAR_VALDYMAS, JAR_KAPITALAS, JAR_NVO). The data.gov.lt dataset pages
  list these URLs as their CSV distributions.
- Access: bulk file, no auth, no paging; pipe-delimited UTF-8 CSV, whole file per request.
- Fields: IREGISTRUOTI: `ja_kodas` (int, 9 digits), `ja_pavadinimas`, `adresas` (full text), `ja_reg_data`,
  `form_kodas`/`form_pavadinimas`, `stat_kodas`/`stat_pavadinimas`, `stat_data_nuo`, `formavimo_data`.
  ISREGISTRUOTI adds `isreg_data`. VALDYMAS: manager flag, since-date, gender, board / supervisory board / council
  flags, dates and member counts by gender. KAPITALAS: share capital, currency, since-date (UAB and AB only).
- Rows and coverage: registered 236,455 (231,716 with no legal proceedings; 188,099 of those are business forms),
  deregistered 316,076, management bodies 235,095, capital 102,641. 0.0% null on name, code, address, dates.
- Freshness: daily; `formavimo_data` = the pull date (2026-11-19); newest registration date in the file is the day
  before. Current.
- Size and speed: 40.9 + 42.6 + 25.4 + 15.6 MB; each parses in < 0.6 s. No ETag or Last-Modified (Cloudflare,
  `Cache-Control: private`): the as-of date is the `formavimo_data` column. No delta file. Changes measured against
  the API copy (cut-off 2026-10-02): 2,048 new registrations, 618 deregistrations, 2,901 status changes in 48 days.
  Day-over-day diff: snapshot of 2026-11-19 kept (`diff_pulls.py`); second pull pending.
- Join keys: `ja_kodas`, 9 digits, mod-11 check digit (same algorithm as Lithuanian personal codes; 552,531 of
  552,531 valid), 100% filled. Joins 1:1 to tax, social-insurance, bankruptcy and EU-funds files.
- Person identity: none in these files. Sole proprietorships (individuali įmonė) and partnerships carry the owner's
  name inside the company name.
- Licence: "Creative Commons Attribution 4.0", data.gov.lt dataset pages for the register (1484) and management
  bodies (1564), verified 2026-11-19.
- Keys, limits, cost: none observed for the files. (The free per-company search page is limited to 100 searches per
  day and is not used.)
- Legal constraints: manager gender + since-date on a one-manager company is personal data about an identifiable
  person; sole-proprietorship names contain personal names. See the legal memo.
- Tested with: `fetch_uapi.py` (API copy), direct downloads, `profile_csv.py`, `diff_pulls.py`, `build_profiles.py`.
- Verdict: **use** as the LT register backbone (grade A).
- a. Primary key: `ja_kodas`, 9 digits, mod-11 check digit, issued for life; deregistered codes stay in
  ISREGISTRUOTI and no code appears in both files (0 overlap), so no reuse observed.
- b. Join keys: LEI via GLEIF `registeredAs` (RA000430): 2.5% of active business-form companies have an LEI.
  VAT number is not embedded: map via the tax-payer register (`pvm_kodas`, 9 or 12 digits).
- c. No row ID for management-body rows; key = `ja_kodas` (one row per company).
- d. No person identity.
- e. Natural-person forms: 810 Individuali įmonė (sole proprietorship), Tikroji ūkinė bendrija and Komanditinė
  ūkinė bendrija (partnerships of natural persons). Individual activity (self-employed) is not in JAR at all.
- f. Full snapshot daily; deregistered companies move from IREGISTRUOTI to ISREGISTRUOTI (they do not vanish).
- g. As-of date in the `formavimo_data` column.
- h. No history: only the current name, address and status (with its start date); no ended roles.
- i. UTF-8, `|` delimiter, `"` quoting with doubled quotes, header in Lithuanian, uncompressed. Header:
  `ja_kodas|ja_pavadinimas|adresas|ja_reg_data|form_kodas|form_pavadinimas|stat_kodas|stat_pavadinimas|stat_data_nuo|formavimo_data`
- j. No stable per-company deep link: the free search page needs a form post with a check number. Link to the
  search page.
- k. Legal-form and status classifiers have Lithuanian and English labels (API `Forma.name`, `Statusas.name`).

### JAR on the national API (get.data.gov.lt, datasets/gov/rc/jar)
- Publisher and official URL: Registrų centras via the State Data Agency API, `https://get.data.gov.lt/datasets/gov/rc/jar/:ns`
- Access: API (Spinta/UAPI). `/:format/csv` streams a whole model without a limit; `limit()`, `select()`,
  `sort()`, filters (`field>="2024-01-01"`), `count()`, cursor paging (`_page.next`), and a change feed
  `/:changes/<cid>`. No key. The catalogue site (data.gov.lt) returns HTTP 429 after a few quick requests; the API
  did not throttle sequential requests. `count()` on the largest table was blocked once by a WAF page.
- Fields: 20 models. Used: JuridinisAsmuo (code, name, dates, form, status refs; address columns 100% null),
  Buveine (address refs to the address register), ValdymoOrganas (**no company key**, unusable), ja_kapitalas,
  Dokumentas (documents filed since 2024: type, subtype, document date), fa_dokumentu_nepateike / fa_veluojantys /
  fa_nepateike_auditoriu_isvadu (non-filers of statements, late filers, missing audit opinions), classifiers.
- Rows and coverage: JuridinisAsmuo 550,482 (all ever registered), Buveine 239,318, Dokumentas 202,306 (70,368
  companies), non-filers 113,081 rows (36,884 companies), late filers 19,987.
- Freshness: catalogue says monthly. Change log of JuridinisAsmuo shows loads on 2025-03-24, 2025-04-14,
  2025-05-15 (full reload), 2025-07-23, 2025-09-03, 2026-03-09, 2026-08-20 and 2026-10-22; newest registration in
  the data 2026-10-02. **Not current** (28 days since the last load, 48 days since the data cut-off, gaps up to six
  months). The lag is the publisher's load schedule, documented only as "monthly"; the daily files above are not
  affected. Classifiers: 1-3 years old (expected).
- Size and speed: JuridinisAsmuo 146 MB, 1.7 s parse, streamed in 4 s. ETag + Last-Modified, `If-Modified-Since`
  answers 304. Delta feed via `/:changes`.
- Join keys: other models reference JuridinisAsmuo by UUID `_id`, not by `ja_kodas`: 100% of statement,
  document and member-count rows resolve; 98.9% of taxes-paid rows.
- Person identity: none.
- Licence: "Creative Commons Attribution 4.0", data.gov.lt pages 1484, 1564, verified 2026-11-19.
- Keys, limits, cost: none.
- Legal constraints: as above.
- Tested with: `fetch_uapi.py`, `freshness.py`, `profile_csv.py`.
- Verdict: **use with caveat** for documents and non-filer lists only (grade B: stale); use the daily files for
  the register.
- a. Spinta `_id` UUIDs. Updates arrive as patches on the same `_id`, but a full reload on 2025-05-15 touched
  524,710 rows: whether `_id`s survive a full reload is unknown (settle by diffing two pulls across a reload).
  Key on `ja_kodas` after joining.
- c. Each row has its own UUID `_id`; document rows have no public document number.
- f. Change feed (`/:changes`, operations insert/patch/delete with timestamps).
- g. Last-Modified and change-log timestamps only.
- h. Documents: 2024 onwards. Address: one row per company with a since-date, no history.
- i. CSV with `,`, UTF-8, header = property names, nested refs as `name._id`.
- k. Classifiers: forms and statuses in LT and EN; document and fact types LT only.

### JAR financial statements (get.data.gov.lt, pelno_ataskaitos and balanso_ataskaitos)
- Publisher and official URL: Registrų centras, `https://get.data.gov.lt/datasets/gov/rc/jar/pelno_ataskaitos/PelnoAtaskaita`
  and `.../balanso_ataskaitos/BalansoAtaskaita`
- Access: API as above; filtered pull `laikotarpis_iki>="2024-01-01"` with `select()`.
- Fields: company UUID, template, standard (short / full form), `line_type_id`, `line_name`, `reiksme` (EUR,
  integer), period from / to, `reg_date` (filing registered). Only key lines: P&L 13 line types (revenue, sales
  revenue, profit before tax, net profit, for each template); balance 9 (non-current assets, current assets, equity,
  liabilities / payables, total assets for some templates). No employees line.
- Rows and coverage: P&L 6,643,810 rows in total; since 2024: 974,331 rows. Balance since 2024: 1,827,948 rows.
  Companies with a statement for a period ending in 2024: 151,967 (P&L) / 156,260 (balance); 2025: 57,460 /
  158,400. Business-form companies with any 2024+ statement: 75.7%; revenue 55.8%; net profit 61.6%; total assets
  71.8%; equity 72.7%.
- Freshness: catalogue says weekly; Last-Modified 2026-10-26 (balance) and 2026-10-28 (P&L). Not current against
  the stated weekly cadence. Annual data, so a month of lag matters little, except during the filing season.
- Size and speed: 2024+ pulls 126 MB (208 s) and 226 MB; parse 1.7 s and 3.1 s. Validators as above.
- Join keys: company UUID → JuridinisAsmuo: 100% of 2024+ statement rows resolve.
- Person identity: none. Sole-proprietorship and partnership names are anonymised in these datasets.
- Licence: "Creative Commons Attribution 4.0", data.gov.lt pages 1666 and 1806, verified 2026-11-19.
- Keys, limits, cost: none.
- Legal constraints: none beyond attribution.
- Tested with: `fetch_uapi.py`, `build_profiles.py`.
- Verdict: **use** (grade B: key lines only, monthly loads).
- h. Statements back to the 2010s in the full table (not pulled in full: 6.6M P&L rows).
- i. Line names are upper-case Lithuanian; the same concept has several line IDs, one per template (mapping in the
  dictionary).

### JADIS members counts (get.data.gov.lt, datasets/gov/rc/jadis)
- Publisher and official URL: Registrų centras, `https://get.data.gov.lt/datasets/gov/rc/jadis/dalyviai/Dalyvis`
- Access: API as above.
- Fields: company UUID, counts of members: Lithuanian natural persons, Lithuanian legal persons, foreign natural
  persons, foreign legal persons. No names, no shares.
- Rows and coverage: 172,845 companies; 81.3% of active business-form companies.
- Freshness: last load 2025-09-04 (441 days). **Not current.**
- Size and speed: 40 MB, 0.4 s parse.
- Join keys: UUID → JuridinisAsmuo.
- Person identity: none (counts only).
- Licence: "Creative Commons Attribution 4.0", data.gov.lt pages 1710 (member lists) and 1711 (state members),
  verified 2026-11-20. Stated cadence monthly; the last load is 441 days old.
- Verdict: **use with caveat** (grade C: stale, counts only). Shows "has foreign owners" only.

### Tax-payer register (VMI, datasets/gov/vmi/mm_registras)
- Publisher and official URL: State Tax Inspectorate (VMI), `https://get.data.gov.lt/datasets/gov/vmi/mm_registras/MokesciuMoketojas`
- Access: API as above.
- Fields: `ja_kodas`, name, registration / deregistration dates, tax-payer type, VAT prefix + `pvm_kodas`, VAT
  registered / deregistered dates, branches (number, name, municipality), economic activity (ref to the activity
  classifier), activity start / end, main-activity flag.
- Rows and coverage: 931,744 rows (one per company × branch × activity); 297,097 companies.
- Freshness: daily (catalogue: "Kasdien"); last load 2026-11-19. Current.
- Size and speed: 351 MB, 4.7 s parse. Change feed shows 2,000-22,000 patches per day.
- Join keys: `ja_kodas` 100% filled. VAT: 64.4% of active business-form companies have a VAT code; 42.9% of all
  active companies are VAT-registered today.
- Person identity: none (legal persons only).
- Licence: "Creative Commons Attribution 4.0", data.gov.lt page 607, verified 2026-11-19.
- Verdict: **use** (grade A) for VAT status and activity.
- k. Activity classifier (EVRK, the national NACE) labels: Lithuanian in the tax and social-insurance files.

### Taxes paid (VMI, datasets/gov/vmi/ja_mokesciai)
- Publisher and official URL: State Data Agency / VMI, `https://get.data.gov.lt/datasets/gov/vmi/ja_mokesciai/Moketojas`
- Access: API as above.
- Fields: company UUID (`mm_kodas`), name, type, county / municipality, year, month (12, or 10 for the current
  year), `suma` = taxes paid in the year to that month (EUR).
- Rows and coverage: 744,645 rows, years 2021-2026 (113,902-132,480 companies per year). 76.5% of active
  business-form companies have a value.
- Freshness: monthly per the catalogue; last load 2026-11-17 with data to October 2026. Current.
- Size and speed: 236 MB, 2.9 s parse.
- Join keys: `mm_kodas` is the JAR UUID (not the tax-payer register ID): 98.9% resolve.
- Licence: "Creative Commons Attribution 4.0", data.gov.lt page 673, verified 2026-11-19.
- Verdict: **use** (grade A).
- h. Six years.

### Tax arrears (VMI, datasets/gov/vmi/ja_nepriemokos)
- Publisher and official URL: VMI, `https://get.data.gov.lt/datasets/gov/vmi/ja_nepriemokos/NepriemokosSuma`
- Access: API as above.
- Fields: `ja_kodas`, name, municipality, arrears, overdue arrears, deferred arrears, deferred overdue, created /
  updated dates.
- Rows and coverage: 31,989 companies with arrears on the list date; 27,237 active companies with overdue
  arrears > 0. List-based: absence means no arrears.
- Freshness: daily; last load 2026-11-19 07:03 UTC. Change feed: about 6,700-7,400 inserts, patches and deletes
  per day. Current.
- Size and speed: 6.8 MB, 0.1 s.
- Join keys: `ja_kodas` 100%.
- Licence: "Creative Commons Attribution 4.0", data.gov.lt page 1202, verified 2026-11-19.
- Legal constraints: includes sole proprietorships (names contain personal names).
- Tested with: `fetch_uapi.py`; the split between tax arrears (11.8% of active companies), social-insurance debt (15.4%) and both (5.2%) with `python -I research/probes/baltics/lt/debt_split.py`.
- Verdict: **use** (grade A).
- f. Current list only; a company that pays leaves the list (delete in the change feed). Keep our own history.

### Social insurance (Sodra): daily insured count, daily debts, monthly averages
- Publisher and official URL: State Social Insurance Fund Board (Sodra), page `https://sodra.lt/viesi-draudeju-duomenys`;
  files `https://sodra.lt/Failai/Apdraustuju_skaicius.zip`, `.../Skolos.zip`, `.../Vidurkiai.zip`; yearly
  monthly file `https://atvira.sodra.lt/imones/downloads/<year>/monthly-<year>.csv.zip` (also `.json.zip`).
- Access: bulk ZIP, no auth.
- Fields: daily insured: tax-payer code, insurer code, insured persons. Daily debts: tax-payer code, insurer code,
  debt, deferred amount. Yearly monthly file: insurer code, `jarCode`, name, municipality, activity code + label,
  month, average wage, insured, average wage II, insured II, contributions.
- Rows and coverage: insured 108,024 employers; debts 37,592; monthly 2026 file 945,868 rows (Jan-Sep 2026).
  Active companies with insured persons: 46.4% (48.6% of business forms). Average wage published only where more
  than 3 insured: 61.4% of monthly rows have no wage; 18.8% of active business-form companies have one.
- Freshness: insured and debts daily (file headers state "as of 2026-11-19 start of day" and "debtors on
  2026-11-18"); averages monthly for the previous month; yearly file updated 2026-10-26. Current.
- Size and speed: ZIPs 0.75 MB, 0.41 MB, 1.4 MB; monthly 12 MB zipped, 143 MB CSV, 1.8 s parse. sodra.lt sends an
  ETag and a Last-Modified that is later than the server time (unreliable); the as-of date is the first line of
  each file.
- Join keys: tax-payer code = `ja_kodas` for legal persons; monthly file `jarCode` 0.6% null.
- Person identity: none for legal persons. Insurers that are natural persons appear with an insurer code only.
- Licence: **no licence statement** on the official page; publication is required by the Law on State Social
  Insurance, art. 15(3) ("vieši duomenys"). Checked 2026-11-19. Settle with Sodra or the legal seat.
- Legal constraints: suppression rules built in (wage only for > 3 insured; gender split only for ≥ 8 with > 3 of
  each). Sodra lists dates when debts were not published or were wrong (bank statements missing).
- Tested with: direct downloads, `profile_csv.py`, `diff_pulls.py`, `build_profiles.py`.
- Verdict: **use with caveat** (grade B: licence unstated).
- i. Daily files: cp1257 (Windows Baltic), `;` delimiter, title line + header + dashed line, comma decimals,
  space-padded numbers. Averages file has a 7-line multi-row header. Yearly file: UTF-8 with BOM, `;`, bilingual
  header. Header of the daily debts file: `Mokesčių mokėtojo kodas;Draudėjo kodas;Skola;Atidėta suma`.
- j. Per-company page exists on atvira.sodra.lt (by insurer code); pattern to confirm.

### Bankruptcy and restructuring reports (AVNT, datasets/gov/avnt)
- Publisher and official URL: Audit, Accounting, Property Valuation and Insolvency Management Authority (AVNT),
  `https://get.data.gov.lt/datasets/gov/avnt/imoniu_bankrotas/BankrotoAtaskaitosDatos`, `.../tyciniai_bankrotai/TycinisBankrotas`
- Access: API as above.
- Fields: company code, name, territory, legal form, activity code + label, bankruptcy initiator, bankruptcy date,
  court, out-of-court procedure date, termination date and reason, liquidation date, simplified procedure, intentional
  bankruptcy date, end decision, deregistration date. Intentional bankruptcies: 835 rows since 1994.
- Rows and coverage: 5,937 rows (5,592 companies), bankruptcies opened 2020-01 to 2025-10.
- Freshness: stated quarterly; last load 2026-09-19 (current by load date), but the newest event is 2025-10-03,
  so the content is about a year behind. The register status (daily) shows bankruptcy first.
- Join keys: company code 100%.
- Licence: "Creative Commons Attribution 4.0", data.gov.lt pages 1979 (bankruptcy reports) and 1334 (intentional
  bankruptcies), verified 2026-11-20.
- Verdict: **use with caveat** (grade B) for the bankruptcy timeline; status comes from the daily register.

### Public procurement (VPT, datasets/gov/vpt)
- Publisher and official URL: Public Procurement Office (VPT), `https://get.data.gov.lt/datasets/gov/vpt/:ns`
- Access: API as above.
- Fields: report forms (Atn-1, Atn-2, AtGn-1, AtK-1) with tenderer lists (`code`, name, address, country,
  private-person flag; the `selected_tenderer` column is 100% empty, so the winner is not identified) and contract lists (`tenderer_code` on some forms); contract register `VptNSutartys`
  (2.57M rows to 2026-01-28) **without supplier code**.
- Rows and coverage: Atn-1 tenderers 226,557 rows; 4.5% of active business-form companies appear as tenderers.
- Freshness: report forms last loaded 2023-05-22 (the procurement system changed in 2023); contract register
  2026-01-28. **Not current.**
- Join keys: tenderer `code` 1.7% null; can be a foreign code.
- Licence: "Creative Commons Attribution 4.0" on data.gov.lt page 390 (procurements before 2017-07-01, "not
  updated"), verified 2026-11-20; the post-2017 dataset page not yet read (unknown; settle by reading its page).
- Verdict: **use with caveat** (grade C): history to 2023 only. Current contracts need TED (EU) or the new CVP IS
  (no open supplier-level export found).

### EU funds 2014-2020 (Ministry of Finance, datasets/gov/finmin/sutartys)
- Publisher and official URL: Ministry of Finance, `https://get.data.gov.lt/datasets/gov/finmin/sutartys/Contract`
- Fields: project contract, `executor` (name), `executor_code`, legal form, county, municipality, dates, state aid
  flags, amounts.
- Rows and coverage: 25,981 contracts, 8,880 executor codes; 3.2% of active business-form companies.
- Freshness: Contract loaded 2026-11-01; other tables 2023-06. Projects started 2015-2022. The 2021-2027 period is
  not in this dataset.
- Licence: "Creative Commons Attribution 4.0", data.gov.lt page 2161, stated cadence "Neatnaujinamas" (not
  updated), verified 2026-11-20.
- Verdict: **use with caveat** (grade B for 2014-2020; 2021-2027 via Kohesio, see the cross-border entry).

### Property arrests (TAAR) and mortgages (HR archive)
- Publisher: Registrų centras, `https://get.data.gov.lt/datasets/gov/rc/taar/:ns`, `.../rc/hr/:ns`
- Fields: arrest acts, debtors and creditors with an internal pseudonymous ID (`skolininkoid`), no company code;
  amount bands. The mortgage register is a liquidated archive.
- Rows: 573,653 arrest acts, 31,371 legal-person debtors.
- Freshness: last loads 2023-06-15 and 2025-09-04. **Not current.**
- Verdict: **skip** (grade D): cannot be joined to a company; the live register is paid.

### Not available as open data (checked)
- Managers', members' and beneficial owners' names (JAR extracts and the beneficial-owner register JANGIS are paid or
  need a legitimate interest).
- Court cases: no bulk data (the courts' search portal is per query). Grade D for bulk; agents may search at query time.
- Official notices: not found as open data. Commercial pledges and live property arrests: paid.

### Freshness of every LT API model checked (`freshness.py`, 2026-11-19)

189 models under the register (JAR, JADIS, TAAR), tax authority (all VMI), insolvency authority (AVNT),
procurement (VPT) and EU-funds (Ministry of Finance, CPVA) namespaces; age = days since the newest change-log entry.

| Age | Models | Includes |
|---|---|---|
| 0-2 days | 2 | tax-payer register, tax arrears |
| 3-35 days | 15 | register (28), management bodies (24), financial statements (24-27), documents, non-filers, EU-funds contracts (18) |
| 36-180 days | 29 | AVNT bankruptcy reports (61), VMI declarations and property/land tax data |
| 181-500 days | 22 | JADIS member counts (441), intentional bankruptcies (379), classifiers |
| > 500 days | 107 | TAAR arrests (1,253), VPT report forms (1,300), EU-funds detail tables (about 1,255), old classifiers |
| error | 14 | HTTP 500 on the change log or namespace (taxes paid: Last-Modified 2026-11-17 instead) |

## Latvia (LV)

Measured 2026-11-19 and 2026-11-20 (two consecutive daily pulls). Population for fill rates: Commercial Register entities (register type `K`) that are neither closed nor terminated: **154,704** (SIA 140,485 · IK 12,146 · AS 765 · other 1,308).

Summary:
- Everything a company report needs, except courts and official notices, comes from bulk CSV on data.gov.lv (CKAN), with no key, and is updated daily, under **CC0-1.0**.
- One full pull of the 20 company files we use is about **1.03 GB** and takes 9.5 minutes to parse and hash single-threaded in stdlib Python. Between two daily pulls, 0.01-0.2% of rows change.
- **Joint-stock shareholders are gone.** The `stockholders` package still exists in the portal's CKAN, but `package_show` returns "Authorization Error" (private) and the dataset page returns 404. `members.csv` holds limited-company (SIA) members only: 0 of 765 active AS have member rows. This matches the Constitutional Court judgment of 9 Nov 2026 (case 2024-01-01), which ended public access to natural-person shareholder data of joint-stock companies, following CJEU C-798/24.
- **Beneficial owners are still published.** The file is CC0, refreshed daily and has 200,800 rows. Since 1 July 2026 a beneficial owner can ask for concealment (one-month interim concealment within one working day). The register's notice says this restricts "public and free availability". It does not say how concealed entries appear in the bulk file, so we can't see whether they are dropped. The legal memo must decide whether we display these at all (CJEU C-37/20, C-601/20).
- **Tax debt amounts are not open.** The tax authority's debtor database is per query, needs the name and code, sits behind a CAPTCHA, and is purpose-limited by law. The open proxy is the tax authority's taxpayer rating: C means "violations in meeting tax obligations". Rating C covers 5.4% of active companies.
- **The masked personal code is not anonymous.** The format is `DDMMYY-*****`. For 91-97% of person rows it is a pre-2017 code whose first six digits are the date of birth. Only 2-3% are new-style codes starting with `32`, which carry no date.

### Enterprise Register: register of entities (`uz`, register.csv)
- Publisher and official URL: Register of Enterprises of the Republic of Latvia (Uzņēmumu reģistrs); https://data.gov.lv/dati/lv/dataset/uz
- Access: bulk CSV, one file, no paging; CKAN API `package_show` for metadata.
- Fields: regcode (int, 11 or 9 digits), name, name parts (before, in and after quotes), regtype + regtype_text, type + type_text (legal form), registered (date), terminated (date), closed (`L` liquidated / `R` reorganised / blank), address, index, addressid (address-register ID), region, city, atvk (territory code), sepa (creditor ID).
- Rows and coverage: 490,496 entities of every register (Commercial 318,129; Enterprise journal 127,426; associations and foundations 32,676; others). 154,704 are active Commercial Register entities. Terminated entities stay in the file (259,230 `L`, 8,398 `R`).
- Freshness: stated daily. Observed: regenerated nightly around 21:26 UTC on both days, with the latest `registered` date in the data at 2026-11-17, a lag of 1-2 days. Current.
- Size and speed: 129 MB; parse+hash 28 s; 43 rows added, 0 removed and 56 changed between the 19 Nov and 20 Nov pulls. ETag and Last-Modified are present, but the ETag embeds the regeneration time and changes daily even without content changes, so diffs must be by content (`diff_pulls.py`). No delta files.
- Join keys: regcode is 100% filled and unique. All 456,256 eleven-digit codes pass the checksum (weights 9,1,4,8,3,10,2,5,7,6; check digit = (3 - sum) mod 11). The 34,240 nine-digit codes are legacy journal entries.
- Person identity: none in this file, but sole-trader (IK) and farm names usually contain the owner's name.
- Licence: "CC0-1.0" (dataset page, Licence field); https://data.gov.lv/dati/lv/dataset/uz; verified 2026-11-19.
- Keys, limits, cost: none; free; no key.
- Legal constraints: sole-trader names are personal data.
- Tested with: `research/probes/baltics/lv/01_ckan_download.py`, `03_profile_csv.py`, `05_population.py`, `diff_pulls.py`.
- Verdict: use. This is the identity spine for LV.
- a. Primary key: regcode, 11 digits with a checksum. It was unique in our pull, and we found no evidence that codes are reissued; the register's own rule on reuse is unknown, and a statement from the register would settle it.
- b. VAT number = `LV` + regcode, embedded (97.6% of VAT rows match a register code). LEI is mapped via GLEIF `registeredAs` (authority `RA000423`); 4,449 LEIs have an LV legal address, an upper bound of 2.9% of active companies. Tax-authority files use the same code: 98.6% of the quarterly file's codes and 100% of the rating file's codes are found in the register. Financial statements: 100%.
- c. Own record ID: regcode.
- d. Person identity: n/a.
- e. Natural-person forms: `IK` (sole trader), `ZEM` (farm), `ZVJ` (fishing farm), `IND` (individual enterprise), and `GIM` (family enterprise).
- f. Change feed: full daily snapshot. Terminated entities stay, with a terminated date and a closed code.
- g. As-of date: not stated in the file or its name. Use CKAN `last_modified`, HTTP Last-Modified, or the max date in the data.
- h. History: current name and address only. Name history is a separate file, which is stale (see below). There is no address history.
- i. Quirks: UTF-8, `;`-delimited, English snake_case headers, legal-form labels in Latvian. Header: `regcode;sepa;name;name_before_quotes;name_in_quotes;name_after_quotes;without_quotes;regtype;regtype_text;type;type_text;registered;terminated;closed;address;index;addressid;region;city;atvk;reregistration_term`
- j. Deep link: the free official lookup at info.ur.gov.lv searches by name or code. A per-entity URL pattern is unknown (single-page app); opening the site in a browser would settle it. Linking terms: unknown.
- k. Labels: legal-form and register-type labels are in Latvian only.

### Enterprise Register: officers (officers.csv)
- Publisher and official URL: Register of Enterprises; https://data.gov.lv/dati/lv/dataset/officers
- Access: bulk CSV.
- Fields: id, at_legal_entity_registration_number, entity_type (NATURAL_PERSON / LEGAL_ENTITY / FOREIGN_ENTITY), position (15 English enums, e.g. BOARD_MEMBER, CHAIR_OF_BOARD, LIQUIDATOR), governing_body (10 enums), name, latvian_identity_number_masked, birth_date (foreigners), legal_entity_registration_number, rights_of_representation_type, representation_with_at_least, registered_on, last_modified_at.
- Rows and coverage: 283,330 rows. 97.8% of active companies have at least one officer (SIA 98.7%, IK 92.4%). `position` is empty in 29% of rows, mostly association executive bodies and sole traders.
- Freshness: daily; the latest registered_on is 2026-11-17. Current.
- Size and speed: 40 MB; 24 s; 130 added, 102 removed and 1 changed per day.
- Join keys: at_legal_entity_registration_number (100%).
- Person identity: name + masked code `DDMMYY-*****` (93.1% of rows). Of those, 257,332 are legacy codes that reveal the birth date and 6,527 are new-style `32…` codes. Foreigners have a `birth_date` (2.6%). There is no register-internal person ID.
- Licence: "CC0-1.0"; dataset page; verified 2026-11-19.
- Keys, limits, cost: none.
- Legal constraints: personal data (names, birth date via the code). Show only in company context (feasibility rule; legal memo).
- Tested with: `01`, `03`, `05`, `06`.
- Verdict: use with caveat. Current officers only, and the masked code needs handling (see d).
- c. Own record ID: `id` (stable across our two pulls: 1 changed and 102 removed out of 283k).
- d. The same masked format is used in members, beneficial owners and the register's sanctions file, so name + masked code links one person across files and companies. It is not unique by construction: two people with the same name and birth date collide.
- f. Ended roles vanish: the file has no end date, and 102 rows disappeared in one day.
- h. History: none. Current roles only. registered_on dates go back to 1990.
- i. Header: `id;uri;at_legal_entity_registration_number;entity_type;position;governing_body;name;latvian_identity_number_masked;birth_date;legal_entity_registration_number;rights_of_representation_type;representation_with_at_least;registered_on;last_modified_at`. `uri` is 100% empty.
- k. Role labels are English enums only; Latvian labels are not in the file.

### Enterprise Register: members (members.csv, members_joint_owners.csv)
- Publisher and official URL: Register of Enterprises; https://data.gov.lv/dati/lv/dataset/members
- Access: bulk CSV (2 files).
- Fields: id, at_legal_entity_registration_number, entity_type, name, latvian_identity_number_masked, birth_date, legal_entity_registration_number, number_of_shares, share_nominal_value, share_currency (EUR/LVL), date_from, registered_on, last_modified_at; joint owners: member_id → co-owners.
- Rows and coverage: 186,535 rows (+507 joint owners), **SIA only**. Every active SIA has members (100%); that is 90.8% of all active companies. JSC (AS) shareholders: 0.
- Freshness: daily; current.
- Size and speed: 25 MB; 25 s; 113 added, 83 removed and 12 changed per day.
- Join keys: at_legal_entity_registration_number 100%. legal_entity_registration_number for corporate members (6% of rows) gives parent → subsidiary links: 11.0% of active companies have a corporate member or are one.
- Person identity: same as officers (87.9% masked code).
- Licence: "CC0-1.0"; verified 2026-11-19.
- Legal constraints: natural-person members of an SIA are still public by law. The 9 Nov 2026 judgment covers joint-stock shareholders; whether it will extend to SIA members is a question for the legal memo.
- Tested with: `01`, `03`, `05`, `06`.
- Verdict: use with caveat (personal data; ownership shares need number_of_shares × nominal summed per company).
- c. Own record ID: `id`. 12 duplicate ids were found in one pull.
- f. Members who leave vanish (no end date).
- i. Header: `id;uri;at_legal_entity_registration_number;entity_type;name;latvian_identity_number_masked;birth_date;legal_entity_registration_number;number_of_shares;share_nominal_value;share_currency;date_from;registered_on;last_modified_at`

### Enterprise Register: joint-stock company shareholders (`stockholders`)
- Publisher and official URL: Register of Enterprises; the dataset slug `stockholders` exists in data.gov.lv CKAN.
- Access: **none**. On 2026-11-19 `package_show?id=stockholders` returned "Authorization Error … not authorised to read package"; the page returns 404; a portal search for shareholder datasets returns 0 hits.
- Legal constraints: Constitutional Court judgment of 9 Nov 2026, case 2024-01-01. The norms that let anyone obtain joint-stock shareholders' personal data without justification lose force on publication; the shareholder register section is moving to the non-public part of the file. CJEU C-798/24 (3 Sep 2026).
- Verdict: skip (grade D). Legal-entity shareholders may return later; watch the portal.

### Enterprise Register: beneficial owners (beneficial_owners.csv)
- Publisher and official URL: Register of Enterprises; https://data.gov.lv/dati/lv/dataset/patiesie-labuma-guveji
- Access: bulk CSV.
- Fields: id, legal_entity_registration_number, forename, surname, latvian_identity_number_masked, birth_date, nationality, residence (country), registered_on, last_modified_at.
- Rows and coverage: 200,800 rows for 164,795 entities. 90.4% of active companies have a beneficial owner (SIA 98.6%, AS 84.1%).
- Freshness: daily; the latest registered_on is 2026-11-17. The dataset page's "last data change" metadata says 2024-07-01, which is stale metadata; the resource itself is regenerated daily.
- Size and speed: 18 MB; 139 added, 107 removed and 0 changed per day.
- Join keys: legal_entity_registration_number 100%.
- Person identity: name + masked code (95.3%); birth_date for foreigners (4.7%); nationality.
- Licence: "CC0-1.0"; verified 2026-11-19. The page cites the legal basis for publishing natural persons' data: Law on the Enterprise Register, section 4.10(12).
- Legal constraints: concealment on request since 1 July 2026 (the register's notice of 8 July 2026). It restricts public and free availability; the competent authorities keep access. CJEU C-37/20 and C-601/20 invalidated general public access under the AML directive. Legal memo to decide display.
- Verdict: use with caveat, pending the legal memo (candidate X).
- f. Removed owners vanish. The concealment effect on the bulk file is unknown; diffing pulls over weeks and checking a concealed case would settle it.
- i. Header: `id;legal_entity_registration_number;forename;surname;latvian_identity_number_masked;birth_date;nationality;residence;registered_on;last_modified_at`

### Enterprise Register: status, events and encumbrances (liquidations, reorganizations, securing-measures, suspensions-prohibitions, equity-capitals, memorandum-date, legal-entity-duration, special-statuses, register_name_history)
- Publisher and official URL: Register of Enterprises; data.gov.lv organisation `ur` (29 datasets, all "CC0-1.0", verified 2026-11-19).
- Access: bulk CSV each.
- Fields: liquidations (liquidation_type 6 enums, date_from, grounds); reorganizations (type 6 enums, source and final regcode, date); securing measures (type ATTACHMENT / LIEN / PROHIBITION, details, date_from, case_number, institution: court, bailiff or tax authority); suspensions (3 enums, date_from, ground_for); equity capitals (type, amount, currency, date_from); memorandum dates; duration; name history (regcode, date_to, name).
- Rows and coverage: liquidations 9,651; reorganizations 10,930; securing measures 34,337 (2.1% have no regcode); suspensions 10,602; equity 144,550; name history 90,974. Together with the tax-authority suspensions, 12.3% of active companies have ever had a securing measure or suspension.
- Freshness: daily, except **name history, last modified 2025-04-02 (stale, 19 months)**.
- Size and speed: 0.9-15 MB each; 7-61 rows added per day.
- Join keys: legal_entity_registration_number 97.9-100%.
- Person identity: none, except free text in grounds.
- Licence: "CC0-1.0"; verified 2026-11-19.
- Verdict: use. Securing measures carry no amount and no creditor name.
- f. Securing measures that are lifted vanish (35 removed per day); there is no end date.
- k. Type labels: English enums + Latvian text.

### Enterprise Register: insolvency proceedings (insolvency_legal_person_proceeding.csv)
- Publisher and official URL: Register of Enterprises (Insolvency Register); https://data.gov.lv/dati/lv/dataset/maksatnespejas-procesi
- Access: bulk CSV (+ a legacy XLSX link dated 2020, not maintained).
- Fields: proceeding_id, debtor_name, debtor_registration_number, debtor_address, proceeding_started_on, proceeding_ended_on, proceeding_form (INSOLVENCY / LEGAL_PROTECTION / OUT_OF_COURT_LEGAL_PROTECTION), proceeding_type, resolution type and name, court_case_initial_number, court_code, court_name, creditor-claim deadlines.
- Rows and coverage: 18,070 proceedings, 2008-01-03 to 2026-11-16. 0.9% of active companies have one; 0.5% have an open one.
- Freshness: daily; 3 added and 2 changed per day.
- Join keys: debtor_registration_number 100%. court_case_initial_number gives a court case link (99.7%).
- Person identity: legal persons only. The administrator is not in the file.
- Licence: "CC0-1.0"; verified 2026-11-19.
- Verdict: use. History is kept, with end dates.

### Annual report financial data (gada-parskatu-finansu-dati)
- Publisher and official URL: Register of Enterprises (State Revenue Service EDS filings); https://data.gov.lv/dati/lv/dataset/gada-parskatu-finansu-dati
- Access: bulk CSV, 4 files joined by statement id.
- Fields: financial_statements (id, file_id, regcode, source_schema, source_type, year, year start and end, employees, rounded_to_nearest ONES/THOUSANDS, currency EUR/LVL, created_at); balance_sheets (18 lines: cash, receivables, inventories, fixed assets, total_assets, current and non-current liabilities, provisions, equity …); income_statements (28 lines: net_turnover, by-nature or by-function costs, interest, income before and after tax, net_income); cash_flow_statements (37 lines, direct or indirect).
- Rows and coverage: 1,986,890 statements for 254,771 entities, years 2006-2026. Among active companies: 74.1% have a statement for 2024 or later (2025: 107,434; 2024: 7,168); 57.8% report employees > 0; only 9% have a cash-flow statement.
- Freshness: daily (created_at up to 2026-11-18). Statements arrive as filed; the deadline is 4-7 months after year end.
- Size and speed: 521 MB in total; parsing takes 5.3 min (the largest share). 40-55 new statements per day.
- Join keys: regcode 100%.
- Person identity: none.
- Licence: "CC0-1.0"; verified 2026-11-19.
- Verdict: use. Check `rounded_to_nearest` and `currency` (LVL before 2014). There are several statements per year (corrections, consolidated): take the latest created_at.
- c. Own record ID: statement `id`, file_id.
- h. History: up to 20 years.
- i. Headers: English snake_case.

### State Revenue Service: taxes paid and employees (quarterly and yearly)
- Publisher and official URL: State Revenue Service (VID); https://data.gov.lv/dati/lv/dataset/nodoklu-maksataju-taksacijas-ceturksni-samaksato-vid-administreto-nodoklu-kopsummas and …/komersantu-ieprieksejos-tris-taksacijas-gados-samaksato-vid-administreto-nodoklu-kopsummas
- Access: bulk CSV.
- Fields: quarterly (code, name, quarter label in Latvian text, taxes paid in kEUR, of which VAT paid, VAT refunded, personal income tax, social contributions, average employees); yearly (code, name, tax year, legal form, main NACE code, territory code and name, taxes paid kEUR, personal income tax, social contributions, average employees).
- Rows and coverage: quarterly 462,376 rows (2026 Q1-Q3, about 155k payers each); yearly 291,512 rows (tax years 2023 and 2024 only, although the title says "three years"). In the latest quarter, among active companies, 56.0% paid tax ≠ 0 and 53.5% had employees > 0. NACE is available for 87.1%.
- Freshness: the quarterly file updates after each quarter (last modified 2026-11-03, with Q3 2026 present); yearly once a year. No change between our two pulls.
- Size and speed: 46 MB each; 25-48 s.
- Join keys: Registracijas_kods (98.6% found in the register).
- Person identity: none.
- Licence: "CC0-1.0" (CKAN license_id on the dataset); verified 2026-11-19.
- Verdict: use. Average salary is not published. It can be estimated as social contributions ÷ 0.3409 ÷ employees ÷ 3 per month (derived, show with caveat; 48.3% coverage).
- i. Quirks: `,`-delimited, every field quoted, UTF-8 with BOM, Latvian headers. The quarter is the text "2026. gada 3. ceturksnis". Amounts are in thousand EUR.

### State Revenue Service: taxpayer rating (reitings_uznemumi.csv)
- Publisher and official URL: VID; https://data.gov.lv/dati/lv/dataset/nodoklu-maksataju-reitings
- Access: bulk CSV.
- Fields: code, name, rating (A / B / C / N / J), explanation (Latvian), update date.
- Rows and coverage: 145,690 companies (91.8% of active). Active companies: A 16.0%, B 40.2%, C 5.4%, N (inactive) 26.7%, J (new) 3.4%, none 8.2%.
- Freshness: the file states 2026-11-11; the CKAN record was modified 2026-11-11. Observed monthly-ish; the stated cadence is unknown.
- Licence: "CC0-1.0"; verified 2026-11-19.
- Legal constraints: the tax authority states that the rating is informative and covers tax compliance only.
- Verdict: use with caveat as the tax-debt and compliance signal (S08, S18). It is not a debt amount.

### State Revenue Service: VAT payers (pdb_pvnmaksataji_odata.csv)
- Publisher and official URL: VID; https://data.gov.lv/dati/lv/dataset/pvn-maksataji
- Access: bulk CSV.
- Fields: Numurs (`LV`+11 digits), name, active (ir/nav), registered, construction flag, VAT-139(2) flag, removed date.
- Rows and coverage: 285,909 rows (all history; 30% have a removal date). 50.5% of active companies are active VAT payers.
- Freshness: daily (CKAN 2026-11-19 06:01).
- Size and speed: 29 MB; 21 s; 12 duplicate keys.
- Licence: "CC0-1.0"; verified 2026-11-19.
- Verdict: use. It also lists natural-person VAT payers (6,747 numbers not in the register).

### State Revenue Service: activity suspensions and minimum-wage employers
- Publisher and official URL: VID; https://data.gov.lv/dati/lv/dataset/saimnieciskas-darbibas-apturesana and https://data.gov.lv/dati/lv/dataset/pdb_dd_minalgasmaksataji_odata
- Fields: suspensions (code, name, decision date, transactions banned from and until, restoration date); minimum-wage employers (code or **second part of personal code**, name or **person's name**, period).
- Rows and coverage: suspensions 72,990 (since 2012; 94.7% not restored); minimum-wage employers 4,008.
- Licence: "CC0-1.0"; verified 2026-11-19.
- Verdict: use suspensions (S09, S18). Use the minimum-wage list with caveat. It contains natural-person employers, so join to companies only.

### State Revenue Service: tax debtors database (per query)
- Publisher and official URL: VID public database; https://www.vid.gov.lv/lv/nodoklu-paradnieki (form at www6.vid.gov.lv/NPAR)
- Access: per-query form. It needs the legal name **and** the 11-digit code, sits behind a reCAPTCHA, and returns yes/no on a date plus history (debts > EUR 150). There is no bulk file; the tax authority stopped publishing lists in 2020.
- Licence: no open licence. The page states: users are "prohibited from using the data for purposes not set out in the law 'On Taxes and Fees'". Automated queries are "not prohibited", but the tax authority may throttle IPs.
- Verdict: skip for loaders (CAPTCHA). Grade C. Offer a link-out for the human to check.

### Procurement Monitoring Bureau: procurement notices (open.iub.gov.lv)
- Publisher and official URL: Procurement Monitoring Bureau (IUB); https://open.iub.gov.lv/data/notice/YYYY/MM/DD-MM-YYYY.json; catalogued on data.gov.lv (`iub`)
- Access: one bulk JSON file per day (e-forms since 25 Oct 2023), no key. Older XML archives are under /data/xml (from 2013).
- Fields: identifier, noticeType (40+ types, e.g. pil-award, contract-execution), name, cpvType, buyerData, lots[].contracts[].winners[].winnerBusinessParties[] (companyId, name, countryCode, isNaturalPerson, winnerSize, websiteURI), tenderValue, decisionDate, clonedFrom (replacement chain). The field description is in publiskie_iepirkumi_metadata.json.
- Rows and coverage: Jan-Nov 2026 has 319 daily files (379 MB) and 27,337 winner parties (411 natural persons). 4,284 distinct LV winner codes, 99.2% found in the register, which is 2.6% of active companies.
- Freshness: daily at 04:00 EET (stated); latest file 2026-11-18.
- Size and speed: about 1.2 MB per day.
- Join keys: companyId = LV regcode (filled for LV legal-entity winners).
- Person identity: natural-person winners are named, flagged isNaturalPerson.
- Licence: "CC0-1.0" (data.gov.lv dataset records for `ligumi` and `publisko-iepirkumu-pazinojumi`); the IUB page says "data can be freely downloaded … without authorisation"; verified 2026-11-19. Resolves the feasibility open question.
- Verdict: use. Keep the newest notice of each `clonedFrom` chain. Exclude natural-person winners from company views.

### Central Finance and Contracts Agency: EU-funded projects (2014-2020, 2021-2027, Recovery Fund)
- Publisher and official URL: CFLA; https://data.gov.lv/dati/lv/dataset/es-lidzfinansetie-projekti and …/eiropas-savienibas-fondu-21-27-perioda-lidzfinansetie-projekti
- Access: bulk CSV (10-11 files per period).
- Fields: project number and name, fund, applicant name, IesniedzejaRegNo, applicant website and email, status, dates, total, eligible and EU amounts; partners (RegNr); procurement contracts (contractor regcode); payments.
- Rows and coverage: 2,449 + 2,567 projects; 6,976 + 1,311 partners. 2.6% of active companies are an applicant or partner.
- Freshness: daily (CKAN 2026-11-19 00:3x); no row changes in 24 h.
- Licence: "CC0-1.0"; verified 2026-11-19.
- Verdict: use (S12). The column names differ between periods (EU amount: `EsFonduLidzfinansejums` vs `ProjektamPieskirtaisESFonduLidzfinansejums`).

### Enterprise Register: sanctions links (sanctions.csv)
- Publisher and official URL: Register of Enterprises; https://data.gov.lv/dati/lv/dataset/sanctions
- Fields: the sanctioned subject's name, masked code, birth date, nationality; the LV entity linked to it (regcode) and its role (BENEFICIAL_OWNER, SHAREHOLDER, BOARD_MEMBER …); list (EU / LV national / OFAC SDN), programme, entry date, legal basis.
- Rows and coverage: 63 rows (2024-12 to 2026-10).
- Licence: "CC0-1.0"; verified 2026-11-19.
- Verdict: use as a flag (S11). It covers only links the register has recorded. Screening against the EU and UN lists is covered under cross-border sources.

### Courts (Court Administration) and official notices (Latvijas Vēstnesis)
- Anonymised rulings (data.gov.lv `anonimizetie-nolemumi`, CC0) are a single CSV of more than 70 MB with metadata only: court, ECLI, case number, process type, date, status and a download URL. It has no party identifiers, so it can't be joined to a company without full-text matching (agent tool, later).
- The `tiesas_sedes` JSON is monthly aggregate counts (2021-2022), not hearings.
- Court case numbers do appear in insolvency (99.7%) and securing measures (97.8%), so a link-out is possible.
- Latvijas Vēstnesis official notices: not open data. Reuse needs written agreement with the official publisher, and fees under Cabinet Regulation No. 536. Grade D.

### Freshness and diffs (two consecutive pulls, 19 → 20 Nov 2026)
| File | Rows | Added | Removed | Changed | MB | Parse s |
|---|---|---|---|---|---|---|
| register | 490,539 | 43 | 0 | 56 | 129 | 28 |
| officers | 283,358 | 130 | 102 | 1 | 40 | 24 |
| members | 186,565 | 113 | 83 | 12 | 25 | 25 |
| beneficial_owners | 200,832 | 139 | 107 | 0 | 18 | 1.3 |
| securing_measures | 34,363 | 61 | 35 | 0 | 7 | 0.3 |
| insolvency | 18,073 | 3 | 0 | 2 | 6 | 1.1 |
| financial_statements | 1,986,939 | 55 | 6 | 0 | 206 | 96 |
| income_statements | 1,753,385 | 40 | 0 | 0 | 150 | 125 |
| balance_sheets | 1,862,440 | 44 | 3 | 0 | 143 | 75 |
| VID quarterly taxes | 462,376 | 0 | 0 | 0 | 46 | 48 |
| VID rating | 145,690 | 0 | 0 | 0 | 14 | 2.5 |
| VID VAT payers | 285,909 | 0 | 0 | 0 | 29 | 21 |
| EU funds 2021-27 projects | 2,567 | 0 | 0 | 0 | 24 | 22 |

Full pull: 1.03 GB; 9.5 min single-threaded parse and hash; re-download took 338 s. All 64 CSV resources send ETag + Last-Modified + Content-Length. Both validators change at every nightly regeneration, so diff by content with `research/probes/baltics/lv/diff_pulls.py snapshot|diff`.

## Estonia (EE)

Measured 19-20 Nov 2026 with real downloads. Probes: `research/probes/baltics/ee/`. All counts below are measured, not quoted.

**Summary.** Estonia is the richest of the three countries in bulk open data: the e-Business Register publishes companies, officers, members, beneficial owners, pledges and rulings daily under CC BY 4.0, plus annual-report key figures for 2019-2025. The Tax and Customs Board adds quarterly taxes, turnover and employees per company and a daily tax-debtor list. Three gaps matter:
1. The open files hold **only current entities and current roles**: deleted companies, ended roles and name/address history are absent.
2. **Personal codes are gone since 1 Nov 2024**; persons carry a pseudonymous hash (UUID v5) that is consistent across files and links a person across companies.
3. Tax, procurement and official-notice data are **CC BY-SA** (share-alike) per the national portal, so they must stay licence-tagged and out of any CC BY / CC0 export.

### e-Business Register open data files (RIK)
- Publisher and official URL: Centre of Registers and Information Systems (RIK), https://avaandmed.ariregister.rik.ee/en/downloading-open-data
- Access: bulk files, no key. Nine datasets: basic data (CSV, XML), general data, registry cards, persons on the registry card, persons not on the card, shareholders, beneficial owners, commercial pledges, rulings (JSON, XML). Zipped; each JSON is one pretty-printed array of one object per entity. The page also links parquet versions of basic and general data, but those are a stale snapshot from 13 Nov 2023: use the daily files.
- Fields: registry code, name, legal form and subtype, status (R registered, L in liquidation, N in bankruptcy), first-entry date, address (+ national address-register id), VAT number, EMTAK/NACE activities, share capital, contacts (email, phone, web), financial-year end, accounting obligation, list of annual reports with employee counts; persons: role, person type, first name, surname or company name, person hash, legal-entity registry code, foreign code, birth date (foreigners only), country, start date, share % and nominal amount, BO control method; pledges: amount, state, rank, start date, pledgee name and code; rulings: number, date, type, entry type, state, date in force. Full list in the dictionary.
- Rows and coverage: 381,685 entities in every file (all legal persons and sole traders currently in the register, all statuses R/L/N; 288,168 active private limited companies). Current role rows: 528,064 on registry cards, 436,481 off-card persons (founders and others), 394,812 shareholder rows, 412,802 beneficial-owner rows; 8,078 commercial pledges on 4,944 entities; 2,897,669 rulings on 381,668 entities (nearly every entity has at least its registration ruling). Deleted entities are not included.
- Freshness: stated daily. All nine files had `Last-Modified` 19 Nov 2026 09:17-09:23 UTC; latest entry date in the data 19 Nov 2026 (same-day). Current.
- Size and speed: 0.52 GB zipped per full pull (all JSON + basic CSV), 10.1 GB unzipped (general data alone 4.6 GB). Parse with a streaming reader (stdlib Python, one object per line block): general data 364 s, each person file 20-35 s, basic CSV 34 s; 872 s for the 1.8 GB rulings file. Validators: `Last-Modified` and `ETag`; a conditional GET with `If-Modified-Since` returns 304. Served through a CDN with `Cache-Control: max-age=1209600` (14 days), so a loader must compare `Last-Modified`, not trust the cache. No delta files; the change-list query exists only in the contract API. Rows changed between two consecutive pulls: not yet measured (needs the next daily file; `diff_pulls.py` snapshots are stored for 19 Nov). Change-volume proxy: register entries per day (see below).
- Join keys: registry code, 8 digits, 100% filled, 100% pass the mod-11 check digit (same rule as the national personal code), first digit 1 = companies and sole traders, 8 = associations, 7 = state and municipal bodies, 9 = foundations. VAT number is a separate number (`EE` + 9 digits, not derived from the registry code), filled for 34.7% of entities. No LEI in the files.
- Person identity: first name + surname, plus `isikukood_hash`, a UUID v5 derived from the personal code (personal codes removed from open data on 1 Nov 2024). Hash filled for 93.3% of card persons, 97.5% of beneficial owners, 96.6% of shareholders. The same hash appears across the card, shareholder and beneficial-owner files (in a 60,000-entity test, 92% of entities with BOs share a hash with a board member). Birth date only for persons without an Estonian code (3%). Legal-entity persons carry their registry code.
- Licence: "License information" links to Creative Commons Attribution 4.0 (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/legalcode, from https://avaandmed.ariregister.rik.ee/en/downloading-open-data; "Downloading open data requires acceptance of the license terms." Verified 19 Nov 2026.
- Keys, limits, cost: none for the files.
- Legal constraints: the page states that a re-user of personal data in open data "is obliged to comply with ... GDPR, including ... the existence of a legal basis". Person files contain names, the person hash, foreigners' birth dates, and for a few percent of rows a person's email (2.8% of card persons) and home address (4.2%): the loader must drop person emails and home addresses. The hash is pseudonymous, not anonymous: treat it as personal data and never try to reverse it. Entity contacts (`sidevahendid`) can hold a sole trader's personal phone or email.
- Tested with: `fetch_ariregister.py` (download + headers), `build_index.py` (field stats, null rates, SQLite index), `diff_pulls.py` (snapshots, entries per day), `reality_check.py`.
- Verdict: use. The backbone for S01-S05, S09, S13 and S17 in Estonia.

Architect's questions:
- a. Registry code: 8 digits, mod-11 check digit (weights 1-7,1 then 3-9,1,2), assigned for life and not reissued (unknown if ever reused after deletion: settle by checking a deleted-code list from the contract API).
- b. Registry code fill 100% in every file and in EMTA, procurement and notices data. VAT: mapped (separate number), 34.7% of all entities and 42.7% of active companies. LEI: not present; join via GLEIF's registration-authority id for the Estonian register (cross-border worker).
- c. Every person, pledge and card row has a stable `kirje_id` record id; pledges also `pandi_id`; rulings have `maaruse_nr`.
- d. Name + `isikukood_hash` (UUID v5), consistent across card, off-card, shareholder and beneficial-owner files; birth date only for foreigners.
- e. Sole trader: legal form "Füüsilisest isikust ettevõtja" (FIE; role code FIE on the card), 24,545 entities. Their name is a person's name.
- f. Full daily snapshot of current entities only. Deleted entities vanish from the files (`kustutamise_kpv` is 100% empty); liquidation (L) and bankruptcy (N) stay with a status until deletion.
- g. As-of date: only HTTP `Last-Modified` and the latest entry dates; nothing in the file name or a header field.
- h. History: none in open data. All role, address, name and capital arrays carry only current rows (`lopp_kpv` 100% empty). The registry-card entries list (entry number, date, type) is the only event history. Financials: 2019-2025 (separate dataset).
- i. JSON: UTF-8, 4-space pretty-printed single array, zipped. Basic CSV: UTF-8 with BOM, `;` delimiter, quoted, Estonian headers; its `ettevotja_aadress` and `ads_ads_oid` columns are always empty. Header (basic CSV): `nimi;ariregistri_kood;ettevotja_oiguslik_vorm;ettevotja_oigusliku_vormi_alaliik;kmkr_nr;ettevotja_staatus;ettevotja_staatus_tekstina;ettevotja_esmakande_kpv;ettevotja_aadress;asukoht_ettevotja_aadressis;asukoha_ehak_kood;asukoha_ehak_tekstina;indeks_ettevotja_aadressis;ads_adr_id;ads_ads_oid;ads_normaliseeritud_taisaadress;teabesysteemi_link`. Layout change: personal codes removed 1 Nov 2024 and replaced by the hash.
- j. Deep link: `https://ariregister.rik.ee/est/company/<registry code>` (also `/eng/`), given per entity in `teabesysteemi_link`. Linking is not restricted by the terms.
- k. Labels in the files are Estonian only. The classifier query (contract API) returns Estonian or English; activities carry the NACE code next to EMTAK, so English NACE labels can come from Eurostat.

### Annual reports open data (RIK)
- Publisher and official URL: RIK, same page, "Annual reports data".
- Access: bulk CSV in zips: (1) report general data, (2) revenue by EMTAK activity, (3) revenue by country, (4) key figures, one file per report year 2019-2025. Linked by `report_id`.
- Fields: report year, period, submission date, consolidated, audited, size category, audit firm, auditor's opinion; key figures (non-consolidated): cash, current and non-current assets, assets, current and non-current liabilities, equity, revenue, total revenue (non-profits), employee expense, depreciation, operating profit, profit before tax, net profit, retained earnings, average employees (FTE), issued capital.
- Rows and coverage: 1,687,349 reports; 250,577 for year 2025, 258,761 for 2024. Key-figure rows: 3.1 M (2019) to 3.9 M (2024) per year file. Coverage of active companies: see fill rates.
- Freshness: stated "initially updated once a month"; files on 19 Nov 2026 were cut at 31 Oct 2026 (`Last-Modified` 9 Nov 2026); latest submission date 31 Oct 2026. Current (within 2x a monthly cadence).
- Size and speed: 0.14 GB zipped, 2.1 GB unzipped; parse 4-68 s per file.
- Join keys: registry code (100%).
- Person identity: none (auditor is a firm name).
- Licence: CC BY 4.0, same page and licence link as above. Verified 19 Nov 2026.
- Keys, limits, cost: none. Full reports (PDF/XBRL) only through the contract API.
- Legal constraints: none beyond attribution.
- Tested with: `build_index.py`.
- Verdict: use. Grade A for S06.

Architect's questions: a/b registry code; c `report_id` stable per report; d none; e sole traders do not file annual reports; f full re-publication monthly; g cut-off date in the file name (`kuni_31102026`); h 2019-2025, three previous years per report; i UTF-8 with BOM, `;`, quoted, Estonian headers, values as decimal strings (`"946.0"`); header (key figures): `report_id;tabel;elemendi_label;elemendi_nimetus;vaartus`; j as above; k element names come in English (`elemendi_nimetus`: Revenue, Assets) and Estonian (`elemendi_label`).

### e-Business Register APIs (RIK)
- Publisher and official URL: RIK, https://avaandmed.ariregister.rik.ee/en/open-data-api/introduction-api-services and REST docs at https://ar-rest.rik.ee/docs
- Access: SOAP/XML and REST JSON per company. Contract required ("In order to use open data API or XML services, it is necessary to sign an agreement"), except the autocomplete service (`https://ariregister.rik.ee/est/api/autocomplete?q=`, no contract, max 10 results; tested: 200 JSON).
- Fields: everything in the files plus history (company data change list, historical beneficial owners), full annual reports, documents list, representation rights.
- Rows and coverage: per query.
- Freshness: real time.
- Size and speed: per query; limits below.
- Join keys: registry code.
- Person identity: the beneficial-owner REST query returns personal codes and birth dates only to competent authorities and obliged entities; "legitimate interest" users get name, birth date, control method and dates; viewing is logged.
- Licence: CC BY 4.0 (same licence link in the site footer). Verified 19 Nov 2026.
- Keys, limits, cost: free when the contract is only for API services; 50,000 answers per day per contract partner (and per API key), 1 simultaneous query, 20 requests/minute per IP for document downloads. Contract application reviewed within five working days. X-tee services are for the public sector.
- Legal constraints: contract terms; data-protection logging for beneficial owners.
- Tested with: page reads only (no contract). Autocomplete called once.
- Verdict: use with caveat. Needs a contract signed by the operator (human task). Worth it for deleted entities, history and full reports at query time.

### Taxes paid, turnover and employees (Tax and Customs Board, EMTA)
- Publisher and official URL: Maksu- ja Tolliamet, https://www.emta.ee/ariklient/amet-uudised-ja-kontakt/uudised-pressiinfo-statistika/statistika-ja-avaandmed
- Access: bulk CSV, no key: current and previous year (`tasutud_maksud_kaesolev_aasta.csv`), older years 2022-2024 (`tasutud_maksud_varasemad_aastad.csv`).
- Fields: data as of, registry code, name, taxpayer type, county, activity, year, and per quarter: state taxes paid, labour taxes paid, taxable turnover, employees.
- Rows and coverage: 469,591 rows (2025-2026), 642,315 rows (2022-2024). Includes companies, non-profits, state bodies, 7,091 sole-trader rows and 81,734 non-resident rows. 2026 Q3: 200,521 taxpayers with a row, 91,543 with an employee count.
- Freshness: stated quarterly, on the 10th of the month after the quarter. File dated 10 Oct 2026, covering Q3 2026. Current.
- Size and speed: 156 MB for both files; parse 23 + 31 s.
- Join keys: registry code (100%; non-numeric codes appear for some non-residents).
- Person identity: sole traders appear by their name.
- Licence: CC BY-SA 3.0, per the dataset entry on the national portal https://andmed.eesti.ee (dataset "Maksu- ja Tolliamet - Tasutud maksud, käive ja töötajate arv"); the EMTA page itself states open data is free "to use, reuse and share" without naming a licence. Verified 19 Nov 2026. Share-alike: keep it out of any differently licensed export.
- Keys, limits, cost: none.
- Legal constraints: EMTA warns the figures "cannot be used to calculate an average salary". Sole-trader rows are personal data.
- Tested with: `fetch_emta.py`, `build_index.py`.
- Verdict: use with caveat (share-alike; no salary). Grade B for S07 and S08.

Architect's questions: a/b registry code; c no row id (key = registry code + year); d sole traders by name only; e taxpayer type `FIE`; f full re-publication each quarter, deleted entities are dropped; g `Andmete seis` column; h 2022-2026, quarterly; i UTF-8, `,` delimiter, quoted, Estonian headers, decimal comma; header: `"Andmete seis","Registrikood","Nimi","Liik","Maakond","Tegevusala","Aasta","Riiklikud maksud I kv",...,"Töötajate arv IV kv"`; j no entity page; k Estonian only.

### Tax debtors (EMTA)
- Publisher and official URL: EMTA, same page, "Maksuvõlglaste nimekiri".
- Access: bulk CSV, no key; real-time single lookups at https://apps.emta.ee/saqu/public/taxdebt
- Fields: data as of, registry code, name, tax debt, of which disputed, of which in a payment schedule, schedule end date, due date of the oldest unpaid claim.
- Rows and coverage: 19,920 legal persons with a debt of at least EUR 100 (natural persons are not published). Debt in a payment schedule or under dispute is included; disputed debt whose enforcement is suspended is not.
- Freshness: stated daily ("Uuendame tabelit ... üks kord päevas"); file dated 19 Nov 2026 05:05 UTC with data as of 19 Nov 2026. Current.
- Size and speed: 1.3 MB; under 1 s.
- Join keys: registry code (12 rows have a non-numeric foreign code).
- Person identity: none.
- Licence: CC BY-SA 3.0 per andmed.eesti.ee. Verified 19 Nov 2026.
- Keys, limits, cost: none.
- Legal constraints: the page puts full responsibility for lawful further processing on the user.
- Tested with: `fetch_emta.py`, `build_index.py`, `diff_pulls.py snapshot`.
- Verdict: use. Grade B for S08 (daily and complete, but share-alike).

### Public procurement register (Riigihangete register)
- Publisher and official URL: Ministry of Finance, https://riigihanked.riik.ee/rhr-web/#/open-data
- Access: bulk monthly XML, no key: `https://riigihanked.riik.ee/rhr/api/public/v1/opendata/notice_award/<year>/month/<m>/xml` (contract award notices; `notice` for contract notices). eForms UBL.
- Fields: notice, buyer, lot, winning tender, payable amount, winner organisation with `CompanyID` and country.
- Rows and coverage: Nov 2025 to Oct 2026: 12,091 award notices, 20,704 winning tender-supplier rows, 100% with a company id, 97.9% with an amount, 95% Estonian winners, 3,821 distinct Estonian suppliers.
- Freshness: monthly files; October 2026 available on 19 Nov 2026. Current.
- Size and speed: 335 MB for 12 months; a few seconds per month to parse.
- Join keys: winner `CompanyID` = Estonian registry code for Estonian winners (99.7% valid 8-digit).
- Person identity: none for companies; sole-trader winners appear by name.
- Licence: CC BY-SA 3.0 per andmed.eesti.ee. Verified 19 Nov 2026.
- Keys, limits, cost: none.
- Legal constraints: share-alike.
- Tested with: `procurement.py 2025-11 2026-10`.
- Verdict: use with caveat (share-alike). Grade B for S12.

### Official notices (Ametlikud Teadaanded)
- Publisher and official URL: RIK for the Ministry of Justice, https://www.ametlikudteadaanded.ee/avalik/uriotsing
- Access: XML by URI pattern, no key: `https://www.ametlikudteadaanded.ee/ee/{publisher|-}/{type}/{subtype|-}/{year}/{month}/xml`. The search UI caps at 1,000 results; the URI route returned full months.
- Fields: notice number, type, legal basis, publisher (court), affected party (type, registry or personal code, name), publication and archiving dates, notice text (HTML).
- Rows and coverage: May-Oct 2026: 187 bankruptcy declarations, 210 bankruptcy petitions ended for lack of assets, 141 bankruptcy proceedings ended. Affected legal persons: 188 notices, all with a registry code; natural persons: 350.
- Freshness: daily publication; latest notice in the October file dated 30 Oct 2026. Current.
- Size and speed: about 0.6 MB per subtype-month.
- Join keys: registry code of the affected legal person (100% for legal persons).
- Person identity: natural-person bankruptcy notices carry the person's name and code.
- Licence: CC BY-SA 4.0 per andmed.eesti.ee. Verified 19 Nov 2026.
- Keys, limits, cost: none.
- Legal constraints: notices addressed to a natural person for delivery, and archived notices, are excluded from open data by law. Natural-person bankruptcy notices are personal data: show them only in a company context or not at all (legal memo).
- Tested with: `official_notices.py 2026-05 2026-10`.
- Verdict: use with caveat for companies only. Grade B for S09.

### Not found or not free in Estonia
- **Court case data**: the register rulings are registration decisions, not court cases. Court decisions are on Riigi Teataja; not measured here (osint or legal).
- **Deleted companies and history**: only via the contract API.
- **Average salary**: not published (EMTA's own warning).
- **AS shareholders**: kept by the securities depository, not the register.

## Cross-border sources (all three countries)

Measured 2026-11-19 and 2026-11-20 with the probes in `research/probes/baltics/common/`. Counts are from real downloads; no entity-level data is reproduced here.

### GLEIF LEI data: golden copy and API (S01 LEI, S05 Group)
- Publisher and official URL: Global Legal Entity Identifier Foundation. Golden copy index https://goldencopy.gleif.org/api/v2/golden-copies/publishes/latest ; API https://api.gleif.org/api/v1/lei-records
- Access: bulk file (golden copy: CSV, JSON or XML, zipped; three files: level 1 `lei2`, level 2 relationship records `rr`, reporting exceptions `repex`) and a JSON:API REST API. API paging: `page[size]` 1-200; `page[number]` stops at 50, so one query returns at most 10,000 records (page 51 at size 200 returns HTTP 400, measured). Estonia alone has 30,632 records, so a full Baltic load must use the golden copy; the API is for per-entity lookups (`filter[entity.registeredAs]=<code>` works).
- Fields: LEI (20 chars), legal name, other and transliterated names, legal and HQ address, `RegistrationAuthorityID` + `RegistrationAuthorityEntityID` (the national register code), legal jurisdiction, ELF legal-form code, category, entity status, creation date, registration status (ISSUED / LAPSED / RETIRED ...), last update, next renewal, validation level. Relationship file: start node (child LEI), end node (parent LEI), type (IS_DIRECTLY_CONSOLIDATED_BY, IS_ULTIMATELY_CONSOLIDATED_BY, IS_FUND-MANAGED_BY, IS_SUBFUND_OF, IS_INTERNATIONAL_BRANCH_OF), status, periods, accounting standard. Full list in the dictionary.
- Rows and coverage: golden copy 3,499,919 LEI records worldwide (2026-11-19 16:00). By legal-address country: LT 5,402 (3,578 issued, 1,647 lapsed), LV 4,452 (2,984 issued, 1,306 lapsed), EE 30,632 (21,593 issued, 7,956 lapsed); US 365,812 for reference. Only entities that bought an LEI appear, so this covers a minority of registered companies (larger firms, funds, anyone trading securities).
- Freshness: stated three golden-copy publications a day (00:00, 08:00, 16:00 UTC) plus delta files (IntraDay, LastDay, LastWeek, LastMonth). Observed: the 2026-11-19 16:00 file; the LastDay delta held 17,308 changed records worldwide, of which LT 34, LV 18, EE 128. Current.
- Size and speed: full pull 510.6 MB (lei2 CSV zip) + 24.5 MB (rr) + 62.9 MB (repex). Streaming all three with Python stdlib csv and filtering to the Baltics took 151 s. Validators: ETag and Last-Modified on the file URLs; delta files make daily refresh a few MB. Rows changed per day: see LastDay above.
- Join keys: register code in `RegistrationAuthorityEntityID`, filled for 98.0% (LT), 98.2% (LV), 99.7% (EE) of records; in the national format (LT 9 digits, LV 11, EE 8) for 96.1% / 97.4% / 99.7%. Registration authorities: LT `RA000430` Register of Legal Entities (5,173 records), `RA000431` central bank (111); LV `RA000423` Enterprise Register (4,155), `RA000424` a commercial database provider (181, still carries the national code), `RA000932` financial regulator for funds (36); EE `RA000181` Commercial Register (30,517), `RA000182` financial regulator (69). `RA999999` (not on the RA list) 106 / 71 / 36. Measured join: 575 LT, 23 LV and 449 EE Kohesio beneficiaries carry a code that also appears in GLEIF.
- Person identity: none. GLEIF holds legal entities only; the reporting-exception file says a parent is `NATURAL_PERSONS` (LT 2,706, LV 2,567, EE 16,433 direct-parent exceptions) without naming anyone.
- Licence: CC0 1.0. "The data available through the Access Service are provided under the CC0 licence, see CC0 1.0 Universal (CC0 1.0)." https://www.gleif.org/en/meta/lei-data-terms-of-use , verified 2026-11-19. Terms also forbid claiming IP in LEI data, circumventing technical restrictions, or implying GLEIF endorsement.
- Keys, limits, cost: no key, free. No published request quota found on the official pages (unknown; settle by asking GLEIF or reading `api.gleif.org/docs`); probes ran at 1 request/s without errors. Hard limits measured: page size 200, 10,000 records per query.
- Legal constraints: none for entity data. Sole-proprietor LEIs exist (LT 4, LV 2, EE 21 in category SOLE_PROPRIETOR): their name and address are personal data even under CC0.
- Tested with: `research/probes/baltics/common/gleif_probe.py` (counts, register-code fill and format, RA codes, relationships, reporting exceptions).
- Verdict: use. Source of the LEI field and the only structured cross-border parent data. Parent coverage is thin: 4.5% (LT), 3.3% (LV), 0.9% (EE) of Baltic LEI holders report a direct parent LEI.
- a. Primary key: LEI, ISO 17442, 20 alphanumeric chars, last two are ISO 7064 mod 97-10 check digits. Stable for life; never reissued (lapsed and retired LEIs stay in the file).
- b. Join keys: register code 98.0-99.7% filled (above). VAT: not carried. Tax / social-insurance / financial files: join via the register code.
- c. Own record ID: LEI per entity; relationship rows are keyed by (start LEI, end LEI, type), no own ID.
- d. Person identity: none (see above).
- e. Natural persons: category `SOLE_PROPRIETOR`; ELF codes per country in the GLEIF ELF code list (not measured per code).
- f. Change feed: full snapshot 3x daily + deltas. Terminated entities stay, with `EntityStatus` INACTIVE and/or `RegistrationStatus` LAPSED / RETIRED / MERGED.
- g. As-of: in the file name and the publish API (`publish_date`); per record `Registration.LastUpdateDate`.
- h. History: legal-entity events (up to 5 in CSV, more in JSON/XML), relationship periods; no name/address history in level 1 CSV (field-modification history is per record via the API).
- i. Format: UTF-8 CSV, comma, double-quoted, zipped; English header; 338 columns in lei2 (repeated groups flattened `.1`..`.5`). Format moved to LEI-CDF 3.1. Header sample: `LEI,Entity.LegalName,Entity.LegalName.xmllang,...,Entity.RegistrationAuthority.RegistrationAuthorityID,Entity.RegistrationAuthority.OtherRegistrationAuthorityID,Entity.RegistrationAuthority.RegistrationAuthorityEntityID,Entity.LegalJurisdiction,Entity.EntityCategory,...,Registration.RegistrationStatus,...,ConformityFlag`
- j. Deep link: `https://search.gleif.org/#/record/<LEI>` and `https://api.gleif.org/api/v1/lei-records/<LEI>`. CC0; linking is allowed.
- k. Labels: English enums; legal-form codes resolve through the ELF code list (local-language names plus transliteration).

### EU consolidated financial sanctions list (S11)
- Publisher and official URL: European Commission (DG FISMA), Financial Sanctions Files. Catalogue entry https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions ; XML 1.1 https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw (CSV 1.1 and 1.0 and PDF also published; RSS at https://webgate.ec.europa.eu/fsd/fsf/public/rss).
- Access: bulk file, full snapshot only. The `token` in the URL is a fixed public value published in the catalogue, not a personal key. XML is nested (one `sanctionEntity` per listing); the CSV is denormalised: 44,043 rows for 6,269 listings, 118 columns, `;`-delimited, UTF-8 with BOM. Use the XML.
- Fields: EU reference number, UN reference (if a UN listing), designation date, subject type (person / enterprise), regulation (type, publication date, OJ number, programme, EUR-Lex URL), name aliases (whole name, first/last, gender, function, language), birth dates (full date or year, place, country), citizenships, addresses (country ISO2), identifications (type code, number, issuing country, validity flags), remarks.
- Rows and coverage: 6,269 listings: 4,490 persons, 1,779 entities (file of 2026-10-23). It is the EU-wide list only; national lists of LT, LV and EE are separate and not covered here.
- Freshness: updated when a new legal act is published (irregular). The RSS showed the 2026-10-23 file as the latest on 2026-11-19 and 2026-11-20; the two pulls were byte-identical. Current against its own cadence.
- Size and speed: 25.9 MB XML, parsed in 1.8 s. Last-Modified header present, no ETag; `Cache-Control: no-cache`. No delta files; diff by `logicalId` (`diff_pulls.py eu`).
- Join keys: no LEI in practice (0.2% of entities). Entities: a registration or tax number is present for 46.7% (types `regnumber` 711, `fiscalcode` 250, `taxid` 234), IMO number 2.6%, SWIFT/BIC 0.4%; at least one official ID 48.9%; nothing at all 50.7%. Persons: full birth date 72.6%, year only 12.4%, passport or national ID 19.6%; any official ID or full birth date 75.0%; nothing 14.7%.
- Baltic-linked entries (any address, citizenship, birth place or document country LT/LV/EE): 0 entities, 11 persons; all 11 have a full birth date, 36% a document number.
- Person identity: name aliases + birth date + document numbers where given.
- Licence: Commission reuse policy. The catalogue marks the XML 1.1 distribution "European Commission reuse notice" (Decision 2011/833/EU) and the CSV 1.0 distribution "Creative Commons Attribution 4.0 International". The Commission legal notice: "content owned by the EU on this website is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) licence" (https://commission.europa.eu/legal-notice_en). Verified 2026-11-19.
- Keys, limits, cost: none; free.
- Legal constraints: the file is personal data about listed people (names, birth dates, passport numbers). Reuse for screening is its purpose, but GDPR applies to our copy: legal memo to confirm basis, retention and display. Attribution: "Source: European Commission, EU consolidated financial sanctions list".
- Tested with: `research/probes/baltics/common/sanctions_probe.py` (counts, identifier shares overall and Baltic-linked), `diff_pulls.py eu`.
- Verdict: use. The main sanctions source. Under rule R8 a confirmed hit needs an official-ID match, which is possible for about half of listed entities and three quarters of listed persons (via birth date); the rest can only ever be "possible match by name".
- a. Primary key: `logicalId` (integer) per listing, and `euReferenceNumber` (format `EU.<n>.<n>`). Not documented as stable; observed stable across the two pulls.
- b. Join keys: see above; no Baltic register codes found (no Baltic entities listed).
- c. Own record ID: yes, `logicalId` on every listing, alias, address, birth date and identification.
- d. Person identity: names + birth date (+ document numbers for 19.6%).
- e. n/a.
- f. Change feed: full snapshot; delisted entries vanish from the file (history only through the amending regulations).
- g. As-of: `generationDate` attribute in the XML root, plus the file name `YYYYMMDD-FULL-1_1(xsd).xml`.
- h. History: designation and regulation dates; no delisted entries.
- i. Format: UTF-8 XML with an XSD, namespace `http://eu.europa.ec/fpi/fsd/export`. CSV header sample: `fileGenerationDate;Entity_LogicalId;Entity_EU_ReferenceNumber;Entity_UnitedNationId;Entity_DesignationDate;...`
- j. Deep link: no per-entry official page; cite the regulation's EUR-Lex URL carried in each entry, and the EU Sanctions Map per regime.
- k. Labels: English; names in several scripts per alias.

### UN Security Council consolidated list (S11)
- Publisher and official URL: United Nations Security Council. https://scsanctions.un.org/resources/xml/en/consolidated.xml (302 redirect to a signed blob URL valid one hour).
- Access: bulk XML, full snapshot.
- Fields: DATAID, VERSIONNUM, names (first to fourth), UN list type, reference number, listed-on date, comments, nationality, aliases with quality, addresses, dates of birth (full date or year), places of birth, documents (type, number, issuing country), INTERPOL link; entities have names, aliases, addresses and comments only.
- Rows and coverage: 1,007 entries: 733 individuals, 274 entities. 957 of them (95.0%) appear in the EU list under the same normalised name or alias; the EU file tags only 86 entries with a UN reference number.
- Freshness: `dateGenerated` 2026-11-19T00:00Z on both pulls (2026-11-19 and 2026-11-20), Last-Modified 2026-11-19 00:02 GMT. Regenerated on change.
- Size and speed: 2.2 MB, parsed in 0.3 s. Last-Modified and ETag on the blob. No deltas; diff by DATAID (`diff_pulls.py un`).
- Join keys: entities: IMO 6.2%, a registration number in free text 5.1%, any official ID 10.6%, none 89.4%. Persons: full birth date 56.9%, year only 39.4%, passport or national ID 40.4%; any 63.8%.
- Baltic-linked entries: 0.
- Person identity: names + birth date + documents.
- Licence: no open licence. The UN website terms: "The United Nations grants permission to Users to visit the Site and to download and copy the information, documents and materials ... for the User's personal, non-commercial use, without any right to resell or redistribute them or to compile or create derivative works therefrom" (https://www.un.org/en/about-us/terms-of-use , verified 2026-11-19). The list page itself returned no text to our client.
- Keys, limits, cost: none; free.
- Legal constraints: redistribution and derivative works are not granted by the general terms. Needs the legal memo.
- Tested with: `sanctions_probe.py`, `diff_pulls.py un`.
- Verdict: use with caveat: fetch at query time for agents and cite it; do not redistribute a copy. 95% of it is already in the EU list, which is reusable.
- a. Primary key: DATAID (integer) + VERSIONNUM; REFERENCE_NUMBER (format: two-letter regime code, `i` or `e` for individual or entity, a sequence number) is the public reference.
- b-c. See above; DATAID per entry, no IDs for sub-records.
- d. Person identity: names + birth date + documents.
- f. Full snapshot; delisted entries vanish.
- g. As-of: `dateGenerated` in the root element.
- h. History: `LISTED_ON`, `LAST_DAY_UPDATED` values.
- i. Format: UTF-8 XML; element names in English capitals (`INDIVIDUALS/INDIVIDUAL`, `ENTITIES/ENTITY`); whitespace inside some values (one document type has an embedded line break).
- j. Deep link: none per entry in the file; cite the list URL and reference number.
- k. English (other UN languages published as separate files).

### Kohesio: EU cohesion-policy projects and beneficiaries (S12)
- Publisher and official URL: European Commission (DG REGIO), https://kohesio.ec.europa.eu/en/data . File index: `https://kohesio.ec.europa.eu/api/data/{beneficiaries|programmingPeriod20142020|programmingPeriod20212027}`; file: `https://kohesio.ec.europa.eu/api/data/object?id=data/beneficiaries/latest/<CC>-latest.csv` and `.../projects-2014-2020/latest/<CC>-pp14-20-latest.csv`, `.../projects-2021-2027/latest/<CC>-pp21-27-latest.csv` (CSV and XLSX).
- Access: bulk files per country and period, dated snapshot folders. The EU Knowledge Graph SPARQL endpoint (query.linkedopendata.eu) returned HTTP 403 to our client; not needed.
- Fields: projects: operation ID (EU KG URI) and local ID, name (EN + programme language), start and end date, co-financing rate, total eligible expenditure, EU budget, beneficiary URI, name and local identifier, intervention category, thematic / policy objective, fund, programme, location (coordinates, postal code, LAU, NUTS 1-3), summary, managing authority. Beneficiaries: URI, label, local identifier, website, Wikidata ID.
- Rows and coverage: beneficiaries LT 10,605, LV 1,378, EE 5,924. Projects 2014-2020: LT 24,772, LV 2,103, EE 14,593. Projects 2021-2027: LT 2,491, LV 1,177, EE 3,729. EU budget sums: LT 7.08 bn (2014-20) + 4.45 bn (2021-27) EUR; LV 3.78 + 1.68 bn; EE 3.83 + 2.50 bn. One beneficiary per project row in all Baltic files.
- Freshness: snapshot folders on 2026-03-17, 06-09, 09-15, 09-24, 10-23 and `latest`. Baltic 2021-2027 files: `latest` is identical to 2026-09-24; LT 2021-2027 has the same 2,491 projects since 2026-03-17 (no rows added, the only change was a new column). Latest project start date seen: LT 2025-04, LV 2025-12, EE 2027-01 (planned). Slow: national lists reach Kohesio months late.
- Size and speed: Baltic pull 108 MB of CSV (LT 2014-20 alone 65.7 MB); probe parse 29 s. No ETag or Last-Modified; the dated folder name is the version.
- Join keys: `Beneficiary_Local_Identifier` = national register code for LT 98.4% and EE 97.3% of beneficiaries, LV 32.1% (65.3% empty). Some carry a VAT number instead (`LT`/`EE` + digits). Project rows with a national code: LT 96.0% (2014-20) / 99.9% (2021-27), LV 0.0% / 63.0%, EE 56.9% / 67.9%. No LEI.
- Person identity: beneficiaries are mostly legal entities; a handful of EE rows mark a private person or sole trader (4 found).
- Licence: Commission reuse policy, CC BY 4.0 by default. Kohesio's data page: "For more information on reuse, policy, and copyright, check the Legal Notice", which points to the Commission legal notice: "content owned by the EU on this website is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) licence". The 2014-2020 dataset on the Cohesion Open Data platform is catalogued as CC0 1.0. Verified 2026-11-19.
- Keys, limits, cost: none; free.
- Legal constraints: attribution (CC BY 4.0). Natural-person beneficiaries are personal data: drop or hide them.
- Tested with: `research/probes/baltics/common/kohesio_probe.py` (rows, null rates, ID fill and format, join test against GLEIF), `diff_pulls.py kohesio` (snapshot diffs).
- Verdict: use for LT and EE; use with caveat for LV (only a third of beneficiaries joinable; match the rest by name only as "possible"). National EU-funds portals would be fresher (country workers).
- a. Primary key: EU Knowledge Graph item URI (`https://linkedopendata.eu/entity/Q<n>`) for projects and beneficiaries; looks stable across snapshots (same IDs March to October).
- b. Join keys: above. No VAT mapping besides the few VAT-shaped identifiers.
- c. Own record ID: yes (Q-IDs).
- d. Person identity: name only.
- e. n/a.
- f. Change feed: dated full snapshots; no deltas. Columns can be added between snapshots (LT 2021-27 gained `Beneficiary_Local_Identifier` between June and September 2026).
- g. As-of: folder date only.
- h. History: all snapshots since 2023-09 stay downloadable.
- i. Format: UTF-8 CSV, comma, double quotes; multi-value fields use `|`. Header sample: `Operation_Unique_Identifier,Operation_Local_Identifier,Operation_Name_English,Operation_Name_Programme_Language,Country,Operation_Start_Date,Operation_End_Date,Cofinancing_Rate,Total_Eligible_Expenditure_amount,Total_Eligible_Expenditure_Currency,Project_EU_Budget,Beneficiary_Unique_Identifier,Beneficiary_Name,Beneficiary_Local_Identifier,...` Dates `DD/MM/YYYY`.
- j. Deep link: `https://kohesio.ec.europa.eu/en/projects/Q<n>` and `https://kohesio.ec.europa.eu/en/beneficiaries/Q<n>`. Linking is allowed under the Commission legal notice.
- k. Labels: English plus the programme language for names and summaries; category and objective labels in English.

### National sanctions lists (LT, LV, EE) (S11)
- **LV:** Financial Intelligence Unit (FID) list of sanctioned subjects whose funds or economic resources are frozen in Latvia (EU, UN and national regimes), https://sankcijas.fid.gov.lv/lv/iesaldetie-aktivi/sankciju-subjekti, also on data.gov.lv (`sankciju-subjektu-lidzekli-un-saimnieciskie-resursi-kas-iesaldeti-latvija`).
  - Access: bulk XLSX, no key; stated cadence irregular; resource last modified 2026-11-16, page "as of 19.11.2026".
  - Rows: 185, of which 180 (97%) carry a birth date or a registration number; it covers subjects listed directly and legal persons owned or controlled by them. Header (Latvian): subject name; birth date / registration no.; nationality / country of registration; type of frozen resource; ground; name of the listed person; date sanctions apply from; legal act; checked by the FIU; date first published.
  - Licence: "CC0-1.0" (data.gov.lv dataset record), verified 2026-11-20. Personal data of listed persons.
  - Tested with: `research/probes/baltics/common/national_sanctions_probe.py`. Verdict: use (grade A, small file). Complements the register's own sanctions-links file.
- **LT:** Financial Crime Investigation Service (FNTT), https://fntt.lrv.lt/en/international-financial-sanctions/a-list-of-sanctioned-subjects/: one HTML list of 16 legal entities owned or controlled by sanctioned subjects, each with a company code; "last updated 12-01-2026"; no download, no licence statement. Terrorism-related designations under UNSCR 1373 are a separate page. Verdict: use with caveat (grade C): per-query HTML, agents fetch and cite at query time.
- **EE:** Ministry of Foreign Affairs, list of subjects of the Government's national sanctions (regulation of 13 March 2025), https://www.vm.ee/en/list-subjects-sanction-government-republic-protect-estonias-security-and-interests-and-against: HTML only, four natural persons, names only (no birth dates or codes), no licence statement. Verdict: use with caveat (grade C): agents fetch at query time; a confirmed match is impossible under R8 (no official ID).

## Reality check

We built 8 real company profiles per country, the way the app would, from the sources above. The profiles stay in `research/.cache/baltics/<country>/profiles/`; only the aggregates are here.

**Sampling.** In each country we drew 8 companies at random from six segments:
- Size by staff count: 2 micro (1-9), 2 small (10-49), 1 medium (50-249) and 1 large (250+).
- 1 bankrupt or insolvent company.
- 1 company with tax debt.

Draws used `random.Random(seed).sample` over the sorted candidate codes of each segment:

| Country | Seed | Staff count from | Bankrupt segment | Tax-debt segment |
|---|---|---|---|---|
| LT | 20261119 | social-insurance insured persons | register status bankrupting, bankrupt, or liquidating due to bankruptcy (pool 1,794) | overdue tax arrears > 0 (pool 27,237) |
| LV | 20261120 | tax-authority employees, 2026 Q3 | open insolvency proceeding started in the last 24 months | tax rating C and at least one employee (debt amounts are not open) |
| EE | 2026 | tax-board employees, 2026 Q3 | register status N (bankruptcy) | on the debtor list with a debt above EUR 10,000 |

Scripts: `research/probes/baltics/lt/build_profiles.py`, `research/probes/baltics/lv/06_reality_check.py`, `research/probes/baltics/ee/reality_check.py`.

**Canonical report fields.** Each profile records these fields. The data dictionary maps every source field to one of them:
- identity: `legal_name`, `reg_code`, `legal_form`, `status`, `reg_date`, `closed_date`, `address`, `activity_code`, `vat_number`, `lei`, `website_or_contact`
- people: `officers`, `officer_roles_dates`, `members_shareholders`, `beneficial_owners`, `person_identifier`
- financials: `fs_latest_year`, `revenue`, `net_profit`, `total_assets`, `equity`, `fs_employees`
- employment: `employees_current`, `avg_salary`
- taxes: `taxes_paid`, `tax_debt`, `vat_registered`
- legal: `insolvency`, `pledges_securing_measures`, `court_or_official_notices`
- public money: `procurement_contracts`, `eu_funds`
- screening: `sanctions_eu`, `sanctions_un`

A section counts as filled when its core fields have a value for that company.

| Section | Country | Segment | Sample size | Filled | Fill rate | Notes |
|---|---|---|---|---|---|---|
| S01 | LT | all | 8 | 8 | 100% | activity 8/8, VAT 6/8, LEI 0/8 |
| S02 | LT | all | 8 | 8 | 100% | |
| S03 | LT | all | 8 | 0 | 0% | roles without names 8/8 |
| S04 | LT | all | 8 | 0 | 0% | member counts 7/8 |
| S06 | LT | micro / small | 4 | 4 | 100% | |
| S06 | LT | medium / large | 2 | 1 | 50% | the medium entity files no statements |
| S06 | LT | bankrupt / tax debtor | 2 | 2 | 100% | |
| S07 | LT | all | 8 | 7 | 88% | the bankrupt entity has no insured; average wage 4/8 |
| S08 | LT | all | 8 | 8 | 100% | taxes paid 8/8 |
| S09 | LT | all | 8 | 8 | 100% | status; bankruptcy report for the bankrupt entity |
| S12 | LT | all | 8 | 2 | 25% | large and bankrupt entities |
| S13 | LT | all | 8 | 8 | 100% | |
| S18 | LT | all | 8 | 8 | 100% | |
| S05, S10, S11, S14-S17 | LT | all | 8 | 0 | 0% | no LT open source; S11 from the cross-border lists |
| S01 | LV | all | 8 | 8 | 100% | population 100.0% |
| S02 | LV | all | 8 | 8 | 100% | population 100.0% |
| S03 | LV | all | 8 | 8 | 100% | population 97.8% |
| S04 | LV | all | 8 | 8 | 100% | population 90.8% |
| S05 | LV | all | 8 | 3 | 38% | population 11.0% |
| S06 | LV | all | 8 | 7 | 88% | population 74.1% |
| S07 | LV | all | 8 | 8 | 100% | population 57.8% |
| S08 | LV | all | 8 | 8 | 100% | population 91.8% |
| S09 | LV | all | 8 | 2 | 25% | population 12.3% |
| S10 | LV | all | 8 | 0 | 0% | population 0.0% |
| S11 | LV | all | 8 | 0 | 0% | population 0.0% |
| S12 | LV | all | 8 | 2 | 25% | population 2.6% |
| S13 | LV | all | 8 | 7 | 88% | population 74.1% |
| S14 | LV | all | 8 | 0 | 0% | population 0.0% |
| S15 | LV | all | 8 | 1 | 12% | population not measured (incidental website fields, under 3%) |
| S16 | LV | all | 8 | 0 | 0% | population 0.0% |
| S17 | LV | all | 8 | 5 | 62% | population 49.1% |
| S18 | LV | all | 8 | 7 | 88% | population 91.8% |
| S01 | EE | all | 8 | 8 | 100% | population: 98.3% of active companies.  |
| S02 | EE | all | 8 | 8 | 100% | population: 100.0% of active companies. current status + status start date only; open data carries no name/address history |
| S03 | EE | all | 8 | 8 | 100% | population: 97.4% of active companies.  |
| S04 | EE | all | 8 | 7 | 88% | population: 99.1% of active companies. OÜ members are in the register; AS shareholders are not (kept by the securities depository) |
| S05 | EE | all | 8 | 1 | 12% | population: 9.8% of active companies. parent known only via a legal-entity shareholder; no subsidiaries list or consolidation links |
| S06 | EE | all | 8 | 6 | 75% | population: 71.6% of active companies.  |
| S07 | EE | all | 8 | 7 | 88% | population: 26.9% of active companies.  |
| S08 | EE | all | 8 | 7 | 88% | population: 39.1% of active companies. tax debt is known for every company (on the debtor list or not) |
| S09 | EE | all | 8 | 8 | 100% | counted as filled when status, pledges and insolvency notices are all known (100% of the population); 1.6% have a commercial pledge |
| S10 | EE | all | 8 | 0 | 0% | the register's rulings are registration decisions, not court cases; no court data |
| S12 | EE | all | 8 | 1 | 12% | population: 1.2% of active companies. share of companies with an award in the last 12 months (not a gap when 0) |
| S13 | EE | all | 8 | 8 | 100% | population: 83.3% of active companies.  |
| S15 | EE | all | 8 | 0 | 0% | population: 6.3% of active companies.  |
| S17 | EE | all | 8 | 8 | 100% | population: 97.2% of active companies. officers carry a pseudonymous person hash usable for linking across companies |

**Where the samples miss:**
- **LT:**
  - S03 and S04: always empty. There are no names: roles appeared in 8 of 8 profiles, member counts in 7 of 8.
  - S06: the medium company files no statements.
  - S07: the bankrupt company has no insured staff. Average wage was published for 4 of 8, because it is suppressed at 3 staff or fewer.
- **LV:**
  - S09 is filled only for the insolvent and the rating-C company.
  - S06 is missing for the rating-C company.
  - S12: one micro and the large company.
  - S17 is missing for one micro and the rating-C company.
  - LEI: 1 of 8.
- **EE:**
  - S04 is missing for the large company: it is a public limited company, and its shareholders are kept by the securities depository, not the register.
  - S06 is missing for the large company and the bankrupt one. The large company filed its report as a PDF, so the open file has no figures; 38% of large companies do this.
  - S07 and S08 are missing for the bankrupt company.
  - S12: one medium company.

**The S09 definition differs by country:**
- LV counts companies with an insolvency, securing-measure or suspension event (12.3% of the population).
- LT and EE count the section as filled when the status is known (100%).
- The population rates with an actual event are in the display matrix.

**Population versus sample.** The population fill rates (in the coverage table, the matrix and the Notes column) come from the full bulk files. The 8 samples only check that a real profile can be built from them.

## Display matrix rows

One row per section and country, in the README's final format. Grades follow the README scale; `X?` marks a candidate for legal restriction that the legal memo decides.

| Section | Country | Sources | Grade | Fill rate | Notes |
|---|---|---|---|---|---|
| S01 | all | GLEIF golden copy (LEI field) | A | LEI records by legal-address country in the golden copy of 2026-11-19 16:00 UTC, all registration statuses: LT 5,402, LV 4,452, EE 30,632 | bulk; licence verified Y; CC0; register code on 98-99.7% of LEI records, so joins are reliable; most small companies have no LEI |
| S01 | LT | JAR daily files; tax-payer register; Sodra; GLEIF | A | 100% (activity 83.5%, VAT 64.4%, LEI 2.5%) | bulk; licence verified Y; full address text; activity from tax / social-insurance files |
| S01 | LV | Enterprise Register register; VID yearly (NACE); VID VAT payers; GLEIF | A | 100% (NACE 87%, VAT 50.5%, LEI ≤3%) | bulk; licence verified Y; daily; VAT = LV+code |
| S01 | EE | e-Business Register basic + general data | A | 98.3% | bulk; licence verified Y; name, code, form, address, activity 100% except address 98.3%; VAT 42.7%; no LEI in the register (GLEIF join) |
| S02 | LT | JAR daily files; API change feed | A | 100% | bulk; licence verified Y; current status + since-date; no name or address history (keep our own from daily diffs) |
| S02 | LV | Register (status, terminated), liquidations, reorganizations, name history | A | 100% | bulk; licence verified Y; name history stale since 2025-04-02; no address history |
| S02 | EE | e-Business Register general data, registry-card entries | B | 100% | bulk; licence verified Y; current status and its start date only; no name/address history and deleted companies vanish (history via contract API or our own daily snapshots) |
| S03 | LT | JAR management bodies | C | 0% names (99.9% roles only) | bulk; licence verified Y; no names: manager flag, since-date, gender, board flags only |
| S03 | LV | Enterprise Register officers | A | 98% | bulk; licence verified Y; current roles only, no end dates; names + masked code (legacy code reveals birth date) |
| S03 | EE | e-Business Register persons on card | A | 97.4% | bulk; licence verified Y; current roles only; names + pseudonymous person hash (UUID v5), birth date only for foreigners; drop person emails and home addresses |
| S04 | LT | JADIS member counts | C | 0% names (81.3% counts) | API; licence verified Y; counts by type only, last loaded 2025-09; owners and BO names paid |
| S04 | LV | Enterprise Register members (SIA) | A | 91% (100% of SIA) | bulk; licence verified Y; personal data; members who leave vanish |
| S04 | LV | Enterprise Register beneficial owners | X? | 90% | bulk; licence verified Y; concealment on request since 2026-07-01; CJEU C-37/20, legal memo decides |
| S04 | LV | Joint-stock company shareholders | D | 0% | none; licence verified Y (dataset withdrawn, private in CKAN); Constitutional Court 9 Nov 2026 |
| S04 | EE | e-Business Register shareholders (members) | A | 97.3% | bulk; licence verified Y; current members of private limited companies; public limited company shareholders are not in the register (kept by the securities depository) |
| S04 | EE | e-Business Register beneficial owners | X? | 95.0% | bulk; licence verified Y; still published daily (412,802 rows, 2026-11-19) with name, country, control method and person hash; legal round 3 proposes HIDE (CJEU C-37/20, C-601/20) |
| S05 | all | GLEIF relationship records + reporting exceptions | C | 4.5% LT, 3.3% LV, 0.9% EE of LEI holders have a parent LEI | bulk; licence verified Y; only LEI holders, accounting-consolidation parents only; most exceptions say "natural persons" (owner not named) |
| S05 | LT | GLEIF relationships only | D | 0% from LT registers | API; licence verified Y (GLEIF CC0, cross-border entry); no group data in LT open data |
| S05 | LV | Members with corporate holders (derived); GLEIF relationships | C | 11% | bulk; licence verified Y; LV-registered parents and subsidiaries only; foreign parents by name |
| S05 | EE | e-Business Register shareholders (legal-entity holders) | C | 9.8% | bulk; licence verified Y; derived: parent only via a corporate member; no subsidiary or consolidation links |
| S06 | LT | JAR financial statements | B | 72.7% (revenue 55.8%) | API; licence verified Y; key lines only, monthly loads; no employee count |
| S06 | LV | Annual report financial data | A | 74% (FY ≥ 2024) | bulk; licence verified Y; 2006-2026; check currency and rounding |
| S06 | EE | RIK annual-report key figures 2019-2025 | A | 71.6% | bulk; licence verified Y; monthly; non-consolidated XBRL figures only; PDF-filed reports have none (1.3% of all FY2025 reports, 38% of large companies) |
| S07 | LT | Sodra daily insured; monthly averages | C | 48.6% insured; 18.8% avg wage | bulk; licence verified N (none stated, public by law); wage only if > 3 insured |
| S07 | LV | VID quarterly employees; FS employees; salary derived from social contributions | B | 54-58% (salary 48%) | bulk; licence verified Y; average salary not published, derived estimate |
| S07 | EE | EMTA taxes paid, turnover, employees | B | 26.9% | bulk; licence verified Y (CC BY-SA 3.0, share-alike); quarterly employee count; no average salary (EMTA warns against deriving it) |
| S08 | LT | VMI taxes paid; VMI arrears | A | 76.5% taxes paid; arrears list-based: 11.8% of active companies have overdue tax arrears | API; licence verified Y (CC BY 4.0); daily arrears |
| S08 | LT | Sodra daily debts | C | list-based: 15.4% of active companies have a social-insurance debt | bulk; licence verified N (none stated, public by law, art. 15(3)); daily |
| S08 | LV | VID taxes paid (quarterly, yearly); VID taxpayer rating | B | taxes 56%; rating 92% | bulk; licence verified Y; debt amount only per-query behind CAPTCHA; rating C = 5.4% |
| S08 | EE | EMTA taxes paid; EMTA tax debtors | B | 39.1% | bulk; licence verified Y (CC BY-SA 3.0); taxes paid quarterly; debtor list daily, known for every company, 6.2% of active companies listed |
| S09 | LT | JAR status; AVNT bankruptcy reports | B | 100% status; bankruptcy reports to 2025-10 | API + bulk; licence verified Y; no open pledges, arrests or notices |
| S09 | LV | Insolvency register; securing measures; suspensions; VID suspensions | A | 12% have an event; 0.5% open insolvency | bulk; licence verified Y; no pledge amounts; official notices (Latvijas Vēstnesis) need written agreement and fees |
| S09 | EE | register status, commercial pledges, share pledges, official notices | A | 100% | bulk; licence verified Y; status + pledges daily (CC BY 4.0), 1.6% have a commercial pledge; bankruptcy notices CC BY-SA 4.0 via URI XML |
| S10 | LT | none | D | 0% | per-query; licence verified N; courts' portal searchable by agents only |
| S10 | LV | Anonymised court rulings (metadata); case numbers from insolvency and securing measures | C | 0% joinable | bulk; licence verified Y; no party IDs; agent full-text later |
| S10 | EE | register rulings | D | 0% | bulk; licence verified Y; the 2.9 M rulings are registration decisions, not court cases; court cases not covered by these sources |
| S11 | all | EU consolidated financial sanctions list | A | official-ID match possible for 48.9% of entities, 75.0% of persons | bulk; licence verified Y; CC BY 4.0 / Commission reuse notice; 0 Baltic entities and 11 Baltic-linked persons listed; personal data, legal memo |
| S11 | all | UN Security Council consolidated list | C | official ID for 10.6% of entities, 63.8% of persons | bulk; licence verified Y; UN site terms: personal non-commercial use, no redistribution; 95% also in the EU list; fetch at query time only |
| S11 | LT | FNTT list of entities owned or controlled by sanctioned subjects | C | 16 entities, all with a company code | per-query (HTML page); licence verified N (none stated); agents fetch and cite at query time |
| S11 | LV | Enterprise Register sanctions links | B | <0.1% | bulk; licence verified Y; 63 rows; EU and UN screening via cross-border lists |
| S11 | LV | FIU list of sanctioned subjects with assets frozen in Latvia | A | 97% of 185 rows carry a birth date or registration number | bulk; licence verified Y (CC0); EU, UN and national regimes plus entities they own or control; complements the register's sanctions-links file |
| S11 | EE | Ministry of Foreign Affairs list of national-sanctions subjects | C | 4 persons, names only | per-query (HTML page); licence verified N (none stated); no official ID, so never a confirmed match under R8 |
| S12 | LT | VPT reports (to 2023); EU funds 2014-2020 | C | 4.5% tenderers; 3.2% EU funds | API; licence verified Y (catalogue); current procurement not open by supplier |
| S12 | LT | Kohesio projects + beneficiaries | B | 98.4% of beneficiaries joinable by register code | bulk; licence verified Y; CC BY 4.0; slow refresh (2021-27 rows unchanged March to October 2026) |
| S12 | LV | IUB procurement notices; CFLA EU-funded projects | A | 2.6% + 2.6% | bulk; licence verified Y; daily JSON and CSV; regcode join 99% |
| S12 | LV | Kohesio projects + beneficiaries | C | 32.1% of beneficiaries joinable; 0% of 2014-20 projects | bulk; licence verified Y; CC BY 4.0; most LV rows match by name only |
| S12 | EE | public procurement register (award notices) | B | 1.2% | bulk; licence verified Y (CC BY-SA 3.0); 1.2% of active companies won a contract in 12 months; 3,821 Estonian suppliers; EU funds via Kohesio (cross-border) |
| S12 | EE | Kohesio projects + beneficiaries | B | 97.3% of beneficiaries joinable | bulk; licence verified Y; CC BY 4.0; slow refresh |
| S13 | LT | JAR documents; statement filing dates; non-filer lists | B | 87.9% | API; licence verified Y; document type and date only, since 2024 |
| S13 | LV | FS filing years; memorandum dates | B | 74% | bulk; licence verified Y; documents themselves per-query at info.ur.gov.lv |
| S13 | EE | annual-report list, registry-card entries, rulings | A | 83.3% | bulk; licence verified Y; filing dates and entry types; full reports via contract API |
| S14 | LV | (none in LV open data) | D | 0% | none; licence verified N; exchange data not researched for LV |
| S14 | EE | none in this area | D | - | listed securities not researched here |
| S15 | LV | Applicant website in EU funds; winner websiteURI in procurement | C | <3% | bulk; licence verified Y; incidental only, the web agent fills it |
| S15 | EE | register contacts (WWW) | C | 6.3% of active business-form companies (5.6% of all active entities, as in osint.md) | bulk; licence verified Y; register website field only; web data is the osint area |
| S16 | LV | (none) | D | 0% | n/a; osint area |
| S16 | EE | none in this area | - | - | osint area |
| S17 | LT | shared addresses only | C | 100% address, 0% people | bulk; licence verified Y; no person links possible |
| S17 | LV | Officers + members + beneficial owners, linked by name + masked code (derived) | B | 49% | bulk; licence verified Y; collisions possible; person data only in company context |
| S17 | EE | person hash across card, member and BO files | A | 97.2% | bulk; licence verified Y; links people across companies without personal codes; legal memo decides how far a person network may be shown |
| S18 | LT | status, VMI arrears, non-filer flags, statements, taxes paid | A | 100% | bulk + API; licence verified Y; transparent inputs available |
| S18 | LT | Sodra debts and insured counts | C | 15.4% debt; 46.4% insured | bulk; licence verified N (none stated, public by law) |
| S18 | LV | VID rating; FS; insolvency; suspensions; minimum-wage employer list | A | 92% | bulk; licence verified Y; all inputs open |
| S18 | EE | derived from S02, S06-S09 | B | - | bulk; licence verified Y; status, key figures, tax debt, taxes paid, pledges, insolvency notices are all machine-readable |

## Open items

1. **Two-day diffs for LT and EE.** The snapshots of 19 Nov are stored. Run `research/probes/baltics/{lt,ee}/diff_pulls.py diff` after the next daily files, then fill the "Changed per day" column.
2. **Estonian register API (contract).**
   - Free, 50,000 answers a day, one query at a time. The application takes up to five working days.
   - It adds history, deleted companies and full annual reports. The bulk files cover everything else.
   - Needs a contract signed by the operator. Deferred under register decision C7 ("key pending").
3. **Latvian beneficial-owner concealment:** we can't yet see whether concealed owners leave the bulk file. Settle by diffing pulls weekly.
4. **Latvian deep links:** the per-company URL pattern of the official lookup site is unknown. Settle by opening it in a browser.
5. **LT API internal IDs:** unknown whether they survive a full reload. Key on the registry code after the join.
6. **LT post-2017 procurement licence page:** not read. Low priority, since that data has no supplier codes.
7. **Registry-code reuse after deletion:** not observed in LT or LV. Only the registers can confirm it.
8. **Courts:**
   - LV publishes anonymised ruling metadata (CC0) with no party IDs.
   - LT and EE have no bulk court data.
   - Agents search the court portals at query time (osint area).
