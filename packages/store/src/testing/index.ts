// Tests only: reads of the sync connection's statement cache, for the proof that no bound value
// outlives a sync (qa SHOULD on 8661a89). Not on the package's main entry, so no product code can use them.
export { cachedStatements, statementCacheSize } from "../statements.ts";
