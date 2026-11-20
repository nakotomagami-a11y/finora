// SourceRef for a stored value (R3, architecture §3.2): the licence and retrieval date come from the
// sync that last changed the record, so a later licence change never rewrites older rows.
import type { DatabaseSync } from "node:sqlite";
import type { SourceRef } from "@finora/domain";

export function sourceRefForStatement(db: DatabaseSync, statementId: number, accessTier: SourceRef["accessTier"] = "open"): SourceRef {
  const row = db
    .prepare(
      `SELECT r.source_id, wrote.licence_id, wrote.started_at AS retrieved_at,
         (SELECT upstream_as_of FROM main.syncs WHERE source_id = r.source_id AND kind = 'content' ORDER BY id DESC LIMIT 1) AS as_of,
         (SELECT as_of_basis FROM main.syncs WHERE source_id = r.source_id AND kind = 'content' ORDER BY id DESC LIMIT 1) AS as_of_basis,
         (SELECT started_at FROM main.syncs WHERE source_id = r.source_id AND kind IN ('content', 'unchanged') ORDER BY id DESC LIMIT 1) AS checked_at
       FROM main.statements st
       JOIN main.records r ON r.id = st.record_id
       JOIN main.syncs wrote ON wrote.id = r.last_changed_sync_id
       WHERE st.id = ?`,
    )
    .get(statementId) as
    | { source_id: string; licence_id: string; retrieved_at: string; as_of: string | null; as_of_basis: string | null; checked_at: string | null }
    | undefined;
  if (!row) throw new Error(`statement ${statementId} not found`);
  return {
    sourceId: row.source_id,
    licenceId: row.licence_id,
    retrievedAt: row.retrieved_at,
    asOf: row.as_of,
    asOfBasis: row.as_of_basis,
    checkedAt: row.checked_at,
    accessTier,
    derived: false,
  };
}
