// Our own snapshots (architecture §3.7): events computed by comparing a record before and after a
// content sync. A role end is detected by line identity, never by names or content (§3.3): the
// source's row-local id, else (role, start date), else the count of lines with that role.
import { recordLines, recordValues, writeFinoraEvent, type RecordLine } from "@finora/store";
import type { DatabaseSync } from "node:sqlite";

export const TRACKED_ATTRIBUTES = ["name", "address", "status", "legalForm", "capital"] as const;

export type Snapshot = { values: Map<string, Record<string, string>>; lines: RecordLine[] };

export function snapshot(db: DatabaseSync, recordId: number | null, companyEids: readonly string[]): Snapshot {
  const values = new Map<string, Record<string, string>>();
  if (recordId === null) return { values, lines: [] };
  for (const eid of companyEids) values.set(eid, recordValues(db, recordId, eid, TRACKED_ATTRIBUTES));
  return { values, lines: recordLines(db, recordId) };
}

function identities(lines: readonly RecordLine[]): Map<string, RecordLine> {
  const out = new Map<string, RecordLine>();
  const seen = new Map<string, number>();
  for (const line of lines) {
    let key: string;
    if (line.lineId !== null) key = `id:${line.lineId}`;
    else if (line.startDate) key = `rs:${line.role ?? ""}|${line.startDate}`;
    else {
      const n = (seen.get(line.role ?? "") ?? 0) + 1;
      seen.set(line.role ?? "", n);
      key = `ro:${line.role ?? ""}|${n}`;
    }
    out.set(`${line.companyEid}|${line.itemId}|${key}`, line);
  }
  return out;
}

/** Lines whose identity disappeared between two snapshots of one record. */
export function endedLines(before: readonly RecordLine[], after: readonly RecordLine[]): RecordLine[] {
  const now = identities(after);
  return [...identities(before)].filter(([key]) => !now.has(key)).map(([, line]) => line);
}

/** Writes the finora.* events for one record; returns how many. `date` is the sync's day. */
export function writeHistory(
  db: DatabaseSync,
  before: Snapshot,
  after: Snapshot,
  date: string,
  itemOf: (eid: string, prop: string) => string | null,
): number {
  let written = 0;
  for (const [eid, old] of before.values) {
    const current = after.values.get(eid) ?? {};
    for (const attribute of TRACKED_ATTRIBUTES) {
      const was = old[attribute];
      const is = current[attribute];
      const itemId = itemOf(eid, attribute);
      if (was === undefined || is === undefined || was === is || itemId === null) continue;
      if (writeFinoraEvent(db, { entityEid: eid, type: `finora.${attribute.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}_changed`, date, itemId, data: { old: was, new: is } })) written++;
    }
  }
  for (const line of endedLines(before.lines, after.lines)) {
    // No name and no person key: only the role and the day (P4, legal condition 2).
    if (writeFinoraEvent(db, { entityEid: line.companyEid, type: "finora.role_ended", date, itemId: line.itemId, data: { role: line.role } })) written++;
  }
  return written;
}
