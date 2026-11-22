// What a backup may hold (architecture §16, LAW-BACKUP-RETENTION). Every table has exactly one
// class; a backed-up table lists every column it copies, and the filters legal set are named, so
// nothing can join a backup unnoticed. The backup command itself lands in S12.

export type BackupClass =
  | { class: "derivable" }
  | { class: "person_excluded" }
  | { class: "backed_up"; columns: readonly string[]; filter: keyof typeof BACKUP_FILTERS | null };

/** The filters legal set on backed-up user tables (council session 2). */
export const BACKUP_FILTERS = {
  company_lines_only: "only disputes with personal = 0, on a non-personal item of an entity with natural_person = 0 (person-line disputes live in restrictions.log)",
  company_level_only: "only suppressions on a non-personal item of an entity with natural_person = 0",
  company_pairs_only: "only judgements where neither entity has natural_person = 1",
} as const;

const derivable = { class: "derivable" } as const;

export const BACKUP_CLASSES: Record<string, BackupClass> = {
  "main.sources": derivable,
  "main.syncs": derivable,
  "main.records": derivable,
  "main.schemas": derivable,
  "main.props": derivable,
  "main.items": derivable,
  "main.concepts": derivable,
  "main.event_types": derivable,
  "main.entities": derivable,
  "main.statements": derivable,
  "main.fact_reports": derivable,
  "main.facts": derivable,
  "main.events": derivable,
  "main.links": derivable,
  "main.live_cache_views": derivable,
  "main.labels": derivable,
  "main.leases": derivable,
  "main.jobs": derivable,
  "main.entities_fts": derivable,
  "main.search_dirty": derivable,
  "main.entities_trigram": derivable,
  "main.withheld": derivable,
  "main.live_cache_misses": derivable,
  "main.live_cache_checks": derivable,
  "main.market_series": derivable,
  "main.market_obs": derivable,
  "main.market_latest": derivable,
  // Licensed market series are re-fetched with the user's own access, never backed up or exported (R17).
  "cc.market_series": derivable,
  "cc.market_obs": derivable,
  "cc.market_latest": derivable,
  "user.purpose_log": {
    class: "backed_up",
    columns: ["id", "company_eid", "section", "purpose_id", "surface", "actor", "at"],
    filter: null,
  },
  "user.disputes": {
    class: "backed_up",
    columns: ["id", "company_eid", "source_id", "item_id", "line_hash", "source_row_id", "role", "personal", "kind", "status", "opened_at", "resolved_at"],
    filter: "company_lines_only",
  },
  "user.suppressions": {
    class: "backed_up",
    columns: ["id", "company_eid", "item_id", "created_at"],
    filter: "company_level_only",
  },
  "user.judgements": {
    class: "backed_up",
    columns: ["id", "eid_a", "eid_b", "decision", "by", "at"],
    filter: "company_pairs_only",
  },
  "user.settings": { class: "backed_up", columns: ["key", "value"], filter: null },
  "sa.sa_syncs": derivable,
  "sa.sa_statements": derivable,
};
