# Feasibility: an open, agentic company-intelligence app

> First desk research, done before the data-research mission. Every finding here is a hypothesis for that mission to test with real downloads.

Scope: the USA and the Baltic states (Lithuania, Latvia, Estonia), plus market data.

## Verdict

**Buildable, and the data side is easier than expected.**
- **Latvia and Estonia** publish almost everything a commercial company-information portal shows, as free daily bulk files: companies, officers, shareholders, financial statements, taxes and employees. Latvia is CC0, Estonia CC BY 4.0.
- **The US** has the richest free data. SEC EDGAR is public and may be redistributed.
- **Lithuania** is the weak spot: company data, financial statements, social-insurance employee and salary figures, and tax debts are open, but **no people** (no manager, shareholder or beneficial-owner names).

**Two hard limits:**
1. **Stock and crypto prices:** no free source we found allows redistribution. They need user-supplied keys or a paid licence.
2. **GDPR on person profiles in the EU:** this is the main legal risk, not copyright.

## Where an open, agentic app can be different

Commercial portals in the region charge roughly €100-1,000 a year. They keep their credit scores secret, and they sell relationship reports, monitoring and sanctions screening per item. An open alternative can offer:
- **A transparent score:** published weights, and the working shown for every company.
- **One tool across countries:** the Baltics and the US to start.
- **Free API, bulk export and an MCP server,** so AI agents can research companies.
- **Agentic research:** agents combine registry data with the open web and cite every source.

## Data coverage

Legend: ✅ free, structured, bulk · 🟡 partial, per-query or unclear licence · 💶 paid · ❌ not available

| Data | LT | LV | EE | US |
|---|---|---|---|---|
| Company basics, status, address, activity | ✅ Registrų centras JAR via get.data.gov.lt | ✅ Enterprise Register, CC0, daily | ✅ e-Business Register, CC BY 4.0, daily | ✅ EDGAR (public companies, Form D filers); 🟡 states: NY, CO, OR, FL bulk; DE ❌ |
| Directors / CEO names | ❌ flags only (verified live) | ✅ names + masked personal code | ✅ names, roles, dates | ✅ Forms 3/4/5 officers and directors, Form D related persons, NY CEO name, FL up to 6 officers |
| Shareholders | 💶 paid extract | ✅ limited-company members · ⚠️ joint-stock shareholders restricted by 2026 rulings | ✅ | ✅ 13D/G (>5%), 13F (funds), Form 4 holdings |
| Beneficial owners | ❌ legitimate interest only | ✅ CC0 (restriction on request from July 2026) | ⚠️ conflicting: open file still listed, restriction postponed | 🟡 not public centrally |
| Financial statements | ✅ P&L + balance sheet line items | ✅ balance sheet, P&L, cash flow, employees | ✅ key figures 2019-2025 (full reports via a free API with contract) | ✅ XBRL company facts (public companies) |
| Employees / average salary | ✅ monthly, from the social-insurance fund (licence unstated) | ✅ employees (tax authority, quarterly) · salary ❌ | ✅ employees + taxes quarterly · salary ❌ | 🟡 annual-report headcount (text) |
| Taxes paid / tax debts | ✅ taxes paid + arrears; social-insurance debts | ✅ taxes paid · debtors ❌ (query only) | ✅ taxes paid + daily debtor list | ❌ |
| Insolvency, pledges, courts | 🟡 status codes only; courts ❌ bulk; arrests 💶 | ✅ insolvency + securing measures | ✅ pledges + rulings + official notices | ✅ federal court bulk data (public domain); PACER 💶 |
| Public contracts / EU funds | ✅ | ✅ procurement (licence unstated) · Kohesio | 🟡 procurement (unverified) · Kohesio | ✅ USAspending · SAM.gov (10 requests/day) |
| VAT status | ✅ | ✅ daily | 🟡 per query | n/a |
| Sanctions | official EU, UN, OFAC and UK lists are free | same | same | ✅ OFAC SDN |
| Legal entity IDs, parent companies | ✅ GLEIF (CC0, every country) | ✅ | ✅ | ✅ |

**Not free anywhere:** Lithuanian shareholders and beneficial owners (paid register extracts), private payment-default registers (built from creditors' data), bailiff debts (not public in any of the three countries), and Lithuanian property arrests (paid).

## Market data

| Need | Free and redistributable | Free for personal or internal use only |
|---|---|---|
| US fundamentals | ✅ SEC XBRL | |
| US daily prices | ❌ none found | several commercial APIs: display-only, internal-only or personal-use terms |
| Crypto prices | ❌ none found | commercial aggregators: attribution required, refresh within 24 h, no redistribution |
| On-chain data | 🟡 public RPCs or your own node (raw chain data is public) | block-explorer APIs (attribution) |
| Macro, rates, US debt | ✅ FRED and US Treasury Fiscal Data | |

Rule for the open-source project: ship **connectors, not data**. Each user brings their own key; the code never bundles or redistributes price data.

## Legal: green / yellow / red

- 🟢 **Copyright and database right:** under the Open Data Directive (art. 1(6)), public bodies may not use database rights to restrict reuse. EU "high-value datasets" rules make company data free and machine-readable. Use official open data; never scrape private portals (their terms forbid it, and CJEU C-30/14 lets them enforce that by contract).
- 🟢 **US:** SEC content may be copied and redistributed (cite the SEC; don't use its logos). Federal court bulk data is public domain; GLEIF is CC0.
- 🟡 **GDPR on EU directors' names:** registers are public, and CJEU C-398/15 found no right to be forgotten in them. But open-data reuse is "without prejudice" to the GDPR, so we need our own legal basis (legitimate interest).
  - A Latvian business-data portal was fined €65k in 2021, though that was for publishing non-public register documents.
  - Estonia's data protection authority has said auto-generated "person profiles" on business portals breach purpose limitation.
  - **So:** show people only in a company's context, with no standalone person pages and no search-engine indexing of people.
- 🔴 **Latvian joint-stock shareholders and EU beneficial owners:** recent rulings restrict them (CJEU C-37/20 and C-601/20 in 2022; CJEU C-798/24, 3 Sep 2026; the Latvian Constitutional Court, 9 Nov 2026). Keep them out of the public build.
- 🟡 **Share-alike (ODbL) and non-commercial (CC BY-NC) datasets:** don't mix them into our own data, or the whole database inherits those licences. Reusing open-source *code* (MIT) from the same ecosystems is fine.

## Open-source building blocks

- **FollowTheMoney** (MIT): an entity model (Person, Company, Directorship, Ownership, Payment).
- **zavod** (MIT): open crawler code that already parses the Estonian and Latvian registers. Its published *output data* is non-commercial only, so we reuse the code, not the data.
- **edgartools** (MIT): SEC XBRL financials and filing parsing.
- **Splink** (MIT): entity resolution on DuckDB.
- **yente** (MIT): a match and search API for FollowTheMoney entities.

No proper open-source loader exists for the Lithuanian or Latvian registers.

## Open questions (unverified)

- Licences for get.data.gov.lt (CC BY 4.0, claimed by third parties only), the Lithuanian social-insurance files, Latvian procurement data and the Estonian tax-authority data.
- The official bulk URL for the Lithuanian social-insurance data.
- Whether Estonian beneficial-owner open data is still published.
- Exactly what the Latvian Constitutional Court ruling covers.
- Whether EDGAR's submissions JSON carries 8-K item numbers (needed for "CEO left" alerts).

## Official sources

- **Lithuania:** [get.data.gov.lt JAR](https://get.data.gov.lt/datasets/gov/rc/jar/:ns) · [tax authority datasets](https://get.data.gov.lt/datasets/gov/vmi/:ns) · [social-insurance files](https://www.sodra.lt/lt/paslaugos/informacijos-rinkmenos)
- **Latvia:** [Enterprise Register on data.gov.lv](https://data.gov.lv/dati/lv/organization/ur) · [financial statements](https://data.gov.lv/dati/lv/dataset/gada-parskatu-finansu-dati) · [tax authority datasets](https://data.gov.lv/dati/lv/dataset?organization=valsts-ienemumu-dienests)
- **Estonia:** [e-Business Register open data](https://avaandmed.ariregister.rik.ee/en/downloading-open-data) · [tax authority open data](https://emta.ee/ariklient/amet-uudised-ja-kontakt/uudised-pressiinfo-statistika/statistika-ja-avaandmed)
- **US:** [SEC reuse policy](https://www.sec.gov/privacy) · [EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) · [insider data sets](https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets) · [Form D data](https://www.sec.gov/dera/data/form-d) · [GLEIF terms](https://www.gleif.org/en/meta/lei-data-terms-of-use)
- **EU law:** [Open Data Directive art. 1](https://www.legislation.gov.uk/eudr/2019/1024/article/1) · [CJEU C-798/24 press release](https://curia.europa.eu/site/upload/docs/application/pdf/2026-09/cp260115en.pdf)
