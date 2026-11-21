# Open-web sources for the research agents (OSINT)

Owner: `data-osint`. Researched 2026-11-19 and 2026-11-20. Terms were read on the official pages on those dates; anything not confirmed there is marked **unverified**. Probes live in `research/probes/osint/`; every download, API response and entity-level profile stays in the gitignored `research/.cache/osint/`.

Tags: 🟢 measured · 🟡 modelled from measured inputs · 🔴 assumed.

Commercial platforms are described by kind ("a review platform's API") unless the code would call them. Official sources are named.

## Key findings

1. **Sanctions are the strongest open-web source.** The official OFAC, EU, UN and UK lists are free, bulk and reusable (🟢 7 files, 85 MB, all downloaded in one pass). Name-only screening of random register names gave hits for 0.22% of company names and 0.06% of person names (🟢 5,000 each), all on generic names, so every hit needs a second identifier before it is shown. The aggregated open sanctions/PEP dataset is CC BY-NC: connector only, under the user's own licence (legal rule 12).
2. **Domain WHOIS ties a website to the register in LV and EE.** The .lv and .ee WHOIS publish the registrant's company code for legal persons, a direct join key. 🟢 On the sample it matched the register code for 5 of 21 websites (44% of EE sites). None of .lt, .lv, .ee or .eu offers RDAP; all need port-43 WHOIS, whose terms restrict reuse. Show at query time, never bulk-store. **Legal's reading (session 1): .lt CAVEAT; .lv and .ee LATER, so the code match is not usable in v1.**
3. **Most small Baltic companies have no findable website.** 🟢 LV: 2 of 8 samples, LT: 2 of 7, both by web search. EE's register has a website contact field, but 🟢 only 5.6% of active EE entities fill it. 🟢 3 of 9 register-listed EE websites no longer resolve (both micro companies and the one in liquidation). A dead official website is a useful "points to check" signal.
4. **News is thin and rate limited.** P4 is free, redistributable with attribution, and covers Lithuanian, Latvian and Estonian media, but it searches only the last 3 months and allows one request every 5 seconds per IP (stated in its own error message). 🟢 It answered only 13 of 32 queries (rate limits and connection timeouts, even at 12 s spacing with retries); 5 returned articles, and 3 of those were other things with the same name. News needs a fallback (the provider's web search, restricted to news domains) and a relevance check before anything is cited. Commercial news APIs either exclude Baltic languages or forbid production use on their free tiers.
5. **Reviews and social platform APIs are closed to this use.** Every major review API either bans feeding its content to a generative AI model, bans "creating content" from it, or is approval-only. The microblogging, social-network and professional-network platforms explicitly ban background checks, eligibility decisions or "investigating". The council's LATER call stands; the evidence is in §1.3-1.4. What is open: 🟢 41% of samples link at least one social profile from their own website, which costs nothing to read.
6. **Regulator red-flag lists are small and mostly HTML.** Three publish files (Bank of Lithuania illegal websites, 145 rows; ESMA non-compliant crypto providers, 217; Lithuanian gambling regulator, 197 domains). Estonian and Latvian warning lists are HTML only. The US consumer-complaint database refuses non-browser clients (🟢 HTTP 403 on both the API and the bulk file).
7. **EU-wide procurement (TED) joins cleanly.** Anonymous API and bulk XML, free reuse. 🟢 92-99% of Baltic winners are identified by their national register code, and 9 of 24 Baltic samples won at least one EU-wide award.
8. **Cost per investigation is modelled, not yet measured.** 🟡 About $0.46 typical and $0.92 worst case with a mid-tier model throughout, under the $1.50 cap. The measurement needs an LLM key, requested as a human-task. §4.6 gives the estimation method the council asked for.

## 1. Source catalog

### 1.1 Website and domain (report section S15)

#### Domain registration data: RDAP and ccTLD WHOIS
- Publisher and official URL: IANA RDAP bootstrap `https://data.iana.org/rdap/dns.json`; generic TLDs answer at the registry's RDAP server (for .com, the .com registry's RDAP server, found through the IANA bootstrap). The ccTLD registries for .lt, .lv, .ee and .eu answer on port-43 WHOIS only (`whois.domreg.lt`, `whois.nic.lv`, `whois.tld.ee`, `whois.eu`).
- Access: per-query. RDAP is JSON over HTTPS; WHOIS is plain text over TCP port 43.
- Fields: registration date, expiry date, registrar, registrant type. For legal persons: registrant name (all four ccTLDs), registry code (.lv `RegNr`, .ee `org id`), address and email (.lv, .lt). Natural persons are hidden by every Baltic registry.
- Rows and coverage: 🟢 the bootstrap file (published 2026-11-19) has no entry for lt, lv, ee or eu. 🟢 On 21 sample websites: registration date found 76% (LT 2/2, EE 6/9, US 8/8, LV 0/2: .lv WHOIS publishes no dates); registrant is an organisation 43% (US 0/8: .com RDAP at the registry shows the registrar only).
- Freshness: live.
- Size and speed: 🟢 p50 84 ms, p95 129 ms; 1.5 KB median response.
- Join keys: 🟢 .lv and .ee registrant code equals the register code for 5 of 21 sample sites (LV 1/2, EE 4/9).
- Person identity: none shown for natural persons.
- Licence: no open licence. .lv: "It is permitted to use the WHOIS service only for technical or administrative needs associated with the operation of the Internet or in order to contact the domain name holder over legal problems"; "It is not permitted to obtain (including copying) or re-use in any form or by any means all or quantitatively or qualitatively significant part of the WHOIS without NIC.LV's express permission" (a database-right clause about substantial parts, so one lookup per investigation is not covered by it) ([nic.lv](https://nic.lv/en/nic-whois-policy)). .ee: "may not be used for business, advertising, reproduction, recompilation, redistribution, reuse"; not "as a backend for a search engine" ([internet.ee](https://www.internet.ee/domains/whois-terms-and-conditions)). .lt: "used only for the information on a specific .lt domain and its holder" ([domreg.lt](https://www.domreg.lt/en/services/whois/)). .com RDAP: no "high volume, automated" processes (terms page in the local provider map). Verified 2026-11-19.
- Keys, limits, cost: free, no key. Per-IP limits without numbers (.lv, .ee). rdap.org redirector: 10 requests per 10 s.
- Legal constraints: one lookup for one domain the user is investigating fits the stated purposes best; bulk lookups or building a domain-to-company table does not. The .lv purpose clause is the tightest: **legal to confirm** whether a due-diligence lookup fits "technical or administrative needs" or "to contact the domain name holder over legal problems". Its reuse clause covers only all or a significant part of the WHOIS, which a single lookup is not.
- Tested with: `domain.mjs` `registration()`, via `reality_check.mjs`.
- Verdict, per legal's reading of the terms quoted in §1.1a (2026-11-20, not legal advice):
  - **.lt: CAVEAT.** One live lookup per investigation; show the creation date (domain age) and the registrar only. Nothing stored beyond the investigation's own cited record. The holder is never contacted.
  - **.lv and .ee: LATER.** No field from either WHOIS is shown, including the register-code match. .lv returns if the registry confirms in writing that a due-diligence lookup is within its purpose clause.
  - **US (.com and other gTLD RDAP): CAVEAT,** as council session 1 kept it: creation date only.
  - Registrant name and contacts: HIDE on every path.
  - Re-read the live .lt terms against the server notice on the build date.

#### 1.1a The WHOIS and web-archive terms, quoted in full for legal

Council session 1, item 5, asked for these texts. Retrieved 2026-11-20. "Banner" is the notice each registry's port-43 WHOIS server returns with every answer; the web page is the registry's published policy. Not legal advice: the readings below are for `legal` to confirm or reject.

**What Finora would do with WHOIS:** one lookup of one domain, when a user investigates a company whose website it is. Shown: creation date (domain age), registrar, and whether the registrant code equals the register code (.lv, .ee). Never shown: the registrant's name, email, phone or address. Nothing is kept outside that investigation; there are no bulk lookups and no domain-to-company table.

**.lv (NIC.LV)**
- Web policy "NIC WHOIS Policy", Riga, 8 May 2018, in force 25 May 2018 ([nic.lv](https://nic.lv/en/nic-whois-policy)), section "Terms of Use of WHOIS", in full:
  > By submitting a WHOIS request, the requestor agrees that: The WHOIS service is provided solely for information purposes; It is permitted to use the WHOIS service only for technical or administrative needs associated with the operation of the Internet or in order to contact the domain name holder over legal problems; Requestor will not use information obtained using WHOIS: to allow, enable or in any other way support sending of unsolicited mails (spam); for any kind of advertising; to disrupt stability and security of the Internet. It is not permitted to obtain (including copying) or re-use in any form or by any means all or quantitatively or qualitatively significant part of the WHOIS without NIC.LV's express permission.
- Same policy, "Technical Limitations": "In order to prevent data mining, the limit of queries per IP address is introduced. Advanced search is not available, and it is not possible to query by holder's name, email, address, phone or fax."
- Banner: the same clauses, word for word, under `[Disclaimer]`.
- Reading for legal: the reuse clause covers "all or ... significant part", so one lookup falls outside it. The open point is the purpose clause: is checking a company before a deal a "technical or administrative need associated with the operation of the Internet"? The "contact the domain name holder over legal problems" limb does not fit.

**.ee (Estonian Internet Foundation)**
- Web page "WHOIS Terms and Conditions", §2 ([internet.ee](https://www.internet.ee/domains/whois-terms-and-conditions)), in full:
  > All information disclosed through the .ee WHOIS service is protected by the rights of the database owner in compliance with the applicable Copyright Act and binding international conventions. Copyright Eesti Interneti SA (english Estonian Internet Foundation, hereinafter as "EIS"). All rights reserved. The WHOIS service is accessible only through the accesses created by EIS, the WHOIS protocol (restricted information) or Rest WHOIS in compliance with the terms and conditions of using WHOIS, with the following restrictions: 1. the WHOIS search results may not be used for business, advertising, reproduction, recompilation, redistribution, reuse or any other similar purposes; 2. the WHOIS search results may not be downloaded for the creation of a personal database or used as a backend for a search engine. In addition, WHOIS search results may not be obscured (partially or completely), hidden or removed. If any of the search results obtained through WHOIS is transferred to a third party, it must be done in its entirety as original information provided by EIS, with reference to the respective source and copyright holder.
- The same page, §3: for legal-person registrants it publishes "their name, commercial registry code, and names and email addresses of their administrative and technical contacts". The page says the Estonian version prevails if the two differ.
- Banner: "Search results may not be used for commercial, advertising, recompilation, repackaging, redistribution, reuse, obscuring or other similar activities."
- Reading for legal: the tightest of the three. "Business ... or any other similar purposes" and "reuse" may cover showing a derived fact to a user doing business due diligence. The "in its entirety" rule also conflicts with showing selected fields only: a third party gets the whole result or nothing. Finora is free and non-commercial, but its users check companies for business reasons.

**.lt (DOMREG)**
- Web page "Searching for the domain in WHOIS" ([domreg.lt](https://www.domreg.lt/en/services/whois/)): "WHOIS database is used only for the information on a specific .lt domain and its holder."
- Banner (version 0.4), in full:
  > By submitting a query you agree not to use the information made available to: - allow, enable or otherwise support the transmission of unsolicited, commercial advertising or other solicitations whether via email or otherwise; - target advertising in any possible way; - to cause nuisance in any possible way to the registrants by sending (whether by automated, electronic processes capable of enabling high volumes or other possible means) messages to them.
- The Procedural Regulation for the .lt domain (edition 3.0, 2023-06-01, [PDF](https://www.domreg.lt/informacija/dokumentai/procedural-regulation.pdf)) defines the WHOIS database (3.20) as data "which can be used individually by electronic means" and sets no other rule on using it.
- Reading for legal: the loosest of the three. One lookup about one domain matches "information on a specific .lt domain and its holder", and none of the banned uses (advertising, solicitations, nuisance) applies. The .lt server gives the creation date but no register code.

**The web archive P8**
- The live terms page (`<endpoint in the local provider map>`) now renders only in a browser that runs its scripts; a headless browser returned an empty shell. The text below is the last server-rendered version, headed "Terms of Use 31 Dec 2014", from the archive's own capture of that page on 2024-11-30 (`<endpoint in the local provider map>`). **Legal should confirm the live text is unchanged.**
- The relevant clauses, verbatim:
  > Access to the Archive's Collections is provided at no cost to you and is granted for scholarship and research purposes only.

  > You agree not to interfere with the work of other users or Archive personnel, servers, or resources.

  > In particular, you certify that your use of any part of the Archive's Collections will be limited to noninfringing or fair use under copyright law.

  > In using the Archive's site, Collections, and/or services, you further agree (a) not to violate anyone's rights of privacy, (b) not to act in any way that might give rise to civil or criminal liability, (c) not to use or attempt to use another person's password, (d) not to collect or store personal data about anyone, (e) not to infringe any copyright, trademark, patent, or other proprietary rights of any person, ...

  > ... we request that, according to standard academic practice, if you use the Archive's Collections for any research that results in an article, a book, or other publication, you list the Archive as a resource in your bibliography.
- The archive's help centre ("the archive's access policy", (terms page in the local provider map)): "The archive's Terms of Use governs patrons' use of the collection of Web pages and other digital content available through the P8."
- **What Finora would do:** ask the capture index (CDX) for one domain's capture dates, show the first and last capture year, and link to a snapshot. No page content is copied or stored, and no personal data is collected.
- Reading for legal: two questions. Does a user checking a company count as "research"? And could capture dates for a domain be "personal data about anyone"? For a sole trader's domain they could, so legal rule 5 applies there either way.


**Legal's reading** (comment 7029245848, 2026-11-20, not legal advice; a lawyer settles the LAWYER items): .lt CAVEAT (one live lookup per investigation; creation date and registrar only; no storage beyond the investigation's cited record; no contact with the holder). .lv LATER, until the registry confirms in writing. .ee LATER, with no field shown, including the register-code match. Web archive LATER, with no due-diligence use; a plain link the user opens is a LAWYER item and never a finding. The live texts are re-read before the build.

#### Certificate transparency: P1 and P5
- Publisher and official URL: P1 `<endpoint in the local provider map>`; P5 `<endpoint in the local provider map>`.
- Access: per-query JSON.
- Fields: certificate issuance dates, DNS names on each certificate (subdomains), issuer.
- Rows and coverage: 🟢 certificates found for 14 of 21 sample websites (67%). The query failed for 4 (US): P1's unauthenticated tier stopped answering late in the run (17 full-domain queries in a few minutes had succeeded), and P5 returned HTTP 502 or 404. Every site that answered had certificates except the 3 dead EE domains. A free P1 key (10 full-domain queries an hour, 100 single-hostname) is enough for one user; querying the single hostname instead of all subdomains stays within the larger quota.
- Freshness: live (CT logs).
- Size and speed: 🟢 p50 458 ms, p95 7.5 s (P5 fallback); 4 KB median, 100 KB max.
- Join keys: domain only.
- Licence: P1: free tier "may be reduced during periods of high load"; the terms do not address storing or redistributing results (terms page in the local provider map). P5: no terms found, "© P5's operator ... All rights reserved". Verified 2026-11-19.
- Keys, limits, cost: P1 free key: 100 single-hostname and 10 full-domain queries per hour; $50/month for 10x. P5: 60 requests per minute (2020 statement, unverified today); 🟢 returned HTTP 502 on first try.
- Legal constraints: none found beyond the above.
- Tested with: `domain.mjs` `certificates()`.
- Verdict: use. Derived facts only (first certificate seen, number of hostnames). P1 first, P5 as fallback; a free P1 key is optional configuration.

#### DNS over HTTPS
- Publisher and official URL: P6 `<endpoint in the local provider map>` (JSON); P7 JSON API as fallback.
- Access: per-query JSON, no key.
- Fields: A (resolves), MX (receives email), SPF and DMARC TXT records (anti-spoofing set up).
- Rows and coverage: 🟢 resolves 86%, MX 81%, SPF 71%, DMARC 57% of sample websites.
- Size and speed: 🟢 p50 83 ms, p95 307 ms (four lookups in parallel).
- Licence: P6: its general website terms; "security scanning use-cases ... may be rate limited" (terms page in the local provider map). P7: its APIs terms, no permanent copies. DNS answers are facts, not content. Verified 2026-11-19.
- Verdict: use. Query time, derived booleans.

#### P8's capture-index API
- Publisher and official URL: P8 `<endpoint in the local provider map>`; availability API `<endpoint in the local provider map>`.
- Access: per-query JSON, no key.
- Fields: capture timestamps (first capture, last capture, years with a capture), status codes, and a link to each snapshot.
- Rows and coverage: 🟢 at least one capture for 95% of sample websites (20 of 21).
- Size and speed: 🟢 p50 877 ms, p95 2.3 s.
- Licence: quoted in §1.1a (last server-rendered text; the live page renders only by script). No rate limit is published; the CDX server caps results at 150,000.
- Verdict: **LATER** (legal, 2026-11-20): access is "for scholarship and research purposes only", and a due-diligence verdict is not that purpose. Not queried by any agent in v1. Whether the UI may offer a plain link that the user opens is a lawyer question, and such a link is never a finding.

#### The company's own homepage
- Access: one HTTPS GET of the homepage, as a browser would, when the user investigates the company.
- Fields: reachable, final host after redirects, whether the page states the registry code or VAT number, links to social profiles.
- Rows and coverage: 🟢 reachable 81% of sample websites; states the register code 14% (LT 2/2, EE 1/9, LV 0/2); links at least one social profile 41% of all samples.
- Size and speed: 🟢 p50 664 ms, p95 3.8 s; 103 KB median HTML, 734 KB max.
- Licence: the site's own copyright. Reading a page to answer a user's question and quoting a short span with a link is the use; storing or republishing the page is not.
- Legal constraints: respect `robots.txt` for anything beyond the homepage and the pages it links to (the agent fetches at most a handful of pages per site). No logins, no forms.
- Verdict: use.

#### The web corpus P9's index
- Official URL: `<endpoint in the local provider map>`.
- Licence: limited, non-sublicensable licence; crawled content "may be subject to separate terms"; "respect the copyrights" (terms page in the local provider map, read 2024-03-07).
- Verdict: skip for v1. P8 covers the same question (is the site old?) with direct snapshot links.

#### Web search APIs
- Options checked 2026-11-19:
  - **The LLM provider's server-side web search tool** (Anthropic Messages API): $10 per 1,000 searches plus tokens; web fetch has no per-call fee. Domain allow and block lists per request. One key for the whole runtime.
  - **Search API A**: $5 per 1,000 requests with a small monthly credit. Its terms forbid storing results beyond transient use, forbid redistribution, and require each end user to be bound by a written agreement with the customer.
  - **Search API B and C** (AI-search APIs): free monthly credits, $4-8 per 1,000; one forbids sharing the key, the other's terms could not be read.
  - A large search engine's JSON API is closed to new customers; another was retired on 2025-08-11. Self-hosted metasearch depends on upstream engines whose terms forbid automated access.
- Verdict: use the LLM provider's web search and web fetch tools (one key, citations built in, no storage clause to police). Keep the search tool behind the provider interface so a second provider can be added.
- 🟢 Observation from website discovery: for small Baltic companies the top results are dominated by commercial company-information portals. Their terms forbid scraping (legal rule 14), so fetching is restricted to an allowlist (§4.2).

### 1.2 News (S16)

#### P4 DOC 2.0 API
- Publisher and official URL: P4, `<endpoint in the local provider map>`.
- Access: per-query JSON, no key. `mode=artlist`, up to 250 records per query.
- Fields: article URL, title, seen date, source domain, language, source country.
- Rows and coverage: rolling last 3 months only. Lithuanian, Latvian and Estonian are in its language list. 🟢 32 queries: 13 answered, 8 of them empty, 5 with articles; 3 of those 5 were name collisions (articles in up to 15 unrelated languages). Exact-phrase search on a short or generic company name is not enough.
- Freshness: updates every 15 minutes.
- Size and speed: 🟢 p50 10.8 s, p95 14.2 s per query including the enforced wait; up to 109 KB for 250 articles. 🟢 Reliability from one IP shared with other research jobs: 41% of queries answered after 3 tries.
- Licence: "available for unlimited and unrestricted use ... for any academic, commercial, or governmental use of any kind without fee"; "You may redistribute, rehost, republish, and mirror"; "must include a citation to the P4 Project and a link" (terms page in the local provider map). Verified 2026-11-19. This covers P4's metadata; the articles stay the publishers'.
- Keys, limits, cost: free. 🟢 The API itself answers "Please limit requests to one every 5 seconds". One IP shares that limit across all investigations, so the tool queues requests globally.
- Legal constraints: show title, source, date and link. The EU press publishers' right (Directive 2019/790 art. 15) exempts hyperlinks and "individual words or very short extracts"; Lithuania reportedly sets that at 125 characters (secondary source, the statute page returned 403). Quote no more than 125 characters from any press article.
- Tested with: `news.mjs`.
- Verdict: use with caveat, best effort. The only free, redistributable, multi-language news index, but unreliable. The news tool queries P4 with the name plus the country (`sourcecountry:`) or the register's language, falls back to the provider's web search on news domains when P4 fails, and the agent confirms each article is about the pinned company before citing it. Coverage text: "news from the last 3 months; may be incomplete".

#### Baltic public broadcasters' RSS
- Feeds: LRT `https://www.lrt.lt/?rss` (Lithuanian, about 50 items), LSM `https://www.lsm.lv/rss/?lang=lv&catid=14` (Latvian), ERR `https://news.err.ee/rss/news` (English) and `https://www.err.ee/rss` (Estonian).
- Licence: LRT: no terms page, "all rights reserved". LSM: use "only with prior written permission"; sharing in full, unaltered form by hyperlink allowed ([lsm.lv](https://www.lsm.lv/lietosanas-noteikumi/)). ERR: no use without permission; headline plus up to five sentences may be summarised with a link ([err.ee](https://info.err.ee/982667/kasutustingimused-ja-kommenteerimine)). Verified 2026-11-19.
- Coverage: each feed holds only the latest ~50 items, so matching a given company is rare; P4 already indexes these outlets.
- Verdict: skip as a separate source in v1; link-only if ever used.

#### US federal press releases and enforcement feeds
- SEC press releases RSS, litigation releases RSS, administrative proceedings RSS, trading suspensions RSS; DOJ press release API (`https://www.justice.gov/api/v1/press_releases.json`, 50 per page, at most 4 requests per second); FTC press release feeds; Federal Reserve enforcement RSS.
- Licence: SEC: "may be copied or further distributed ... without the SEC's permission" ([sec.gov](https://www.sec.gov/privacy)); DOJ: "in the public domain" ([justice.gov](https://www.justice.gov/legalpolicies)); FTC: US government work, attribution requested ([ftc.gov](https://www.ftc.gov/site-information/website-policy)). Verified 2026-11-19.
- Verdict: use (US). Small feeds, bulk-loadable daily, searchable locally by name; feeds S11 and S16 for US entities. SEC needs the User-Agent contact from the environment.

#### Commercial news APIs (six checked)
- Free tiers: development-only or non-commercial, 12-24 h delays, 30 days of history. None of the three with published language lists covers Lithuanian, Latvian or Estonian. One offers storage, display of headlines and short excerpts, and AI processing on paid plans from about $90 a month. Three major publishers' APIs could not be read and are reported to bar AI use.
- Verdict: skip for v1. A user-key connector is possible later; it would be a paid item for the human.

#### A large search engine's news RSS
- `robots.txt` disallows `/rss` for generic agents, and its terms forbid automated access against machine-readable instructions. Verdict: skip.

### 1.3 Reviews (S16)

| Source (by kind) | Lookup of any business | Storage | Display | AI use | Verdict |
|---|---|---|---|---|---|
| A map platform's places API | yes, by place ID | place ID forever; lat/lng 30 days; never names, addresses or reviews | max 5 reviews, credit the author, link to the platform, say how reviews are ordered; "Don't create content based on" its content | its agent tools may ground an LLM only if the content is not cached or stored and sources follow the text; the clause for the plain API could not be read | LATER: needs a billing account (rating $20 and reviews $25 per 1,000 after 1,000 free a month) and a legal read of the AI clause |
| A US review platform's API | yes | 24 h, IDs exempt | logo, link back, no generic stars | "Submit or ingest any ... Content into any Generative AI Model" is prohibited | skip |
| A travel review platform's API | yes | per caching policy | mark and link back, no combining | no licence for AI or ML use | skip |
| A consumer review platform | domain → score and review count, by key | not stated | not stated | consumer terms (from 2026-10-01) forbid automated access by AI agents without permission | skip |
| A US business-complaints bureau | approval only | refresh every 30 days | internal use only | not addressed | skip |

Verified 2026-11-19 on each platform's developer terms. Legal rule 14 (official APIs only) and the council's LATER call both hold. **What would reopen reviews:** a map-platform key from the human plus a legal reading that showing a rating and count with a link, without LLM processing, is allowed. That path is deterministic (no AI) and could fill "rating, number of reviews, link" for consumer-facing businesses only.

### 1.4 Social media (S16)

| Platform (by kind) | Official API for this use | Terms on this use | Verdict |
|---|---|---|---|
| Microblogging platform | pay per use ($0.005 per post read) | bans "surveillance ... including ... investigating", "Background checks or any form of extreme vetting", "Credit or insurance risk analyses" | skip |
| Largest social network and its photo app | page search needs app review and business verification; photo app: business accounts only | bans "eligibility determinations" (credit, housing, jobs) and "tools for surveillance" | skip |
| Professional network | no self-serve company or people lookup | API terms ban input to eligibility decisions; user agreement bans scraping | skip |
| Video platform | Data API: 10,000 units a day plus 100 searches | store at most 30 days; attribute; no derived metrics | later (user key): official channel videos only |
| Forum platform | approval required since Nov 2025; commercial use needs written approval | AI restrictions (official pages blocked: unverified) | skip |
| Decentralised network on the AT Protocol | public app view, no key; post search without login intermittently refused | honour deletions | later |
| Fediverse servers | public search without full text; full text only for opted-in posts | per server | skip |
| Short-video platform | research APIs for academics and ads only | not eligible | skip |

🟢 What works without any platform API: **the social profiles a company links from its own website** (41% of samples: EE 5/9, US 4/8, LT 2/7, LV 2/8). The web agent lists them as links ("the company's website links these profiles"), reads nothing from the platforms, and never searches people.

### 1.5 Red flags (S11, S16)

#### Reverse image search
- A cloud vision API's web detection (about $3.50 per 1,000 after 1,000 free a month; price **unverified**); a reverse-image API sold in prepaid bundles (2015 prices: $0.01-0.04 a search; current terms could not be read); another vendor's visual search API was retired on 2025-08-11.
- Faces: the cloud vision API "doesn't support facial recognition or individual identification"; GDPR art. 9 makes biometric identification of a person a special category; a US state biometric law has been read by a federal court to cover face geometry taken from photos (secondary source).
- Verdict: LATER, and never on photos of people. A possible v2 use: checking whether a product or office photo on a suspicious website is a stock image found elsewhere, with the user's own key.

#### US regulator data
| Source | Access | Licence | Verdict |
|---|---|---|---|
| CFPB consumer complaint database | API and bulk ZIP | "freely available for anyone to use" | 🟢 both refused this client with HTTP 403 (bot protection); narratives removed 2026-09. Later: retry with the data-us seat, or link out |
| FTC enforcement actions | CSV (non-merger actions FY1996-2026), XLSX (civil penalties) | US government work | use: small, bulk, name-searchable |
| SEC litigation and administrative proceedings | RSS | public, may be copied | use (see §1.2) |
| Federal Reserve enforcement | RSS | US government work | use |
| OCC, FDIC enforcement | HTML search; could not be reached | - | link out |
| FINRA BrokerCheck and disciplinary actions | HTML; website terms are non-commercial, no scraping, no machine learning | restricted | link out only |
| SAM.gov exclusions | API with key, 10 requests a day without a role; daily bulk extract with key | no systematic harvesting of the website | owned by `data-us` |
| DOJ press releases | API | public domain | use (see §1.2) |
| State attorneys general | no structured feed | - | skip |

#### Baltic and EU regulator lists
| Source | Rows (🟢 2026-11-20) | Format | Licence | Verdict |
|---|---|---|---|---|
| Bank of Lithuania, illegal financial websites | 145 | CSV export (domain; company; brand) | credit the Bank of Lithuania | use: domain and name check |
| ESMA, non-compliant crypto-asset service providers (all EU) | 217 | CSV | reproduction authorised with source | use |
| Lithuanian gambling regulator, illegal operators | 197 domains | TXT | none stated | use with caveat (domain check only) |
| Latvijas Banka, unlicensed investment firms | 20 names | one news page | "© Latvijas Banka" | use with caveat: agent reads the page at query time |
| Estonian Finantsinspektsioon alerts | ~863 a year | HTML, filterable | not found | use with caveat: agent searches the page at query time |
| Latvian consumer rights centre: suspicious websites (5), blacklist of traders ignoring dispute decisions (141) | HTML | "all rights reserved" | use with caveat: query time, link |
| Estonian consumer protection: traders ignoring dispute decisions | 238 | HTML | not stated | use with caveat: query time, link |
| Lithuanian procurement office, unreliable suppliers | - | dashboard only | - | link out |
| IOSCO investor alerts portal | - | API needs a signed agreement | - | later |

🟢 No sample entity appeared on any list (expected for a random sample; these are rare-event lists).

#### Phishing and malware domain feeds
- A browser-safety API is non-commercial only; its commercial sibling has 100,000 free lookups a month (price **unverified**) and strict refresh and attribution rules. A non-profit malware-URL feed is free for not-for-profit use with a key and forbids AI training. One phishing feed has closed registration; another is non-commercial with no display rights. National CERT DNS-firewall lists are not published.
- Verdict: later (user key, the commercial safety API). Not needed for the primary job.

### 1.6 Sanctions and PEP (S11)

All lists downloaded 2026-11-19 with `sanctions.mjs`. Entries are distinct list IDs; names include aliases.

| List | URL (format) | 🟢 Entries (names) | Second identifier | Licence (verified 2026-11-19) |
|---|---|---|---|---|
| OFAC SDN | `sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV` + `ALT.CSV` (CSV; also XML) | 19,589 (39,839) | persons: date of birth 99%; entities: registration or tax ID 61% | US government work (17 U.S.C. §105); a current Treasury statement was not found |
| OFAC non-SDN consolidated | `.../CONS_PRIM.CSV` + `CONS_ALT.CSV` | 486 (1,598) | persons: DOB 96%; entities: ID 71% | as above |
| EU Financial Sanctions Files | `webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw` (CSV; public static token) | 6,267 (24,792) | persons: birth date 73%; entities: identification number 52% | Decision 2011/833/EU: reuse "for commercial or non-commercial purposes"; acknowledge the source; do not distort |
| UN Security Council | `scsanctions.un.org/resources/xml/en/consolidated.xml` (XML; redirects to a signed link) | 1,007 (3,750) | persons: DOB 42% | **unverified** (terms page returned 403) |
| UK Sanctions List | `sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv` (CSV; also XML) | 6,449 (58,763) | persons: DOB 83%; entities: business registration number 37% | Open Government Licence v3.0. The older UK consolidated list closed on 2026-01-28 |
| US Consolidated Screening List | `data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv` | not downloaded | - | required notice: "This product uses the International Trade Administration's Data API ... but is not endorsed or certified" |
| Latvia FIU national list | XML ZIP on `sankcijas.fid.gov.lv` (download URL returned HTTP 500) | - | - | none stated |
| Lithuania national list | JSON endpoint reported by a third party | - | - | none stated |
| Estonia national list | three HTML pages, a handful of names | - | - | none stated |

- Note on the EU file: it has one row per entity × name × birth date × identifier, so identifiers must be collected per entity before deduplicating names; subject type is `P`/`E`, with the class name in `Entity_SubjectType_ClassificationCode`.
- Size and speed: 🟢 85 MB for all four official sources; each list refreshes daily; the loader skips unchanged files by content hash (cto call 4).
- Join keys: names; dates of birth; registration numbers in free text (OFAC remarks) or a column (UK).
- Person identity: name plus date of birth, nationality and document numbers on most person entries.
- **False positives** (🟢 `reality_check.mjs`): 5,000 random Estonian company names gave 11 exact normalised-name hits (0.22%). All 11 are one- or two-word generic names once legal-form words are removed, and the listed entities are registered in other countries; only a second identifier can settle them. 5,000 random Latvian officer names gave 3 exact hits (0.06%). Fuzzy matching at 0.9 similarity on the rarest shared token added none.
- **Which official identifiers the entries carry** (architect, for rule R8: a listing is confirmed only on an official-ID match). 🟢 Counted 2026-11-19:
  - OFAC SDN entities (10,122): registration number 54%, tax ID 38%, IMO number 6%, LEI 2%. Persons (7,561): date of birth 99%, nationality 76%, passport 28%.
  - OFAC non-SDN entities (368): registration number 68%, tax ID 60%, LEI 4%.
  - EU (identifier rows per entry): registration number 682, other 539, passport 517, fiscal code 479, tax ID 309, national ID 212, IMO 41.
  - UK: 693 of 2,379 entities and ships carry an IMO number; 37% of entities a business registration number; 83% of persons a date of birth.
  - UN: no registration numbers; persons DOB 42%.
  - So at most about half of listed companies can ever be confirmed by an official registration number; the rest stay "possible match, needs review" unless the human confirms. No list carries Baltic register codes in a dedicated field: registration numbers are free text with mixed country formats.
- Rows for the store (cto): about 34,000 entries and 128,000 names across the four official sources; we would load all of them (sanctions are not filtered by country), keeping name, aliases, kind, list, programme, listing date, identifiers, birth dates and nationality: about 12 statements per entry, ~400,000 statements, ~50 MB at cto's 123 bytes each.
- Verdict: use the official lists, loaded in bulk daily. Owner: `data-osint` (coordinator's split; `data-us` skips OFAC, `data-baltics` reports hits for its samples only). A hit is shown as "possible match, needs review" (legal rule 8) and becomes a finding only with a second identifier: registration number or country for entities, date of birth or nationality for persons. Without one, the agent asks the human (§4.4).

#### PEP sources
| Source | What it is | Licence | Verdict |
|---|---|---|---|
| Open aggregated sanctions and PEP dataset | the most complete open PEP data | CC BY-NC 4.0; "Compliance screening is a commercial use even though it generates no revenue"; API from €0.10 a query, 2,000 free credits for business email | connector only, user's own licence (legal rules 12-13) |
| P10 | officeholders with positions and dates | CC0 | later: query-time lookup of a person's public offices, company context only; needs a legal read on PEP flags for EU persons |
| EU list of prominent public functions (OJ C/2023/724 and C/2023/611) | functions, not names | EU reuse decision | use as reference text for what PEP means per country |
| Officials' declarations (LT, LV, EE, US) | LT needs API authentication; LV and EE search forms only; US federal disclosures may not be used "for any commercial purpose" or credit ratings (5 U.S.C. §13107(c)) | - | skip |

### 1.7 EU-wide public procurement: TED (S12)

#### TED (Tenders Electronic Daily) Search API and packages
- Publisher and official URL: Publications Office of the EU. Search API `POST https://api.ted.europa.eu/v3/notices/search` ([docs](https://docs.ted.europa.eu/api/latest/index.html)); daily and monthly XML packages `https://ted.europa.eu/packages/daily/{yyyynnnnn}` and `https://ted.europa.eu/packages/monthly/{yyyy-n}`.
- Access: API, anonymous ("The Search API does not require a key"); JSON; query language with fields such as `winner-country`, `winner-identifier`, `notice-type`, `publication-date`; up to 250 notices per page. Bulk XML packages for a full load.
- Fields: publication number and date, notice type, buyer name and country, winner name, winner identifier, winner country, contract value (`total-value`, `result-value-notice`), links to the notice in every EU language (HTML, PDF, XML).
- Rows and coverage: 🟢 award notices published in 2025 with a winner from LV 5,676, LT 6,136, EE 3,607. Covers contracts above the EU thresholds and notices buyers chose to publish; national below-threshold contracts are `data-baltics`' national sources.
- Freshness: daily (one Official Journal S issue per working day).
- Size and speed: 🟢 search p50 1.2 s, p95 1.6 s (30 calls).
- Join keys: 🟢 the winner identifier is a national register code for 99% of LV winners (11 digits), 92% of LT (9 digits) and 99% of EE (8 digits), sampled from 250 award notices per country published in 2026. Some carry a country prefix (`LVA-…`), which the loader strips.
- Person identity: winners are organisations; sole traders can appear with their trading name.
- Licence: "the procurement notices published in the Supplement to the Official Journal ... can be freely reused, for commercial or non-commercial purposes" under the Commission's reuse decision of 12 December 2011; site editorial content CC BY 4.0; system metadata CC0 ([ted.europa.eu legal notice](https://ted.europa.eu/en/legal-notice)). TED logos may not be used. Verified 2026-11-20.
- Keys, limits, cost: free, no key. Fair use from one IP: 700 requests a minute, 600 notice views or downloads in 6 minutes, 3 concurrent package downloads ([developers' corner](https://ted.europa.eu/en/simap/developers-corner-for-reusers)).
- Legal constraints: none beyond attribution; the data names organisations.
- Tested with: `ted.mjs` (volumes, identifier format, sample lookups).
- Verdict: use. Bulk-load award notices for winners in LV, LT and EE (eForms notices since late 2023; older notices use the previous XML schema), keyed by register code. For the investigation, an agent tool can also look up a code live. 🟢 9 of 24 Baltic sample companies won at least one notice (EE 4/9, LV 2/8, LT 3/7).

## 2. Reality check

**Method.** Samples were picked by rule, ordered by `sha256("finora-osint-2026-11:" + id)`, from the registers the data seats downloaded (`select_samples.py`, `select_samples_lt.py`, `select_samples_us.py`):
- EE (9): active companies listing a website in the register contacts, two per annual-report size class (large, medium, small, micro), plus one in liquidation or bankruptcy.
- LV (8): active limited companies by latest net turnover (≥€50M, €5-50M, €0.5-5M, <€0.5M) plus one terminated company.
- LT (7): companies by 2024 sales revenue in the same bands. The late-filer list gave no distressed pick.
- US (8): three public companies by public float (≥$10B, $300M-2B, <$100M) and five small private businesses from the SAM.gov entity extract that list a website (one per trade, five trades).

Websites: from the register (EE, US private), else found by web search as the web agent would (LV, LT, US public). Each probe then ran exactly as the agent tool would. Entity-level profiles are in `research/.cache/osint/profiles/`.

Sample sizes are small (7-9 per country). The rates below say what the agent can expect, not population statistics.

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
| S15 archived in P8 | all | sites known | 21 | 20 | 95% | |
| S15 homepage reachable | all | sites known | 21 | 17 | 81% | |
| S15 homepage states register code | all | sites known | 21 | 3 | 14% | LT 2/2, EE 1/9, LV 0/2 |
| S16 social profile linked from own site | all | all | 32 | 13 | 41% | EE 5/9, US 4/8, LT 2/7, LV 2/8 |
| S16 news articles, last 3 months (P4) | all | all | 32 | 5 | 16% | only 13 of 32 queries answered (41%): rate limits and connection timeouts despite 12 s spacing and 3 retries. Of the 5 hit sets, 3 are in languages with no tie to the company's country: name collisions |
| S11 sanctions exact name hit | all | all | 32 | 0 | 0% | expected; see false-positive rates |
| S11 regulator red-flag list hit | all | all | 32 | 0 | 0% | expected |
| S12 EU-wide award notice won (TED) | EE | all sizes | 9 | 4 | 44% | live lookup by register code |
| S12 EU-wide award notice won (TED) | LV | all sizes | 8 | 2 | 25% | |
| S12 EU-wide award notice won (TED) | LT | all sizes | 7 | 3 | 43% | |

**Population note.** 🟢 In the full EE register (2026-11-19), 20,944 of 372,137 active entities (5.6%) list a website contact. So for most EE companies the web agent also has to search, as in LV and LT.

## 3. Display matrix rows

| Section | Country | Sources | Grade | Fill rate | Notes |
|---|---|---|---|---|---|
| S11 | all | OFAC SDN + non-SDN, EU FSF, UK Sanctions List | A | 100% screened; 0% hits | bulk; licence verified Y; name + second identifier required; "possible match, needs review" |
| S11 | all | UN Security Council consolidated list | C | 100% screened; 0% hits | bulk; licence verified N (terms page returned 403); 🟢 1,002 of 1,007 UN entries have a name that also appears on the EU, UK or OFAC lists, so leaving UN out loses almost nothing |
| S11 | LT | Bank of Lithuania illegal websites; gambling regulator domains | B | 100% checked; 0% hits | bulk; licence verified Y (gambling list: none stated); domain and name match |
| S11 | LV | Latvijas Banka warnings page; consumer centre lists | C | 100% checked at query time | per-query; licence verified Y (all rights reserved: link and short quote only) |
| S11 | EE | Finantsinspektsioon alerts; consumer protection list | C | 100% checked at query time | per-query; licence verified N (no terms found) |
| S11 | all | ESMA non-compliant crypto providers | A | 100% checked; 0% hits | bulk; licence verified Y |
| S11 | US | SEC, Fed enforcement RSS; FTC actions CSV; DOJ press API | A | 100% checked | bulk; licence verified Y (public); CFPB: HTTP 403, later |
| S11 | all | PEP (aggregated dataset) | D | - | user key; licence verified Y (CC BY-NC: connector only) |
| S12 | LV | TED award notices (EU-wide) | A | 99% of winners keyed by register code; 25% of samples won one | API + bulk; licence verified Y; above-threshold contracts only |
| S12 | LT | TED award notices (EU-wide) | A | 92% keyed; 43% of samples | API + bulk; licence verified Y |
| S12 | EE | TED award notices (EU-wide) | A | 99% keyed; 44% of samples | API + bulk; licence verified Y |
| S15 | EE | register website field → DNS, WHOIS, CT, P8, homepage | B | website 100% of sample (by selection); resolves 67% | per-query; licence verified Y (WHOIS: query time only); population share: see §2 |
| S15 | LV | web search → DNS, WHOIS, CT, P8, homepage | C | website found 25% | per-query; licence verified Y; .lv WHOIS gives the register code, no dates |
| S15 | LT | web search → DNS, WHOIS, CT, P8, homepage | C | website found 29% | per-query; licence verified Y; .lt WHOIS gives registrant name and dates, no code |
| S15 | US | SAM.gov URL or web search → DNS, RDAP, CT, P8, homepage | B | website 100% of sample; RDAP date 100%; registrant 0% | per-query; licence verified Y |
| S15.ALL.whois | LT | .lt WHOIS (port 43): creation date, registrar | C | date 2/2 sites | per-query; licence verified Y (§1.1a); legal: CAVEAT, one live lookup per investigation, no storage beyond the cited record |
| S15.ALL.whois | LV | .lv WHOIS | X | date 0/2; code match 1/2 | per-query; licence verified Y (§1.1a); legal: LATER, purpose clause does not cover due diligence |
| S15.ALL.whois | EE | .ee WHOIS | X | date 6/9; code match 4/9 | per-query; licence verified Y (§1.1a); legal: LATER, no field shown ("business ... or any other similar purposes", "in its entirety") |
| S15.ALL.archive | all | P8 CDX | X | 95% of sites known | per-query; licence verified Y (2014 text, §1.1a); legal: LATER, "scholarship and research purposes only" |
| S16 | all | P4 DOC 2.0 (news, last 3 months) | C | 16% raw hits; 41% of queries answered | API; licence verified Y; 1 request per 5 s per IP; titles + links only |
| S16 | US | SEC / DOJ / FTC press releases | A | not measured on the sample | bulk; licence verified Y (public) |
| S16 | all | social profiles linked from the company's own website | C | 41% | per-query; licence verified Y (own site); links only, no platform data |
| S16 | all | review platforms | D | - | paid or AI-restricted; licence verified Y; LATER |
| S16 | all | social platform APIs | X | - | terms ban investigating, background checks and eligibility uses (§1.4) |

## 4. The agent pattern

The architecture (`docs/architecture.md` §7) fixes the runtime seams: a lead step, specialists in parallel, a synthesis step, `ask_human`, documents, citations and a cost ledger. This section answers what the agents may store, what they cost, how fast they are, how they check each other and when they ask. The full agent and tool specs (`docs/plan/agents.md`) follow in phase 3.

### 4.1 Agents in v1 (council decision 3) and their open-web tools

| Agent | Deterministic tools (no LLM cost) | Open-web tools |
|---|---|---|
| Lead | `search_companies`, `get_company` | none |
| Registry and people | store reads (officers, owners, history) | none |
| Money and tax | store reads (financials, taxes, arrears) | none |
| Legal, insolvency and sanctions | store reads; `screen_sanctions` (local lists, second-identifier check); `check_regulator_lists` (bulk lists + query-time pages) | `fetch_page` on regulator warning pages (allowlist) |
| Web, domain and news | `domain_report` (DNS, CT, US RDAP creation date, .lt WHOIS creation date and registrar, in one call, about 1-8 s; no .lv/.ee WHOIS and no web archive in v1), `homepage_facts`, `news_search` (P4, queued globally) | provider `web_search` (max 4 uses), `fetch_page` (allowlist + the subject's own domain) |
| Synthesis | none (reads findings) | none |

Deterministic tools return compact JSON summaries, not raw responses: 🟢 the raw responses are 0.3-100 KB, the summaries under 1 KB. That keeps tokens low and keeps restricted raw text (WHOIS) out of the model's context.

### 4.2 What may be stored and what may only be displayed

| Data | Store (local SQLite) | Display | Never |
|---|---|---|---|
| Official sanctions and regulator lists | yes, bulk, daily, with source and licence | the matched entry, list name, date, link | "sanctioned" without a list entry (rule 8) |
| P4 article metadata | yes (title, URL, date, domain, language), with the P4 citation | title, source, date, link; at most 125 characters quoted | article text |
| WHOIS/RDAP results (.lt and US only in v1) | creation date and registrar in the investigation's cited record, with the retrieval date | the two facts with "source: <registry>, <date>" | .lv and .ee WHOIS; registrant name or contacts; bulk lookups; any shared table or export |
| DNS, CT | derived facts in the investigation | yes | - |
| Web archive | nothing in v1 | nothing (a user-opened link is a lawyer question) | captures, copies of archived pages |
| The company's own web pages | content hash, URL, retrieval time and the quoted span (≤ 300 characters) that a citation points to | the quote and a link | full-page copies in exports |
| Web search results | only the URLs the agent then fetched and cited | as links | result lists (provider terms); anything from commercial company-information portals |
| Social profiles | the link found on the company's own site | the link | anything read from the platform |
| Reviews, platform data | nothing | nothing in v1 | - |

**Fetch allowlist.** `fetch_page` fetches: the subject's own domain (from the register, or confirmed by an anchor in §4.3); government and regulator domains (`.gov`, `.gov.lv`, `.gov.lt`, `.ee` state hosts, EU institutions); news domains returned by P4. Everything else is shown as a link the human may open. The list is configuration, so self-hosters can extend it within their own terms. This also keeps commercial company-information portals, whose terms forbid scraping, out of the agents' reach without naming them in code.

### 4.3 How agents cross-check each other

The worst failure is the wrong company (council). So:

1. **Every finding is pinned to a registry ID.** The lead resolves the subject to one register entry before specialists start; if it can't, it asks (§4.4).
2. **Web findings need an anchor that ties the website to that ID.** Anchors, strongest first, with 🟢 sample rates: the register lists the website (EE: 100% of sampled companies that have one; LV and LT registers carry no website); the domain's WHOIS registrant code equals the register code (🟢 EE 44%, LV 50% of sites, but LATER per legal, so not available in v1); the homepage states the register code or VAT number (14%); the LLM matched name and address only (the rest). A web finding with only the last anchor is labelled "linked by name only" and cannot raise the verdict above "Points to check".
3. **Sanctions and list hits need a second identifier** (§1.6). Name-only hits are "possible match, needs review", or a question to the human.
4. **The citation verifier is code, not a model.** Each citation's quoted span must occur in the stored document (normalised whitespace), and each document's URL must be one the run actually fetched. A finding that fails is dropped and logged.
5. **Conflicts become findings.** Synthesis receives findings from all agents and the rule table flags contradictions it can detect deterministically: the register says liquidated or deregistered while the website is live; the register lists a website that no longer resolves (🟢 3 of 9 EE samples); the domain is newer than a claimed founding year (creation date from US RDAP or .lt WHOIS; elsewhere the first certificate in CT logs as a lower bound); the website states a different register code than the pin.
6. **Open-web risk claims need two independent sources** (two domains, or one official source). A single-source web risk claim is shown as "single source" and cannot set the verdict level.
7. **The verdict level is rules, not the model** (council decision 3); the model writes the explanation from findings only.

### 4.4 How agents ask the human

`ask_human` (architecture §7.4) with `choose_one`, `confirm` or `free_text`, a reason, and a stated default. The agents ask only in these cases:

| Trigger | Kind | Example wording (fictional) | Default if unanswered |
|---|---|---|---|
| Several register entries match the subject | `choose_one` with up to 5 entries (name, code, status, city) | "Three registered companies are called Example Trading. Which one do you mean?" | stop the investigation: "Not enough data" |
| A website was found but no anchor ties it to the pinned company | `confirm` | "Is example-trading.example the website of Example Trading SIA (code …)?" | treat as unconfirmed; findings labelled "linked by name only" |
| A sanctions or list entry matches the name, with no second identifier to confirm or rule out | `choose_one`: same / different / not sure, with the list entry's details | "A sanctioned entity in the UK list is also called Example Trading (registered in another country). Is this the same company?" | "possible match, needs review" stays visible |
| The user's free text names a person or a website that conflicts with the register | `confirm` | "You mentioned example-trading.test; the register lists example-trading.example. Check both?" | check the register's one only |

Limits: at most 3 questions per investigation and 1 per agent; a question blocks only its own agent and the agents that depend on it. 🟡 Cost note: a question unanswered for more than 5 minutes lets the prompt cache (5-minute TTL) expire, so resuming re-reads the agent's context at the full input price (about $0.02-0.08 at the mid tier). The estimate's high end includes one such resume.

### 4.5 Parallelism and latency

🟢 Measured tool latencies (p50 / p95): DNS 83 / 307 ms; WHOIS/RDAP 84 / 129 ms; CT 458 ms / 7.5 s; P8 877 ms / 2.3 s; homepage 664 ms / 3.8 s; regulator list downloads 31-252 ms; P4 about 10 s including the 5-second gate.

- `domain_report` runs its four lookups in parallel: about 1 s typical, 8 s worst.
- 🔴 LLM turns are unmeasured (no key yet). Assumed 3-8 s per turn on a mid-tier model at medium effort.
- 🟡 Specialists run in parallel (architecture default: 6 at once; v1 starts 4). Registry-backed specialists: about 4 turns, 15-35 s. The web specialist is the long pole: about 8 turns plus P4 and fetches, 60-120 s.
- 🟡 **One investigation: about 1.5-3 minutes** wall time (lead 10-20 s, specialists in parallel, synthesis 15-30 s), plus the human's answer time if a question is asked.
- Global limits the runtime must enforce across concurrent investigations: P4 1 request per 5 s; SEC 10 per second; WHOIS per-IP limits (one lookup per domain per investigation, cached for the investigation's lifetime); DOJ 4 per second; P1 100 single-hostname queries per hour unauthenticated; TED 700 requests a minute.
- **Provider rate limits do not cap parallelism for one user** ([rate limits](https://platform.claude.com/docs/en/api/rate-limits), read 2026-11-20). The lowest standard tier ("Start") allows, per model, 4,000 requests, 2,000,000 uncached input tokens and 400,000 output tokens a minute for the current mid, small and top models; cached reads do not count toward the input limit. 🟡 One investigation uses about 96k uncached input and 20k output tokens over 1.5-3 minutes, so roughly 50 concurrent investigations fit before the limit. Two things can still return HTTP 429: new organisations may start in an "Evaluation" tier with lower, unpublished limits, and a "ramp limit" caps sudden jumps in usage. The runtime retries on 429 with `retry-after` and starts specialists a second apart. The Start tier also has a $500 monthly spend cap set by the provider; the app's own daily cap ($10) stays far below it.

### 4.6 Cost per investigation and the pre-run estimate

**Model (🟡, to be replaced by measured runs).** Inputs: the measured tool summary sizes above; provider list prices as of 2026-11, per million input/output tokens: small `claude-haiku-5-5` $0.10/$0.50 (doubles for prompts over 100k tokens, which no role reaches), mid `claude-sonnet-5-5` $2/$10, top `claude-opus-5-5` $4/$20 (a costlier top tier at $8-10/$40-50 exists and is not proposed); cache reads 0.05-0.1x input; cache writes 1.25x for the 5-minute cache the runtime uses (the 1-hour cache writes at 2x); web search $10 per 1,000; prompt caching on the system prompt and tools; thinking tokens counted as output.

| Role | Typical: turns, new input, output, searches | Worst: turns, new input, output, searches |
|---|---|---|
| Lead | 2, 4k, 1.5k, 0 | 3, 6k, 2.5k, 0 |
| Registry and people | 4, 6k, 3k, 0 | 8, 14k, 6k, 0 |
| Money and tax | 4, 6k, 3k, 0 | 8, 14k, 6k, 0 |
| Legal, insolvency and sanctions | 4, 7k, 3k, 0 | 8, 16k, 6k, 0 |
| Web, domain and news | 8, 31k, 6k, 4 | 14, 70k, 12k, 8 |
| Synthesis | 1, 9k, 4k, 0 | 2, 18k, 8k, 0 |
| **Total tokens** | ~96k fresh input, ~257k cached reads, ~20k output | ~170k fresh, ~950k cached, ~40k output |

| Model choice | Typical | Worst |
|---|---|---|
| Small model throughout (`claude-haiku-5-5`) | $0.06 | $0.13 |
| Small specialists, mid lead and synthesis | $0.15 | $0.29 |
| **Mid model throughout, `claude-sonnet-5-5` (proposed default)** | **$0.46** | **$0.92** |
| Mid specialists, top synthesis | $0.53 | $1.05 |
| Top model throughout (`claude-opus-5-5`) | $0.88 | $1.76 (over the $1.50 cap) |
| Local open-weights model (OpenAI-compatible server) | $0 | $0 (quality and speed unmeasured) |

The web agent is about half of the cost at every tier; its search count and fetch size are the levers. The mid-tier default keeps the worst case under the $1.50 cap with room for the one-shot $0.50 extension (council guardrail 1).

**Estimation method for the pre-run range** (council answer, for `POST /investigations/estimate`):
1. For each planned role, keep a per-role distribution of settled cost from `cost_ledger`, per model and effort. Until an install has 10 finished investigations, use the defaults above (`basis: "defaults"`).
2. `typical` = sum of the per-role medians; `low` = sum of the 10th percentiles; `high` = sum of the 95th percentiles plus one cache-expiry resume per agent that may ask a question. Clamp `high` to the cap and say so ("up to the cap").
3. Adjust before summing, with these drivers: specialists selected (each adds its role cost); country and website status (no known website: the web agent's search share rises; 🟢 LV and LT samples mostly had none); model tier and effort per role (linear in price); the number of officers to screen (no LLM cost: screening is deterministic).
4. Show it as "Estimated $0.30-0.92, usually about $0.46. Cap $1.50. Today: $X of $10 left." The cap, not the estimate, is what the code enforces.

**For cto:** the "typical" column is the modelled p50 and "worst" the modelled p95 of the council's v1 set (4 agents and the verdict step): $0.46 and $0.92 at the mid tier, against the $1.50 cap.

**At the cap** (architect's decision on frontend #3, which this seat supports): the run pauses as `paused_at_cap` and asks one `cap` question, "Stop and write the report" (default) or "Allow up to $0.50 more", clipped to what is left of the daily cap and offered once per investigation (register C10). With the mid-tier default the cap is reached only in the worst case.

**What the measured run will add:** real tokens, tool calls and wall time per agent at two model tiers, on 3 sample entities per country, replacing the defaults above. It needs an LLM key (human-task).

### 4.7 Provider

**Anthropic Messages API**, as `docs/architecture.md` §7.3 already assumes: one key gives the model and the server-side web search and fetch tools with citations. Default model per role: `claude-sonnet-5-5` at medium effort for every role (the mid tier above); the small tier (`claude-haiku-5-5`) is the "cheap mode" option for specialists. Web search costs $10 per 1,000 searches; web fetch has no per-call fee.

### 4.8 UI facts (designer's questions 12-14)

| Agent | Typical run (🟡) | Sources read | Cost per run, mid tier (🟡) |
|---|---|---|---|
| Lead (resolve and plan) | 10-20 s | the local store | $0.02 |
| Registry and people | 15-35 s | the local store (4-6 sections) | $0.06 |
| Money and tax | 15-35 s | the local store (3-4 sections) | $0.06 |
| Legal, insolvency and sanctions | 15-35 s | 4 official sanctions lists, 3-8 regulator lists, the local store | $0.07 |
| Web, domain and news | 60-120 s | DNS, CT, RDAP or .lt WHOIS, the homepage, P4, up to 4 searches and 3 fetched pages: 8-15 sources | $0.20 |
| Verdict step | 15-30 s | the findings only | $0.05 |

- **Excerpts, per web source** (13): the store-or-show rule is §4.2. In short: sanctions and regulator lists, P4 metadata, TED notices and US federal releases may be stored and excerpted. The company's own pages: a quote of up to 300 characters with a link. Press articles: headline, source, date and link, quoting at most 125 characters. WHOIS: derived facts only, at query time. P8: dates and a link. Reviews and social platforms: link only, or nothing.
- **Sanctions fields for the side-by-side card** (14): §1.6, "Which official identifiers the entries carry". Every list gives the name, aliases, list name, programme or regime, and listing date. Then, per list: OFAC adds registration and tax IDs, IMO, addresses, and date of birth, nationality and passport for persons. EU adds identification rows (type and number), birth dates and addresses. UK adds business registration number, IMO, date of birth, nationality and passport. UN adds date of birth, nationality and document numbers for persons only.
- **Dates and deep links:** every list entry carries its own listing date. P4 carries the date it saw the article. TED carries the publication date and a stable notice URL (`https://ted.europa.eu/en/notice/-/detail/{publication-number}`). P8 snapshot URLs are stable. WHOIS has no deep link; cite the registry's web lookup page instead.
- **Attribution text:** P4: a citation and a link to its home page (in the local provider map). EU sanctions and TED: "© European Union", with the source named. UK: "Contains public sector information licensed under the Open Government Licence v3.0". US federal sources: name the agency. Bank of Lithuania: name it as the source. ESMA: credit ESMA.

## 5. Facts the architecture needs (architect's question)

| Source | Primary key | Joins (🟢 measured where stated) | Record IDs | Person identity |
|---|---|---|---|---|
| Domain WHOIS/RDAP | domain name (lowercase, IDNA) | .lv `RegNr` and .ee `org id` = register code: 5 of 21 sample sites; .lt and .com: none | none; derive from domain + retrieval date | natural persons hidden |
| CT logs | certificate SHA-256 | domain | P1 `id`; P5 `id` | none |
| P8 | URL + 14-digit timestamp | domain | timestamp | none |
| P4 | article URL | name text only (no IDs) | URL | none |
| OFAC | `ent_num` (integer, stable) | registration or tax IDs in remarks (61% of entities) | `ent_num` + `alt_num` | name + DOB (99%), nationality, passport |
| EU FSF | `Entity_LogicalId` | identification numbers per row | logical ID | name + birth date + identification |
| UN SC | `DATAID`; reference number like `QDi.123` | none | `DATAID` | name + DOB (42%) |
| UK | `Unique ID` (new); OFSI Group ID (historic, still valid) | business registration number (37% of entities) | Unique ID | name + DOB (83%) |
| Bank of Lithuania list | domain | company name (free text) | row has no ID; derive from domain | none |
| ESMA crypto list | LEI where given; else name + website | LEI | none; derive | none |
| TED | publication number `NNNNNN-YYYY` | winner identifier = register code (LV 99%, LT 92%, EE 99% of winners) | publication number + lot | organisations only |

No checksum applies to these IDs. Whether a list ever reuses an ID after a delisting is unknown; a daily diff of the lists would settle it.

## 6. Open items

**Keys: deferred, per the coordinator's rule C7** (what each would unlock):

| Source | Env var | Unlocks |
|---|---|---|
| LLM provider (Anthropic) | `ANTHROPIC_API_KEY` | the measured cost run (§4.6) and every agent run, including the provider's web search and fetch. Human-task posted |
| P1 | none in v1 (H5: no keys) | the unauthenticated quota only; P5 is the fallback |
| A map platform's places API | (not proposed for v1) | rating and review count for consumer-facing businesses; needs a billing account and a legal read |
| Video platform Data API | (later) | official channel videos |
| A commercial web-safety lookup | (later) | phishing and malware flags for a domain |
| Open aggregated sanctions/PEP dataset | (user's own licence) | PEP flags; connector only (CC BY-NC) |

No paid service is needed for v1 beyond the LLM key. Web search runs on the same key at $10 per 1,000 searches.

**Other open items**
- **Legal (council S1 item 5):** the .lt, .lv and .ee WHOIS terms and the web archive's terms, quoted in full in §1.1a with one reading each: .lt looks compatible, .lv turns on its purpose clause, .ee's "business ... or any other similar purposes" and its "in its entirety" rule are the hardest, and the archive's "scholarship and research purposes only" needs a reading. Also: whether showing a map platform's rating and count without LLM processing is allowed; the UN list terms (403).
- **data-osint, next round:** the US Consolidated Screening List bulk file (not downloaded); the LV FIU national list (download returned HTTP 500); a second P4 run off-peak.
- **data-us:** the CFPB 403 (bot protection on the API and the bulk file).

## 7. Reproduce

From a clean checkout, with the data seats' downloads in place (paths are arguments or env vars):

```bash
python -I research/probes/osint/select_samples.py --ee-dir <EE extract dir> --lv-dir <LV raw dir> --out research/.cache/osint/samples.json
python -I research/probes/osint/select_samples_lt.py --out research/.cache/osint/samples.json
FORMS345_DB=<path> python -I research/probes/osint/select_samples_us.py --sam <SAM extract zip> --out research/.cache/osint/samples.json
LV_OFFICERS_CSV=<officers.csv> EE_SIMPLE_CSV=<lihtandmed.csv> node research/probes/osint/reality_check.mjs   # fill rates, latency, screening
node research/probes/osint/ted.mjs                                                                          # TED volumes and joins
```

Counts were taken on 2026-11-19 and 2026-11-20. Outputs: `research/.cache/osint/{fillrates,timings,screening,ted}.json`. Websites for LV, LT and US public samples were found by web search and written into `samples.json` (`website_source`); a rerun needs that step again. `REUSE=1` re-runs only the failed P4 queries and the screening on cached profiles.
