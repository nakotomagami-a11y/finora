# Early plan review (phase 1, before the freeze)

`qa` reviewed the early drafts of `docs/architecture.md` and `docs/plan/slices.md` (first at `f88b2d0`, then a delta at `f0531fd`) against `docs/plan/qa-plan-checklist.md`, council session 0 and the legal memo. `architect` accepted every finding and committed to fixing them in the first phase 3 revision. Committed by the coordinator so phase 3 starts from this list. qa re-reviews from the newest commit when phase 3 opens.

Status: **open** = still in the draft at `f0531fd`; **partly** = partly fixed; **fixed** = fixed in `bbb8205` or `282b2d6`.

## MUST-FIX

| # | Finding | Status | Committed resolution |
|---|---|---|---|
| 1 | Facts are never purged, so a paid-off tax debt shows forever; `Fact` lacks `lastSeen`, `sourceUrl`, `personal`, `accessTier` | open | `Fact` gets `firstSeen`, `lastSeen`, `sourceUrl`, `syncId`; purge covers facts; the export filter checks facts; test: a debt removed upstream is gone after a complete load |
| 2 | The licence is read through `sourceId`, so a licence change rewrites history | partly | `syncs` table (source, licence id, access tier, start, finish, upstream date); `syncId NOT NULL` on statements and facts; test: old rows keep the old licence |
| 3 | Legal rules without an enforcement point (2, 5, 6, 9, 10, 11; 15 USC 1681b uses) | fixed, two additions open | R11 also covers ended roles and agent documents; a purpose list without credit, employment, tenancy or insurance, with a refusal test |
| 4 | The LLM sets the verdict level, and "clear" is a severity | open | Pure rule table in `packages/domain/src/verdict/rules.ts`, one test per hard flag; synthesis has no level field; same findings with different LLM text give the same level; severity names follow the banned list; catalogue test and reject → regenerate once → facts-only, tested per branch |
| 5 | Section states contradict the council ("no data", "hidden by policy") | open | `SectionResult = not_published \| checked_none{sourceId, asOf} \| not_checked \| data`, one test per state |
| 6 | Slice order is not "walking skeleton first" | open | M2 = LV loader, API, explorer UI, runtime core, one specialist, rule-based verdict and a minimal one-command run; other countries after |
| 7 | No milestone-gate script | open | `scripts/milestone-gate.mjs` reads `research/.cache/`, prints aggregates only; output goes into every `council/03-*.md` |
| 8 | No check that keys stay out of the client bundle | fixed, one addition open | `import "server-only"` in `env.ts` and every seam file |
| 9 | Fixture codes in real formats can collide with real entities | open | IDs with a check digit (LV, EE, LT, LEI): fixture codes fail the official checksum on purpose (documented fixture variant, accepted only in fixture mode). IDs without one (CIK, US state registry IDs): a documented reserved range. The plan states the rule per ID type, with a test each (qa follow-up) |
| 10 | The sync pipeline has no package home | open | `packages/ingest` (domain, store, sources, resolve), used by the CLI and the server |
| 11 | Timeout, retry and turn limits | fixed, values open | Max 40 turns and 80 tool calls per run, each tested with a machine code; retries follow N2 (each attempt settles), not "hold once, settle once" |
| 12 | Findings are not pinned to an entity | open | `Finding.entityId` required; the verifier rejects citations of unrelated entities; tested |
| 13 | A disambiguation question times out into a guess | open | Identity questions have no default; timeout ends as "Not enough data"; tested |
| 14 | HIDE enforced only on the loader path | open | Display policy also in `record_finding`, follow-ups and documents; HIDE negative tests cover the agent path |
| 15 | Sole traders not modelled | partly | `Entity.naturalPerson` by legal form drives no verdict, the R6 disclaimer, noindex, the purpose gate, and title and search rules (title = registry code and legal form); one test per behaviour |
| N1 | The R11 TTL deletes live officer data when a source file is unchanged for 35 days | open | TTL keyed on `lastSeen`, which a successful unchanged check also updates; TTL on ended roles and agent documents; test: an unchanged source for 40 days keeps its current officers |

## SHOULD-FIX

| # | Finding | Committed resolution |
|---|---|---|
| 16 | No follow-up cap; no global daily-cap hold | `AGENT_FOLLOWUP_CAP_USD` (0.25); a global daily hold; test: two parallel investigations can't jointly exceed it |
| 17 | Trivial citation spans | At least 40 characters and 8 words; tested |
| 18 | Purge leaves dangling citations | `citations` snapshot the value, source, licence and retrieval time |
| 19 | Person IDs reversible by dictionary | HMAC with an install-local key; a fixed key for fixtures |
| 20 | The personal-code check can reject LV company codes | Person properties only; test: every LV fixture company code passes |
| 21 | Visual baselines vs the guard | Baselines from fixtures only; `guard review` on each changed image; small baseline set |
| 22 | Fixture size vs the guard | The large test dataset is generated at test time from a seeded generator; only small layout fixtures are committed |
| 23 | Timing criteria not reproducible | Relative regression budgets in CI; absolute budgets as recorded benchmarks in `docs/plan/benchmarks.md` |
| N2 | Retries can under-count real spend | Settle each attempt (usage if returned, else its held worst case); new hold per retry; tested |

## NIT
- 24: "Unknown env values" → "Invalid env values" (fixed).
- 25: Fold the second profile template slice into the counterparty template slice (one template in v1).

## Phase 3 notes from the architect's answers (2026-11-20)

Agreed between architect, designer, frontend and qa while the drafts were frozen; they go into the first phase 3 revision.

- **New slices:** a network explorer slice after S12 (one hop, `SourceRef` on every node and edge, person nodes behind the purpose gate, no agent runs on browse; list view is the default under 768 px). S04b lands every DTO schema in `api-contract` plus fixture-backed demo responses, so UI slices start against the real contract.
- **Vocabulary:** finding severity `none_found | point_to_check | concern` (plus `not_checked`); verdict level `no_concerns_found | points_to_check | serious_concerns | not_enough_data`, with `coverage {ran, applicable}` and `sourceCount`. `level` and `firedRules[]` come from the rule table; `explanation` from synthesis, labelled AI-written. `VerdictBlock` renders level and explanation as separate children.
- **Section DTO union:** `not_published | none_found{sourceId, asOf} | not_checked{reason: later|error|skipped|paid_only} | needs_purpose | disputed | data{freshness: current|stale, completeness: full|partial}`. `loading` is client-only; HIDE items have no row.
- **Cap reached:** `paused_at_cap` with a `cap_reached` question: "Stop and write the report" (default) or "Allow up to $0.50 more", once per run, clipped to the remaining daily cap; a second hit stops without asking. The coordinator reads this as within H2 (register C10).
- **Viewports:** 390x844, 768x1024, 1280x800, 1920x1080, plus 1024 as the panel-to-sheet breakpoint.
- **Crash monitor:** 60 s poll.
