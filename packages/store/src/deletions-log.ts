// Every deletion of user data is written here before it happens, so a restore from a backup can
// never bring it back (architecture §16). Append-only, fsynced before the deletion is acknowledged,
// never backed up, never restored. Entries hold an id and a date only.
import { closeSync, fsyncSync, openSync, readFileSync, writeSync } from "node:fs";

export type DeletionEntry = { table: string; id: string; deletedAt: string };

export class DeletionsLog {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  /** Throws if the entry cannot be made durable; the caller then must not delete. */
  append(entry: DeletionEntry): void {
    const line = `${JSON.stringify({ table: entry.table, id: entry.id, deletedAt: entry.deletedAt })}\n`;
    const fd = openSync(this.path, "a");
    try {
      writeSync(fd, line);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }

  /** Throws if the log is missing or unreadable, so a repair refuses instead of restoring without it. */
  entries(): DeletionEntry[] {
    const text = readFileSync(this.path, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DeletionEntry);
  }
}
