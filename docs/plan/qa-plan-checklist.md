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

## Phase 5
For each slice, the builder sends qa the commit range. qa returns MUST-FIX / SHOULD-FIX / NIT with file:line. A MUST-FIX blocks the slice.

## Mockups (web-qa)
web-qa tests at 390x844, 768x1024, 1280x800 and 1920x1080. Every mockup needs a state switcher or URL parameter for each state: empty, loading, streaming, partial, error, question to the human, report.
