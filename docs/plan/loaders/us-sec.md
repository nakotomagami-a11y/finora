# us-sec: SEC EDGAR (filings, financials, insiders, offerings, large holders)

One loader package `packages/sources/src/us/sec/` with five sources that share the SEC fetcher. Research: `docs/research/us.md` §1. **Nothing here is enabled without `SEC_USER_AGENT`** (Part G: the US public profile is `needs_key` until it is set). Every number marked *verify* comes from SEC documentation, because live EDGAR calls are deferred until the key-testing round (register C7); the key-testing round runs `research/probes/us/edgar_probe.py` and updates this spec.

## Source

| `id` | What | Endpoint | Storage | Cadence |
|---|---|---|---|---|
| `us-sec-tickers` | company list with tickers and exchanges | `https://www.sec.gov/files/company_tickers_exchange.json` | `store` | daily (after 06:00 UTC) |
| `us-sec-company` | submissions + XBRL company facts per CIK | `https://data.sec.gov/submissions/CIK##########.json`; `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` | `store` | `on-view` |
| `us-sec-insiders` | Forms 3/4/5 quarterly data sets, last 8 quarters | `https://www.sec.gov/files/structureddata/data/insider-transactions-data-sets/<yyyy>q<n>_form345.zip` *verify path* | `store` | quarterly |
| `us-sec-formd` | Form D quarterly data sets, last 8 quarters | `https://www.sec.gov/files/structureddata/data/form-d-data-sets/<yyyy>q<n>_d.zip` | `store` | quarterly |
| `us-sec-holders` | Schedules 13D/13G XML about a company | daily index `https://www.sec.gov/Archives/edgar/daily-index/<yyyy>/QTR<n>/company.<yyyymmdd>.idx`, then `https://www.sec.gov/Archives/edgar/data/<cik>/<accession>/primary_doc.xml` | `store` | index daily; documents `on-view` |

- `publisher`: U.S. Securities and Exchange Commission. `officialHosts`: `www.sec.gov`, `data.sec.gov`.
- `licence`: `sec-public` ("Information presented on sec.gov is considered public information and may be copied or further distributed by users of the web site without the SEC's permission"; https://www.sec.gov/about/privacy-information, verified 2026-11-19). `shareAlike` false, `nonCommercial` false, `redistribution` true.
- `attribution`: "Source: U.S. Securities and Exchange Commission (EDGAR), retrieved [date]." No SEC seal or logo; no product or feature is named "EDGAR" (SEC trademark).
- `requires`: `["SEC_USER_AGENT"]`: a string with an organisation or name and a real contact email. SEC refuses no-reply addresses (measured: 403). Never hard-coded, never logged.
- `limits`: `{ requestsPerSecond: 8 }` across the whole app (SEC: at most 10 per second from all machines), enforced by one shared token bucket in the polite fetcher; `Accept-Encoding: gzip`.
- `asOf` (strategies in order, §4.2):
  - tickers: `[http_last_modified]` (the file carries no date; rendered "as published by the portal").
  - submissions: `[max_date_in_data]` over `filings.recent.acceptanceDateTime`.
  - companyfacts: `[max_date_in_data]` over `facts.*.*.units.*[].filed`.
  - insider and Form D data sets: `[in_file_name]` (`2026q3_…zip` → 2026-09-30).
  - holders: index `[in_file_name]` (`company.20261118.idx`); documents `[in_file_field]` (the event date in the XML).
- `maxPurgeShare`: tickers 0.05 (daily list; delistings are few); insider and Form D data sets 0.15 (one quarter of eight leaves the window per load); on-view company and holder documents 0 (filings are never deleted).
- `deepLink`: company `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}`; filing `https://www.sec.gov/Archives/edgar/data/{cik}/{accessionNoDashes}/`.
- `orderUrl`: null. `cacheTtl`: none (`store`); on-view sources re-fetch when older than 24 h.
- Latency (SEC): submissions in under a second after acceptance, XBRL APIs under a minute. Nightly bulk zips (`submissions.zip`, `companyfacts.zip`) exist but are not used in v1: on-view fetches are cheaper than a multi-GB nightly download (*verify sizes in the key-testing round*).

## Items

| item_id | Call | Caveat | Empty state | Source |
|---|---|---|---|---|
| S01.US.01 | SHOW | - | KEY ("needs the SEC contact setting") | us-sec-company, us-sec-tickers |
| S03.US.01 | CAVEAT | Current roles only; past roles are not published. People appear only in this company's context | needs_purpose; then NP | us-sec-insiders |
| S03.US.02 | CAVEAT | same as S03.US.01 | needs_purpose; then NP | us-sec-formd |
| S04.US.01 | CAVEAT | Large holders as filed with the SEC; people appear only in this company's context | KEY / needs_purpose | us-sec-holders |
| S04.US.02 | CAVEAT | same as S04.US.01 | KEY / needs_purpose | us-sec-insiders |
| S06.US.01 | SHOW | - | KEY | us-sec-company |
| S07.US.03 | CAVEAT | From the annual report (self-reported) | KEY | us-sec-company |
| S13.US.01 | SHOW | - | KEY | us-sec-company |
| S14.US.01 | CAVEAT | Insider transactions as filed; people appear only in this company's context | KEY / needs_purpose | us-sec-insiders |
| S14.US.02 | SHOW | - | - | us-sec-tickers |

LATER, not read: S03.US.04 (DEF 14A), S05.US.01 (EX-21), S14.US.03, S17.US.01. **HIDE, never loaded: OUT.US.01** (FEC individual contributions; not an SEC source, named here because it is the only US HIDE id): no loader exists, and `domain/src/items/hide.test.ts` asserts that no source registry entry, field map or agent tool targets it.

## Field map

**us-sec-tickers** (`{ fields: [...], data: [[...]] }`)

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `cik` | int | entity key `us-cik-<10 digits>` | resolution key | no | zero-pad to 10 |
| `name` | text | `Company.name` (search) | S01.US.01 | no | |
| `ticker` | text | `Security.ticker` | S14.US.02 | no | upper case |
| `exchange` | text | `Security.exchange` | S14.US.02 | no | values as published (e.g. Nasdaq, NYSE, OTC, CBOE) |

**us-sec-company: submissions**

| Source field | Type | Target | item_id | Personal? | Transform and validation |
|---|---|---|---|---|---|
| `cik` | text | entity key | resolution key | no | |
| `name` | text | `Company.name` | S01.US.01 | no | |
| `formerNames[].name`, `.from`, `.to` | text, dates | `previousName` + event `finora.renamed` dated `to` | S01.US.01 | no | |
| `entityType` | text | `legalForm` (verbatim) | S01.US.01 | no | e.g. operating, other |
| `sic`, `sicDescription` | text | `sector` | S01.US.01 | no | |
| `stateOfIncorporation`, `stateOfIncorporationDescription` | text | `jurisdiction` | S01.US.01 | no | `us-<state>` |
| `ein` | 9 digits | `taxNumber` | resolution key | no | keep only `^\d{9}$`; `000000000` dropped |
| `fiscalYearEnd` | MMDD | `fiscalYearEnd` | S01.US.01 | no | |
| `addresses.business.*` | text | `Address` | S01.US.01 | no | company address |
| `category` | text | `filerCategory` | S01.US.01 | no | e.g. large accelerated filer |
| `website` | text | `website` | S01.US.01 | no | |
| `filings.recent.accessionNumber`, `form`, `filingDate`, `acceptanceDateTime`, `primaryDocument`, `items` | arrays | event `filing.<form>` (e.g. `filing.10-K`, `filing.8-K`), data = accession, items | S13.US.01 | no | last 5 years only; `items` split on comma |
| `filings.recent.items` contains `5.02` | | extra event `filing.8k.5.02` "Officer change (8-K item 5.02)" | S13.US.01 | no | the sentence of who changed is an agent task, never parsed into a name |
| `phone`, `addresses.mailing`, `flags`, `insiderTransactionFor*Exists`, `tickers`, `exchanges`, `description`, `investorWebsite` | | dropped | - | - | tickers come from `us-sec-tickers` |
| `filings.files[]` (older pages) | | not fetched | - | - | history older than `filings.recent` is not needed for 5 years of events (*verify* that `recent` always covers 5 years; if not, fetch the first older page only) |

**us-sec-company: companyfacts.** Only these concepts are read, latest 5 fiscal years, annual (`fp = FY`, forms 10-K, 10-K/A, 20-F, 40-F), deduplicated by `end` date with the latest `filed` winning:

| Concept (taxonomy:name, first found wins) | Fact concept | item_id |
|---|---|---|
| us-gaap: Revenues, RevenueFromContractWithCustomerExcludingAssessedTax, SalesRevenueNet; ifrs-full: Revenue | `revenue` | S06.US.01 |
| us-gaap: NetIncomeLoss; ifrs-full: ProfitLoss | `net_profit` | S06.US.01 |
| us-gaap: Assets; ifrs-full: Assets | `total_assets` | S06.US.01 |
| us-gaap: Liabilities; ifrs-full: Liabilities | `total_liabilities` | S06.US.01 |
| us-gaap: StockholdersEquity; ifrs-full: Equity | `equity` | S06.US.01 |
| us-gaap: CashAndCashEquivalentsAtCarryingValue; ifrs-full: CashAndCashEquivalents | `cash` | S06.US.01 |
| us-gaap: NetCashProvidedByUsedInOperatingActivities; ifrs-full: CashFlowsFromUsedInOperatingActivities | `operating_cash_flow` | S06.US.01 |
| dei: EntityNumberOfEmployees | `employees` | S07.US.03 |

Each fiscal year is one `fact_reports` row (`kind = annual_accounts`, `period_start`, `period_end`, `currency` from the unit key, `unit_scale = 1`). All other concepts are not read.

**us-sec-insiders** (tab-separated tables inside each quarterly zip; table and column names *verify* against the data-set PDF in the key-testing round)

| Table.field | Target | item_id | Personal? | Transform |
|---|---|---|---|---|
| SUBMISSION.ACCESSION_NUMBER, ISSUERCIK, FILING_DATE, DOCUMENT_TYPE, AFF10B5ONE | event `filing.form345`; record key | S14.US.01 | no | issuer must be a `us-cik-*` entity; `AFF10B5ONE` shown as "Trading plan (Rule 10b5-1) flagged" |
| REPORTINGOWNER.RPTOWNERCIK, RPTOWNERNAME, RPTOWNER_RELATIONSHIP, RPTOWNER_TITLE | `Person` (or `LegalEntity` for a 10% owner, see party gate) in a `Directorship` or `Ownership` of the issuer | S03.US.01 (officer, director), S04.US.02 (ten percent owner) | **yes** | `RPTOWNERCIK` is used only inside the HMAC person id (§3.3) and is never stored or shown; roles: Director, Officer, TenPercentOwner, Other |
| NONDERIV_TRANS.TRANS_DATE, TRANS_CODE, TRANS_SHARES, TRANS_PRICEPERSHARE, TRANS_ACQUIRED_DISP_CD | aggregated per issuer and calendar quarter: `fact_reports(kind = insider_quarter)` with `shares_bought` (code P), `shares_sold` (code S), `value_bought`, `value_sold`, `filings` | S14.US.01 | no | only P and S feed net buys and sells; other codes (A, F, M, G, J, ...) are counted in `other_transactions` |
| owner addresses, footnotes, derivative tables | dropped | - | - | |

"Current roles" = an owner with a Form 3, 4 or 5 for this issuer in the last 12 months. The role row is replaced on each quarterly load, and a role that drops out emits `finora.role_ended` with no name.

**us-sec-formd** (tables FORMDSUBMISSION, ISSUERS, OFFERING, RELATEDPERSONS)

| Table.field | Target | item_id | Personal? | Transform |
|---|---|---|---|---|
| ISSUERS.CIK, ENTITYNAME, ENTITYTYPE, JURISDICTIONOFINC, YEAROFINC, STREET1, CITY, STATEORCOUNTRY, ZIPCODE | `us-cik-*` entity (creates one if absent): name, legal form, jurisdiction, address | S01.US.01 | no | only primary issuers (`IS_PRIMARYISSUER_FLAG = YES`) *verify column name* |
| FORMDSUBMISSION.ACCESSION_NUMBER, FILING_DATE, SUBMISSIONTYPE | event `filing.formd` | S13.US.01 | no | |
| OFFERING.INDUSTRYGROUPTYPE, REVENUERANGE, TOTALOFFERINGAMOUNT, TOTALAMOUNTSOLD | event data on `filing.formd` (revenue band verbatim, e.g. "$1 - $1,000,000", "Decline to Disclose") | S13.US.01 | no | |
| RELATEDPERSONS.FIRSTNAME, LASTNAME, RELATIONSHIP_1..3 | `Person` in a `Directorship` (roles: Executive Officer, Director, Promoter) | S03.US.02 | **yes** | address columns dropped |
| RECIPIENTS (sales compensation) | dropped | - | - | |

**us-sec-holders**

| Source field | Target | item_id | Personal? | Transform |
|---|---|---|---|---|
| daily `company.idx` rows with form `SCHEDULE 13D`, `SCHEDULE 13D/A`, `SCHEDULE 13G`, `SCHEDULE 13G/A` | index of (subject CIK, accession) | resolution key | no | a 13D/G appears twice in the index (subject and filer); keep pairs where the CIK is a subject company *verify in the key-testing round* |
| `primary_doc.xml`: issuer CIK, CUSIP, reporting person name, citizenship or place of organisation, type of reporting person, aggregate amount, percent of class, event date | `Ownership` of the subject company: owner name, percent, shares, as-of event date | S04.US.01 | **yes** when the type of reporting person is IN (individual); otherwise no | numeric values only (the XML schema enforces numbers); last 3 years; the newest filing per reporting person wins |

## Party gate

- 10% owners (Forms 3/4/5) and 13D/G reporting persons may be people or companies. A 13D/G row carries "type of reporting person" (IN = individual; CO, PN, IA, BD, HC, ... = organisations): IN rows are `Person` (personal, purpose gate); others are `LegalEntity` and shown as companies. Forms 3/4/5 owners carry no type: **all are treated as personal** (purpose gate) and never linked to another company.
- Drop reasons: `owner_type_missing` (13D/G with no type: treated as personal, counted), `issuer_not_company` (a data-set row whose issuer CIK has no submissions).

## Identity and joins

- `eid` `us-cik-<10-digit CIK>`, stable for life. CIK ↔ ticker from `us-sec-tickers`. CIK ↔ LEI only through GLEIF (`gleif.md`); SEC files carry no LEI. CIK ↔ EIN from submissions (fill *verify*).
- People: HMAC person id over source, company eid and the owner CIK or name (§3.3); the owner CIK itself is never stored.
- Search: public companies are found by name or ticker from `us-sec-tickers` (about 10,000 rows) and by Form D issuer name.

## Refresh and change

- Tickers: content hash per daily file; row hash per CIK; removed CIKs lose their `Security` statements (delisted), the company stays.
- Company (on view): re-fetch when older than 24 h; row hash per document section; events added, never deleted (filings don't disappear).
- Insiders: one record per issuer and calendar quarter (A8): `record_key` = `insiders:<issuerCik>:<yyyy>q<n>`, holding the quarter's transaction aggregate and its filing events; `hashInput` = the quarter's rows (accession, owner key, code, shares, price) sorted by accession and row. Current roles are one record per issuer: `roles:<issuerCik>`, `hashInput` = sorted (owner HMAC id, relationship, title). On a new quarterly file, load it and drop the quarter that leaves the 8-quarter window; unchanged quarters write nothing.
- Form D: one record per filing: `record_key` = `formd:<accession>`, `hashInput` = the issuer, offering and related-person lines in table order.
- Tickers: one record per CIK: `tickers:<cik>`. Company: `submissions:<cik>` and `companyfacts:<cik>` (one record each per company, grouped as A8). Holders: `holders:<subjectCik>:<accession>`.
- Holders: index rows appended daily; documents fetched on view, cached as records.
- History events: `finora.renamed` (from `formerNames` and from changes between fetches), `finora.role_ended` (insider roles), `filing.*` events.

## Size and time budget

All estimated until the key-testing round:
- tickers ≈ 10,000 entities × 4 statements ≈ 5 MB.
- Insiders, 8 quarters: ≈ 400,000 filings, ≈ 600,000 transactions aggregated into ≈ 90,000 issuer-quarter fact reports, ≈ 120,000 current person roles ≈ 0.1 GB. Download 8 × ~8 MB.
- Form D, 8 quarters: ≈ 150,000 filings, ≈ 120,000 issuers, ≈ 450,000 related persons ≈ 0.4 GB. Download 8 × ~3.5 MB.
- On-view company data: ≈ 20-60 KB per opened company.
- US total ≈ 0.5 GB, inside the 10 GB store with the Baltic budgets. Proposed P10 line: **US ≤ 1 GB** (P10 has no US line yet; cto to confirm).
- First load (tickers + 16 quarterly zips): ≈ 2-4 min; quarterly refresh ≈ 30 s; company open ≈ 2 requests, < 1 s.

## Fixtures

- `fixtures/us/sec/`: a tickers JSON with 3 companies; submissions and companyfacts JSON for CIK `9900000001` (reserved range `99xxxxxxxx`, §3.4) including one 8-K with items `5.02,9.01`, two former names, five fiscal years in us-gaap and one year with only ifrs-full; a quarterly insider zip (tables as tab-separated text) with one officer, one director, one 10% owner and P/S/A/M transactions; a Form D zip with one issuer and two related persons; a 13D XML with type IN and a 13G XML with type CO.
- Layout writer `fixtures/us/sec.ts` generates these from the seed; all names fictional.

## Tests

| File | Proves |
|---|---|
| `sources/src/us/sec/tickers.test.ts`, `company.test.ts`, `insiders.test.ts`, `formd.test.ts`, `holders.test.ts` | parsing, field map = `meta.items`, every value has an item id |
| `sources/src/us/sec/companyfacts.test.ts` | concept fallback order; 5-year window; duplicate `end` dates resolved by latest `filed`; IFRS company handled |
| `sources/src/us/sec/items-502.test.ts` | an 8-K with item 5.02 produces `filing.8k.5.02`; no person name is extracted |
| `ingest/src/sec-fetcher.test.ts` | no request leaves without `SEC_USER_AGENT`; 8 requests per second across concurrent loaders; the User-Agent never appears in logs |
| `ingest/src/insiders-window.test.ts` | the 9th quarter is dropped; a role missing from the new window emits `finora.role_ended` without a name |
| `ingest/src/party-gate.test.ts` (SEC cases) | 13D/G type IN → personal person; type CO → company; Forms 3/4/5 owners → personal |
| `domain/src/items/hide.test.ts` | OUT.US.01 has no loader, field map or agent tool |
| `web/e2e/us-public-needs-key.spec.ts` | with no `SEC_USER_AGENT`, a US public profile shows KEY states and promises nothing |

## Failure modes

| Case | Behaviour | UI |
|---|---|---|
| `SEC_USER_AGENT` missing | sources disabled at boot | KEY: "needs the SEC contact setting" |
| 403 (User-Agent refused) | disable SEC sources for the session; health check names the cause | KEY with "SEC refused the contact setting" |
| 429 or 503 | back off 10 min (SEC's rule: wait until the rate falls below the threshold for 10 minutes) | cached values with their date, else `not_checked{reason: "source_down"}` |
| Data-set layout changed | the quarter fails with `schema_changed`; the previous quarters stay | CAVEAT rows keep their last date |
| A CIK has no companyfacts | normal: many filers have no XBRL | S06 `partial` "No financial data filed with the SEC" |

## Open questions

Resolved in the key-testing round (C7), not by the builder: the exact insider data-set path and column names, the Form D primary-issuer column, whether 13D/G subject pairs are reliable in `company.idx`, EIN fill, and the measured sizes. The probes are ready: `research/probes/us/edgar_probe.py bulk | submissions | companyfacts | formd | sched13 | items`.
