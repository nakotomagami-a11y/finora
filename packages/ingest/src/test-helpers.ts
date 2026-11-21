// Shared set-up for the pipeline tests. Every name and code is fictional.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openStore } from "@finora/store";
import type { SourceLoader } from "@finora/sources";
import { runSync, type SyncOptions } from "./pipeline.ts";
import { noNetwork } from "./testing/fake-source.ts";

export function memoryDb(): DatabaseSync {
  return openStore({ dataDir: null }).db;
}

export function tempDir(): { path: string; remove(): void } {
  const path = mkdtempSync(join(tmpdir(), "finora-ingest-"));
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

let clock = Date.parse("2026-11-01T06:00:00.000Z");

/** Runs a sync on a clock that moves one hour per call, so sync rows order by time. */
export function sync(db: DatabaseSync, loader: SourceLoader, options: Partial<SyncOptions> = {}) {
  clock += 3_600_000;
  const at = new Date(clock);
  return runSync(db, loader, { fetcher: noNetwork, now: () => at, ...options });
}

export const count = (db: DatabaseSync, sql: string, ...params: (string | number)[]) =>
  (db.prepare(sql).get(...params) as { n: number }).n;

export const statements = (db: DatabaseSync) => count(db, "SELECT COUNT(*) AS n FROM main.statements");
export const records = (db: DatabaseSync, sourceId = "fake-register") =>
  count(db, "SELECT COUNT(*) AS n FROM main.records WHERE source_id = ?", sourceId);
