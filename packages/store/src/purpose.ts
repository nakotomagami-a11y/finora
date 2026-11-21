// Policy P2 (legal rule 2): person data is read only with a stated purpose, and every company
// opened gets its own append-only log row with the purpose in force at that moment.
import type { DatabaseSync } from "node:sqlite";
import { isPurposeId, PURPOSE_SESSION_HOURS, type PurposeId } from "@finora/domain";
import { companyRoleLines, type RoleLine } from "./lines.ts";
import type { RestrictionsLog } from "./restrictions-log.ts";
import { StoreError } from "./registry.ts";

export type PurposeSession = { purposeId: string; startedAt: string };
export type PurposeRead =
  | { state: "needs_purpose" }
  | { state: "data"; purposeId: PurposeId; lines: RoleLine[] };

export function readPurposeSection(
  db: DatabaseSync,
  request: {
    companyEid: string;
    section: string;
    itemIds: readonly string[];
    purpose: PurposeSession | null;
    surface: "ui" | "api" | "mcp" | "agent";
    actor: string;
    now: string;
    sessionHours?: number;
  },
  restrictions: RestrictionsLog,
): PurposeRead {
  const { purpose } = request;
  if (!purpose) return { state: "needs_purpose" };
  if (!isPurposeId(purpose.purposeId)) throw new StoreError("purpose_blocked", purpose.purposeId);
  const ageMs = Date.parse(request.now) - Date.parse(purpose.startedAt);
  // A session that starts in the future, or ran past its hours, asks again.
  if (!(ageMs >= 0) || ageMs > (request.sessionHours ?? PURPOSE_SESSION_HOURS) * 3_600_000) return { state: "needs_purpose" };
  // Read the restrictions before logging, so a missing or corrupt log refuses the read (fail closed).
  const active = restrictions.active();

  db.prepare(
    "INSERT INTO user.purpose_log (company_eid, section, purpose_id, surface, actor, at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(request.companyEid, request.section, purpose.purposeId, request.surface, request.actor, request.now);
  const lines = companyRoleLines(db, request.companyEid, request.itemIds, active).filter((line) => line.hidden === null);
  return { state: "data", purposeId: purpose.purposeId, lines };
}
