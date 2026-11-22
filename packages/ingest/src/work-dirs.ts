// A sync's streamed downloads live in `<work base>/finora-<sourceId>-XXXXXX` and only for that sync
// (architecture §4.3). A downloaded file can hold person data, so a directory left by a sync that
// never reached its own cleanup (a terminated worker, a killed process) is removed: by the parent
// that terminated the worker, at the start of the source's next sync, and at boot (qa, legal
// condition 1 on 9ec97db).
import type { DatabaseSync } from "node:sqlite";
import { readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PREFIX = "finora-";
/** mkdtemp appends six characters to `finora-<sourceId>-`. */
const sourceOf = (name: string) => (name.startsWith(PREFIX) && name.length > PREFIX.length + 7 ? name.slice(PREFIX.length, -7) : null);

export const workBase = (workDir: string | undefined) => workDir ?? tmpdir();

function entries(base: string): string[] {
  try {
    return readdirSync(base);
  } catch {
    return [];
  }
}

/** Removes every work dir of these sources; returns how many went. The path is never logged. */
export function removeWorkDirs(base: string, sourceIds: readonly string[]): number {
  let removed = 0;
  for (const name of entries(base)) {
    const id = sourceOf(name);
    if (id === null || !sourceIds.includes(id)) continue;
    rmSync(join(base, name), { recursive: true, force: true });
    removed++;
  }
  return removed;
}

/** At boot: removes the work dir of every source whose sync lease is not live now. */
export function sweepWorkDirs(db: DatabaseSync, base: string, now = Date.now()): number {
  const live = new Set(
    (db.prepare("SELECT resource FROM main.leases WHERE expires_at > ? AND resource LIKE 'sync:%'").all(now) as { resource: string }[]).map((r) => r.resource.slice("sync:".length)),
  );
  const orphans = [...new Set(entries(base).map(sourceOf).filter((id): id is string => id !== null && !live.has(id)))];
  return removeWorkDirs(base, orphans);
}
