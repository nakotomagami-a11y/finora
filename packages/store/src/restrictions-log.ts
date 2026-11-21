// Suppressions of a person's line (council session 2 addenda, LAW-BACKUP-RETENTION). The record
// must survive a repair, but no derived value of the person's data may be written anywhere:
//   with a source row id    { op, reason, companyEid, itemId, sourceRowId, at }   that line stays hidden
//   without one (US people) { op, reason, companyEid, itemId, role, at }          that role's lines stay hidden
//   sole traders            no entry; their personal items stay hidden after a repair
// `reason` is "suppression" (L5) or "dispute" (R10): an open dispute on a person's line lives here
// too, so a repair never shows it again (legal on S04a Q-3).
// Append-only and fsynced before the suppression is acknowledged; never in a backup; a daily
// compaction keeps active entries only.
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { findPersonalCodes, PERSON_EID } from "@finora/domain";

export type RestrictionEntry = {
  op: "suppress" | "lift";
  reason: "suppression" | "dispute";
  companyEid: string;
  itemId: string;
  sourceRowId?: string;
  role?: string;
  at: string;
};

const ALLOWED_KEYS = new Set(["op", "reason", "companyEid", "itemId", "sourceRowId", "role", "at"]);

function validate(entry: RestrictionEntry): void {
  for (const key of Object.keys(entry)) {
    if (!ALLOWED_KEYS.has(key)) throw new Error(`restrictions.log takes no "${key}" field`);
  }
  if (entry.reason !== "suppression" && entry.reason !== "dispute") throw new Error("a restriction names its reason");
  if ((entry.sourceRowId === undefined) === (entry.role === undefined)) {
    throw new Error("a restriction names exactly one of sourceRowId or role");
  }
  for (const value of Object.values(entry)) {
    if (findPersonalCodes(String(value)).length > 0 || PERSON_EID.test(String(value))) {
      throw new Error("a restriction holds no personal code and no person id");
    }
  }
}

const target = (e: RestrictionEntry) => JSON.stringify([e.reason, e.companyEid, e.itemId, e.sourceRowId ?? null, e.role ?? null]);

function writeDurably(path: string, text: string, flag: "a" | "w"): void {
  const fd = openSync(path, flag);
  try {
    writeSync(fd, text);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export class RestrictionsLog {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  append(entry: RestrictionEntry): void {
    validate(entry);
    const ordered: RestrictionEntry = { op: entry.op, reason: entry.reason, companyEid: entry.companyEid, itemId: entry.itemId, at: entry.at };
    if (entry.sourceRowId !== undefined) ordered.sourceRowId = entry.sourceRowId;
    if (entry.role !== undefined) ordered.role = entry.role;
    writeDurably(this.path, `${JSON.stringify(ordered)}\n`, "a");
  }

  /** The active restrictions. Throws if the log is missing or unreadable (repair fails closed). */
  active(): RestrictionEntry[] {
    const live = new Map<string, RestrictionEntry>();
    for (const line of readFileSync(this.path, "utf8").split("\n").filter(Boolean)) {
      const entry = JSON.parse(line) as RestrictionEntry;
      if (entry.op === "suppress") live.set(target(entry), entry);
      else live.delete(target(entry));
    }
    return [...live.values()];
  }

  /**
   * Rewrites the file with active entries only, so no lifted entry persists (legal's condition).
   * The rename is not followed by an fsync of the directory (Windows has none); a crash at that
   * moment leaves the old file, which still holds every active entry.
   */
  compact(): void {
    const text = this.active().map((e) => `${JSON.stringify(e)}\n`).join("");
    const temp = `${this.path}.compact`;
    writeDurably(temp, text, "w");
    renameSync(temp, this.path);
  }
}
