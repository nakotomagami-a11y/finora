// A small store for the screening tests: fixture-world companies and hand-built list entries in
// the shape the sanctions loaders write (sanctions.md §6). Every name and code is fictional.
import type { DatabaseSync } from "node:sqlite";
import { beginSync, finishSync, openStore, upsertSource, writeRecord, type EntityInput, type SourceEventInput } from "@finora/store";

export type TestEntry = {
  list: string;
  sourceId: string;
  itemId?: string;
  id: string;
  names: string[];
  weak?: string[];
  lei?: string;
  identifiers?: { type: string; number: string; country?: string }[];
  program?: string;
};

export type TestCompany = { eid: string; country: string; code: string; name: string; legalForm: string; lei?: string; vat?: string };

let clock = Date.parse("2026-11-21T06:00:00Z");

function syncOf(db: DatabaseSync, sourceId: string, write: (syncId: number) => void, asOf = "2026-11-20"): void {
  clock += 60_000;
  const at = new Date(clock).toISOString();
  upsertSource(db, { id: sourceId, storage: "store" }, at);
  const syncId = beginSync(db, { sourceId, licenceId: "cc0-1.0", storage: "store", parserVersion: "test-1", startedAt: at });
  write(syncId);
  finishSync(db, syncId, { kind: "content", finishedAt: at, upstreamAsOf: asOf });
}

export function companyEntity(c: TestCompany): EntityInput {
  const item = `S01.${c.country.toUpperCase()}.01`;
  return {
    eid: c.eid,
    schema: "Company",
    country: c.country,
    legalForm: c.legalForm,
    code: c.code,
    statements: [
      { prop: "name", value: c.name, itemId: item },
      { prop: "registrationNumber", value: c.code, itemId: item },
      ...(c.lei ? [{ prop: "leiCode", value: c.lei, itemId: "S01.ALL.01" }] : []),
      ...(c.vat ? [{ prop: "vatCode", value: c.vat, itemId: item }] : []),
    ],
  };
}

export function entryEntities(e: TestEntry): EntityInput[] {
  const itemId = e.itemId ?? "S11.ALL.02";
  const eid = `sanc-${e.list}-${e.id}`;
  return [
    {
      eid,
      schema: "Organization",
      country: "intl",
      statements: [
        ...e.names.map((value, i) => ({ prop: i === 0 ? "name" : "alias", value, itemId })),
        ...(e.weak ?? []).map((value) => ({ prop: "weakAlias", value, itemId })),
        ...(e.lei ? [{ prop: "leiCode", value: e.lei, itemId }] : []),
      ],
    },
    {
      eid: `${eid}-s`,
      schema: "Sanction",
      country: "intl",
      statements: [
        { prop: "entity", value: eid, itemId },
        { prop: "authority", value: "Fixture Authority", itemId },
        { prop: "program", value: e.program ?? "FIXTURE", itemId },
        { prop: "listingDate", value: "2026-03-01", itemId },
      ],
    },
    ...(e.identifiers ?? []).map((id, n) => ({
      eid: `${eid}-i${n}`,
      schema: "Identification" as const,
      country: id.country ?? "intl",
      statements: [
        { prop: "holder", value: eid, itemId },
        { prop: "type", value: id.type, itemId },
        { prop: "number", value: id.number, itemId },
        ...(id.country ? [{ prop: "country", value: id.country, itemId }] : []),
      ],
    })),
  ];
}

export function testStore(companies: TestCompany[], entries: TestEntry[], frozen: { companyEid: string; date: string }[] = []): DatabaseSync {
  const { db } = openStore({ dataDir: null });
  syncOf(db, "test-register", (syncId) => {
    for (const c of companies) writeRecord(db, { syncId, sourceId: "test-register", recordKey: c.eid, hashInput: [c.eid], entities: [companyEntity(c)] });
  });
  const bySource = new Map<string, TestEntry[]>();
  for (const e of entries) bySource.set(e.sourceId, [...(bySource.get(e.sourceId) ?? []), e]);
  for (const [sourceId, list] of bySource) {
    syncOf(db, sourceId, (syncId) => {
      for (const e of list) writeRecord(db, { syncId, sourceId, recordKey: e.id, hashInput: [JSON.stringify(e)], entities: entryEntities(e) });
    });
  }
  if (frozen.length > 0) {
    syncOf(db, "lv-fid-frozen", (syncId) => {
      for (const [n, f] of frozen.entries()) {
        const events: SourceEventInput[] = [{ entityEid: f.companyEid, type: "register.frozen_assets", date: f.date, itemId: "S11.LV.02", data: { legalAct: "Regula FX/2026" } }];
        writeRecord(db, { syncId, sourceId: "lv-fid-frozen", recordKey: `row-${n}`, hashInput: [f.companyEid], entities: [], events });
      }
    });
  }
  return db;
}
