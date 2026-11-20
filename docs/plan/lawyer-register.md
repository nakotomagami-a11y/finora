# LAWYER register (policy P13)

Every question a licensed lawyer must settle, with the safe interim value v1 ships until the answer arrives. Nothing is upgraded without that answer, and no hosted build ships while a publication-related row is open. `legal` owns the rows (the coordinator commits them); `scripts/check-lawyer-register.mjs` (slice S01) fails CI on a `[pending: lawyer]` marker with no row here. Sources: `docs/research/legal.md`, `docs/plan/council/01-data.md` Parts E-H, `docs/architecture.md` §3.3 and §10.

| id | Question | Affected items | Interim value (v1) | Config key | Test |
|---|---|---|---|---|---|
| LAW-PSEUDONYM | May a per-company person pseudonym (install-local HMAC) be built? | S03 LV/EE | not built; names under a non-persistent row id | `PERSON_ROWS=names_no_id` | `domain/src/report/person-rows.test.ts` |
| LAW-LV-OFFICERS | Do Latvian board and officer data stay public after the 9 Nov 2026 ruling? | S03.LV.01 | names shown behind the purpose gate | `LV_PERSON_ROWS=names_no_id` (fallback `role_counts`) | `domain/src/report/lv-people.test.ts` |
| LAW-LLC-MEMBERS | Does rule 1 reach natural-person members of private limited companies (LV, EE)? | S04.LV.01, S04.EE.01 | natural-person members not loaded; company members shown | - (load rule) | `sources/src/members-gate.test.ts` |
| LAW-MEMBER-COUNT | May an anonymous count of private-individual members be shown? | S04 LV/EE; check 4 | no count; check 4 "not run" | - | `domain/src/checks/owners.test.ts` |
| LAW-RETENTION-ROLES | How long may ended person roles be kept? | S03, S13 (P4) | 0 days | `PERSON_ROLE_RETENTION_DAYS=0` | `ingest/src/history.test.ts` |
| LAW-PERSON-TTL | What TTL applies to natural-person data and the US live cache? | P5 | re-fetch after 24 h; purge after 30 days unviewed | `PERSON_DATA_TTL_DAYS=30` | `store/src/retention.test.ts` |
| LAW-DISPUTE-WINDOW | Within what window must a disputed statement be suppressed? | R10, every entity page | suppressed on receipt | `DISPUTE_SUPPRESS_AFTER` | `store/src/disputes.test.ts` |
| LAW-SA-STORE | Is a local-only store of CC BY-SA data outside project rule 4? | S07.EE.01, S08.EE.01a/b (P1) | separate share-alike store, never exported | `SHARE_ALIKE_MODE=store` (fallback `live-no-store`) | `ingest/src/share-alike.test.ts` |
| LAW-SOLETRADER-ADDR | May a sole trader's address show at municipality level? | P6 | country only; nothing finer loaded | - | `sources/src/sole-trader.test.ts` |
| LAW-ADDRESS-LINKS | Are address-based links that touch private individuals allowed? | S17 | registered offices of companies only | - | `domain/src/network/address-links.test.ts` |
| LAW-WHOIS-LV | Is a due-diligence lookup within the .lv WHOIS purpose clause? | S15.LV.whois | LATER | - | - |
| LAW-ARCHIVE-LINK | May the UI show a plain link to the web archive? | S15.ALL.archive | no link | - | - |
| LAW-BENEFICIAL-OWNERS | Do C-37/20 and C-601/20 bar showing LV and EE beneficial owners from the open files? | S04.LV.02, S04.EE.02 | HIDE, not loaded, LOCK shown | - | HIDE negative suite |
| LAW-SAM-FIELDS | Are agency-entered SAM exclusion fields free of the commercial data restriction? | S11.US.01 | possibly restricted fields dropped | - | `sources/src/us-sam.test.ts` |
| LAW-MARKET-CAP | May the repo ship one cited market-cap figure per market? | M01-M04 "market cap lost" | drawdown only, unless the source's terms are quoted | - | `markets/src/tiles.test.ts` |
| LAW-FCRA-SOLE | Can a report on a sole trader become a consumer report under the FCRA? | P6, P7 | facts only, no verdict, blocked uses refused | - | `domain/src/report/natural-person.test.ts` |
| LAW-DEFAMATION | What is the defamation exposure of automated verdicts (EU, US)? | the verdict | rule-based level, cited claims only, AI label, dispute channel | - | rule suites R7-R10 |
| LAW-AGPL-HOSTED | Does the code licence affect any future hosted service? | hosting | no hosted build in v1 | - | - |

Draft by the coordinator from the sources above, for `legal` to confirm. Test file names are proposals: the architect aligns them with `docs/plan/slices.md` in S01. A row whose test is "-" is enforced by a load rule or by absence (LATER), and the HIDE negative suites cover it.
