// Forward-only migrations, one list per database file (architecture §3.8, §16):
//   main  finora.db       registry data, re-derivable from the raw cache
//   user  finora-user.db  what cannot be re-derived: purposes, disputes, suppressions, judgements, settings
//   sa    finora-sa.db    share-alike rows, keyed on the public eid only (P1, A6)
// Each file tracks how many of its migrations ran in its own PRAGMA user_version.

import type { DatabaseSync } from "node:sqlite";

export type Target = "main" | "user" | "sa";
export type Migration = { target: Target; name: string; sql: string };

export const MIGRATIONS: readonly Migration[] = [
  {
    target: "main",
    name: "registry",
    sql: `
      CREATE TABLE main.sources (
        id TEXT PRIMARY KEY,
        storage TEXT NOT NULL,
        purge_scope TEXT NOT NULL DEFAULT 'full',
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE main.syncs (
        id INTEGER PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES sources(id),
        kind TEXT NOT NULL CHECK (kind IN ('running', 'content', 'unchanged', 'stale_skipped', 'partial', 'failed')),
        licence_id TEXT NOT NULL CHECK (length(licence_id) > 0),
        storage TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        upstream_as_of TEXT,
        as_of_basis TEXT,
        content_hash TEXT,
        parser_version TEXT NOT NULL,
        report_json TEXT
      ) STRICT;
      CREATE TABLE main.records (
        id INTEGER PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES sources(id),
        record_key TEXT NOT NULL,
        row_hash BLOB NOT NULL,
        first_sync_id INTEGER NOT NULL REFERENCES syncs(id),
        last_changed_sync_id INTEGER NOT NULL REFERENCES syncs(id),
        line_ids TEXT,
        UNIQUE (source_id, record_key)
      ) STRICT;
      CREATE TABLE main.schemas (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE) STRICT;
      CREATE TABLE main.props (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE) STRICT;
      CREATE TABLE main.items (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE) STRICT;
      CREATE TABLE main.concepts (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE) STRICT;
      CREATE TABLE main.event_types (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE) STRICT;
      CREATE TABLE main.entities (
        id INTEGER PRIMARY KEY,
        eid TEXT NOT NULL UNIQUE,
        schema_id INTEGER NOT NULL REFERENCES schemas(id),
        country TEXT NOT NULL,
        legal_form TEXT,
        natural_person INTEGER NOT NULL CHECK (natural_person IN (0, 1)),
        status TEXT,
        code TEXT,
        caption TEXT NOT NULL,
        tombstone_since TEXT,
        first_sync_id INTEGER NOT NULL REFERENCES syncs(id)
      ) STRICT;
      CREATE TABLE main.statements (
        id INTEGER PRIMARY KEY,
        entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        prop_id INTEGER NOT NULL REFERENCES props(id),
        value TEXT NOT NULL,
        lang TEXT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        line INTEGER
      ) STRICT;
      CREATE TABLE main.fact_reports (
        id INTEGER PRIMARY KEY,
        entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        period_start TEXT,
        period_end TEXT NOT NULL,
        currency TEXT,
        unit_scale INTEGER NOT NULL DEFAULT 1,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE
      ) STRICT;
      CREATE TABLE main.facts (
        report_id INTEGER NOT NULL REFERENCES fact_reports(id) ON DELETE CASCADE,
        concept_id INTEGER NOT NULL REFERENCES concepts(id),
        value REAL NOT NULL,
        PRIMARY KEY (report_id, concept_id)
      ) STRICT, WITHOUT ROWID;
      CREATE TABLE main.events (
        id INTEGER PRIMARY KEY,
        entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        type_id INTEGER NOT NULL REFERENCES event_types(id),
        date TEXT NOT NULL,
        data TEXT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        record_id INTEGER REFERENCES records(id) ON DELETE CASCADE
      ) STRICT;
      CREATE TABLE main.links (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind = 'same_as'),
        entity_a INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        entity_b INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        UNIQUE (entity_a, entity_b, record_id)
      ) STRICT;
      CREATE TABLE main.live_cache_views (
        entity_id INTEGER PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
        viewed_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE main.labels (
        scheme TEXT NOT NULL,
        code TEXT NOT NULL,
        lang TEXT NOT NULL,
        label TEXT NOT NULL,
        PRIMARY KEY (scheme, code, lang)
      ) STRICT, WITHOUT ROWID;
      CREATE TABLE main.leases (
        resource TEXT PRIMARY KEY,
        holder TEXT NOT NULL,
        heartbeat_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE main.jobs (
        name TEXT PRIMARY KEY,
        last_run_at TEXT,
        last_status TEXT,
        next_run_at TEXT
      ) STRICT;
      CREATE VIRTUAL TABLE main.entities_fts USING fts5(search_text, tokenize = 'unicode61 remove_diacritics 2');
      CREATE VIRTUAL TABLE main.entities_trigram USING fts5(search_text, tokenize = 'trigram remove_diacritics 1');
      CREATE INDEX main.statements_entity ON statements(entity_id);
      CREATE INDEX main.statements_record ON statements(record_id);
      CREATE INDEX main.statements_prop_value ON statements(prop_id, value);
      CREATE INDEX main.entities_code ON entities(country, code);
      CREATE INDEX main.syncs_source ON syncs(source_id, kind, started_at);
    `,
  },
  {
    target: "user",
    name: "user data",
    sql: `
      CREATE TABLE user.purpose_log (
        id INTEGER PRIMARY KEY,
        company_eid TEXT NOT NULL,
        section TEXT NOT NULL,
        purpose_id TEXT NOT NULL,
        surface TEXT NOT NULL CHECK (surface IN ('ui', 'api', 'mcp', 'agent')),
        actor TEXT NOT NULL,
        at TEXT NOT NULL
      ) STRICT;
      CREATE TRIGGER user.purpose_log_append_only BEFORE UPDATE ON purpose_log
      BEGIN SELECT RAISE(ABORT, 'purpose_log is append-only'); END;
      CREATE TABLE user.disputes (
        id INTEGER PRIMARY KEY,
        company_eid TEXT NOT NULL,
        source_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        line_hash TEXT NOT NULL,
        personal INTEGER NOT NULL CHECK (personal IN (0, 1)),
        kind TEXT NOT NULL CHECK (kind IN ('correction', 'objection')),
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
        opened_at TEXT NOT NULL,
        resolved_at TEXT
      ) STRICT;
      CREATE TABLE user.suppressions (
        id INTEGER PRIMARY KEY,
        company_eid TEXT NOT NULL,
        item_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (company_eid, item_id)
      ) STRICT;
      CREATE TABLE user.judgements (
        id INTEGER PRIMARY KEY,
        eid_a TEXT NOT NULL,
        eid_b TEXT NOT NULL,
        decision TEXT NOT NULL CHECK (decision IN ('same', 'different', 'unsure')),
        by TEXT NOT NULL CHECK (by IN ('rule', 'agent', 'human')),
        at TEXT NOT NULL,
        UNIQUE (eid_a, eid_b)
      ) STRICT;
      CREATE TABLE user.settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
    `,
  },
  {
    target: "sa",
    name: "share-alike",
    sql: `
      CREATE TABLE sa.sa_syncs (
        id INTEGER PRIMARY KEY,
        source_id TEXT NOT NULL,
        licence_id TEXT NOT NULL CHECK (length(licence_id) > 0),
        started_at TEXT NOT NULL,
        upstream_as_of TEXT
      ) STRICT;
      CREATE TABLE sa.sa_statements (
        id INTEGER PRIMARY KEY,
        eid TEXT NOT NULL,
        prop TEXT NOT NULL,
        value TEXT NOT NULL,
        item_id TEXT NOT NULL,
        sync_id INTEGER NOT NULL REFERENCES sa_syncs(id)
      ) STRICT;
      CREATE INDEX sa.sa_statements_eid ON sa_statements(eid);
    `,
  },
];

/** Large tables take additive migrations only: a rebuild doubles disk use on a ~7 GB store (cto S3). */
export const LARGE_TABLES = ["statements", "facts", "records"] as const;

const ADDITIVE = [/^ALTER TABLE \S+ ADD COLUMN /i, /^CREATE (?:UNIQUE )?INDEX /i];

/** Returns the statements of a non-initial migration that rewrite a large table. */
export function largeTableRewrites(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s && LARGE_TABLES.some((t) => new RegExp(`\\b(?:main\\.)?${t}\\b`, "i").test(s)))
    .filter((s) => !ADDITIVE.some((re) => re.test(s)));
}

/** Runs the migrations a database file has not run yet. `upTo` limits each target, for tests. */
export function migrate(db: DatabaseSync, upTo?: Partial<Record<Target, number>>): void {
  for (const target of ["main", "user", "sa"] as const) {
    const list = MIGRATIONS.filter((m) => m.target === target);
    const limit = Math.min(upTo?.[target] ?? list.length, list.length);
    const row = db.prepare(`PRAGMA ${target}.user_version`).get() as { user_version: number };
    for (let i = row.user_version; i < limit; i++) {
      const migration = list[i];
      if (!migration) break;
      db.exec("BEGIN");
      try {
        db.exec(migration.sql);
        db.exec(`PRAGMA ${target}.user_version = ${i + 1}`);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  }
}
