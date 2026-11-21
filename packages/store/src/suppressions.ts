// L5: a restriction request hides a company's item on every surface. Suppressions on a person's
// line go to restrictions.log instead (restrictions-log.ts), never to this table or a backup.
import type { DatabaseSync } from "node:sqlite";
import type { DeletionsLog } from "./deletions-log.ts";
import type { RoleLine } from "./lines.ts";
import type { RestrictionEntry, RestrictionsLog } from "./restrictions-log.ts";

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

function personTarget(line: RoleLine): Pick<RestrictionEntry, "sourceRowId" | "role"> {
  if (!line.personal || line.target.kind === "hash") throw new Error("only a person's line is suppressed by line; hide a company's item instead");
  return line.target.kind === "row" ? { sourceRowId: line.target.rowId } : { role: line.target.role };
}

/** Hides one person's line (by row id) or a role's lines (US people sources) until "Show again" (L5). */
export function suppressPersonLine(restrictions: RestrictionsLog, companyEid: string, line: RoleLine, now: string): void {
  restrictions.append({ op: "suppress", reason: "suppression", companyEid, itemId: line.itemId, ...personTarget(line), at: now });
}

export function liftPersonLine(restrictions: RestrictionsLog, companyEid: string, line: RoleLine, now: string): void {
  restrictions.append({ op: "lift", reason: "suppression", companyEid, itemId: line.itemId, ...personTarget(line), at: now });
}
