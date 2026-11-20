// R10: a correction or objection hides the disputed line on every read until it is resolved.
// The target is the line's content hash, so a reload that replaces the role set keeps it hidden.
import type { DatabaseSync } from "node:sqlite";
import type { DeletionsLog } from "./deletions-log.ts";
import type { RoleLine } from "./lines.ts";

export function openDispute(
  db: DatabaseSync,
  dispute: { companyEid: string; line: RoleLine; kind: "correction" | "objection"; personal: boolean; now: string },
): number {
  const result = db
    .prepare(
      `INSERT INTO user.disputes (company_eid, source_id, item_id, line_hash, personal, kind, status, opened_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
    )
    .run(dispute.companyEid, dispute.line.sourceId, dispute.line.itemId, dispute.line.hash, dispute.personal ? 1 : 0, dispute.kind, dispute.now);
  return Number(result.lastInsertRowid);
}

/** A resolved dispute is logged first, so a restore never re-opens it; if the log write fails, nothing changes. */
export function resolveDispute(db: DatabaseSync, log: DeletionsLog, disputeId: number, now: string): void {
  log.append({ table: "disputes", id: String(disputeId), deletedAt: now });
  db.prepare("UPDATE user.disputes SET status = 'resolved', resolved_at = ? WHERE id = ?").run(now, disputeId);
}
