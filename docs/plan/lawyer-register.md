# LAWYER register (policy P13)

Every question a licensed lawyer must settle, with the safe interim value v1 ships until the answer arrives. Nothing is upgraded without that answer, and no hosted build ships while a publication-related row is open. `legal` owns the rows (the coordinator commits them); `scripts/check-lawyer-register.mjs` (slice S01) fails CI on a `[pending: lawyer]` marker with no row here. Sources: `docs/research/legal.md`, `docs/plan/council/01-data.md` Parts E-H, `docs/architecture.md` §3.3 and §10. Not legal advice.

## Rows supplied by legal (2026-11-20)

| id | Question | Interim value (v1) | Config key |
|---|---|---|---|
| LAW-BO-LV-EE | Beneficial owners in LV and EE after C-37/20, C-601/20 and C-798/24 | HIDE, not loaded, LOCK shown | none |
| LAW-PSEUDONYM | Per-company person pseudonym (HMAC) | not built | `PERSON_ID_MODE=row` |
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
| LAW-SHARE-ALIKE | A local store of CC BY-SA data under project rule 4 | separate store, switchable | `SHARE_ALIKE_MODE=store` (fallback `live-no-store`) |
| LAW-P7-SCOPE | Blocked uses limited to natural-person subjects | natural persons and sole traders only | none |
| LAW-DEFAMATION | Automated verdicts about natural persons | no verdict on natural persons | none |

## Rows added by the coordinator, for legal to confirm

| id | Question | Interim value (v1) | Config key |
|---|---|---|---|
| LAW-DISPUTE-WINDOW | Within what window must a disputed statement be suppressed (R10)? | suppressed on receipt | `DISPUTE_SUPPRESS_AFTER` |
| LAW-SODRA | May the LT social-insurance files (no stated licence) be stored? | not stored; `live-no-store` daily fetch if legal confirms, else agent-only | storage class in the source registry |
| LAW-FILING-DEADLINES | The statutory annual-report filing deadlines (LV, EE, LT) used by check 5 | Finora's estimate (7, 6, 5 months + 30 days), labelled as an estimate until cited from the law | - |
| LAW-MARKET-CAP | May the repo ship one cited market-cap figure per market? | drawdown only, unless the source's terms are quoted | - |
| LAW-AGPL-HOSTED | Does the code licence affect any future hosted service? | no hosted build in v1 | - |

Each row's test is named in `docs/plan/slices.md` (the architect aligns the ids with `check-lawyer-register` in S01).
