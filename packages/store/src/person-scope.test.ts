import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as store from "./index.ts";
import { companyRoleLines } from "./lines.ts";
import { searchCompanies } from "./search.ts";
import { contentSync, memoryStore, writeRoleSet } from "./test-helpers.ts";

const HUMAN = { name: "Anna Example", role: "board_member", startDate: "2022-02-02" };

function twoCompanies() {
  const { db } = memoryStore();
  const sync = contentSync(db, "lv-officers", "2026-11-01T00:00:00.000Z");
  writeRoleSet(db, sync, "lv-00000000001", [HUMAN]);
  writeRoleSet(db, sync, "lv-00000000002", [HUMAN]);
  return db;
}

describe("PS2: people exist only inside one company", () => {
  it("stores the same human in two companies as two unrelated rows", () => {
    const db = twoCompanies();
    const persons = db
      .prepare("SELECT e.eid FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id WHERE s.name = 'Person'")
      .all() as { eid: string }[];
    expect(persons).toHaveLength(2);
    expect(new Set(persons.map((p) => p.eid)).size).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.links").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM user.judgements").get()).toEqual({ n: 0 });
  });

  it("returns each company's line only from that company", () => {
    const db = twoCompanies();
    for (const eid of ["lv-00000000001", "lv-00000000002"]) {
      const lines = companyRoleLines(db, eid, ["S03.LV.01"]);
      expect(lines.map((l) => l.name)).toEqual(["Anna Example"]);
    }
    expect(searchCompanies(db, "anna example")).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM main.entities_fts").get()).toEqual({ n: 0 });
  });

  it("exposes no repository call that takes a person id (a new export needs review here)", () => {
    expect(Object.keys(store).sort()).toEqual([
      "BACKUPS_KEPT",
      "BACKUP_CLASSES",
      "BACKUP_FILTERS",
      "DeletionsLog",
      "IDENTIFIER_INDEX_WHERE",
      "IDENTIFIER_PROPS",
      "LARGE_TABLES",
      "MIGRATIONS",
      "RestrictionsLog",
      "STORE_SCHEMAS",
      "StoreError",
      "acquireLease",
      "beginStaging",
      "beginSync",
      "clearMiss",
      "companyRoleLines",
      "companyValues",
      "countMarketObservations",
      "countRecords",
      "deleteMarketObservations",
      "deleteMarketSeries",
      "deleteMarketSource",
      "deleteRecords",
      "dropIfOrphan",
      "endStaging",
      "entityByCode",
      "expireMarketLatest",
      "failSync",
      "findByIdentifier",
      "finishSync",
      "heartbeat",
      "holdsLease",
      "intern",
      "isCompanyEid",
      "largeTableRewrites",
      "lastContentStorage",
      "lastContentSync",
      "lastMarketSync",
      "liftPersonLine",
      "liftSuppression",
      "lineHash",
      "liveCheckedAt",
      "markViewed",
      "marketCheckedAt",
      "marketSyncInfo",
      "migrate",
      "missSince",
      "missingMarketDates",
      "missingRecords",
      "openDispute",
      "openStore",
      "purgeShareAlike",
      "purgeSourceFromMain",
      "putMarketLatest",
      "putMarketObservations",
      "readMarketSeries",
      "readPurposeSection",
      "recordChangedAt",
      "recordId",
      "recordIdsWithPrefix",
      "recordKeyOf",
      "recordLines",
      "recordMiss",
      "recordValues",
      "refreshEntity",
      "releaseLease",
      "replaceShareAlike",
      "resolveDispute",
      "rowHash",
      "runRetention",
      "scanStore",
      "searchCompanies",
      "setContentHash",
      "setLiveChecked",
      "shareAlikeRecords",
      "sourceRefForStatement",
      "stage",
      "suppressItem",
      "suppressPersonLine",
      "tombstoneRecord",
      "transaction",
      "trimMarketWindow",
      "upsertMarketSeries",
      "upsertSource",
      "writeBackup",
      "writeFinoraEvent",
      "writeRecord",
    ]);
  });

  it("computes no HMAC and keeps no person key (LAW-PSEUDONYM interim)", () => {
    const dir = new URL(".", import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      expect(readFileSync(new URL(file, dir), "utf8"), file).not.toMatch(/createHmac|person_key|pseudonym\s*[:=(]/i);
    }
  });
});
