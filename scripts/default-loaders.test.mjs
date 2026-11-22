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
const isTest = (path) => /\.test\.tsx?$/.test(path) || /\.spec\.tsx?$/.test(path) || path.includes("/testing/") || path.includes("/e2e/");

/** Every product source file of the workspace, as a repo-relative path. */
function productFiles(root = ROOT) {
  const out = [];
  for (const group of ["apps", "packages"]) {
    for (const name of readdirSync(join(root, group))) out.push(`${group}/${name}/src`);
  }
  out.push("fixtures/src");
  return out.flatMap((dir) => {
    let entries;
    try {
      entries = readdirSync(join(root, dir), { recursive: true });
    } catch {
      return [];
    }
    return entries.map((e) => `${dir}/${String(e).replaceAll("\\", "/")}`).filter((p) => /\.(ts|tsx|mjs)$/.test(p) && !isTest(p) && !p.includes("node_modules"));
  });
}

test("no product module uses the default loader config", () => {
  const files = productFiles();
  assert.ok(files.length > 100, "the scan sees the workspace");
  const users = files.filter((p) => !DEFINED.has(p) && LISTS.test(readFileSync(join(ROOT, p), "utf8")));
  assert.deepEqual(users, []);
});

test("the control: the scan finds the default where it is defined", () => {
  for (const path of DEFINED) assert.ok(LISTS.test(readFileSync(join(ROOT, path), "utf8")), path);
});
