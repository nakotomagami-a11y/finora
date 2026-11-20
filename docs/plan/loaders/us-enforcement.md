# us-enforcement: federal enforcement feeds (SEC, Federal Reserve, FTC, DOJ) and FINRA

Agent tools, not stored loaders (`storage: agent-only`, architecture §3.5). Modules `packages/sources/src/us/enforcement/` (fetch and parse, pure) used by the legal agent's tool `us_enforcement_search` (`docs/plan/agents.md`). Research: `docs/research/osint.md` §1.2 and "US regulator data" (data-osint), `docs/research/us.md` §4.4.

## Source

| `id` | Feed | URL | Licence (verified) |
|---|---|---|---|
| `us-sec-enforcement` | SEC litigation releases, administrative proceedings, trading suspensions (RSS) | `https://www.sec.gov/rss/litigation/litreleases.xml`, `…/rss/litigation/admin.xml`, `…/rss/litigation/suspensions.xml` (*verify paths in the key-testing round*) | `sec-public` (osint.md, 2026-11-19) |
| `us-fed-enforcement` | Federal Reserve enforcement actions (RSS) | `https://www.federalreserve.gov/feeds/enforcementactions.xml` (*verify*) | `us-gov-work` |
| `us-ftc-actions` | FTC non-merger enforcement actions (CSV, FY1996-2026) | linked from ftc.gov (*URL verify*) | `us-gov-work`, attribution requested (osint.md) |
| `us-doj-press` | DOJ press releases (API) | `https://www.justice.gov/api/v1/press_releases.json` (50 per page, ≤ 4 requests per second) | public domain (osint.md) |
| `us-finra-brokercheck` | FINRA BrokerCheck firm summary | `https://brokercheck.finra.org/firm/summary/{crd}` (link only, see below) | FINRA terms |

- `officialHosts`: `www.sec.gov`, `www.federalreserve.gov`, `www.ftc.gov`, `www.justice.gov`, `brokercheck.finra.org`.
- `storage`: `agent-only`: fetched at query time, cited, kept only as investigation documents under the R11 TTL. Feeds are cached in memory for the investigation (one fetch per feed per investigation).
- `cadence`: `on-view` (per investigation). `asOf`: `[in_file_field]` (RSS `lastBuildDate` or the newest `pubDate`; DOJ `date`; FTC CSV the newest action date).
- `maxPurgeShare`: not applicable (nothing stored). `deepLink`: each item's own `link` (official host only). `orderUrl`: null.
- `requires`: SEC feeds need `SEC_USER_AGENT`; the others need nothing.
- `limits`: SEC shared bucket (8 per second); DOJ 4 per second (global, architecture §7.6a).

### Contract fields (milestone A.1 checklist)
- `asOf`: `[in_file_field]` per feed (above).
- `purgeScope`: `none`; `maxPurgeShare`: not applicable (agent-only: nothing is stored, so nothing is purged).
- `parserVersion` (A1): the hash of the loader module, its field map and the generated item list, as in §4.4 (the tool's parsers).
- Record unit: none stored; each feed item is one investigation document.
- `personRecordKey`: none. Share-alike events: none.

## Items
| item_id | Call | Caveat | Empty state |
|---|---|---|---|
| S11.US.04 | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |
| S11.US.03 (FINRA) | CAVEAT | Checked live at query time; a match needs a second identifier and your review | AGENT / CN |

S16.US.01 (press releases as news) is LATER and is covered by S11.US.04 (Part C).

## Field map (what the tool returns to the agent; nothing is written to the store)
| Feed field | Returned as | Personal? | Rule |
|---|---|---|---|
| RSS `title`, `link`, `pubDate`, `description` | candidate item: title, URL, date, excerpt (first 300 characters) | maybe | the excerpt is a cited quote; banned-word rules exempt verbatim quotes |
| DOJ `title`, `url`, `date`, `component`, `topic` | candidate item | maybe | query by the company name; *verify the API's keyword filter*, else page the last 90 days and match locally |
| FTC CSV respondent, case name, date, action type, link | candidate item | maybe | |

A candidate is a match only if the company's name matches **and** a second identifier agrees (ticker, CIK, state, city, or the company's domain in the text). Otherwise it is "Mentions the name; not confirmed to be this company" and never a key finding.

## Party gate
Enforcement items often name individuals. **P8 on the agent path:** an item whose matched party has no legal-form token and no registry-ID match is shown as "a private individual" (masked) or dropped from the findings; the agent output filter tests it (`agents/src/p8-filter.test.ts`, data-osint).

## FINRA (S11.US.03): link-out only in v1
- BrokerCheck permitted uses (https://www.finra.org/investors/investing/working-with-investment-professional/about-brokercheck/permitted-uses): copying and compiling only "for investor protection, academic, compliance or regulatory purposes", with source, compile date, an error channel and no unsolicited marketing. data-osint read the general finra.org terms as non-commercial, no scraping and no machine learning.
- Interim (until legal gives a light): **no automated BrokerCheck request.** For companies whose SIC code is a broker-dealer code (6211), the profile shows `not_checked{reason: "manual_lookup", url: "https://brokercheck.finra.org/"}` with "Check this firm on FINRA BrokerCheck". The agent never fetches BrokerCheck.
- Open for `legal`: does a due-diligence check by the user count as "investor protection" or "compliance" under the permitted uses, and may an LLM read the result? If yes, the tool fetches the firm summary by CRD and returns the disclosure flag verbatim with the required attribution block.

## Identity and joins
None stored. A confirmed match becomes a finding pinned to the subject entity's eid (architecture §7.7).

## Refresh and change
None (per investigation).

## Size and time budget
0 bytes in the store. Per investigation: 3 SEC feeds + 1 Fed feed + FTC CSV (*size verify*, expected < 5 MB) + 1-3 DOJ pages ≈ 2-5 s.

## Fixtures
`fixtures/us/enforcement/`: one RSS file per feed, a DOJ JSON page and an FTC CSV, each with 5 fictional items: an exact company match with a second identifier, a name-only match, an individual (must be masked), an older item, and a near-miss name.

## Tests
`sources/src/us/enforcement/parse.test.ts` (RSS, JSON, CSV parsing), `agents/src/tools/us-enforcement.test.ts` (second-identifier rule; name-only → "not confirmed"; individual masked; nothing written to the store), `sources/src/us/finra.test.ts` (no request to any FINRA host in v1).

## Failure modes
A feed down: the tool reports it per feed; the check line reads "Checked [n] of 4 federal feeds". SEC feeds without `SEC_USER_AGENT`: skipped, "SEC feeds need the SEC contact setting".

## Open questions
For `legal`: the FINRA question above. Feed paths and the DOJ keyword filter are verified in the key-testing round (C7); the tool falls back to paging if the filter is absent.
