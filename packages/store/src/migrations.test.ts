import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { largeTableRewrites, migrate, MIGRATIONS, type Target } from "./migrations.ts";
import { memoryStore } from "./test-helpers.ts";

const TARGETS: Target[] = ["main", "user", "sa"];

function bare(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("ATTACH DATABASE ':memory:' AS user; ATTACH DATABASE ':memory:' AS sa;");
  return db;
}

function schemaOf(db: DatabaseSync): string[] {
  return TARGETS.flatMap((t) =>
    (db.prepare(`SELECT type, name, sql FROM ${t}.sqlite_master ORDER BY type, name`).all() as { type: string; name: string; sql: string | null }[]).map(
      (r) => `${t}|${r.type}|${r.name}|${r.sql ?? ""}`,
    ),
  );
}

function versions(db: DatabaseSync): Record<Target, number> {
  const v = (t: Target) => (db.prepare(`PRAGMA ${t}.user_version`).get() as { user_version: number }).user_version;
  return { main: v("main"), user: v("user"), sa: v("sa") };
}

const count = (t: Target) => MIGRATIONS.filter((m) => m.target === t).length;

describe("migrations", () => {
  it("run from empty files to the latest version of each", () => {
    const store = memoryStore();
    expect(versions(store.db)).toEqual({ main: count("main"), user: count("user"), sa: count("sa") });
    for (const table of ["main.statements", "user.purpose_log", "sa.sa_statements", "main.leases"]) {
      expect(() => store.db.prepare(`SELECT COUNT(*) FROM ${table}`).get()).not.toThrow();
    }
    store.close();
  });

  it("are idempotent", () => {
    const store = memoryStore();
    const before = schemaOf(store.db);
    migrate(store.db);
    migrate(store.db);
    expect(schemaOf(store.db)).toEqual(before);
    store.close();
  });

  it("reach the same schema from every intermediate version", () => {
    const fresh = bare();
    migrate(fresh);
    const expected = schemaOf(fresh);
    for (const target of TARGETS) {
      for (let k = 0; k <= count(target); k++) {
        const db = bare();
        migrate(db, { main: 0, user: 0, sa: 0, [target]: k });
        expect(versions(db)[target]).toBe(k);
        migrate(db);
        expect(schemaOf(db), `${target} from ${k}`).toEqual(expected);
        db.close();
      }
    }
  });

  it("never rewrite a large table after the first migration of a file", () => {
    for (const target of TARGETS) {
      for (const migration of MIGRATIONS.filter((m) => m.target === target).slice(1)) {
        expect(largeTableRewrites(migration.sql), migration.name).toEqual([]);
      }
    }
  });

  it("flag a migration that rebuilds a large table, and let an additive one through", () => {
    const rebuild = `
      CREATE TABLE main.statements_new (id INTEGER PRIMARY KEY, value TEXT);
      INSERT INTO main.statements_new SELECT id, value FROM main.statements;
      DROP TABLE main.statements;
      ALTER TABLE main.statements_new RENAME TO statements;`;
    expect(largeTableRewrites(rebuild).length).toBeGreaterThan(0);
    expect(largeTableRewrites("UPDATE facts SET value = value * 1000")).toHaveLength(1);
    expect(largeTableRewrites("ALTER TABLE main.statements ADD COLUMN extra TEXT; CREATE INDEX main.x ON records(source_id)")).toEqual([]);
  });
});
