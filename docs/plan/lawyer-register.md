# LAWYER register (policy P13)

Every question a licensed lawyer must settle, with the safe interim value v1 ships until the answer arrives. Nothing is upgraded without that answer, and no hosted build ships while a publication-related row is open. `legal` owns the rows (the coordinator commits them); `scripts/check-lawyer-register.mjs` (slice S01) fails CI on a `[pending: lawyer]` marker with no row here. Sources: `docs/research/legal.md`, `docs/plan/council/01-data.md` Parts E-H, `docs/architecture.md` §3.3 and §10. Not legal advice.

## Rows supplied by legal (2026-11-20)

| id | Question | Interim value (v1) | Config key |
|---|---|---|---|
| LAW-BO-LV-EE | Beneficial owners in LV and EE after C-37/20, C-601/20 and C-798/24 | HIDE, not loaded, LOCK shown | none |
| LAW-PSEUDONYM | Per-company person pseudonym (HMAC) | not built | `PERSON_ROWS=names_no_id` |
| LAW-LV-OFFICERS | Latvian officers public after the 9 Nov 2026 ruling | names, behind the purpose gate | `LV_PERSON_ROWS=names_no_id` (fallback `role_counts`) |
| LAW-LLC-MEMBERS | Natural-person members of private limited companies (LV SIA, EE OÜ) | not loaded, LOCK | none |
| LAW-RETENTION-ROLES | Retention of ended roles | 0 days | `PERSON_ROLE_RETENTION_DAYS=0` |
| LAW-CACHE-TTL | Natural-person cache TTL (and the US live cache) | 30 days unviewed; re-fetch after 24 h | `PERSON_DATA_TTL_DAYS=30` |
| LAW-SOLE-ADDRESS | Sole-trader address finer than country | country only | none |
| LAW-PERSON-LINKS | Person-to-person links (S17) | LATER | none |
| LAW-ANON-COUNT | Anonymous per-company member count | not built; check 4 "not run" | none |
| LAW-WHOIS-LT | .lt WHOIS live lookup, terms re-read on the build date | CAVEAT, live, holder never shown | none |
| LAW-WHOIS-LV-EE | .lv and .ee WHOIS, and the web archive | LATER, no archive link | none |
| LAW-SAM | SAM.gov exclusion fields that may carry the commercial data restriction | dropped | none |
| LAW-FINRA | FINRA BrokerCheck automated reads | link-out only | none |
| LAW-SHARE-ALIKE | A local store of CC BY-SA data under project rule 4 | separate store, or `live-no-store` with no write, no cache and no log of the data (the fallback is not a free switch) | `SHARE_ALIKE_MODE=store` |
| LAW-P7-SCOPE | Blocked uses limited to natural-person subjects | natural persons and sole traders only | none |
| LAW-DEFAMATION | Automated verdicts about natural persons | no verdict on natural persons | none |

## Rows added in the plan round (2026-11-20; legal confirmed or supplied)

| id | Question | Interim value (v1) | Config key |
|---|---|---|---|
| LAW-DISPUTE-WINDOW | Within what window must a disputed statement be suppressed (R10)? | suppressed on receipt | `DISPUTE_SUPPRESS_AFTER=0` |
| LAW-SODRA-LICENCE | The LT social-insurance files state no licence ("public by law" is not one) | agent path only, live, not stored; not in the instant profile | storage class in the source registry |
| LAW-PERSON-INSOLVENCY | Natural-person insolvency and bankruptcy records, all countries | HIDE, not loaded | none |
| LAW-SECURING-SOLE | Sole traders' securing measures and suspensions (LV) | HIDE, not loaded | none |
| LAW-UN-LIVE | The UN list terms (personal, non-commercial, no redistribution) | CAVEAT, live fetch with citation, not stored | none |
| LAW-NATIONAL-LISTS | LT, EE and LV national sanctions lists with no stated licence | CAVEAT, live, citation shown, not stored | none |
| LAW-CO-DISCLAIMER | Colorado's required disclaimer wherever Colorado data appears | shown | none |
| LAW-LV-NP-PROCUREMENT | Natural-person procurement winners (LV) | LATER | none |
| LAW-MARKET-CAP | May the repo ship one cited market-cap figure per market? | drawdown only, unless the source's terms are quoted | none |
| LAW-AGPL-HOSTED | Does the code licence affect any future hosted service? | no hosted build in v1 | none |
| LAW-COURTS-LT | LITEKO keyword searches by company name and code | LATER, MANUAL link; if a build-time probe shows company names and legal gives a light: organisation parties only (P8), cited, not stored | none |
| LAW-COURTS-LV | Latvian court portal search (terms unread) | MANUAL link plus the case numbers loaded with insolvency and securing measures | none |

**Not LAWYER items:** the annual-report filing windows behind check 5. Check 5 states a fact with the window labelled as Finora's estimate, and the law text can be cited in `filing-windows.ts`; re-open a row only if a statutory date is ever shown as a deadline (legal).

The architect adopts these ids in architecture §10.2; `check-lawyer-register` matches `[pending: lawyer <id>]` markers against them, and each row's test is named in `docs/plan/slices.md`.
