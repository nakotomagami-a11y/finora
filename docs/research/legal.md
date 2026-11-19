# Legal memo (phase 1)

> **NOT LEGAL ADVICE.** A sourced research summary for the council, written by the `legal` seat (round 1, fetched 2026-11-19) and committed by the coordinator. Items marked **LAWYER** need a licensed lawyer in the relevant jurisdiction before any build decision that depends on them. Cases are cited by number only. Citations to commercial or news sites are described rather than linked; official sources keep their URLs.

## Key findings (newest first)

- **C-798/24, judgment of 3 Sep 2026 (First Chamber).** EU law does not require disclosure of all shareholders' data, including minority shareholders. GDPR Arts 5 and 6, read with Charter Arts 7 and 8, preclude national law that makes all shareholders' personal data of public limited companies publicly available without conditions. Access was not conditioned on a legitimate interest. [EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:62024CJ0798)
- **Latvian Constitutional Court, case 2024-01-01, reported 9 Nov 2026.** Unrestricted public access to shareholders' personal data is unconstitutional. The struck provisions cease on publication of the judgment, and are void from 1 Jul 2023 for the applicants. The court said less intrusive options exist, such as restricted-access parts of the registration file. Reported by the state legal-information portal ([lvportals.lv](https://lvportals.lv/dienaskartiba/396866-satversmei-neatbilst-neierobezota-piekluve-akcionaru-personas-datiem-2026)) and two news outlets. The judgment text was not read.
- **C-37/20 and C-601/20, 22 Nov 2022.** Public access to beneficial-ownership data is a serious interference with Charter Arts 7 and 8. It is not strictly necessary, and the public regime was invalidated. [EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:62020CJ0037)
- **C-398/15, 9 Mar 2017.** No automatic erasure or blocking of company-register data on directors after dissolution. Restricted access is a Member State option, used only exceptionally, after a sufficiently long period, and only for third parties with a specific interest. [EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:62015CJ0398)

## Data points

| Item | Value | Source |
|---|---|---|
| Latvian register open-data licence | The official page says "distribution of open data is allowed without restriction" and names no licence. A third party says CC0. **Conflict, unresolved.** | [ur.gov.lv open data](https://www.ur.gov.lv/en/open-data-sets-register-open-data-portal-latvia); third-party claim from a search summary |
| Estonian register open-data licence | The official page links "License information" to the CC BY 4.0 legal code; the licence is named by URL only. Downloads require accepting licence terms. API reuse needs a contract. | [avaandmed.ariregister.rik.ee](https://avaandmed.ariregister.rik.ee/en/node/2) |
| Estonian beneficial-owner open data | Official page: changes from 1 Sep 2023 are in the detailed service. A third-party summary says beneficial-owner data left open data from 10 Jul 2026. **Not verified.** | Official page as above; third-party summary |
| Lithuanian register open-data licence | Third-party sources say CC BY 4.0. The official page was **not retrieved**. | Search summaries only |
| Lithuanian open-data scope | One source: codes, names, addresses, legal form, status. Another: only counts of governing bodies and participants. **Conflict.** | Search summaries only |
| EU consolidated sanctions list | Reuse free in principle (Art 9(1)). May require crediting the Commission. No altering of the original meaning. No Commission liability. Reuse calculated to deceive is barred (Art 2(4)). | [Decision 2011/833/EU](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32011D0833) |
| Aggregated sanctions dataset (third party) | CC BY-NC 4.0. Commercial use needs a paid licence. Non-commercial users, journalists and academic researchers are exempt. Its FAQ says compliance screening counts as commercial even without revenue. No startup exemption on the pages read. | The dataset's official FAQ and exemption pages |
| SEC EDGAR | Free. A User-Agent with contact info is required. Max 10 requests per second. No separate reuse licence stated on this page. | [sec.gov: accessing EDGAR data](https://www.sec.gov/os/accessing-edgar-data) |
| Map API caching (one commercial provider) | Lat/lng may be cached up to 30 days; place IDs have looser rules. Terms version unclear. | Search summary of the provider's service terms |
| Latvian DPA (DVI) | Opinion, per a secondary law-firm summary, that Company Register data listed in the law is public. Full text not found. | Secondary summary only |
| Estonian DPA (AKI) letter | Company-owner personal data is processed under GDPR Art 6(1)(e) and is open under the Public Information Act. Recipients who further process it must follow the GDPR. A single letter, not guidance. | A public mirror of the AKI document register |

## 1. GDPR and Baltic positions

- **Baltic DPAs.** Lithuania (VDAI): no position on register republication found. **Gap.** Latvia (DVI): only the secondary summary above. Estonia (AKI): no guidance found beyond the single letter above. **Gap, LAWYER.**
- **Legitimate interest.** The controller must state the specific interest. Data subjects can object (Art 21). Lithuanian practice is described only in secondary law-firm newsletters (April and August 2025).
- **Transparency (Art 14).** A controller must disclose the source, including whether it is publicly accessible. Art 14(5)(b) lets controllers skip notice for disproportionate effort only with appropriate safeguards. [gdpr-info.eu, Art 14](https://gdpr-info.eu/art-14-gdpr/)
- **Retention.** C-398/15 gives no fixed cut-off. Our retention must be set case by case. **LAWYER.**
- **Data subject rights.** No general erasure right for register data (C-398/15). Objection and access rights were not verified in this round. **LAWYER.**
- **Latvian scope.** The ruling concerns shareholders. Whether board and officer data stays public was **not found**. **LAWYER.**

## 2. US FCRA and state law

- **Statute (verified).** 15 USC 1681a(d)(1): a consumer report is a communication by a consumer reporting agency bearing on credit worthiness, character, general reputation, personal characteristics or mode of living, used or expected to be used for (A) personal credit or insurance, (B) employment, or (C) another 1681b purpose. [LII](https://www.law.cornell.edu/uscode/text/15/1681a)
- **Consumer reporting agency (verified).** 15 USC 1681a(f): a person who, for fees, regularly assembles or evaluates information on consumers to furnish consumer reports to third parties.
- **Business-only reports.** A 2011 FTC staff report (secondary summary) says a report on business history, prepared solely for business transactions, is not a consumer report. Primary text not read.
- **Sole traders.** A 2001 OCC advisory says lenders may obtain consumer reports where an individual is personally liable on business credit, including a sole proprietor. A sole trader's report used for personal credit may therefore be a consumer report. **LAWYER.** [OCC advisory letter 2001-6](https://www.occ.gov/news-issuances/advisory-letters/2001/advisory-letter-2001-6.pdf)
- **Disclaimers.** FTC position (secondary): a label or disclaimer does not decide consumer-reporting-agency status. Not verified against FTC primary text.
- **Permissible purpose (15 USC 1681b).** Not fetched. **Gap.**
- **CCPA.** "Personal information" excludes information lawfully made available from government records; the exclusion is lost if the data is used for a purpose incompatible with the record. A third category (information a consumer made public) exists under the CPRA; a 2026 bill (SB 435) would delete it. Enactment status not confirmed. [California Privacy Protection Agency document](https://privacy.ca.gov/wp-content/uploads/sites/357/2026/07/20260806_07_12.pdf) (search summary, not read). Other state laws: **not searched. Gap.**

## 3. Defamation and automated verdicts

- **EU.** A Munich regional court, reported 28 May 2026 (preliminary injunction), held a search operator directly liable for false AI-generated statements about a company: its own content, not third-party links. An appeal is reported. Low confidence: one secondary trade-press source, judgment not read.
- **US.** Reported 2026 rulings (secondary legal-news and case-tracker sites, not read): a Delaware court denied dismissal of a defamation claim over AI-generated statements about an individual (July 2026). A Chicago federal judge held AI outputs could be read as factual assertions and found actual malice plausibly pleaded after notice (September 2026). A 2025 Georgia ruling for an AI developer relied partly on clear fallibility disclaimers.
- **Mitigations (from these sources).** Disclose that output is AI-generated and fallible. Tie every claim to a cited source. Keep a correction channel. Act on notices promptly, because notice supports actual malice. **LAWYER** for each jurisdiction.

## 4. Platform terms (reviews, social, search)

- **Review platforms.** Consumer terms reportedly bar scraping, and a public page is not permission. Terms version unclear. Official API only. (Secondary summary.)
- **Professional network.** The user agreement bars scraping, and the platform has filed enforcement suits (2025). A 2026 ruling claim is unverified. Official API only.
- **Map API.** See Data points (30-day lat/lng caching).
- **Social platform APIs.** Not searched. **Gap** (the `data-osint` seat covers these terms in `osint.md`).

## 5. Licence compatibility

- **ODbL.** Share-alike applies to a Derivative Database that is publicly used (s.4.4a). A Produced Work needs notice when publicly used (s.4.3). The ODbL excludes programs used to make or run the database (s.2.3a). So AGPL code can call an ODbL database, but any database we publish from ODbL data is ODbL. Project rule 4 keeps ODbL out of our datasets. [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)
- **CC BY-NC.** NC prohibits commercial use. Creative Commons recommends against CC licences for software ([CC FAQ](https://creativecommons.org/faq/)). NC data therefore cannot ship in an AGPL repo; only through a user-supplied connector.
- **CC BY 4.0.** Attribution required. Compatible as a separate data asset with attribution shown in the UI.
- **CC0.** A dedication, not a licence (CC FAQ). Attribution is not required by the CC0 text (not confirmed from the CC0 page). Treat as attribution-optional and show the source anyway.
- **Public domain (US federal works).** Not verified in this round. **Gap.**
- **AGPL-3.0 vs Apache-2.0.** Apache-2.0 is compatible with GPLv3, one way, and not with GPLv2-only ([apache.org](https://apache.org/licenses/GPL-compatibility.html)). AGPL-3.0 is OSI-approved; its s.13 requires offering source to remote network users if the program is modified, which applies to a hosted app ([OSI](https://opensource.org/license/agpl-v3)). Inference: Apache-2.0 code can go into an AGPL-3.0 project. The human decides the licence.

## Product rules the code must enforce

1. Natural-person data of Latvian shareholders is not shown publicly. Show company-level facts only, unless a permitted access path exists. (C-798/24; the Latvian ruling.)
2. Natural-person register data sits behind a stated purpose, logged per access, with the purpose shown to the user.
3. Every record carries source name, licence, retrieval date and access tier.
4. No bulk redistribution of natural-person data in the repo or any published dataset.
5. A sole trader is treated as a natural person. No credit, character or eligibility score for a natural person.
6. Every verdict about a person shows "Not a credit report. Not for credit, employment, tenancy or insurance decisions."
7. Each verdict claim links to a primary source. Unsourced claims are not rendered.
8. A sanctions match is shown as "possible match, needs review". Never "sanctioned" without a primary list entry.
9. AI-written text is labelled AI-generated on every surface.
10. A correction and objection channel exists on every entity page. A disputed statement is suppressed within a set window pending review (window to be set by a lawyer).
11. Retention: the natural-person cache has a TTL (set by a lawyer).
12. Sanctions data: only official EU and US lists are bundled, with attribution. The CC BY-NC aggregated dataset is connector-only, under the user's own licence.
13. CC BY-NC and ODbL data are never committed to the repo or published datasets.
14. No scraping on any platform whose terms forbid it. Official APIs only, within limits. EDGAR: User-Agent from the environment, at most 10 requests per second.
15. Map data: cache only lat/lng, for up to 30 days, until the provider's terms are verified.
16. Each source's licence and attribution are shown in the UI.
17. Market data from licensed feeds comes only through user-supplied keys.

## Questions for a lawyer

- Latvian, Lithuanian and Estonian legitimate interest and publication scope; board and officer data after the Latvian ruling.
- Retention and erasure periods in each jurisdiction.
- Whether sole-trader reports fall under the FCRA, and which state laws apply.
- CCPA scope after the pending bill; other state laws.
- Defamation exposure for automated verdicts in the EU and US.
- Whether the aggregated sanctions dataset's CC BY-NC terms apply to a free, open-source app.
- AGPL-3.0 vs Apache-2.0 for the code.

## Source quality

- **Verified on primary text:** C-398/15, C-37/20 and C-601/20, C-798/24 (EUR-Lex); Decision 2011/833/EU; 15 USC 1681a(d) and (f); GDPR Art 14; AGPL s.13; ODbL (partial); the EDGAR access page; the Estonian and Latvian register open-data pages; the aggregated sanctions dataset's licence pages.
- **Reported, not read:** the Latvian Constitutional Court ruling (judgment not read); the Munich and US 2026 defamation rulings; the CCPA bill; the 2011 FTC report; the Lithuanian licence and scope; the Estonian beneficial-owner removal; the Latvian CC0 claim.
- **Conflicts:** Latvian register licence (official: no licence named; third party: CC0). Lithuanian open-data scope (two sources disagree). Estonian beneficial-owner status (official page vs third party).
- **Gaps:** Baltic DPA primary positions on register republication; social-platform terms; FTC primary text and 15 USC 1681b; other US state laws; the US federal public-domain basis; the Latvian Constitutional Court judgment text.
