export { openStore, transaction, type Store } from "./open.ts";
export { IDENTIFIER_INDEX_WHERE, IDENTIFIER_PROPS, LARGE_TABLES, largeTableRewrites, migrate, MIGRATIONS, type Migration, type Target } from "./migrations.ts";
export {
  beginSync,
  dropIfOrphan,
  finishSync,
  intern,
  refreshEntity,
  rowHash,
  StoreError,
  upsertSource,
  writeRecord,
  type EntityInput,
  type RecordInput,
  type ReportInput,
  type SourceEventInput,
  type StatementInput,
  type StoreErrorCode,
  type SyncStart,
} from "./registry.ts";
export { findByIdentifier, searchCompanies, type MatchKind, type SearchHit } from "./search.ts";
export { sourceRefForStatement } from "./provenance.ts";
export { acquireLease, heartbeat, releaseLease, type Lease } from "./leases.ts";
export { companyRoleLines, lineHash, type LineTarget, type RoleLine } from "./lines.ts";
export { readPurposeSection, type PurposeRead, type PurposeSession } from "./purpose.ts";
export { openDispute, resolveDispute } from "./disputes.ts";
export { liftPersonLine, liftSuppression, suppressItem, suppressPersonLine } from "./suppressions.ts";
export { markViewed, runRetention } from "./retention.ts";
export { scanStore, type CanaryHit } from "./canary.ts";
export { BACKUP_CLASSES, BACKUP_FILTERS, type BackupClass } from "./backup-classes.ts";
export { DeletionsLog, type DeletionEntry } from "./deletions-log.ts";
export { RestrictionsLog, type RestrictionEntry } from "./restrictions-log.ts";
export {
  beginStaging,
  clearMiss,
  countRecords,
  deleteRecords,
  endStaging,
  entityByCode,
  lastContentStorage,
  lastContentSync,
  liveCheckedAt,
  missingRecords,
  missSince,
  purgeShareAlike,
  purgeSourceFromMain,
  recordChangedAt,
  recordId,
  recordLines,
  recordMiss,
  recordValues,
  replaceShareAlike,
  setContentHash,
  setLiveChecked,
  stage,
  tombstoneRecord,
  writeFinoraEvent,
  type MissingRecord,
  type RecordLine,
} from "./ingest-support.ts";
export { BACKUPS_KEPT, writeBackup } from "./backup.ts";
