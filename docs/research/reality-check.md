# Reality check: summary

Assembled by the coordinator on 2026-11-20 from the reality checks in the four area docs. Every seat built real profiles for sample entities, the way the app would, from the sources it measured. Entity-level profiles stay in the gitignored `research/.cache/<area>/profiles/`; only aggregates are here. Sampling methods and seeds are in each area doc.

| Area | Sample | Method |
|---|---|---|
| Baltics | 8 companies per country: 2 micro, 2 small, 1 medium, 1 large, 1 bankrupt, 1 with tax debt | random draw per segment, seeds recorded (`baltics.md`) |
| US | 5 public companies, 5 small private businesses | seed 20261119 (`us.md`); SEC EDGAR not run (key pending) |
| OSINT | 32 companies (EE 9, LV 8, LT 7, US 8) | ordered by a salted hash, rule-based segments (`osint.md`) |
| Markets | the 20 Crash monitor series | live probes on 2026-11-19 (`markets.md`) |

## What the instant official profile fills, per country

Population fill rates for active companies (Baltics, from `baltics.md`, "Coverage at a glance") and the US sample (from `us.md`; S06 and S13 wait for SEC EDGAR). Grade · fill rate.

| Section | LT | LV | EE | US public (n=5) | US private (n=5) |
|---|---|---|---|---|---|
| S01 Identity | A · 100% | A · 100% | A · 98.3% | 60% (SEC pending) | 100% |
| S02 Status and history | A · 100%, no history | A · 100% | B · 100%, no history | 40% | 100% |
| S03 People | C · roles only, 0% names | A · 97.8% | A · 97.4% | 80% | 80% |
| S04 Owners | C · counts only | A · members 90.8%; beneficial owners restricted | A · members 97.3%; beneficial owners restricted | 80% (insiders) | 0%, not published |
| S05 Group | D | C · 11.0% | C · 9.8% | 0% (EX-21 pending) | 0% |
| S06 Financials | B · 72.7% | A · 74.1% | A · 71.6% | pending SEC | 0%, not published |
| S07 Workforce | B · 48.6% | B · 57.8% | B · 26.9% | 20% (2020-21 only) | 20% |
| S08 Taxes and arrears | A · taxes 76.5%, arrears daily | B · taxes 56%, no debt amounts | B · taxes 39.1%, debtors daily | not published | not published |
| S09 Insolvency, pledges, notices | B | A · 12.3% have an event | A | checked, none found | checked, none found |
| S10 Courts | D | C · not joinable | D | 20% (name match, needs confirmation) | 0% |
| S11 Sanctions | A (EU), C (UN, national) | A (EU, national), C (UN) | A (EU), C (UN, national) | checked, none found | checked, none found |
| S12 Public money | C · 4.5% + 3.2% | A · 2.6% + 2.6% | B · 1.2% | 20% | 20% |
| S13 Filings and events | B · 87.9% | B · 74% | A · 83.3% | 40% (EDGAR pending) | 40% |
| S14 Securities | listed shares only | listed shares only | listed shares only | 100% | n/a |

**What the agents add (`osint.md`, 32 companies):** a website is found for 25% (LV) and 29% (LT) by search; EE lists one for 5.6% of active companies; US 100% of the sample. 86% of known websites resolve. Social links from the company's own site: 41%. News (last 3 months): 16% raw hits, with name collisions in 3 of 5 hit sets. Sanctions exact-name hits: 0 of 32, as expected.

**Crash monitor (`markets.md`, 20 series):** official only 7/20 (strict 6/20); plus keyless crypto 10/20 (strict 9/20); plus one user stock key 20/20 (estimated, key pending).

## What this means for session 1

- **Against the council's kill criterion** (a primary-job section under 50% for a country): LT S03 People is 0% (no names exist in any LT source), EE S07 Workforce is 26.9%, and US private S04 and S06 are 0% (not published in the US). These are facts of the sources, not loader gaps.
- **LV and EE carry the fullest instant profile.** LT is strong on money (taxes, arrears, wages) and empty on people.
- **US numbers are incomplete** until `SEC_USER_AGENT` is set: S01, S05, S06 and S13 for public companies.
- **Risk signals** (arrears, insolvency, pledges, sanctions, exclusions) ran for every sample; the council's exception lets them ship at any fill rate with coverage text.

## Area tables (copied unchanged)

### baltics.md

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

### us.md

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

### osint.md

| Section | Country | Segment | Sample size | Filled | Fill rate | Notes |
|---|---|---|---|---|---|---|
| S15 website known | EE | register-listed website | 9 | 9 | 100% | by selection; see population note |
| S15 website known | LV | all sizes | 8 | 2 | 25% | 1 by search, 1 brand domain |
| S15 website known | LT | all sizes | 7 | 2 | 29% | both by search |
| S15 website known | US | public + small private | 8 | 8 | 100% | private: SAM.gov field; public: search |
| S15 website resolves | all | sites known | 21 | 18 | 86% | EE 6/9: 3 register-listed sites are dead |
| S15 domain registration date | all | sites known | 21 | 16 | 76% | .lv WHOIS has no dates (0/2) |
| S15 registrant code = register code | EE | sites known | 9 | 4 | 44% | .ee WHOIS `org id` |
| S15 registrant code = register code | LV | sites known | 2 | 1 | 50% | .lv WHOIS `RegNr` |
| S15 certificates in CT logs | all | sites known | 21 | 14 | 67% | 4 US queries failed (rate limit, HTTP 502/404); 3 dead EE domains have none |
| S15 MX / SPF / DMARC | all | sites known | 21 | 17 / 15 / 12 | 81% / 71% / 57% | |
| S15 archived in Wayback | all | sites known | 21 | 20 | 95% | |
| S15 homepage reachable | all | sites known | 21 | 17 | 81% | |
| S15 homepage states register code | all | sites known | 21 | 3 | 14% | LT 2/2, EE 1/9, LV 0/2 |
| S16 social profile linked from own site | all | all | 32 | 13 | 41% | EE 5/9, US 4/8, LT 2/7, LV 2/8 |
| S16 news articles, last 3 months (GDELT) | all | all | 32 | 5 | 16% | only 13 of 32 queries answered (41%): rate limits and connection timeouts despite 12 s spacing and 3 retries. Of the 5 hit sets, 3 are in languages with no tie to the company's country: name collisions |
| S11 sanctions exact name hit | all | all | 32 | 0 | 0% | expected; see false-positive rates |
| S11 regulator red-flag list hit | all | all | 32 | 0 | 0% | expected |
| S12 EU-wide award notice won (TED) | EE | all sizes | 9 | 4 | 44% | live lookup by register code |
| S12 EU-wide award notice won (TED) | LV | all sizes | 8 | 2 | 25% | |
| S12 EU-wide award notice won (TED) | LT | all sizes | 7 | 3 | 43% | |

### markets.md

| Section | Country | Segment | Sample size | Filled | Fill rate | Notes |
|---|---|---|---|---|---|---|
| M01-M08 | - | A: official only, no key | 20 | 7 (strict: 6) | 35% (strict: 30%) | debt, Brent, WTI, Japan; plus quarterly US value, monthly gold, Taiwan without backfill. Strict count excludes Taiwan: it can't show a drawdown from the 2025-01-01 peak until seeded |
| M01-M08 | - | A + D: official plus keyless on-chain/exchange/aggregator | 20 | 10 (strict: 9) | 50% (strict: 45%) | adds bitcoin, ether, total crypto; strict count excludes Taiwan |
| M01-M08 | - | A + D + one stock key (S7) | 20 | 20 (estimated) | 100% (estimated) | stock tiles via ETF proxies; not measured: key pending |
| M01-M08 | - | strictly hostable in public (open licences only) | 20 | 6 (strict: 5) | 30% (strict: 25%) | Japan drops out (redistribution needs the owner's permission); crypto too, until oracle and exchange licences are confirmed |
| S14 | LT, LV, EE | listed-share records with ISIN and LEI | 67 | 67 | 100% | FIRDS reference data; no prices (corrected 2026-11-20 from 73, which counted superseded versions) |

