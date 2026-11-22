// S05 review M6, SEC-9 and legal's byte-scan condition: after a full LV fixture load, in both
// `LV_PERSON_ROWS` modes, no file in the data dir or the raw dir holds a masked person code, a birth
// date or a dropped person's text; no LV file is kept in the raw cache; a holder the party gate does
// not prove a company is never stored.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSync } from "@finora/ingest";
import { lvUrOfficersLoader, type LvPersonRows } from "@finora/sources";
import { LV_BIRTH_DATE_CANARY, LV_RISK_CANARIES, lvMaskedCodeCanary, lvRiskMaskedCode } from "@finora/sources/testing";
import { openStore, scanStore } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { FIXTURE_PROFILE } from "./src/index.ts";
import { fxLvUrOfficers } from "./src/loaders.ts";

const noNetwork = async (): Promise<never> => {
  throw new Error("the fixture profile never fetches");
};
const LV = FIXTURE_PROFILE.map((p) => p.loader).filter((l) => /^lv-(ur|vid)-/.test(l.meta.id));
const COMPANY_PARTY_TYPES = ["LEGAL_ENTITY", "FOREIGN_ENTITY"];

/** Values no mode may store: person codes, birth dates and the dropped free text around people. */
const ALWAYS = [lvMaskedCodeCanary(), LV_BIRTH_DATE_CANARY, lvRiskMaskedCode(), LV_RISK_CANARIES.birthDate, LV_RISK_CANARIES.debtorAddress, LV_RISK_CANARIES.bailiff, LV_RISK_CANARIES.typeDetails, LV_RISK_CANARIES.groundFor, LV_RISK_CANARIES.nationality, LV_RISK_CANARIES.legalBase];

/**
 * Officers', members' and listed persons' fixture names. "Test Person A" is left out: it is also a
 * fixture sole trader's own business name, which the register file loads by design.
 */
const PERSON_NAMES = ["Zed", "Adam", "B", "C", "D", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "R"].map((n) => `Test Person ${n}`).concat("Test  Person   E", "Test Person E");

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

async function loadAll(mode: LvPersonRows): Promise<{ dataDir: string; rawDir: string }> {
  const dataDir = mkdtempSync(join(tmpdir(), "finora-lv-scan-"));
  const rawDir = mkdtempSync(join(tmpdir(), "finora-lv-raw-"));
  dirs.push(dataDir, rawDir);
  const store = openStore({ dataDir });
  const officers = { ...lvUrOfficersLoader({ personRows: mode }), fetch: fxLvUrOfficers.fetch };
  for (const loader of LV.map((l) => (l.meta.id === "lv-ur-officers" ? officers : l))) {
    const outcome = await runSync(store.db, loader, { fetcher: noNetwork, rawCacheDir: rawDir, companyPartyTypes: COMPANY_PARTY_TYPES });
    expect(outcome.kind, loader.meta.id).toBe("content");
  }
  store.close();
  return { dataDir, rawDir };
}

describe("LV fixture load: data dir and raw dir byte scan", () => {
  it.each(["names_no_id", "role_counts"] as const)("holds no person code, birth date or dropped person text in %s mode", async (mode) => {
    const { dataDir, rawDir } = await loadAll(mode);
    expect(files(rawDir)).toEqual([]);
    // In role_counts no officer, member or listed person's name is stored either.
    const needles = mode === "role_counts" ? [...ALWAYS, ...PERSON_NAMES] : ALWAYS;
    const hits = files(dataDir).flatMap((path) => {
      const text = readFileSync(path).toString("utf8");
      return needles.filter((n) => text.includes(n)).map((n) => `${path.slice(dataDir.length)}: ${n}`);
    });
    expect(hits).toEqual([]);
  }, 60_000);

  it("never stores a foreign holder the party gate does not prove a company, in any mode (SEC-9)", async () => {
    for (const mode of ["names_no_id", "role_counts"] as const) {
      const { db, close } = openStore({ dataDir: null });
      const officers = { ...lvUrOfficersLoader({ personRows: mode }), fetch: fxLvUrOfficers.fetch };
      const outcome = await runSync(db, officers, { fetcher: noNetwork, companyPartyTypes: [] });
      expect(outcome.report?.dropped.party_not_proven).toBeGreaterThan(0);
      expect(scanStore(db, ["Sample Holdings Ltd"])).toEqual([]);
      close();
    }
  });
});
