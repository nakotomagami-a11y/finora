// No product module builds loaders on the default config: one that synced from them would store
// officer names for a user who chose role_counts (SEC-1 on S05; qa, legal). A sync builds its list
// with loadersFor(config) or fixtureProfileFor(config) from the run's own config; listings use the
// meta-only SOURCE_METAS.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LISTS = /\bDEFAULT_LOADER_CONFIG\b/;
/** Where the default is defined, re-exported, and compared against (the fixture officers file). */
const DEFINED = new Set(["packages/sources/src/registry.ts", "packages/sources/src/index.ts", "fixtures/src/loaders.ts"]);
const isTest = (path) => /\.(test|spec)\.(ts|tsx|mjs)$/.test(path) || path.includes("/testing/") || path.includes("/e2e/");
/** Installed or generated trees, never source. */
const SKIP = new Set(["node_modules", ".next", "dist", "build", "coverage", "out", ".turbo"]);

/** Every non-test .ts, .tsx and .mjs file under apps, packages and fixtures (scripts too), repo-relative. */
function productFiles(root = ROOT) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(path);
      } else if (entry.isFile() && /\.(ts|tsx|mjs)$/.test(entry.name) && !isTest(path)) out.push(path);
    }
  };
  for (const top of ["apps", "packages", "fixtures"]) walk(top);
  return out;
}

test("no product module uses the default loader config", () => {
  const files = productFiles();
  assert.ok(files.length > 100, "the scan sees the workspace");
  const users = files.filter((p) => !DEFINED.has(p) && LISTS.test(readFileSync(join(ROOT, p), "utf8")));
  assert.deepEqual(users, []);
});

test("the scan reaches app scripts and config files, not only src", () => {
  const files = productFiles();
  assert.ok(files.some((p) => /^apps\/[^/]+\/scripts\//.test(p)), "an app's scripts dir is scanned");
  assert.ok(files.some((p) => /^(apps|packages)\/[^/]+\/[^/]+\.(ts|mjs)$/.test(p)), "a package-root file is scanned");
});

test("the control: the scan finds the default where it is defined", () => {
  for (const path of DEFINED) assert.ok(LISTS.test(readFileSync(join(ROOT, path), "utf8")), path);
});
