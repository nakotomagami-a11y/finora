import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isDemoMode } from "./server-data.ts";

/**
 * Fixture mode (`FINORA_DEMO=1`, docs/plan/ui-build-plan.md §12): the state gallery and the real routes can serve the
 * synthetic DTOs under `fixtures/ui/`. In any other mode nothing here reads a file, and `?state=` is ignored.
 */

const NAME = /^[a-z0-9][a-z0-9-]{0,40}$/u;

/** The repository root: the nearest folder above `start` that holds `pnpm-workspace.yaml`. */
export function findRepoRoot(start: string): string | null {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export type FixtureRef = { screen: string; state: string };

/** Whether a screen or state name is safe to turn into a path: lower case letters, digits and hyphens only. */
export function isFixtureName(value: string): boolean {
  return NAME.test(value);
}

/** One fixture's parsed JSON, or null when fixture mode is off, the name is not safe, or no such file exists. */
export function readUiFixture(ref: FixtureRef, root: string | null = findRepoRoot(process.cwd())): unknown {
  if (!isDemoMode() || root === null || !isFixtureName(ref.screen) || !isFixtureName(ref.state)) return null;
  const file = join(root, "fixtures", "ui", ref.screen, `${ref.state}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

/** Every fixture that exists, by screen, for the gallery's list. Empty outside fixture mode. */
export function listUiFixtures(root: string | null = findRepoRoot(process.cwd())): Record<string, string[]> {
  if (!isDemoMode() || root === null) return {};
  const base = join(root, "fixtures", "ui");
  if (!existsSync(base)) return {};
  const out: Record<string, string[]> = {};
  for (const screen of readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    out[screen.name] = readdirSync(join(base, screen.name))
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -".json".length))
      .sort();
  }
  return out;
}
