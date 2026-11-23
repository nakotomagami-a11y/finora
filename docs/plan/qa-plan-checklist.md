# qa checklist for the plan (phase 3)

Posted by the `qa` seat on the hub; committed by the coordinator. A slice plan gets a MUST-FIX if any item is missing.

1. **Each slice:** acceptance criteria a test can check, the named test files, and a demo step a stranger can run.
2. **Licence on data:** every stored record carries source id, licence id, retrieval time and source URL from loader to API to UI. The plan says where it lives in the schema and which test proves it survives each hop.
3. **Legal rules in code:** each rule from the legal memo maps to one enforcement point (a function or module) and one test. A rule only written in docs does not count.
4. **Package boundaries:** a dependency graph showing which package may import which, and the lint rule that enforces it.
5. **No real data in the repo:** fixtures are synthetic with made-up names. Recorded HTTP responses are scrubbed or stay in `research/.cache/`. Screenshots in docs use synthetic data only. The plan says how a builder makes a fixture.
6. **Agent runtime:** the cost cap, timeout, retry and cancel rules are in the spec, with a test for each. Every verdict sentence links to a stored citation, and a test fails if one is missing.
7. **Secrets:** keys come from env vars and never reach the client bundle. The plan names the test or check that proves it.
8. **"Fully working":** one command runs the app; the CI jobs are listed; e2e runs against recorded fixtures, not live sources.

### Added after council session 0
9. **Rendered-field registry vs. the `01-data.md` table:** a CI job fails on an untagged field, an unknown item_id, or any HIDE item reachable from UI, API, MCP or export. The plan names the job and the test file.
10. **No blank section, in the types:** a section result is one of `not_published`, `checked_none {source, as_of}`, `not_checked`, or `data`. An empty array must not be able to stand for "clean". The plan shows the type and a test for each state.
11. **Deterministic verdict:** the rule table that sets the level lives in code, with one test per hard flag, plus a test that the LLM text cannot change the level (same inputs, different LLM output, same level).
12. **Banned wording enforced on both paths:** a lint or test over UI strings, and a runtime check on LLM output that rejects a banned term before display (council clarification 2: reject and regenerate once, never silently rewrite). A word list in DESIGN.md alone does not count.
13. **Milestone gate is runnable:** the regression set lives in gitignored `research/.cache/`, so CI cannot run it. The plan names a committed script that runs it locally and prints only aggregate results (wrong-company count, cited-claim rate, fill-rate delta). A milestone record without that output does not pass.

## Phase 5
For each slice, the builder sends qa the commit range. qa returns MUST-FIX / SHOULD-FIX / NIT with file:line. A MUST-FIX blocks the slice.

**Outside names (H4, qa 7066865925; legal agrees), run before every slice is accepted:**
1. `node scripts/guard/guard.mjs tree` is clean at the slice's head. Every real name a sweep finds goes into the private denylist (`.guard/`; the CI secret only in the fresh public repo, since this repo's history check would fail).
2. The discovery sweep `scripts/check-outside-names.mjs` (architect, with tests) over the slice's changed files, and `--tree` for a full audit: hostnames, URLs and email domains not on the private allowlist; organisation-shaped phrases (capitalised words ending in a company-form token, with plainly fictional prefixes passing); ticker-shaped tokens in ticker contexts other than `ZZFX01`-`ZZFX99`; real-shaped ids (a real register check digit, an LEI passing mod 97, a CIK outside `99xxxxxxxx`, an ISIN with a valid check digit); brand words in a looser match. It reports file:line and a category only, never the matched text. Out of scope (C14): dependency names, the lockfile, licence files, generated directories.
3. The allowlist is private (`.local/outside-names-allow.txt`, a CI secret in the fresh repo); each entry names its category (public body, official registry, open standard, tool). Every hit is renamed to a code, allowlisted with its category, or removed. Nothing is accepted with an unresolved hit.
4. Committed images follow the reviewed-media rule; no other committed binary in fixtures (built at run time). The sweep fails on a new binary outside `__screenshots__`.
5. Recorded agent transcripts are fixtures: written against the fixture world or recorded on the fixture profile with the web answered by a fake. No real name, page or hostname.
6. qa writes one line in the slice's review record: "outside names: guard tree clean; sweep <range>: 0 unresolved; N allowlisted (by category)". Counts and categories only. Until the script exists, qa runs guard tree plus a manual pass of the classes over the slice's diff.

## Mockups (web-qa)
web-qa tests at 390x844, 768x1024, 1280x800 and 1920x1080. Every mockup needs a state switcher or URL parameter for each state: empty, loading, streaming, partial, error, question to the human, report.
