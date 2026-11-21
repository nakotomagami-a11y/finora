// R10: a correction or objection hides the disputed line on every read until it is resolved.
// A company's line is targeted by its content hash; a person's line by the source's row id or by
// its role, and its open dispute is also written to restrictions.log, so a repair from a backup
// (which holds no person-line dispute) never shows it again (legal on S04a Q-3).
import type { DatabaseSync } from "node:sqlite";
import type { DeletionsLog } from "./deletions-log.ts";
import type { RoleLine } from "./lines.ts";
import type { RestrictionEntry, RestrictionsLog } from "./restrictions-log.ts";

type PersonTarget = Pick<RestrictionEntry, "sourceRowId" | "role">;

function personTarget(line: RoleLine): PersonTarget {
  if (line.target.kind === "row") return { sourceRowId: line.target.rowId };
  if (line.target.kind === "role") return { role: line.target.role };
  throw new Error("a company line has no person target");
}

/** The restriction is logged first; if that write fails, no dispute is opened. */
export function openDispute(
  db: DatabaseSync,
  restrictions: RestrictionsLog,
  dispute: { companyEid: string; line: RoleLine; kind: "correction" | "objection"; now: string },
): number {
  const { line } = dispute;
  const person = line.personal ? personTarget(line) : null;
  if (person) {
    restrictions.append({ op: "suppress", reason: "dispute", companyEid: dispute.companyEid, itemId: line.itemId, ...person, at: dispute.now });
  }
  const result = db
    .prepare(
      `INSERT INTO user.disputes (company_eid, source_id, item_id, line_hash, source_row_id, role, personal, kind, status, opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    )
    .run(
      dispute.companyEid,
      line.sourceId,
      line.itemId,
      line.target.kind === "hash" ? line.target.hash : null,
      person?.sourceRowId ?? null,
      person?.role ?? null,
      line.personal ? 1 : 0,
      dispute.kind,
      dispute.now,
    );
  return Number(result.lastInsertRowid);
}

/**
 * A resolved dispute is logged first, so a restore never re-opens it; a person-line dispute is
 * lifted in restrictions.log next. If either log write fails, the dispute stays open.
 */
export function resolveDispute(db: DatabaseSync, log: DeletionsLog, restrictions: RestrictionsLog, disputeId: number, now: string): void {
  const row = db
    .prepare("SELECT company_eid, item_id, source_row_id, role, personal FROM user.disputes WHERE id = ? AND status = 'open'")
    .get(disputeId) as { company_eid: string; item_id: string; source_row_id: string | null; role: string | null; personal: number } | undefined;
  if (!row) return;
  log.append({ table: "disputes", id: String(disputeId), deletedAt: now });
  if (row.personal === 1) {
    restrictions.append({
      op: "lift",
      reason: "dispute",
      companyEid: row.company_eid,
      itemId: row.item_id,
      ...(row.source_row_id !== null ? { sourceRowId: row.source_row_id } : { role: row.role ?? "" }),
      at: now,
    });
  }
  db.prepare("UPDATE user.disputes SET status = 'resolved', resolved_at = ? WHERE id = ?").run(now, disputeId);
}
