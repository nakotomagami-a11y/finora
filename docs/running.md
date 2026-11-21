# Running Finora

This page grows with S12 (`pnpm finora` for Latvia) and is final in S25. Until then it holds the operating notes that the first real loads depend on.

## First load

- `pnpm finora-cli data sync` starts one long-lived worker thread per lane: LV, EE, LT, sanctions and other cross-border lists, and GLEIF. Lanes run in parallel; inside a lane the sources run in order, the register first (architecture §4.5).
- Each worker runs under a 768 MB heap cap (buffers such as downloaded files are not counted in it). A source that runs out of memory ends its lane's syncs as `failed` with `worker_out_of_memory`; the other lanes and the CLI carry on. `data sync` prints the peak RSS so each loader slice can record it against P10.
- The sanctions lists download about 178 MB at each start of their lane. Plan for it on a metered connection.

## Known runtime issue: V8 `jit_page_` check

- **Symptom:** the process aborts with `Check failed: jit_page_->allocations_.erase(addr) == 1`.
- **Trigger:** many short-lived worker isolates started and stopped in one process. It was seen on Windows with Node 24.20 when an early version of the CLI started one worker per source (about 20 per run).
- **What Finora does:** one long-lived worker per lane, so a run starts at most five workers. Do not reintroduce a worker per source or per record.
- **If you see it anyway:** note the Node version and the command, and rerun: a second run is incremental, so sources that already finished and have not changed write nothing.

## Agents and your Claude plan

- Investigations run on the local Claude Code CLI with your own sign-in (H5). Finora stores no credential and sets no key.
- Finora stops at its own caps (per investigation, per follow-up, per day), counted in standard tokens.
- **Keep paid extra usage off in your Claude account.** Finora cannot see whether it is on. With it on, a run could draw on paid usage, up to Finora's daily cap at most.
