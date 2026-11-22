// Forward-only migrations, one list per database file (architecture §3.8, §16):
//   main  finora.db       registry data, re-derivable from the raw cache
//   user  finora-user.db  what cannot be re-derived: purposes, disputes, suppressions, judgements, settings
//   sa    finora-sa.db    share-alike rows, keyed on the public eid only (P1, A6)
//   cc    connector-cache.db  licensed market series fetched for this user; never exported or backed up (R17)
// Each file tracks how many of its migrations ran in its own PRAGMA user_version.
// Until the first release (the M1 demo) the initial migration of a file may still change in place,
// because no store exists outside test runs; from then on every change is a new migration.

import type { DatabaseSync } from "node:sqlite";

export type Target = "main" | "user" | "sa" | "cc";
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
      -- Identifier props sit at fixed ids so one partial index serves every ID lookup (cto M1 health
      -- check: a full (prop_id, value) index costs 29 B of every statement). IDENTIFIER_PROPS mirrors this.
      INSERT INTO main.props (id, name) VALUES
        (1, 'registrationNumber'), (2, 'vatCode'), (3, 'taxNumber'), (4, 'leiCode'),
        (5, 'idNumber'), (6, 'cikCode'), (7, 'isinCode'), (8, 'ticker');
      CREATE INDEX main.statements_identifier ON statements(prop_id, value) WHERE prop_id BETWEEN 1 AND 8;
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
    // qa S04a Q-3, legal: a person's line is targeted by row id or role, never by a content hash.
    target: "user",
    name: "dispute targets",
    sql: `
      CREATE TABLE user.disputes_v2 (
        id INTEGER PRIMARY KEY,
        company_eid TEXT NOT NULL,
        source_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        line_hash TEXT,
        source_row_id TEXT,
        role TEXT,
        personal INTEGER NOT NULL CHECK (personal IN (0, 1)),
        kind TEXT NOT NULL CHECK (kind IN ('correction', 'objection')),
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
        opened_at TEXT NOT NULL,
        resolved_at TEXT,
        CHECK (
          (personal = 0 AND line_hash IS NOT NULL AND source_row_id IS NULL AND role IS NULL) OR
          (personal = 1 AND line_hash IS NULL AND (source_row_id IS NULL) <> (role IS NULL))
        )
      ) STRICT;
      INSERT INTO user.disputes_v2 (id, company_eid, source_id, item_id, line_hash, personal, kind, status, opened_at, resolved_at)
        SELECT id, company_eid, source_id, item_id, line_hash, personal, kind, status, opened_at, resolved_at
        FROM user.disputes WHERE personal = 0; -- a person's line was never disputed by hash outside test runs
      DROP TABLE user.disputes;
      ALTER TABLE user.disputes_v2 RENAME TO disputes;
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
  {
    // S04i: window and periods_in_file purges need a record's period; a field refused at load
    // (a sole trader's id with a personal-code shape) is recorded as withheld so the profile shows
    // "not loaded", never an empty value (legal 7058881476); live-cached sources count misses per dataset.
    target: "main",
    name: "ingest",
    sql: `
      ALTER TABLE main.records ADD COLUMN period TEXT;
      CREATE INDEX main.records_source_period ON records(source_id, period);
      CREATE TABLE main.withheld (
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        prop_id INTEGER NOT NULL REFERENCES props(id),
        reason TEXT NOT NULL,
        PRIMARY KEY (record_id, entity_id, prop_id)
      ) STRICT, WITHOUT ROWID;
      CREATE TABLE main.live_cache_misses (
        source_id TEXT NOT NULL REFERENCES sources(id),
        record_key TEXT NOT NULL,
        dataset TEXT NOT NULL,
        first_miss_at TEXT NOT NULL,
        PRIMARY KEY (source_id, record_key, dataset)
      ) STRICT, WITHOUT ROWID;
      CREATE TABLE main.live_cache_checks (
        source_id TEXT NOT NULL REFERENCES sources(id),
        record_key TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        PRIMARY KEY (source_id, record_key)
      ) STRICT, WITHOUT ROWID;
    `,
  },
  {
    // qa S04i M3: the share-alike store gets the purge guard, which needs the last record count.
    target: "sa",
    name: "share-alike records",
    sql: `ALTER TABLE sa.sa_syncs ADD COLUMN records INTEGER;`,
  },
  {
    // S22: Crash monitor series (loaders/markets.md §1.2). Open-licence series live in main; their
    // provenance is the sync that wrote each value.
    target: "main",
    name: "markets",
    sql: `
      CREATE TABLE main.market_series (
        id INTEGER PRIMARY KEY,
        series_key TEXT NOT NULL UNIQUE,
        source_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        unit TEXT NOT NULL CHECK (unit IN ('index_points', 'usd', 'usd_per_oz', 'usd_per_bbl', 'usd_cap', 'coins')),
        frequency TEXT NOT NULL CHECK (frequency IN ('daily_exchange', 'daily_7d', 'monthly', 'quarterly')),
        symbol TEXT
      ) STRICT;
      CREATE TABLE main.market_obs (
        series_id INTEGER NOT NULL REFERENCES market_series(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        value REAL NOT NULL,
        sync_id INTEGER NOT NULL REFERENCES syncs(id),
        PRIMARY KEY (series_id, date)
      ) STRICT, WITHOUT ROWID;
      CREATE TABLE main.market_latest (
        series_id INTEGER PRIMARY KEY REFERENCES market_series(id) ON DELETE CASCADE,
        value REAL NOT NULL,
        observed_at TEXT NOT NULL,
        sync_id INTEGER NOT NULL REFERENCES syncs(id)
      ) STRICT;
    `,
  },
  {
    // S22: licensed market series (R17). The same tables in connector-cache.db. SQLite cannot hold a
    // foreign key across files, so sync_id points at main.syncs by convention, checked in markets.test.ts.
    target: "cc",
    name: "connector cache",
    sql: `
      CREATE TABLE cc.market_series (
        id INTEGER PRIMARY KEY,
        series_key TEXT NOT NULL UNIQUE,
        source_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        unit TEXT NOT NULL CHECK (unit IN ('index_points', 'usd', 'usd_per_oz', 'usd_per_bbl', 'usd_cap', 'coins')),
        frequency TEXT NOT NULL CHECK (frequency IN ('daily_exchange', 'daily_7d', 'monthly', 'quarterly')),
        symbol TEXT
      ) STRICT;
      CREATE TABLE cc.market_obs (
        series_id INTEGER NOT NULL REFERENCES market_series(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        value REAL NOT NULL,
        sync_id INTEGER NOT NULL,
        PRIMARY KEY (series_id, date)
      ) STRICT, WITHOUT ROWID;
      CREATE TABLE cc.market_latest (
        series_id INTEGER PRIMARY KEY REFERENCES market_series(id) ON DELETE CASCADE,
        value REAL NOT NULL,
        observed_at TEXT NOT NULL,
        sync_id INTEGER NOT NULL
      ) STRICT;
    `,
  },
  {
    // cto's write-path fix 3 on S05: entities whose search rows a sync still owes, written in one pass at
    // its end; a sync cut off before that pass leaves its marks for the next sync or the boot.
    target: "main",
    name: "search dirty",
    sql: `
      CREATE TABLE main.search_dirty (
        entity_id INTEGER PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE
      ) STRICT;
    `,
  },
];

/** The identifier props and their fixed ids, seeded by the first main migration. */
export const IDENTIFIER_PROPS = {
  registrationNumber: 1,
  vatCode: 2,
  taxNumber: 3,
  leiCode: 4,
  idNumber: 5,
  cikCode: 6,
  isinCode: 7,
  ticker: 8,
} as const;

/** The partial index's predicate on `statements st`; a lookup must repeat it to use the index. */
export const IDENTIFIER_INDEX_WHERE = "st.prop_id BETWEEN 1 AND 8";

/** Large tables take additive migrations only: a rebuild doubles disk use on a ~7 GB store (cto S3). */
export const LARGE_TABLES = ["statements", "facts", "records"] as const;

const WRITE_TARGET = /^(?:CREATE TABLE|DROP TABLE|INSERT(?: OR \w+)? INTO|REPLACE INTO|UPDATE(?: OR \w+)?|DELETE FROM|ALTER TABLE)\s+(?:IF (?:NOT )?EXISTS\s+)?(?:main\.)?(\w+)/i;
const isLarge = (name: string | undefined) => name !== undefined && (LARGE_TABLES as readonly string[]).includes(name.toLowerCase());

/**
 * Returns the statements of a non-initial migration that rewrite a large table: any write to one
 * (create, drop, insert, update, delete, alter other than ADD COLUMN), a rename onto one, or a
 * copy that reads one. A new table or index that only references a large table is additive.
 */
export function largeTableRewrites(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((s) => {
      if (/^ALTER TABLE \S+ ADD COLUMN /i.test(s) || /^CREATE (?:UNIQUE )?INDEX /i.test(s)) return false;
      if (isLarge(WRITE_TARGET.exec(s)?.[1])) return true;
      if (isLarge(/\bRENAME TO (?:main\.)?(\w+)/i.exec(s)?.[1])) return true;
      return /^(?:INSERT|REPLACE|CREATE TABLE)\b/i.test(s) && /\bSELECT\b/i.test(s) && isLarge(/\bFROM (?:main\.)?(\w+)/i.exec(s)?.[1]);
    });
}

/** Runs the migrations a database file has not run yet. `upTo` limits each target, for tests. */
export function migrate(db: DatabaseSync, upTo?: Partial<Record<Target, number>>): void {
  for (const target of ["main", "user", "sa", "cc"] as const) {
    const list = MIGRATIONS.filter((m) => m.target === target);
    const limit = Math.min(upTo?.[target] ?? list.length, list.length);
    const row = db.prepare(`PRAGMA ${target}.user_version`).get() as { user_version: number };
    for (let i = row.user_version; i < limit; i++) {
      const migration = list[i];
      if (!migration) break;
      // IMMEDIATE takes the write lock up front, and the version is read again under it, so two
      // processes migrating one store at once run each migration exactly once.
      db.exec("BEGIN IMMEDIATE");
      const again = (db.prepare(`PRAGMA ${target}.user_version`).get() as { user_version: number }).user_version;
      if (again > i) {
        db.exec("COMMIT");
        continue;
      }
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
