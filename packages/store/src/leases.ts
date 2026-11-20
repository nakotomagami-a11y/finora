// One holder per resource across processes (cto B1, architecture §1): `sync:<source>`, `runner`,
// `recover`. Taken inside BEGIN IMMEDIATE, so two processes cannot both see the lease as free.
import type { DatabaseSync } from "node:sqlite";
import { transaction } from "./open.ts";

export type Lease = { resource: string; holder: string; expiresAt: number };

export function acquireLease(db: DatabaseSync, resource: string, holder: string, ttlMs: number, now = Date.now()): Lease | null {
  return transaction(
    db,
    () => {
      const current = db.prepare("SELECT holder, expires_at FROM main.leases WHERE resource = ?").get(resource) as
        | { holder: string; expires_at: number }
        | undefined;
      if (current && current.holder !== holder && current.expires_at > now) return null;
      db.prepare(
        `INSERT INTO main.leases (resource, holder, heartbeat_at, expires_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (resource) DO UPDATE SET holder = excluded.holder, heartbeat_at = excluded.heartbeat_at, expires_at = excluded.expires_at`,
      ).run(resource, holder, now, now + ttlMs);
      return { resource, holder, expiresAt: now + ttlMs };
    },
    "IMMEDIATE",
  );
}

/** Extends a held lease. Returns false if another holder has taken it over. */
export function heartbeat(db: DatabaseSync, lease: Lease, ttlMs: number, now = Date.now()): boolean {
  const result = db
    .prepare("UPDATE main.leases SET heartbeat_at = ?, expires_at = ? WHERE resource = ? AND holder = ?")
    .run(now, now + ttlMs, lease.resource, lease.holder);
  return result.changes === 1;
}

export function releaseLease(db: DatabaseSync, lease: Lease): void {
  db.prepare("DELETE FROM main.leases WHERE resource = ? AND holder = ?").run(lease.resource, lease.holder);
}
