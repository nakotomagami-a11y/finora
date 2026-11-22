// No product module builds loaders on the default config: one that synced from them would store
// officer names for a user who chose role_counts (SEC-1 on S05; qa, legal). A sync builds its list
// with loadersFor(config) or fixtureProfileFor(config) from the run's own config; listings use the
// meta-only SOURCE_METAS. The scan is legal's control for that rule, so it looks for every way the
// default reaches code (H1 in the S05 security re-check), not only the config's name.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The default config, the loaders built on it, a no-argument build, and the literal default mode. */
const DEFAULTS = [
  /\bDEFAULT_LOADER_CONFIG\b/,
  /\bLV_PEOPLE_DEFAULT_CONFIG\b/,
  /\blvUrOfficers\b/,
  /\bfxLvUrOfficers\b/,
  /\bLV_PEOPLE_LOADERS\b/,
  /\blvUrOfficersLoader\(\s*\)/,
  /\blvPeopleLoaders\(\s*\)/,
  /["'`]names_no_id["'`]/,
];
/** Where a default is defined, re-exported, gated by a config, or read as the user's documented choice. */
const DEFINED = new Map([
  ["packages/sources/src/registry.ts", "defines DEFAULT_LOADER_CONFIG and builds loaders from a config"],
  ["packages/sources/src/index.ts", "re-exports"],
  ["packages/sources/src/lv/lv-people/lv-people.ts", "names the two LV_PERSON_ROWS modes; it builds no default loader (data-baltics 3077a78)"],
  ["fixtures/src/loaders.ts", "fixtureProfileFor(config) swaps the officers loader by config"],
  ["apps/cli/src/env.ts", "reads LV_PERSON_ROWS, whose documented default is names_no_id"],
  ["apps/server/src/env.ts", "reads LV_PERSON_ROWS, whose documented default is names_no_id"],
]);
/** Product modules that may import a testing entry: fixture data and the demo script only. */
const TESTING_IMPORTS = new Map([
  ["fixtures/src/loaders.ts", "the fixture profile reads the sources' fixture files"],
  ["packages/markets/src/fixtures/layouts.ts", "builds fixture archives"],
  ["packages/ingest/demo.ts", "the ingest demo runs on fake sources"],
]);
const TESTING_IMPORT = /(?:from\s*|import\s*\(\s*)["'][^"']*\/testing(?:\/[^"']*)?["']/;

const SOURCE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
const isTest = (path) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || /\/test-helpers?\.[cm]?[jt]s$/.test(path) || path.includes("/testing/") || path.includes("/e2e/");
/** Generated trees at a package's root; node_modules anywhere. */
const GENERATED = new Set([".next", "dist", "build", "coverage", "out", ".turbo"]);

/** Every non-test source file under apps, packages and fixtures (scripts and package roots too), repo-relative. */
function productFiles(root = ROOT) {
  const out = [];
  const walk = (dir, depth) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        // apps/<app>/dist is generated; apps/<app>/src/build is source and is read.
        if (entry.name === "node_modules" || (depth === 1 && GENERATED.has(entry.name))) continue;
        walk(path, depth + 1);
      } else if (entry.isFile() && SOURCE.test(entry.name) && !isTest(path)) out.push(path);
    }
  };
  for (const group of ["apps", "packages"]) {
    for (const entry of readdirSync(join(root, group), { withFileTypes: true })) if (entry.isDirectory()) walk(`${group}/${entry.name}`, 1);
  }
  walk("fixtures", 1);
  return out;
}

const read = (path) => readFileSync(join(ROOT, path), "utf8");
const usesDefault = (text) => DEFAULTS.some((re) => re.test(text));

test("no product module uses the default loader config, in any form", () => {
  const files = productFiles();
  assert.ok(files.length > 100, "the scan sees the workspace");
  assert.deepEqual(files.filter((p) => !DEFINED.has(p) && usesDefault(read(p))), []);
});

test("no product module imports a testing entry, outside the fixture and demo modules", () => {
  assert.deepEqual(productFiles().filter((p) => !TESTING_IMPORTS.has(p) && TESTING_IMPORT.test(read(p))), []);
});

test("the scan reaches app scripts and package roots, not only src", () => {
  const files = productFiles();
  assert.ok(files.some((p) => /^apps\/[^/]+\/scripts\//.test(p)), "an app's scripts dir is scanned");
  assert.ok(files.some((p) => /^(apps|packages)\/[^/]+\/[^/]+\.(ts|mjs)$/.test(p)), "a package-root file is scanned");
});

test("the controls: each form of the default is caught, and each exemption is still needed", () => {
  for (const text of [
    "loadersFor(DEFAULT_LOADER_CONFIG)",
    "import * as s from '@finora/sources'; s.lvUrOfficers",
    "sources['LV_PEOPLE_LOADERS']",
    "lvUrOfficersLoader( )",
    "lvPeopleLoaders()",
    "loadersFor({ lvPersonRows: 'names_no_id' })",
    "fixtures.fxLvUrOfficers",
  ]) assert.ok(usesDefault(text), text);
  assert.ok(!usesDefault("loadersFor(config); lvUrOfficersLoader({ personRows: mode })"), "a config-built loader passes");
  for (const text of ['import { x } from "@finora/sources/testing";', "await import('../testing/index.ts')"]) assert.ok(TESTING_IMPORT.test(text), text);
  for (const path of DEFINED.keys()) assert.ok(usesDefault(read(path)), `${path} is still a definition`);
  for (const path of TESTING_IMPORTS.keys()) assert.ok(TESTING_IMPORT.test(read(path)), `${path} still imports a testing entry`);
});
