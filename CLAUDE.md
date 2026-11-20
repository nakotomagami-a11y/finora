# Finora

Free, open-source, agentic company intelligence. Agents research a company (and the people running it) from official registries, filings, courts, sanctions lists and the open web, and return a sourced verdict. The same app hosts market tools (Crash monitor), with more tools to come.

## Status

Build phase (phase 5), run as an Agent Office mission (the hub is the open draft PR labelled `ao-mission`). The plan is approved; slices land one at a time per `docs/plan/slices.md`. Read in this order:
1. This file
2. `.local/CONTEXT.md`, if it exists (private context on the maintainer's machine; never quote it in public)
3. `docs/plan/README.md` (the mission register: phases, decisions, deliverables)
4. `docs/architecture.md` (the contract) and `docs/plan/slices.md` (the build order, acceptance criteria and tests)
5. `docs/plan/council/01-data.md` (what each country shows) and `docs/plan/lawyer-register.md` (the interim legal values the build keeps)
6. `DESIGN.md` for UI work; `docs/plan/agents.md` for the agent runtime; `docs/plan/loaders/` for a data source

## Hard rules

1. **This repo is public, and its history is permanent.** Follow `docs/contributing/publishing-checklist.md` before every commit, push, PR, merge, PR description or comment. The guard (`scripts/guard/`) runs in the git hooks and in CI. Never pass `--no-verify`, never edit the hooks or the guard to get a change through, and never commit `.local/` or `.guard/`.
2. **No names.** Never name other companies, products or services we compare ourselves with, or real companies and people as examples, anywhere public: files, commit messages, PR text, comments, mission posts. Examples use obviously made-up names. Data sources we integrate (registries, official APIs) may be named where needed.
3. **No personal data, secrets or machine details** in committed files: no emails, personal codes, local paths, machine names, keys or `.env` files. Research output about real companies or people goes in the gitignored `research/.cache/` or `.local/`.
4. **Licences first.** Record every source's licence and terms before using it. Use official open data and APIs within their terms; never scrape a site whose terms forbid it. Don't mix share-alike (ODbL) or non-commercial (CC BY-NC) data into our own datasets.
5. **No redistributed licensed data.** Prices and other licensed feeds come through connectors with the user's own keys.
6. **Mission posts are public.** Before ending a turn with an outbox block, check its text: `node scripts/guard/guard.mjs text -`.

## Setup

```bash
node scripts/guard/install.mjs          # hooks on; creates the local .guard/denylist.txt
node --test "scripts/guard/*.test.mjs"  # guard tests
```

## Quality bar

Clean, readable code that strangers will read on GitHub. Tests with every change. A UI that is pleasant and checked in a real browser at real viewport sizes. No comments unless the why is non-obvious.

## Environment

- Windows 11 machine; Git Bash and PowerShell both available. Python 3.12 and Node 24 are on PATH.
- Git identity and the `gh` credential helper are set repo-local.
- SEC EDGAR requires a `User-Agent` with contact info (read from the environment, never hard-coded) and at most 10 requests per second.
