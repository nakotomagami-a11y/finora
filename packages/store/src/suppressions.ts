// L5: a restriction request hides a company's item on every surface. Suppressions on a person's
// line go to restrictions.log instead (restrictions-log.ts), never to this table or a backup.
import type { DatabaseSync } from "node:sqlite";
import type { DeletionsLog } from "./deletions-log.ts";

export function suppressItem(db: DatabaseSync, companyEid: string, itemId: string, now: string): void {
  db.prepare(
    "INSERT INTO user.suppressions (company_eid, item_id, created_at) VALUES (?, ?, ?) ON CONFLICT (company_eid, item_id) DO NOTHING",
  ).run(companyEid, itemId, now);
}

/** Lifting deletes user data, so it is logged first; if the log write fails, nothing is lifted. */
export function liftSuppression(db: DatabaseSync, log: DeletionsLog, companyEid: string, itemId: string, now: string): void {
  const row = db.prepare("SELECT id FROM user.suppressions WHERE company_eid = ? AND item_id = ?").get(companyEid, itemId) as
    | { id: number }
    | undefined;
  if (!row) return;
  log.append({ table: "suppressions", id: String(row.id), deletedAt: now });
  db.prepare("DELETE FROM user.suppressions WHERE id = ?").run(row.id);
}
