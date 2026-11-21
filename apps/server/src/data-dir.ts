import "server-only";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { getEnv } from "./env.ts";

// Kept apart from env.ts: the proxy imports env.ts, and a Node module has no place in code the proxy loads.

/** The folder with `pnpm-workspace.yaml` above `from`, or `from` itself when there is none. */
export function repoRoot(from: string): string {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(from);
    dir = parent;
  }
}

/** A relative data directory is relative to the repository, not to whichever app folder the server runs from. */
export function resolveDataDir(value: string, cwd: string): string {
  return isAbsolute(value) ? value : resolve(repoRoot(cwd), value);
}

/** Where the databases, raw downloads and backups live. */
export function getDataDir(): string {
  return resolveDataDir(getEnv().FINORA_DATA_DIR, process.cwd());
}
