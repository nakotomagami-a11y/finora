#!/usr/bin/env node
// Checks every workspace package.json against the dependency table of architecture §2:
// a package may depend on the workspace packages in its row and nothing else.
// Also checks that every package is private and AGPL-3.0-or-later.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LICENSE = "AGPL-3.0-or-later";

const SERVER_ALLOWED = [
  "domain", "i18n", "api-contract", "store", "sources", "resolve", "ingest",
  "markets", "agent-tools", "agents", "mcp",
];

/** Architecture §2. `@finora/tooling` is allowed everywhere as a dev dependency. */
export const ALLOWED = {
  "@finora/domain": [],
  "@finora/i18n": [],
  "@finora/ui": ["i18n"],
  "@finora/api-contract": ["domain"],
  "@finora/store": ["domain"],
  "@finora/sources": ["domain"],
  "@finora/resolve": ["domain", "store"],
  "@finora/ingest": ["domain", "store", "sources", "resolve"],
  "@finora/markets": ["domain"],
  "@finora/agent-tools": ["domain", "store", "resolve", "markets"],
  "@finora/agents": ["domain", "store", "agent-tools"],
  "@finora/tooling": [],
  "@finora/server": SERVER_ALLOWED,
  "@finora/mcp": ["domain", "store", "agent-tools", "api-contract"],
  "@finora/cli": ["domain", "store", "ingest", "sources", "resolve", "fixtures"],
  "@finora/fixtures": ["domain", "sources", "ingest", "store"],
  "@finora/web": ["api-contract", "ui", "i18n", "domain", "server"],
};

/** Edges a package may declare only as devDependencies: its tests use them, its code never does. */
export const DEV_ONLY = {
  "@finora/fixtures": ["ingest", "store"],
};

/** Returns one message per problem in the given manifests: [{ path, pkg }]. */
export function checkManifests(manifests) {
  const problems = [];
  for (const { path, pkg } of manifests) {
    const name = pkg.name;
    if (!(name in ALLOWED)) {
      problems.push(`${path}: ${name} is not in the dependency table (architecture §2, scripts/check-deps.mjs)`);
      continue;
    }
    if (pkg.license !== LICENSE) problems.push(`${path}: license must be "${LICENSE}"`);
    if (pkg.private !== true) problems.push(`${path}: must be "private": true`);
    const allowed = new Set(ALLOWED[name].map((short) => `@finora/${short}`));
    const runtime = { ...pkg.dependencies, ...pkg.peerDependencies };
    if ("@finora/tooling" in runtime) problems.push(`${path}: @finora/tooling is a dev dependency only`);
    for (const short of DEV_ONLY[name] ?? []) {
      if (`@finora/${short}` in runtime) problems.push(`${path}: ${name} may use @finora/${short} in its tests only (devDependencies)`);
    }
    const declared = { ...runtime, ...pkg.devDependencies };
    for (const dep of Object.keys(declared)) {
      if (dep === "@finora/tooling" || dep === name || !dep.startsWith("@finora/")) continue;
      if (!allowed.has(dep)) problems.push(`${path}: ${name} may not depend on ${dep} (architecture §2)`);
    }
  }
  return problems;
}

export function workspaceManifests(root = ROOT) {
  const manifests = [];
  const fixtures = join("fixtures", "package.json");
  if (existsSync(join(root, fixtures))) manifests.push({ path: fixtures, pkg: JSON.parse(readFileSync(join(root, fixtures), "utf8")) });
  for (const group of ["apps", "packages"]) {
    const dir = join(root, group);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(group, entry.name, "package.json");
      if (entry.isDirectory() && existsSync(join(root, path))) {
        manifests.push({ path, pkg: JSON.parse(readFileSync(join(root, path), "utf8")) });
      }
    }
  }
  return manifests;
}

function main() {
  const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const problems = checkManifests(workspaceManifests());
  if (root.license !== LICENSE) problems.push(`package.json: license must be "${LICENSE}"`);
  if (problems.length) {
    for (const p of problems) console.error(`check-deps: ${p}`);
    process.exit(1);
  }
  console.log("check-deps: every package follows the dependency table.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
