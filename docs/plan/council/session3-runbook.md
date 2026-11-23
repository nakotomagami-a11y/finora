# Council session 3: the milestone runbook

One session at the end of each milestone (M1-M5), per council session 2, item 2. The coordinator convenes it; the record goes to `docs/plan/council/03-m<N>.md`. The question every time: would we use this every day, and what is missing?

## Who does what

| Step | Owner | What |
|---|---|---|
| 1 | coordinator | Checks that every slice of the milestone is done (`slices.md` "Done means": tests green, qa with no open MUST-FIX, web-qa for UI slices, security review where marked) and convenes `council` and `cto` with the evidence below |
| 2 | qa | **M1:** a fresh clone on a clean folder, following only the README and `slices.md`; records the timings |
| 3 | web-qa | **M2-M5:** drives the milestone's demo steps on real data in a real browser at the four viewports and three engines; records what failed |
| 4 | cto | The health check: budgets against actuals (`benchmarks.md`, P10), open technical debt, scaling risks |
| 5 | coordinator | Runs `node scripts/milestone-gate.mjs` (from M2) and pastes its fixed table |
| 6 | human | Answers two questions in the record: "Would I use this daily?" and council Part F's "Which country's companies do you actually pay or sign with each week?" (from the first demo the human attends) |
| 7 | council | Decides: pass, or numbered fix slices. cto adds the technical calls |

## Evidence the session reads

- the CI link for the milestone's last commit, all jobs green (Ubuntu and Windows legs)
- the fresh-clone timings (M1) or the cold-path number on `dev-desktop-1` (from M2)
- the milestone gate output (from M2): wrong-company count, cited-claim rate, fill-rate delta, spend
- the web-qa record for the milestone's UI slices
- the cto health check
- zero open MUST-FIX in `docs/plan/reviews/`
- **M5 only:** the daily-use trial counts (`prototype.md` D11), or "daily use unmeasured"

## On failure

The council lists numbered fix slices, each with an owner, acceptance criteria and a test. Only the failed steps are re-demoed; the session record is updated in place, with the re-demo date.

## Milestone questions (from `slices.md`)

| Milestone | Ask |
|---|---|
| M1 Foundation | Can a contributor clone, run, test and add a loader without asking anyone? |
| M2 Latvia end to end | Would we check a Latvian counterparty here instead of on the registry site? Does an investigation earn its cost? |
| M3 Every country | What is missing per country? Is the US promise honest (the CEO's US-private test)? |
| M4 Crash monitor and the daily app | Is this the app the maintainer opens every day? |
| M5 Done | Phase 6 exit criteria and `prototype.md` D1-D11, signed off |
