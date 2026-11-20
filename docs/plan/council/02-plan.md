# Council session 2: plan approval

Convened 2026-11-20 after phase 3 closed (`e007ed4`: qa has no open MUST-FIX, web-qa signed off the mockups). `council` returns the decision; `cto` owns the technical and scaling calls; `legal` advises. Posts are committed by the coordinator. Council approval is the go-ahead to build.

## Legal input (legal seat, 2026-11-20)

Not legal advice.
- **No legal blocker remains in the plan.** Every rule in `legal.md` (1-18) and every Part H call has an enforcement point and a test, as qa's verdict records. The build keeps the LAWYER register's interims, and `check-lawyer-register` fails if a row is removed or a `[pending: lawyer]` marker has no row.
- **O1 (no verdict level on the instant profile):** no legal objection. The facts-only rule for natural persons and sole traders holds either way.
- **O2 (the "proposed" rule-table entries, `agents.md` §6.2):** an engineering call. Any entry touching a natural person, a listed person or a share-alike value keeps its P8, share-alike and canary tests.
- **Hosted build: blocked.** `LAW-AGPL-HOSTED`, `LAW-SHARE-ALIKE` and the CC BY-NC and market-cap rows bar any hosted version until a lawyer clears them. v1 is local only, and the build docs say so on their first screen.

## cto's technical red-team (cto seat, 2026-11-20)

**Approve once three blocking items land.** All three are architecture-text fixes for the architect; no slice moves and no data decision changes.

### Blocking

| # | Finding | Close | Tests | Owner |
|---|---|---|---|---|
| B1 | **Nothing stops two writers syncing the same source at once.** The first core load runs up to 30 min in the CLI, the scheduler can fire a daily job for the same source inside that window, and each sync's set-difference purge deletes the rows the other just wrote. `next dev` can start the job runner twice, and recovering dead runs must happen exactly once (`architecture.md:28, 349, 448, 1083`) | A `leases` table (resource, holder = pid + boot id, heartbeat, expiry) taken with `BEGIN IMMEDIATE`: every sync takes `sync:<source>`, the job runner `runner`, investigation recovery `recover`; a second taker exits `already_running` (CLI) or skips (scheduler); an expired lease is taken over | two concurrent syncs of one fixture source: one runs, the other ends `already_running`, no rows lost; two `boot()` calls: one runner; a killed holder's lease is taken over after expiry | architect (S04, S12) |
| B2 | **Sync work must never run on the server's main thread.** `node:sqlite` is synchronous: ≈ 0.19 s of CPU per 5,000-record batch (measured), and the daily Baltic set is minutes of CPU. On the main thread that freezes SSE streams, the 20 s heartbeat and page renders (`:28, 461, 468`) | The job runner runs every sync in a worker thread (or the CLI child process) with its own connection; the main thread serves requests and does only the small investigation writes | during a fixture sync of ≥ 10 s, `/api/v1/health` p95 < 100 ms and no SSE heartbeat more than 1 s late | architect (S04, S12) |
| B3 | **The one command doesn't say production build or dev server.** Daily use on `next dev` means a compile on each first route visit, dev-mode React and B1's double runner start (`:1083`; `slices.md:246` says "within minutes", vaguer than P10) | `pnpm finora` runs `next build` when `.next` is missing or stale (keyed on commit + lockfile hash), then `next start` on 127.0.0.1. S12 acceptance cites P10 (LV searchable ≈ 2 min after the app is up) plus the cold path (clone → install → build → app up) as a number recorded on `dev-desktop-1` | S12 acceptance | architect (S12) |

### Should-fix (same revision)
- **S1. A Windows CI leg:** `windows-latest` for `test` and `demo-boot` (the human runs Finora on Windows; `slices.md:57, 246` require it).
- **S2. Disk preflight, integrity and backup:** `doctor` and `pnpm finora` refuse the core load with < 15 GB free; `doctor` runs `PRAGMA quick_check`; `finora-cli backup` (`VACUUM INTO`) for the non-derivable tables (investigations, `purpose_log`, disputes, settings); on corruption, rebuild the derivable tables from the raw cache.
- **S3. Migrations on a ~7 GB store:** migrations on `statements`, `facts` and `records` are additive only; anything else is a re-derive through `parserVersion`.
- **S4. A Part G edit re-parses every source** (≈ the first-load time): it runs under the B1 leases, in the background, with the UI usable.

### Verified, no change needed
Monorepo and boundaries; licence on every value; store, resolution and budgets (P10); the agent runtime (tools first, parallel specialists, hold-then-settle per attempt, global daily hold, runtime-owned questions, run clock excluding waiting, citation spans and pinning, S10 gated on the measured run); API and MCP (one tool definition, three surfaces, read-only MCP with a purpose on person calls); auth and hosting (127.0.0.1, `Actor` in every service, no hosted build while publication LAWYER rows are open); security (host allowlist and Origin check, SSRF re-check per redirect, CSP, bundle secret canary, supply chain); testing and CI (fixtures only, the `fake` provider, HIDE on six surfaces, `field-registry`, migrations from every version, nightly `live` job); legal rules in code (§10, `check-lawyer-register`).

**O1 and O2, technical note:** the verdict rule table is pure and runs on stored data with no LLM, so a level on the instant profile would cost $0 and no new infrastructure: a product call either way. Every O2 rule stays deterministic, with one test per rule.

## Council decision

Pending.
