# United States: source catalog, display rows and reality check

Owner: `data-us`. Measured 2026-11-19 and 2026-11-20 unless a line says otherwise. Every count names the probe that produced it; probes are in `research/probes/us/` and run from a clean checkout with `python -I <script>` (Python 3.12+, standard library only). Downloads and entity-level output stay in the gitignored `research/.cache/us/`.

## Summary

- **The US splits in two.** Public companies get deep, free, redistributable data from SEC EDGAR (filings, XBRL financials, insiders, 8-K events, large holders). Small private businesses get only what their state registry publishes, plus federal side-signals (federal contracts, pandemic loans, trucking authority, federal court dockets).
- **SEC EDGAR is not measured yet.** EDGAR answers 403 unless the User-Agent carries a real contact address; GitHub no-reply addresses are refused too. The probes are written (probe `edgar_probe.py`) and run as soon as `SEC_USER_AGENT` is set in the main checkout's `.env` (coordinator's human-task, item 1). Every EDGAR line below marked *deferred: `SEC_USER_AGENT` pending* is from SEC's own documentation, not from a measurement.
- **Five states publish free bulk people data:** FL (six officer slots), CT (principals), PA (parties), NY (chief executive of corporations only) and OR (authorised representative). CO publishes only the registered agent; WA publishes contractor-licence principals. **CA and DE have no free bulk data:** CA sells bulk orders, DE charges per status query.
- **No US source publishes private-company financials, owners or employees.** The reality check confirms it: S04 Owners, S05 Group and S06 Financials are empty for all five private samples.
- **Courts:** the federal Integrated Database is free and bulk, but only civil cases carry party names; bankruptcy records carry no debtor name at all. CourtListener has 73 M dockets in free bulk files; its API needs a free token and allows 125 requests a day. PACER costs $0.10 a page.
- **Legal limits that change the UI:** FEC individual-donor data may not be used for commercial purposes (52 U.S.C. 30111(a)(4)); FINRA BrokerCheck data may be compiled only for investor-protection, compliance, academic or regulatory purposes, with source, date and an error-correction channel; CT principals and FMCSA records carry home addresses and emails that must not be shown.

## How to read this

- Template and grades: `docs/research/README.md`.
- "Fill" in a source entry is measured on the whole file unless it says "sample".
- Legal rule numbers (R1-R17) refer to the product rules at the end of `docs/research/legal.md`.
- Answers to the cto's, architect's and designer's questions are in section 7, plus **Architecture facts** lines under the state entries.

---

## 1. SEC EDGAR

Common to every EDGAR source:
- **Licence:** "Information presented on sec.gov is considered public information and may be copied or further distributed by users of the web site without the SEC's permission." SEC asks to be cited as the source and forbids using its seal or logos; "EDGAR" is an SEC trademark, so no product or feature may be named after it. URL: https://www.sec.gov/about/privacy-information, verified 2026-11-19.
- **Access rules:** User-Agent with a contact (SEC's example: company name plus admin email), at most 10 requests per second across all machines; automated "unclassified" crawling is blocked. Verified on the same page and https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data, 2026-11-19. Measured: a User-Agent without an address, or with a GitHub no-reply address, gets HTTP 403 on both `www.sec.gov` and `data.sec.gov`.
- **Keys and cost:** none. **Blocking dependency:** `SEC_USER_AGENT` (human-task).
- **Change feed:** daily index files (`/Archives/edgar/daily-index/YYYY/QTRn/form.YYYYMMDD.idx`), rebuilt nightly from 10 p.m. ET; submissions JSON updates in under a second, XBRL APIs in under a minute (SEC API page, verified 2026-11-19).
- **Deep link:** `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000000000` per company; `https://www.sec.gov/Archives/edgar/data/<cik>/<accession without dashes>/` per filing.
- **Attribution text (proposed):** "Source: U.S. Securities and Exchange Commission (EDGAR), retrieved <date>."
- **Person identity:** insiders and reporting persons have their own CIK (10 digits), stable for life. No birth dates or personal codes.

### 1.1 Submissions and company tickers
- Publisher and URL: SEC, `https://data.sec.gov/submissions/CIK##########.json`; ticker map `https://www.sec.gov/files/company_tickers_exchange.json`; nightly bulk `submissions.zip`.
- Access: JSON API per company, plus nightly bulk zip (republished around 3 a.m. ET).
- Fields (SEC documentation): CIK, name, former names with dates, tickers, exchanges, SIC code and description, state of incorporation, fiscal year end, business and mailing address, phone, EIN, filer category, and the filing list (accession, form, filing and acceptance time, report date, **8-K item numbers**, primary document, XBRL flags).
- Rows, fill, sizes, latency: *deferred: `SEC_USER_AGENT` pending* (probe `edgar_probe.py bulk`, `edgar_probe.py submissions 300`).
- Join keys: CIK (10 digits, zero-padded, never reissued) ↔ ticker (company_tickers_exchange); CIK ↔ EIN (in submissions; fill *deferred: `SEC_USER_AGENT` pending*); CIK ↔ LEI only through GLEIF (no LEI in submissions).
- Tested with: `research/probes/us/edgar_probe.py` (written, not yet run).
- Verdict: **use** for every public company and Form D filer. Grade A once measured.

### 1.2 XBRL company facts (financials)
- URL: `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json`, `companyconcept`, `frames`; nightly bulk `companyfacts.zip`.
- Taxonomies served: us-gaap, ifrs-full, dei, srt (SEC page names these four; whether `ecd` pay-versus-performance tags are included is *deferred: `SEC_USER_AGENT` pending*).
- Fields: every reported concept by period, unit, form, filing date and accession. History back to 2009 for large filers.
- Fill of revenue, net income, assets, equity, cash, operating cash flow, shares outstanding, public float, employees: *deferred: `SEC_USER_AGENT` pending* (probe `edgar_probe.py companyfacts 300`).
- Money: USD; fiscal years differ from calendar years (field `fy`, `fp`, `start`, `end` per fact).
- Verdict: **use** (S06 for public companies).

### 1.3 Forms 3, 4 and 5 (insiders)
- Publisher: SEC. Two sources: the live filings (XML in each filing folder) and the quarterly **Insider Transactions Data Sets** (https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets: quarterly since 2006 Q1, latest 2026 Q3 at 8.26 MB, verified 2026-11-19).
- Measured on a local 10-year store built from those data sets (read-only, aggregates only; `research/probes/us/forms345_local.py`, run 2026-11-19, 4 min 43 s):

| Measure | Value |
|---|---|
| Filings | 2,031,218 (Form 4: 1,812,337; Form 3: 156,421; Form 5: 22,076; amendments: 40,384) |
| Period | 2016-10-03 to 2026-11-05 (40 quarters, 2016Q4-2026Q3) |
| Issuers | 11,930 |
| Distinct insiders | 155,103 (2,211,268 insider-filing rows) |
| Roles | officer 860,412; director 758,457; director + officer 213,360; 10% owner 200,842; other combinations ~178k |
| Officer title filled | 51.0% of insider rows (titles exist only for officers) |
| Transactions | 3,057,075; price filled 93.2%; codes S 878k, A 633k, F 484k, M 447k, P 310k |
| 10b5-1 plan flag | set on 64,843 filings, "no" on 572,838, blank before the field existed (July 2025 data-set change) |

- Rebuild cost for the open-source app (the local store can't ship): 40 quarterly zips; the latest is 8.26 MB, so roughly 300-400 MB in total (**estimated**; exact sizes *deferred: `SEC_USER_AGENT` pending* a HEAD per file). One pass, then quarterly.
- Person identity: reporting owner CIK. Roles and titles as filed.
- Legal: insiders are natural persons, but filing is a statutory public disclosure; show only in the company's context (R2-R4).
- Verdict: **use** (S03 officers and directors of public companies, S14 insider trades, S04 10% owners).

### 1.4 Form D (exempt offerings, including private companies)
- URL: quarterly **Form D Data Sets**, https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets (latest 2026 Q3, 3.48 MB; page updated 2026-09-30; files back to 2008 Q1; verified 2026-11-19).
- Tables (from the data-set documentation): FORMDSUBMISSION, ISSUERS, OFFERING, RELATEDPERSONS (executive officers, directors and promoters by name, with relationship and city/state), RECIPIENTS (sales compensation).
- Rows, fill of related persons, revenue range ("decline to disclose" share), issuers per quarter: *deferred: `SEC_USER_AGENT` pending* (probe `edgar_probe.py formd 2026q3`).
- Why it matters: Form D is the only free federal source that names the **officers of private companies** that raise money, and it gives a revenue band.
- Verdict: **use** once measured.

### 1.5 Schedules 13D and 13G (large holders)
- Structured XML has been required since 2024-12-18 for the whole cover page; exhibits stay HTML (SEC beneficial-ownership rule amendments; technical specification v2.x on https://www.sec.gov/submit-filings/technical-specifications).
- Fields to measure: issuer CIK and CUSIP, reporting person name and CIK, citizenship or place of organisation, shares, percent of class, type of reporting person. Fill: *deferred: `SEC_USER_AGENT` pending* (probe `edgar_probe.py sched13 <dates>`).
- Verdict: **use** (S04 for public companies).

### 1.6 8-K item 5.02 (officer and director changes)
- **Feasibility question answered:** EDGAR does carry 8-K item numbers. On the local store (copied from EDGAR's submissions feed), all 1,042 8-Ks filed 2026-11-04 to 2026-11-06 carried item numbers, and 90 (8.6%) included item 5.02.
- Item 5.02 covers departures, elections, appointments and compensation of directors and officers in one item. Telling "CEO left" from "new director" needs the filing text: keyword rates (resign, retire, appoint, elect, terminat) are *deferred: `SEC_USER_AGENT` pending* (probe `edgar_probe.py items <dates>`).
- Verdict: **use** for S13 events; the "who left" sentence is an agent task with a citation to the filing.

### 1.7 DEF 14A (proxy statements)
- Since fiscal 2022, the pay-versus-performance table is tagged inline XBRL (`ecd:` taxonomy), including the principal executive officer's name (`ecd:PeoName`) and pay.
- Share of companies with a DEF 14A since June 2025, and share with `ecd` tags: *deferred: `SEC_USER_AGENT` pending* (probe `edgar_probe.py def14a 300`).
- Verdict: **use** as an agent-read document for board and pay; structured part only after measurement.

### 1.8 Exhibit 21 (subsidiaries)
- Free-form HTML or text attached to the 10-K: subsidiary name and jurisdiction, no identifiers.
- Share of 10-K filers with an EX-21 and typical length: *deferred: `SEC_USER_AGENT` pending* (probe `edgar_probe.py ex21 300`).
- Verdict: **use with caveat** (S05 for public companies): names only, matched to registries by an agent, never auto-linked.

---

## 2. State business registries

All except Florida are published on Socrata open-data portals: SoQL API, no key (an optional free app token raises limits), JSON or CSV export, `rowsUpdatedAt` in metadata. Probe: `research/probes/us/states/socrata_probe.py` (columns, `count(*)`, metadata licence and attribution), run 2026-11-19.

| State | Dataset (portal id) | Rows | Updated (seen) | Licence on the official portal | People fields |
|---|---|---|---|---|---|
| NY | Active Corporations (`n9v6-gdp6`) | 4,284,155 | 2026-11-19 (monthly snapshot) | OPEN-NY Terms of Use | chairman/CEO name (business corporations only), registered agent, process recipient |
| NY | All Filings (`63wc-4exh`) | 21,172,729 | 2026-11-18 | same | filer name |
| NY | Entity Status History (`3gg2-jgnp`) | 21,172,729 | 2026-11-17 | same | none |
| NY | Daily filings (`k4vb-judh`) | 160,952 | 2026-11-19 (daily) | same | filer, service-of-process name |
| CO | Business Entities (`4ykn-tg5h`) | 3,140,873 | 2026-11-19 (daily) | Public Domain | registered agent only |
| CO | Transaction History (`casm-dbbj`) | 21,847,648 | 2026-11-19 | Public Domain | none |
| CO | UCC Debtors (`8upq-58vz`) | 2,030,256 | 2026-11-19 | Public Domain | debtor names (people and firms) |
| OR | Active Businesses (`tckn-sxa6`) | 1,592,149 name rows | 2026-11-17 (weekly) | none stated on this dataset; "Public Domain U.S. Government" on sibling datasets | authorised representative, registered agent |
| OR | Construction Contractors Board licences (`g77e-6bhs`) | 56,647 | 2026-11-19 | Public Domain U.S. Government | licence holder name, phone, bond and insurance |
| CT | Business Master (`n7gp-d28j`) | 1,308,957 | 2026-11-19 (daily) | Public Domain | none |
| CT | Principals (`ka36-64k6`) | 1,805,128 | 2026-11-19 | none stated | principal name, title, business **and residence** address |
| CT | Agents (`qh2m-n44y`) | 1,327,058 | 2026-11-19 | none stated | agent name, phone, email |
| CT | Filing History (`ah3s-bes7`) | 10,119,093 | 2026-11-19 | none stated | organiser and incorporator names |
| CT | UCC Liens (`xfev-8smz`) | 851,074 | 2026-11-19 | Public Domain | debtor and secured-party names |
| PA | Registered Businesses (`xvd7-5r2c`) | 4,200,322 party rows | 2026-11-03 | Public Domain U.S. Government | party first and last name, party type |
| WA | Contractor licences (`m8qx-ubtq`) and principals (`4xk5-x9j6`) | 161,862 and 251,688 | 2026-11-19 | ODC Public Domain Dedication and Licence | principal name, start and end date |
| DE | Business Licenses (`5zy2-grhr`) | 74,418 | 2026-11-19 | Public Domain | none (a tax licence list, not the corporate registry) |

### 2.1 New York — Department of State, Division of Corporations
- Access: Socrata API and bulk CSV on data.ny.gov; no key.
- Licence: OPEN-NY Terms of Use (PDF linked from the NY Open Data Handbook, https://data.ny.gov/download/77gx-ii52/application/pdf, read 2026-11-20): "use our government information however you wish, in private sector projects or in government collaborations", and the terms "do not contain restrictions requiring members of the public to use attribution, to re-post the license terms … to impose share-alike or technical restrictions". Attribution shown in the portal metadata: "New York State Department of State".
- Coverage: active entities only in the master file; inactive ones appear in All Filings and Status History. The portal's own limitation note: the current name only (former names are in the filings file), and the service-of-process address "may not reflect the physical location of the corporation or any of its officers".
- People: the chairman/CEO name is filed only by business corporations; LLCs (most small firms) show no person except a registered agent, if any.
- Architecture facts: key `dos_id` (numeric, stable). Full snapshot monthly plus a daily filings file (change feed). Status history keeps dated status changes.
- Verdict: **use** (S01, S02, S13; S03 partial).

### 2.2 Florida — Division of Corporations (Sunbiz)
- Access: public SFTP (`sftp.floridados.gov`, public login printed on the Sunbiz data-usage guide). Daily files `doc/cor/YYYYMMDDc.txt` (~3-5 MB each, published nightly, latest seen 2026-11-18) and a quarterly full file `doc/Quarterly/Cor/cordata.zip` (1,793,034,019 bytes, dated 2026-10-07) plus `corevent.zip` (195 MB). Fixed-width text, 1,440 bytes per record, Latin-1.
- Fields: document number (12), name (192), status, filing type, principal and mailing address, file date, FEI/EIN, "more than six officers" flag, last transaction date, state of formation, registered agent, and **six officer slots** (title code, person-or-company flag, name, address).
- Measured on the 2026-11-18 daily file (2,934 records; `research/probes/us/states/florida_sunbiz.py profile`): 92.5% have at least one officer; officers per record 1 (1,923), 2 (578), 3-6 (214); titles MGR, AMBR, P, VP, CEO, D; 94% of officers are persons. FEI filled on 1.6%. Longest name 93 characters. Quarterly file (dated 2026-10-07; 10 parts, 18.7 GB unzipped, Deflate64 so it needs `unzip`; profiled in 4 min 35 s): **12,987,601 records, 3,818,699 active**; filing types FLAL 6.61 M, DOMP 5.19 M, DOMNP 510k, foreign 568k; 95.9% have at least one officer (1: 7.04 M, 2: 3.54 M, 3-6: 1.88 M); FEI/EIN 70.8%; registered agent 97.4%; 83% of officers are persons. Inactive records stay in the file with status I, so FL has history of dissolved companies.
- Licence: unknown. The Sunbiz pages answer 403 to automated fetches, so no terms could be read; Florida's public-records law makes the records public, but that is not a reuse licence. **Licence verified: N.** To settle: read the data-usage guide in a browser.
- Verdict: **use with caveat** (best free US officer data; licence to confirm).

### 2.3 Colorado — Secretary of State
- Daily, Public Domain (portal metadata), attribution "CDOS". Names of officers are not published, only the registered agent. Status values include Good Standing, Delinquent (1,161,411), Administratively Dissolved, Exists, Converted. Transaction history and **UCC debtor** files make Colorado the only state here with both history and pledges in bulk.
- Architecture facts: key `entityid` (11 digits, year-prefixed). Full snapshot; terminated entities stay with a status.
- Verdict: **use** (S01, S02, S09, S13).

### 2.4 Oregon — Corporation Division
- One row per business per associated name (registered agent, authorised representative, principal place of business, mailing address). Weekly. People: names of authorised representatives and agents, no titles.
- Licence: none stated on the main dataset; sibling datasets from the same agency say "Public Domain U.S. Government". **Licence verified: partial.**
- Verdict: **use with caveat**.

### 2.5 Connecticut — Secretary of the State
- Daily. Principals file carries names, titles and **residence addresses** (personal data: never show the residence fields; R2, R4). Agents file carries phone and email (same rule). UCC liens in bulk.
- Licence: Public Domain on the master and UCC files; none stated on principals, agents and filing history. **Licence verified: partial.**
- Verdict: **use** (S01, S02, S03, S09, S13), residence and contact fields dropped at load.

### 2.6 Pennsylvania — Department of State
- One row per business and party (name, party type), with county. Public Domain U.S. Government. Updated 2026-11-03 (about monthly).
- Verdict: **use with caveat** (no status field; party types to map).

### 2.7 California — Secretary of State
- No free bulk data. The official records page says bulk data is ordered "through the BE & UCC Bulk Orders link" in bizfile Online; the price is not published on public pages (https://www.sos.ca.gov/administration/public-records-act-requests/business-entity-records, read 2026-11-20). An API exists behind a subscription key (secondary sources only; not verified).
- Verdict: **skip for v1** (grade D). Agents may read the public search page only if its terms allow; not checked.

### 2.8 Delaware — Division of Corporations
- No bulk data. Entity status costs $10 (status) or $20 (status with tax and history) per query (official site, quoted in search results; the fee page was not fetched). Officer names are filed in annual reports but are not published. About 40% of US LEI holders are Delaware entities (GLEIF, below), so most large companies have no free registry record beyond SEC.
- Verdict: **skip** (grade D).

### 2.10 Volumes, change feeds and how to load (cto's asks)

Measured 2026-11-20 with `research/probes/us/states/socrata_volumes.py 2` (rows whose Socrata system field `:updated_at` changed in the last 2 days) and the FL probe above.

| State | Dataset | Rows | Rows we'd load | Distinct entities | Columns | Rows changed in 2 days | Change feed |
|---|---|---|---|---|---|---|---|
| NY | Active Corporations | 4,284,155 | 4,284,155 (file is active-only) | 4,284,155 | 30 | 4,284,155 (full re-publish) | daily filings dataset (`k4vb-judh`, 160,952 rows) |
| CO | Business Entities | 3,140,873 | 2,214,539 (good standing, exists, delinquent) | 3,140,873 | 35 | 3,629 | **row-level**: `:updated_at` filter works |
| OR | Active Businesses | 1,592,149 name rows | 1,592,149 | 570,794 | 19 | 0 (weekly; last 2026-11-17) | weekly full; new-businesses dataset monthly |
| CT | Business Master | 1,308,957 | 460,495 (active) | 1,308,957 | 59 | 1,308,957 (full re-publish) | none: full daily |
| CT | Principals | 1,805,128 | for active businesses only | 1,101,102 businesses | 26 | 1,805,128 (full re-publish) | none |
| PA | Registered Businesses | 4,200,322 party rows | 4,200,322 | 2,386,129 | 17 | 0 (about monthly) | none |
| WA | Contractor licences | 161,872 | 161,872 | 161,872 | 23 | 161,872 (full re-publish) | none |
| FL | Quarterly corporate file | 12,987,601 | 3,818,699 (active) | 12,987,601 | 1,440-byte records | n/a | **daily delta files** (~3,000 records a day) |

Size at the cto's lean layout (123 bytes per statement), keeping about 10 fields per entity (id, name, status, type, formation date, address, county, agent) plus one statement per person:

| State | Entities loaded | Statements (estimated) | Size (estimated) |
|---|---|---|---|
| NY | 4.28 M | ~45 M | ~5.5 GB |
| CO | 2.21 M | ~22 M | ~2.7 GB |
| FL | 3.82 M | ~38 M + ~6.5 M officers | ~5.5 GB |
| PA | 2.39 M | ~26 M | ~3.2 GB |
| OR | 0.57 M | ~6 M | ~0.7 GB |
| CT | 0.46 M | ~5 M + ~0.7 M principals | ~0.7 GB |

**All six together are about 18 GB: well over the 10 GB budget before any Baltic data.**

**The alternative measured here: query live, cache what was looked up.** Every Socrata registry (NY, CO, OR, CT, PA, WA) answers a name-prefix query with no key in a median of 0.66-1.05 s (5 queries per portal, max 1.72 s; no rate-limit headers returned; a free Socrata app token, `SOCRATA_APP_TOKEN`, is the documented way to avoid shared throttling). So:
- **Proposal:** US state registries are queried live per search and per profile, and each entity looked up is cached in the store with its source and retrieval date. No bulk state load by default.
- **FL is the exception:** no API, only SFTP files. Proposal: opt-in bulk load of active FL entities (about 5.5 GB), refreshed from the daily delta files, off by default.
- **Trade-off:** live queries need the network and leave the portals' uptime in our path; search across all states at once becomes 5-6 parallel requests (about 1-2 s). Network-of-officers within a state (S17) needs the bulk file, so it stays LATER for the live states.
- Council session 1 decides which states load by default, as it planned.

### 2.11 Terms for live queries and caching (legal's question)

Read 2026-11-20. **No portal limits how long a query result may be kept.** Colorado's terms add an obligation (a disclaimer) and a right to revoke. The other portals disclaim warranties, may withdraw data, or don't state terms.

| State | Terms read (URL) | Use and reuse | Caching or retention limit | Other conditions |
|---|---|---|---|---|
| NY | OPEN-NY Terms of Use, https://data.ny.gov/download/77gx-ii52/application/pdf | "use our government information however you wish, in private sector projects or in government collaborations"; no attribution, share-alike or pre-approval required | none stated | none |
| CO | https://data.colorado.gov/terms (no date shown) | "By using data made available through this site, the user agrees to all the conditions…"; dataset licence Public Domain (portal metadata) | none stated | **Disclaimer required:** "Applications using data supplied by this site must include the following disclaimers on their sites: The data made available here has been modified for use from its original source, which is the State of Colorado. THE STATE OF COLORADO MAKES NO REPRESENTATIONS OR WARRANTY AS TO THE COMPLETENESS, ACCURACY, TIMELINESS, OR CONTENT OF ANY DATA MADE AVAILABLE THROUGH THIS SITE. THE STATE OF COLORADO EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE. The data is subject to change as modifications and updates are complete. It is understood that the information contained in the Web feed is being used at one's own risk." **Revocation:** the State may "require the termination of any and all displaying, distributing or otherwise using any or all of the data for any reason" |
| OR | No portal terms page: `https://data.oregon.gov/terms` answers 404. The footer's only terms link is the platform vendor's corporate terms (https://www.tylertech.com/terms, effective 2024-04-29), which contain no clause on data, caching or retention | main dataset: no licence stated; sibling datasets from the same division: "Public Domain U.S. Government" | none found | licence verified partial |
| CT | https://data.ct.gov/terms (no date shown) | data provided "as is" as a public service; no conditions on use; no attribution required | none stated | the State may "discontinue availability of content … at any time", and must "promptly correct or remove" inaccurate or protected data |
| PA | PA Data Policy, https://data.pa.gov/data-policy (no date shown) | "Data sets available through data.pa.gov are offered free and without restriction" | none stated | attribution requested, not required: "Data retrieved from data.pa.gov (https://www.data.pa.gov/)"; the policy may be amended "at any time and without further notice" |
| WA | No portal terms found: the "User Resources" page has none, and the federal catalogue's copy of the portal's Terms of Service is marked "to be retired" | dataset licence: Open Data Commons Public Domain Dedication and Licence (portal metadata) | none (PDDL sets none) | licence verified Y (dataset), portal terms N |

**API throttling (all six portals run on the same platform):** "requests that aren't using an application token come from a shared pool via IP address", while "currently we do not throttle API requests that are using an application token" (https://dev.socrata.com/docs/app-tokens.html, read 2026-11-20). No numeric limits are published; throttled requests get HTTP 429.

**What this means for the cache:**
- No time limit comes from the portals. Retention of person data (officers, principals, agents) is set by legal rule R11 and a lawyer, not by these terms.
- Every cached state record keeps its retrieval date and is refreshed from the source. A record the source withdraws or corrects (CT, CO) is replaced or purged on refresh, not kept.
- Wherever Colorado data is shown, the UI shows Colorado's disclaimer, for example behind the source chip.

### 2.9 Other states
- Texas: the "Active Franchise Taxpayers" dataset (`9cir-efmm`) did not answer the count query; not usable as tested.
- No other state with free bulk **officer** data was found on the Socrata catalogue search; IA, VT, AK and others were not checked individually. To settle: one pass over each Secretary of State's data page.

---

## 3. Courts

### 3.1 FJC Integrated Database (federal civil, criminal, appeals, bankruptcy)
- Publisher: Federal Judicial Center, https://www.fjc.gov/research/idb. Tab-delimited zips; civil `cv88on.zip` (329,665,474 bytes; 2.0 GB unzipped), bankruptcy `cpbank18on.zip` (887,034,431 bytes; 3.65 GB unzipped; Deflate64, needs `unzip`, Python's zipfile can't read it).
- Civil: 10,960,173 cases, 46 columns, filed through 2026-06-30; plaintiff name filled 99.8%, defendant 99.5%; about 29% of defendants look like organisations. Columns include nature of suit, origin, disposition, judgment and amount received.
- Bankruptcy: 12,405,433 cases, 87 columns (chapter 13: 7.37 M; chapter 7: 4.84 M; chapter 11: 170k). **No debtor name**, only ZIP and county, so a case can't be tied to a company.
- Licence: the page states none; FJC is a federal agency, so its work is a US Government work (17 U.S.C. 105; legal memo). **Licence verified: partial.**
- Probe: `research/probes/us/fjc_idb.py civil` (bankruptcy profiled with `unzip -p`).
- Verdict: civil **use with caveat** (name match only; "party names are as filed and may be a different company with the same name"); bankruptcy **skip** for profiles.

### 3.2 CourtListener / RECAP (Free Law Project)
- Bulk: 1,111 files on public S3, 1.78 TB in total; dockets 5.14 GB, 72,979,931 dockets, regenerated quarterly ("on the last day of March, June, September, and December"), latest 2026-09-30. About 7.7 M dockets have an organisation-like case name. Dockets sample (50,000 rows): case name 100%, docket number 94%, date filed 90%, nature of suit 22%.
- Licence (bulk): "Our bulk data files are free of known copyright restrictions." (https://wiki.free.law/c/courtlistener/help/api/bulk-data/bulk-legal-data, read 2026-11-20). No attribution requested.
- API v4: anonymous requests reach only `courts/`; dockets and search answer 401. With a free token: "authenticated users may make up to 5 requests per minute, 50 requests per hour, and 125 requests per day" (https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview, read 2026-11-20). Commercial agreements on request.
- Blocking dependency: `COURTLISTENER_TOKEN` (human-task item 2) for search; none for bulk.
- Probe: `research/probes/us/courtlistener.py`.
- Verdict: **use**: bulk dockets for name search over loaded data (S10), API for an agent's targeted look-ups within 125 a day.

### 3.3 PACER
- Fees (https://pacer.uscourts.gov/pacer-pricing-how-fees-work, read 2026-11-20): "$0.10 per page", "You won't be charged more than $3 per document", "Spend $30 or less on court records in a quarter and fees are WAIVED", audio "$2.40 per audio file". The page says nothing about automated access.
- Verdict: **later** (paid; needs the human's account). Link to the court's docket instead.

---

## 4. Other federal sources

### 4.1 USAspending.gov (federal contracts, grants, loans)
- API `https://api.usaspending.gov/api/v2/`, no key, no stated rate limit; monthly bulk archives (FY2026 contracts full file dated 2026-11-06). Awards data last updated 2026-11-19.
- Recipient table: 18,320,930 rows (parent, child and recipient levels). FY2026 award counts: contracts 4,712,741; direct payments 2,694,387; loans 1,086,502; grants 426,844.
- Recipient profile fields: name, alternate names, UEI, DUNS, parent UEI and name, business types, location, totals. Award fields: amount, agency, NAICS, PSC, place of performance, period, description. "Executive details" (top-5 officer pay) exist but were null in the sample.
- Licence: no statement on the API page; federal data, US Government work (17 U.S.C. 105). **Licence verified: partial.**
- Join keys: UEI (12 characters), parent UEI. Search by name is fuzzy: one keyword returned 24,597 recipients.
- Probe: `research/probes/us/usaspending.py`.
- Verdict: **use** (S12).

### 4.2 SAM.gov (registrations and exclusions)
- Public extracts through the keyless file service: monthly entity file `SAM_PUBLIC_UTF-8_MONTHLY_V2_20261101` (911,820 registrations, 142 pipe-separated columns; 149.6 MB zip) and a daily exclusions file (`…_26323`, 2026-11-19: 169,170 rows; 11.9 MB zip).
- Exclusions: individuals 133,929; special entity designations 25,552; firms 8,367; vessels 1,322. Agencies: HHS 70,282, OFAC 41,712, OPM 40,971, DOJ 3,174. UEI present on 47,692 rows.
- Entity API: key required; "Non-federal, no SAM.gov role: 10 requests/day; with a role: 1,000" (https://open.gsa.gov/api/entity-api/, read 2026-11-20). Public data: names, UEI, registration dates, addresses, business types, NAICS, and point-of-contact **names and addresses** (emails and phones are restricted).
- Licence: no statement on the pages fetched; US Government work. **Licence verified: partial.**
- Probe: `research/probes/us/sam.py --download`.
- Verdict: entity extract **use** (S01 UEI, S12 registered contractor); exclusions **use** (S11, risk signal, shown at any fill rate). API **later** (10 calls a day without a role).

### 4.3 FDIC BankFind Suite
- API `https://api.fdic.gov/banks/`, no key ("Users are currently not required to register…"), ETag support, rate-limit header 20. Institutions 27,835 (4,208 active); failures 4,117 (latest 2026-07-17); financials quarterly (latest report date 2026-06-30); data index built 2026-11-13.
- Join keys: FDIC certificate number, Federal Reserve RSSD (100% of active), holding-company RSSD (84%), website (98%).
- Licence: none stated ("publicly available bank data"); US Government work. **Licence verified: partial.**
- Probe: `research/probes/us/fdic.py`.
- Verdict: **use** for banks only (S06, S02 failures).

### 4.4 FINRA
- BrokerCheck: firm search works without a key (one generic term: 8,367 firms); firm detail exposes basic information and a disclosure flag. Terms (FINRA permitted-uses page, https://www.finra.org/investors/investing/working-with-investment-professional/about-brokercheck/permitted-uses): data may be copied and compiled, including with tools, only "for investor protection, academic, compliance or regulatory purposes", without interfering with the service; anyone who republishes must identify BrokerCheck as the source, link to it and its terms, disclose when the data was compiled, keep it current, and provide a way to report errors; no unsolicited marketing. The general finra.org terms forbid scraping for other uses.
- FINRA Query API: public datasets (for example OTC weekly summaries) without a key.
- Join key: firm CRD number.
- Verdict: **use with caveat, agent per-query only** for broker-dealers (S11 regulator disclosures), with the BrokerCheck attribution block and our correction channel (R10). No bulk copy.

### 4.5 OFAC
- Owned by `data-osint` (coordinator's phase-1 split). Only noted here: the SAM exclusions file already carries 41,712 OFAC rows.

### 4.6 IRS exempt organisations (990)
- EO Business Master File: 1,984,891 organisations, 28 columns, four regional CSVs, Last-Modified 2026-11-09 (monthly). Fill: NTEE 71%, revenue amount 28.6%.
- 990 e-file XML: https://www.irs.gov/charities-non-profits/form-990-series-downloads (years 2019-2026, monthly batches, page updated 2026-11-19). 2025 index: 748,906 returns (990: 376,920; 990-EZ: 217,102; 990-PF: 130,347). Sample of 500 full 990s: officer list (Part VII) 100%, total revenue 100%, related organisations (Schedule R) 21%.
- Pub 78 (deductibility): 1,437,288 rows. Auto-revocation list: 1,248,282 rows.
- Licence: no statement; US Government work. Join key: EIN (9 digits).
- Probe: `research/probes/us/irs990.py`.
- Verdict: **later** (non-profits are outside the v1 counterparty job; useful when a counterparty is a non-profit).

### 4.7 USPTO
- Every data endpoint now needs a key: Open Data Portal (header `X-API-KEY`) and TSDR (`USPTO-API-KEY`) both answered 401; the bulk site serves a bot challenge; the legacy assignment API host no longer resolves. Key issuance terms were not readable (empty page).
- Verdict: **later** (needs a key and terms check).

### 4.8 FEC
- Committee master bulk `cm26.zip` (882 KB, Last-Modified 2026-11-19): 21,094 committees for the 2026 cycle; 1,736 with a connected corporation (organisation type C). openFEC API works with `DEMO_KEY` (measured `X-RateLimit-Limit: 10`); a free api.data.gov key raises it.
- **Legal limit:** "information about individual contributors taken from FEC reports cannot be sold or used to solicit contributions … or for commercial purposes" (52 U.S.C. 30111(a)(4); 11 CFR 104.15; https://www.fec.gov/updates/sale-or-use-contributor-information/, read 2026-11-20). Committee names may be compiled freely.
- What this means for us: show a company's own PAC (committee name, totals) only; never list individual donors, and never search donors by employer. The probe counts individual records and never prints them.
- Verdict: company PAC **later** (not part of the counterparty job); individual donors **hide**.

### 4.9 GLEIF
- Golden copy (CSV, published three times a day; file 2026-11-19 16:00): 3,499,919 LEI records (511 MB zip), 338 columns; relationship file 493,515 rows (24.5 MB zip).
- By legal-address country: US 365,812 (issued 138,349; lapsed 206,552; retired 19,398), LT 5,392, LV 4,450, EE 30,619. Every record carries a registration-authority id.
- US registration authorities: RA000602 (Delaware) 133,621; RA999999 (none given) 44,426; then other state registries. Jurisdictions: US-DE 146,364; US 26,313; US-CA 20,790; US-NY 16,877; US-FL 14,251.
- Parents: 16,310 US LEIs have a direct-parent record and 18,051 an ultimate-parent record (about 5%).
- Licence: "The data available through the Access Service are provided under the CC0 licence" (https://www.gleif.org/en/meta/lei-data-terms-of-use, read 2026-11-20). No attribution required; don't imply endorsement.
- Join keys: LEI (20 characters, ISO 17442 check digits); registration authority + entity id maps an LEI to a state registry number or SEC CIK.
- Probe: `research/probes/us/gleif.py --golden`.
- Verdict: **use** (S01 LEI, S05 parents) for all four countries; daily delta files.

### 4.10 Small-business signals

**SBA Paycheck Protection Program (PPP) loans.** 11,468,210 loans in 13 CSVs (5.2 GB), 53 columns; borrower name, address, NAICS, business type, jobs reported (100%), loan amount, lender, status (paid in full 10.66 M, charged off 643k), forgiveness (92%). Static: files dated 2024-09-30, dataset updated 2024-10-21. Licence: "U.S. Government Works" (https://data.sba.gov/dataset/ppp-foia, read 2026-11-20). Probe: `research/probes/us/sba_ppp.py --all`. Verdict: **use with caveat** (S07 headcount as of 2020-2021, S12): always labelled "reported in 2020-21".

**FMCSA (trucking and freight brokers).** On data.transportation.gov, daily (2026-11-19): Company Census 4,533,061 carriers (2,248,384 active), 147 columns; Licensing & Insurance 1,860,604 (25,081 active brokers; 24,970 with a broker bond on file); authority history 4,941,925; revocations 1,529,083; insurance 467,984. Active census fill: officer 1 94%, phone 99%, email 76% (never show email or phone), drivers 95%, power units 100%, safety rating 2%. Join keys: USDOT number, MC docket number. Licence: none stated in portal metadata; US Government work. Probe: `research/probes/us/fmcsa.py`. Verdict: **use** for carriers and brokers (S01 licence, S03 officer, S07 drivers, S11 revocations).

**Not probed:** DOL enforcement (OSHA, wage and hour) and EPA ECHO. To settle: one probe each; both are federal and keyless as far as known.

---

## 5. Reality check

### Method
- **Seed 20261119**, `random.Random` in `research/probes/us/reality_sample.py`. One random pick per private segment from an official dataset with a generic filter, and five random public issuers from those with an insider filing in 2026:

| Segment | Candidate pool | Candidates |
|---|---|---|
| Contractor | CO entities in good standing, name contains "construction", formed 2018 or later | 7,771 |
| Coffee roaster | OR businesses, name contains "coffee roast" | 111 |
| Payroll firm | CT active businesses, name contains "payroll" | 91 |
| Freight broker | FMCSA active brokers with no carrier authority, based in NY, CO, OR, CT or PA | 1,873 |
| Solar installer | NY active corporations, name contains "solar", filed 2015 or later | 3,249 |
| Public company | Issuers with a Form 3/4/5 in 2026 (local store) | 6,427 |

- Profiles: `research/probes/us/reality_profile.py [--bulk]` looks every sample up in the registries of NY, CO, OR, CT and PA (home record by id, others by normalised name), CT principals, OR representatives, status and filing history, CO and CT UCC debtors, FMCSA, OR and WA contractor licences, USAspending, GLEIF, the Forms 3/4/5 store, and with `--bulk` PPP, the FJC civil file and the SAM extracts. Name matching is exact after normalising case, punctuation and legal suffixes.
- **Not checked, with the reason:** SEC EDGAR (no `SEC_USER_AGENT`), CourtListener search (no token), OFAC (data-osint), FL (quarterly file still downloading during the run; the samples aren't Florida entities).

### Results

| Section | Public (5) | Private (5) | Sources that filled it |
|---|---|---|---|
| S01 Identity | 3 (60%) | 5 (100%) | private: home-state registry; public: GLEIF (3), NY foreign registration (2). SEC would fill 5 of 5 (not run) |
| S02 Status and history | 2 (40%) | 5 (100%) | registry status; dated history for 2 private (NY status history, CO transactions, CT filings) |
| S03 People | 4 (80%) | 4 (80%) | public: officers filing Forms 3/4/5 in the last 12 months; private: CT principals, OR representatives, NY chairman, FMCSA officer |
| S04 Owners | 4 (80%) | 0 | public: a 10% owner has filed Forms 3/4/5; private: not published anywhere |
| S05 Group | 0 | 0 | no GLEIF parent record for any sample; EX-21 not run |
| S06 Financials | 0 | 0 | XBRL not run (would fill public); private: not published |
| S07 Workforce | 1 (20%) | 1 (20%) | PPP jobs reported (2020-21) |
| S09 Insolvency, pledges | 0 | 0 | UCC checked for CO and CT only; no hits |
| S10 Courts | 1 (20%) | 0 | FJC civil name match; CourtListener not run |
| S11 Sanctions, exclusions | 0 | 0 | SAM exclusions checked for all 10: none found |
| S12 Public money | 1 (20%) | 1 (20%) | USAspending (1 private), PPP (1 public) |
| S13 Filings and events | 2 (40%) | 2 (40%) | state filing history; EDGAR not run |
| S14 Securities | 5 (100%) | 0 | Forms 3/4/5 |

### What the numbers say
- **Private businesses:** the registry identifies all five and gives a status, and four of five get at least one person. Nothing else is published about them: no owners, no financials, no employees except the pandemic-loan headcount. The instant profile for a US private firm is identity, status, people and a list of checks that came back empty.
- **Public companies without SEC:** only 3 of 5 could be identified from non-SEC sources, because most are incorporated in Delaware, which publishes nothing. SEC submissions and XBRL would lift S01, S06 and S13 to near 100%; that is the next run.
- **Risk sections are "checked, none found", not empty:** SAM exclusions, UCC (two states), the FJC civil file and FMCSA revocations were checked for every sample where they apply. The UI should show these as checks, per the council's three empty states.
- **Name matching is the weak joint.** State files have no tax id, and the FJC and PPP files have only names. One public company matched a court case by name only; an agent must confirm such hits before they are shown.
- **Sample size is 10.** At this size each rate is roughly ±30 points. Session 1 should read these as "available or not", not as precise rates.

---

## 6. Answers to the feasibility open questions (US)

| Question in `00-feasibility.md` | Answer |
|---|---|
| Does EDGAR's submissions JSON carry 8-K item numbers? | **Yes.** 1,042 of 1,042 8-Ks in a 3-day window carried items; 8.6% included 5.02 (local copy of the feed). A direct probe of `data.sec.gov` is pending the User-Agent. |
| US states with bulk officer data | FL (6 officer slots), CT (principals), PA (parties), NY (CEO of corporations), OR (authorised representative), WA (contractor principals). CO: agent only. CA, DE: none free. |

## 7. Answers to cto, architect and designer

- **EDGAR bulk zip sizes, per-company latency, Forms 3/4/5 rebuild cost:** pending the User-Agent, except the rebuild estimate (~300-400 MB, 40 quarterly files).
- **FL, CA, DE bulk sizes and terms:** FL quarterly 1.79 GB + daily 3-5 MB, licence unverified; CA paid bulk order, price not public; DE none.
- **Load facts per bulk source** (bytes per full pull · parse time · validators · observed cadence):
  - FL quarterly: 1,793,034,019 bytes zipped, 18.7 GB unzipped · 4 min 35 s to profile all records · SFTP directory dates only · quarterly; daily delta files nightly.
  - GLEIF golden copy: 510,551,864 bytes (LEI) + 24,532,211 (relationships) · not timed · per-publish file names with a timestamp · three publishes a day.
  - SAM.gov: entity extract 149,557,066 bytes monthly; exclusions 11,898,264 bytes daily · not timed separately · dated file names.
  - PPP: 13 files, 5.2 GB in total · one streaming pass, not timed separately · static since 2024-10.
  - FJC civil: 329,665,474 bytes zipped · the FJC civil and SAM passes together took about 5 min · Last-Modified · about quarterly.
  - FJC bankruptcy: 887,034,431 bytes zipped · one pass over 10 min (stopped at the 10-min tool limit, finished in the background) · Deflate64.
  - Socrata states: no full pull needed under the live-query proposal (section 2.10); Socrata exports full CSVs if needed.
- **EDGAR change feed (architect):** the daily index files (`form.YYYYMMDD.idx`, nightly) list every filing by form, CIK and date; the submissions JSON carries `formerNames` (with from/to dates) and both business and mailing addresses, and `submissions.zip` holds the same JSON for every CIK (SEC documentation; not measured, deferred: `SEC_USER_AGENT` pending).
- **Keys deferred (C7), and what each unlocks:**
  - `SEC_USER_AGENT` (not a key, a contact string): all of EDGAR: submissions, XBRL financials, Form D related persons, 13D/G, 8-K 5.02 text, DEF 14A, EX-21, and the exact rebuild size for Forms 3/4/5. Without it, US public companies have no S06 financials and weak S01.
  - `COURTLISTENER_TOKEN`: docket search by party name (125 a day). The bulk dockets need no token.
  - `SAM_GOV_API_KEY`: live entity look-up by UEI (10 a day without a SAM role). The public extracts need no key, so this is low value.
  - `USPTO_ODP_KEY`: trademarks and patents (LATER anyway).
  - `FEC_API_KEY`: higher rate limit than `DEMO_KEY` for company PAC look-ups (LATER anyway).
  - `SOCRATA_APP_TOKEN` (optional, free): avoids shared throttling on live state queries.
- **Change feeds:** NY daily filings dataset; CO, CT, FMCSA daily full refresh (Socrata `rowsUpdatedAt`); FL daily files; GLEIF three publishes a day with deltas; SAM exclusions daily, entities monthly; FJC and CourtListener quarterly; PPP static.
- **As-of dates:** Socrata gives `rowsUpdatedAt` per dataset, not per record; records carry their own filing or status dates (NY `initial_dos_filing_date`, CO `entityformdate`, CT `date_registration`). FL records carry file date and last-transaction date. SAM and GLEIF carry per-record registration and last-update dates.
- **Terminated entities:** CO, CT and FMCSA keep them with a status; NY's master file drops them (status history keeps them); OR's dataset is active businesses only.
- **Person identity:** name only in every state file (no birth dates, no personal codes). SEC insiders have a CIK. So people can be linked across companies only by name within a state, which the network view must label as "same name".
- **Sole traders:** state registries list legal entities; sole proprietors appear only in assumed-name/trade-name files (CO trade names 289,445 rows with first and last names). Those are natural persons (R5).
- **Vocabularies (English):** CO statuses (Good Standing, Delinquent, Administratively Dissolved, Exists, Converted, …); FL status A/I and filing types (FLAL, DOMP, DOMNP, FORL, FORP, …) and officer title codes (MGR, AMBR, P, VP, CEO, D, …); FMCSA authority actions (granted, involuntary revocation, reinstated, dismissed, …); SAM exclusion types (prohibition/restriction, ineligible, voluntary exclusion).
- **Field sizes:** FL longest name 93 of 192 characters; FL officers per record median 1, maximum 6 slots plus a "more than six" flag; Form 4 issuers can have dozens of insiders a year.
- **Deep links** (patterns other than SEC are not verified yet): SEC (above); USAspending `https://www.usaspending.gov/recipient/<recipient hash>/latest`; FMCSA `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=0000000`; GLEIF `https://search.gleif.org/#/record/<LEI>`; CourtListener `https://www.courtlistener.com/docket/<id>/<slug>/`. State registries: search pages only, no stable per-entity URL was verified.

---

## 8. Display matrix rows

| Section | Country | Sources | Grade | Fill rate | Notes |
|---|---|---|---|---|---|
| S01 | US | SEC submissions, tickers (public companies, Form D filers) | A | deferred: User-Agent pending (expected ~100% of public) | API + bulk; licence verified Y; blocked on `SEC_USER_AGENT` |
| S01 | US | State registries: NY, CO, CT | A | private 100% (5/5); public 40% (2/5) | bulk; licence verified Y; daily (NY: monthly master + daily filings) |
| S01 | US | State registries: OR, PA | B | within the private 100% above | bulk; licence verified partial (OR: none on the main dataset) |
| S01 | US | State registry: FL (Sunbiz) | B | not sampled | bulk SFTP; licence verified N (pages refuse automated reads); best free officer data |
| S01 | US | State registries: CA, DE | D | 0% | paid bulk order (CA) or $10-20 per status query (DE); ~40% of US LEIs are DE entities |
| S01 | all | GLEIF LEI | A | public 60% (3/5); private 40% (2/5) | bulk, 3 publishes a day; licence verified Y (CC0) |
| S01 | US | SAM.gov entity extract (UEI) | B | 0% (0/10) | bulk monthly; licence verified partial (US Government work); firms registered for federal work only |
| S01 | US | FMCSA census, OR CCB, WA L&I licences | A | segment-specific (broker 1/1) | bulk daily; licence verified partial; carriers, brokers, contractors only |
| S02 | US | State status + history (NY status history, CO transactions) | A | status 100% private; dated history 40% (2/5, all samples combined) | bulk; licence verified Y |
| S02 | US | CT business filing history | B | included in the 40% above | bulk daily; licence verified partial (no licence stated on this dataset; the CT master file says Public Domain) |
| S02 | US | FDIC BankFind (failures, history) | A | banks only | API, no key; licence verified partial |
| S03 | US | SEC Forms 3/4/5 officers and directors | A | 80% public (4/5) | bulk quarterly data sets + live XML; licence verified Y; name + insider CIK |
| S03 | US | Form D related persons | B | deferred: User-Agent pending | bulk quarterly; licence verified Y; the only federal list of private-company officers |
| S03 | US | State people: FL officers, CT principals, PA parties, NY CEO, OR representatives | B | 80% private (4/5, incl. FMCSA) | bulk; licence verified Y/partial/N by state; name only; drop CT residence addresses and agent contacts |
| S03 | US | DEF 14A (ecd:PeoName) | C | deferred: User-Agent pending | per-filing; licence verified Y; agent-read |
| S04 | US | Schedules 13D/13G XML | A | deferred: User-Agent pending | per-filing XML; licence verified Y |
| S04 | US | Forms 3/4/5 10% owners | A | 80% public (4/5) | bulk; licence verified Y |
| S04 | US | Private-company owners | D | 0% (0/5) | not published by any US source |
| S05 | all | GLEIF relationship records | A | 0% (0/10); ~5% of US LEIs have a parent | bulk; licence verified Y (CC0) |
| S05 | US | Exhibit 21 subsidiaries | C | deferred: User-Agent pending | per-filing HTML; licence verified Y; names only, agent-matched |
| S06 | US | SEC XBRL company facts | A | deferred: User-Agent pending (public); 0% private | API + bulk; licence verified Y |
| S06 | US | FDIC call-report financials | A | banks only | API; licence verified partial |
| S06 | US | Private-company financials | D | 0% (0/5) | not published |
| S07 | US | SBA PPP jobs reported | C | 20% public, 20% private | bulk, static since 2024-10; licence verified Y; 2020-21 headcount only |
| S07 | US | FMCSA drivers and power units | A | carriers only | bulk daily; licence verified partial |
| S07 | US | SEC dei:EntityNumberOfEmployees | B | deferred: User-Agent pending | API; licence verified Y |
| S08 | US | none | D | 0% | no public tax payments or tax-debt lists |
| S09 | US | UCC filings: CO, CT | B | 0% (checked for the CO and CT samples: none found) | bulk daily; licence verified Y; 2 states only |
| S09 | US | FJC bankruptcy IDB | D | n/a | bulk, but no debtor names, so a case can't be tied to a company |
| S09 | US | PACER bankruptcy dockets | D | n/a | paid: $0.10/page, $3 cap, waived under $30 a quarter |
| S10 | US | FJC civil IDB | B | 20% public (1/5), 0% private | bulk, about quarterly; licence verified partial; party names only, agent must confirm |
| S10 | US | CourtListener dockets (bulk) and API | B | not run | bulk quarterly, free; API needs `COURTLISTENER_TOKEN`, 125 calls a day; licence verified Y (bulk) |
| S11 | US | SAM.gov exclusions | A | checked 100%, hits 0% | bulk daily; licence verified partial; risk signal |
| S11 | US | FMCSA revocations | A | carriers and brokers only | bulk daily; licence verified partial |
| S11 | US | FINRA BrokerCheck | C | not run | per-query only; licence verified Y (permitted-uses terms: attribution, compile date, error channel) |
| S12 | US | USAspending | A | 0% public, 20% private (1/5) | API, no key; licence verified partial |
| S12 | US | SBA PPP loans | C | 20% public, 20% private | bulk, static; licence verified Y |
| S13 | US | EDGAR filings, 8-K items (5.02) | A | deferred: User-Agent pending; item numbers on 100% of 1,042 8-Ks | API + daily index; licence verified Y |
| S13 | US | State filing history (NY daily filings, CO transactions) | A | 40% private (2/5, all samples combined) | bulk; licence verified Y |
| S13 | US | CT business filing history | B | included in the 40% above | bulk daily; licence verified partial (no licence stated on this dataset) |
| S14 | US | SEC Forms 3/4/5 trades | A | 100% public (5/5) | bulk quarterly + live; licence verified Y |
| S14 | US | Tickers and exchanges | A | deferred: User-Agent pending | bulk JSON; licence verified Y |
| S17 | US | Shared insiders across issuers (SEC insider CIK) | A | deferred: User-Agent pending | derived; exact person id |
| S17 | US | Shared officers by name within a state (FL, CT, PA) | C | not measured | derived; name-only match, label "same name" |
| S18 | US | Status, UCC, exclusions, revocations, court cases, PPP charge-off | C | see sections | derived; the US has no tax-debt or payment-default data |
| - | US | FEC individual contributions | X | n/a | 52 U.S.C. 30111(a)(4): no commercial use; never list donors |
| - | US | FEC company PAC | B | not run | bulk; licence verified Y; later (not in the counterparty job) |
| - | US | IRS 990 / EO BMF (non-profits) | A | not run | bulk monthly; licence verified partial; later |
| - | US | USPTO trademarks and patents | D | not run | key required for every endpoint; terms not read; later |

## 9. Reality-check rows

| Section | Country | Segment | Sample size | Filled | Fill rate | Notes |
|---|---|---|---|---|---|---|
| S01 | US | public company | 5 | 3 | 60% | public: GLEIF + NY foreign registration; SEC not run (pending User-Agent); private: home-state registry |
| S01 | US | small private business | 5 | 5 | 100% | public: GLEIF + NY foreign registration; SEC not run (pending User-Agent); private: home-state registry |
| S02 | US | public company | 5 | 2 | 40% | status in every registry; dated history in NY, CO, CT |
| S02 | US | small private business | 5 | 5 | 100% | status in every registry; dated history in NY, CO, CT |
| S03 | US | public company | 5 | 4 | 80% | public: Forms 3/4/5 officers; private: CT, OR, NY registry people, FMCSA officer |
| S03 | US | small private business | 5 | 4 | 80% | public: Forms 3/4/5 officers; private: CT, OR, NY registry people, FMCSA officer |
| S04 | US | public company | 5 | 4 | 80% | public: 10% owners in Forms 3/4/5; 13D/G not run; private: not published |
| S04 | US | small private business | 5 | 0 | 0% | public: 10% owners in Forms 3/4/5; 13D/G not run; private: not published |
| S05 | US | public company | 5 | 0 | 0% | GLEIF parents only; EX-21 not run |
| S05 | US | small private business | 5 | 0 | 0% | GLEIF parents only; EX-21 not run |
| S06 | US | public company | 5 | 0 | 0% | XBRL not run; private: not published |
| S06 | US | small private business | 5 | 0 | 0% | XBRL not run; private: not published |
| S07 | US | public company | 5 | 1 | 20% | PPP jobs reported, 2020-21 only |
| S07 | US | small private business | 5 | 1 | 20% | PPP jobs reported, 2020-21 only |
| S08 | US | public company | 5 | 0 | 0% | not published in the US |
| S08 | US | small private business | 5 | 0 | 0% | not published in the US |
| S09 | US | public company | 5 | 0 | 0% | UCC checked in CO and CT: none found; bankruptcy files carry no debtor names |
| S09 | US | small private business | 5 | 0 | 0% | UCC checked in CO and CT: none found; bankruptcy files carry no debtor names |
| S10 | US | public company | 5 | 1 | 20% | FJC civil name match (needs agent confirmation); CourtListener not run |
| S10 | US | small private business | 5 | 0 | 0% | FJC civil name match (needs agent confirmation); CourtListener not run |
| S11 | US | public company | 5 | 0 | 0% | SAM exclusions checked for all: none found; OFAC by data-osint |
| S11 | US | small private business | 5 | 0 | 0% | SAM exclusions checked for all: none found; OFAC by data-osint |
| S12 | US | public company | 5 | 1 | 20% | USAspending, PPP |
| S12 | US | small private business | 5 | 1 | 20% | USAspending, PPP |
| S13 | US | public company | 5 | 2 | 40% | state filing history; EDGAR not run |
| S13 | US | small private business | 5 | 2 | 40% | state filing history; EDGAR not run |
| S14 | US | public company | 5 | 5 | 100% | Forms 3/4/5 insider filings and trades |
| S14 | US | small private business | 5 | 0 | 0% | Forms 3/4/5 insider filings and trades |
