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
| Latvian register open-data licence | The Enterprise Register's own open-data page names no licence ("distribution of open data is allowed without restriction"). data.gov.lv dataset metadata states CC0-1.0 for the datasets checked (retrieved 2026-11-20, per dataset, with the metadata URL). Datasets not checked are not covered by this statement. **Closed 2026-11-20.** | [ur.gov.lv open data](https://www.ur.gov.lv/en/open-data-sets-register-open-data-portal-latvia); third-party claim from a search summary |
| Estonian register open-data licence | The official page links "License information" to the CC BY 4.0 legal code; the licence is named by URL only. Downloads require accepting licence terms. API reuse needs a contract. | [avaandmed.ariregister.rik.ee](https://avaandmed.ariregister.rik.ee/en/node/2) |
| Estonian beneficial-owner open data | Official page: changes from 1 Sep 2023 are in the detailed service. A third-party summary says beneficial-owner data left open data from 10 Jul 2026. **Not verified.** **Corrected 2026-11-20:** the official file is still published (412,802 rows dated 19 Nov 2026, measured by data-baltics); the third-party claim is wrong. The HIDE position (round 3, item 1) is unchanged. | Official page as above; third-party summary |
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
18. The source code link is visible in the UI and the API (AGPL-3.0 s.13: a modified version run as a network service must offer its source to its users). Added after the human chose AGPL-3.0.

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
- **Conflicts:** Latvian register licence: closed 2026-11-20 (CC0-1.0 per data.gov.lv dataset metadata, for the datasets checked only). Lithuanian open-data scope (two sources disagree). Estonian beneficial-owner status (official page vs third party).
- **Gaps:** Baltic DPA primary positions on register republication; social-platform terms; FTC primary text and 15 USC 1681b; other US state laws; the US federal public-domain basis; the Latvian Constitutional Court judgment text.

## Addendum: the designer's display assumptions (round 2, item 5)

Answers to `docs/design/display-options.md` §3.2, §3.11 and §3.15. Not legal advice.

- **Sanctions wording (§3.15): confirmed.** A match is shown as "possible match, needs review" (rule 8). "Sanctioned" only with a primary list entry.
- **Verdicts on natural persons and sole traders (§3.11): partly confirmed; the memo is narrower.** Rule 5 bars credit, character and eligibility scores on natural persons, and rule 6 requires the "not a credit report" disclaimer on any verdict about a person. The memo does not bar every verdict about a natural person; defamation exposure is a **LAWYER** item. Recommended default until a lawyer answers: no verdict on any natural person or sole trader; show sourced facts only.
- **Standalone person pages (§3.2): not covered by the memo; LAWYER.** Person data appears only inside company pages. Shareholder personal data follows rule 1 (company level only, Latvia).

Corrections for the display advice:
1. Read "no verdict on natural persons" as "no credit, character or eligibility verdict on natural persons; any other verdict is LAWYER-pending, and the default is none".
2. Keep the rule 6 disclaimer on every page that shows a natural person.

## Round 2 (fetched 2026-11-19)

Not legal advice. **LAWYER** marks items a licensed lawyer must settle.

### Answers

1. **15 USC 1681b (permissible purposes).** A user may obtain a consumer report only under the listed circumstances "and no other": court orders, the consumer's written instructions, or reason to believe the report will be used for credit, employment, insurance underwriting, a government licence, investment, servicing of credit, or "another legitimate business need". [LII](https://www.law.cornell.edu/uscode/text/15/1681b)
   - Analysis from 15 USC 1681a(f): a free tool that never furnishes consumer reports to third parties is outside the consumer-reporting-agency definition on its face. Selling or furnishing reports on sole traders that bear on personal characteristics could bring it inside. **LAWYER.**
   - The product must block the listed purposes as uses: credit, employment, insurance, licensing, investment and credit servicing.
2. **US public domain.** 17 USC 105: no copyright in any work of the US Government ([LII](https://www.law.cornell.edu/uscode/text/17/105)). Federal court opinions are government works (inference from the statute). PACER charges fees; litigation on free access is reported, with no settled outcome found. A nonprofit runs a free public mirror of court filings ([free.law](https://free.law/pacer-facts/), secondary; its reuse terms not checked). SEC filings are written by the filers, so their copyright status is **unchecked**. **LAWYER.**
3. **Baltic DPAs on board and officer data.**
   - **LT (VDAI):** public availability does not waive the GDPR; each republisher needs its own legal basis. Manager data remains personal data; a company's own data is outside the GDPR. From a secondary Lithuanian source; VDAI decision 3R-1497 of 20 Aug 2026 was located but not read ([vdai.lrv.lt](https://vdai.lrv.lt/public/canonical/1787292327/1511/2026-08-20%20sprendimas%20Nr.%203R-1497%20(2.13-1.E).pdf)).
   - **LV (DVI):** no opinion on board-member data found. **Gap.**
   - **EE (AKI):** board members' names and personal codes go on the register card by statute, and publication there is lawful. Each later republisher needs its own legal basis (a 2024 letter). Supervision from April 2025 ended with a warning covering personal codes and indefinite publication of historical data. From a public mirror of AKI letters, not the official site.
4. **The Latvian judgment, case 2024-01-01.** Not listed on the court's site. Press reports describe a ruling on shareholders only, with the norms losing force on the day the judgment is published. No report mentions board members or officers. Per the EU e-Justice summary, Latvian board members, representatives and senior staff with representation rights appear in the public part of the register (name, part of the personal code, post, registration date) ([e-Justice](https://e-justice.europa.eu/topics/registers-business-insolvency-land/business-registers-eu-countries/lv_en)). Judgment text unread. **LAWYER.**
5. **The designer's assumptions.** See the addendum above; unchanged.
6. **US state privacy laws.** About 20 comprehensive state laws were in force as of Aug 2026 in most trackers; some count 24 enacted, with conflicting 2027-2028 dates (secondary trackers). Exemptions for publicly available government records: **not found. Gap**; the primary text of each statute is needed.

### Round 2 source quality

- **Verified on primary text:** 15 USC 1681b (via LII); 17 USC 105 (opening clause).
- **Not verified:** the Latvian court's site (no case listing); the official VDAI and AKI pages (mirror and secondary only); DVI; state privacy statutes; PACER and mirror terms; SEC filing copyright.
- **Gaps:** the Latvian judgment text; a DVI opinion; the US state exemptions table.

### Coordinator's reading, for session 1 (proposals, not rulings)

- **Personal codes:** propose never showing them, even masked (AKI warning; rule 4). Session 1 decides.
- **Historical officers:** propose a retention limit for ended roles (AKI warning; rule 11).
- **Blocked uses (US):** propose that the terms of use and the UI exclude credit, employment, insurance, licensing, investment and credit-servicing decisions (15 USC 1681b; rule 6).

## Addendum: market data questions from `markets.md` (2026-11-20)

Rule-based positions; the provider terms were not re-read for this answer. Not legal advice.

1. **One cited market-cap figure per market, shipped in the repo:** allowed only as a derived number with its source and as-of date shown (rules 3 and 16), and only if the source's terms allow redistributing that figure. Until those terms are read: CAVEAT, not SHOW. **LAWYER** to confirm.
2. **Oracle feed terms:** the feeds are keyless public on-chain reads, so the user-key rule (17) does not apply. A display clause in the public RPC's terms does not clear the oracle's own data terms, which are unread. LATER until they are read and quoted (corrected 2026-11-20).
3. **EIA vendor-permission note:** not verified. Until it is read, use the CSV route only and show the source and date (rule 16).
4. **Two exchanges' data terms:** not verified. User key, or LATER.

**Positions for session 1, pending the quoted clauses:** oracle route LATER; bitcoin price from the exchange API (X4) CAVEAT until its redistribution clause is quoted and confirms that the derived figure (not raw ticks) may be shown; EIA SHOW on the official "republished with permission" wording, with source and date on each figure (rule 16); O5 and X1 LATER until their terms are readable.

Before any of these moves to SHOW, the provider's current terms page is read and its URL, date and exact redistribution clause are recorded (for coded commercial providers, in the maintainer's private notes, by code).

## Round 3: the Baltic items (part 1, 2026-11-20)

Positions on the first items in `baltics.md`, "For the legal memo". Rule-based positions, not a lawyer's advice. Not legal advice.

1. **Beneficial owners, LV and EE:** HIDE. Public bulk access was invalidated in C-37/20 and C-601/20, and C-798/24 requires conditions for shareholder data. Neither case was decided on these exact registers: **LAWYER** per country. Until then the section shows "Not shown in [country]: restricted by rule 1" (council clarification 4).
2. **LV masked personal code:** the birth date it reveals is personal data. The code is never shown, and no derived birth date or age is shown. Name and role only, in company context (rules 1 and 2).
3. **EE person hash:** a pseudonym that links records across files is still personal data. Internal joins only; never rendered, exposed in the API or exported. **LAWYER.**
4. **EE officer personal emails and home addresses:** dropped in the loader. Mandatory: no section needs them, so they fail the necessity test (rule 4).
5. **Share-alike data and the UN list:** EE CC BY-SA data keeps its licence tag per record and is never merged into any dataset we publish (project hard rule 4). The UN list (no redistribution): agents fetch it live; no stored copy.
6. **Our own daily snapshots of ended roles:** they need a retention limit before they are stored. Until a lawyer sets the period, keep no role history beyond what the session 1 matrix requires.

## Round 3: the Baltic items (complete, 2026-11-20)

Not legal advice. Primary texts were not re-read this round; "not verified" items need a source check before they are relied on.

| Item | Position | Proposed call | Light |
|---|---|---|---|
| 1 LV and EE beneficial owners | Restricted (rule 1); LV concealment on request since 1 Jul 2026 (not verified) means bulk copies can't be relied on. **LAWYER** | HIDE, with the restricted-section lock | R |
| 2 LV masked personal code | Personal; no code, birth date or age shown (rules 1, 2). **LAWYER** for scope | HIDE | R |
| 3 EE person hash | Personal pseudonym; internal join key only. **LAWYER** | HIDE | R |
| 4 EE officer personal emails and home addresses | Dropped in the loader, mandatory (rule 4) | drop | R |
| 5a Sole-trader names | Natural person, company context only, with the purpose note (rules 2, 5) | CAVEAT | Y |
| 5b LV natural-person procurement winners | Undecided | LATER | R |
| 5c EE natural-person bankruptcy notices | Natural person; company bankruptcies unaffected. **LAWYER** | HIDE | R |
| 6 CC BY-SA data (EE tax board, procurement, notices) | Hard rule 4 turns on publication; a local-only store is not clearly outside it. **LAWYER** | CAVEAT: a separate store, a licence tag per record, never merged into any dataset the app exports, publishes or serves in bulk; single facts in the UI carry attribution and the licence link | Y |
| 7 LT social-insurance files, no stated licence | Public by law (not verified) | CAVEAT: source, as-of date and "no licence stated by the publisher"; verify with the publisher before SHOW | Y |
| 8 UN sanctions list | Personal, non-commercial use; no redistribution | CAVEAT: agents fetch live, no stored copy, match shown with its citation | Y |
| 9 LV tax-debtor lookup | Purpose-limited by law, CAPTCHA-gated; automating it would bypass a control | LATER, no connector | R |
| 10 LV official notices | Reuse needs a written agreement and fees | LATER | Y |

**Item 11, the Estonian register API contract: not cleared; do not sign until the contract text is read.** No public term found bars display in an open-source app, but the governing contract was not read.
- A contract is needed for the API and XML services. Limits: 50,000 answers per partner per day, one simultaneous query, 20 document requests per minute per IP ([register open-data page](https://avaandmed.ariregister.rik.ee/en/node/2)).
- General conditions ([RIK](https://abiinfo.rik.ee/en/general-conditions-use-inquiry-systems-centre-registers-and-information-systems)): 4.1 use "in compliance with valid legislation, in good faith"; 4.2 personal data follows Estonian and EU rules, with no transfer abroad; 6.6 bans scripts, robots and automated tools in the web query systems (the API is the intended automation route; the contract must confirm it); 6.5 and 8.3 allow restriction or termination for security risk or breach.
- Not found: any clause on publication, redistribution, commercial use, display in applications, or passing data to third parties.
- Before signing, legal reads the contract form ([contract page](https://ariregister.rik.ee/eng/contract)) and the [conditions of use](https://www.rik.ee/en/asutusest/kasutustingimused). If either bans publication or redistribution, or conflicts with an open-source app, the API-sourced fields are HIDE and the contract is not signed.

## Share-alike storage (answer to qa, 2026-11-20)

Not legal advice. The architecture's CI test (fail any share-alike source stored locally) is the stricter position and stays the default. Relax it only through an explicit share-alike storage class with the three round 3 conditions enforced in code: a separate store, a licence tag per record, and never merged into anything exported, published or served in bulk, with a negative test for export. Without that class, EE tax debt (S08) can't be built as decided. Session 1 chooses: (a) the storage class, or (b) EE tax debt agent-only, queried live, nothing stored. Whether a separate local store is within project rule 4 remains a **LAWYER** item.

## Per-company person pseudonym (architecture milestone A, 2026-11-20)

Not legal advice. The architecture gives each person row an install-local HMAC over (source, company, record key), with no cross-company person id. Light **Y**, conditional; if any condition fails, the light is **R** and the design falls back to company-level data.
1. The masked LV code and the EE person hash are never an input, direct or indirect. The record key comes from a row-local identifier not derived from a personal code; if the register's record key is the person's code or a function of it, the light is R.
2. One company only: no cross-company output, query, index or API joins person rows across companies.
3. The key is install-local: never exported, served, logged or shown; deleted with the store; never copied into backups or shared between installs.
4. Retention follows policy P4: the pseudonym is removed when the role ends (0 days interim); no same-company person history.
5. Tests: the HMAC appears in no API, MCP, export or agent output; a fixture with a known code asserts the code does not appear in the store.

A per-company pseudonym is still personal data; condition 1 keeps it out of the direct-identifier class. **LAWYER** to confirm before the person rows are built.
