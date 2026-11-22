// S05 review M6, SEC-9 and legal's byte-scan condition: after a full LV fixture load, in both
// `LV_PERSON_ROWS` modes, no file in the data dir or the raw dir holds a masked person code, a birth
// date or a dropped person's text; no LV file is kept in the raw cache; a holder the party gate does
// not prove a company is never stored.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSync } from "@finora/ingest";
import { DEFAULT_LOADER_CONFIG, lvUrOfficersLoader, type LvPersonRows } from "@finora/sources";
import { LV_BIRTH_DATE_CANARY, LV_LIQUIDATION_GROUND_CANARY, LV_RISK_CANARIES, lvFx, lvMaskedCodeCanary, lvOfficersCsv, lvRiskMaskedCode } from "@finora/sources/testing";
import { openStore, scanStore } from "@finora/store";
import { afterEach, describe, expect, it } from "vitest";
import { fixtureProfileFor } from "./src/index.ts";
import { fxLvUrOfficers, fxLvUrRegister, fxLvUrSanctionsLinks } from "./src/loaders.ts";

const FIXTURE_PROFILE = fixtureProfileFor(DEFAULT_LOADER_CONFIG);

const noNetwork = async (): Promise<never> => {
  throw new Error("the fixture profile never fetches");
};
const LV = FIXTURE_PROFILE.map((p) => p.loader).filter((l) => /^lv-(ur|vid)-/.test(l.meta.id));
const COMPANY_PARTY_TYPES = ["LEGAL_ENTITY", "FOREIGN_ENTITY"];

/** Values no mode may store: person codes, birth dates and the dropped free text around people. */
const ALWAYS = [lvMaskedCodeCanary(), LV_BIRTH_DATE_CANARY, lvRiskMaskedCode(), LV_RISK_CANARIES.birthDate, LV_RISK_CANARIES.debtorAddress, LV_RISK_CANARIES.bailiff, LV_RISK_CANARIES.typeDetails, LV_RISK_CANARIES.groundFor, LV_RISK_CANARIES.nationality, LV_RISK_CANARIES.legalBase, LV_LIQUIDATION_GROUND_CANARY, "Test Person S"];

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

  it("loads a sanctions counterparty known by name only through the party gate (N4)", async () => {
    const counterparty = async (types: string[]) => {
      const { db, close } = openStore({ dataDir: null });
      await runSync(db, fxLvUrRegister, { fetcher: noNetwork });
      const outcome = await runSync(db, fxLvUrSanctionsLinks, { fetcher: noNetwork, companyPartyTypes: types });
      const parties = (db.prepare("SELECT data FROM main.events WHERE data LIKE '%foreign_company%'").all() as { data: string }[]).map((r) => (JSON.parse(r.data) as { party: string | null }).party);
      const result = { outcome, parties, names: scanStore(db, ["Sample Trading LLC"]).length, orgs: (db.prepare("SELECT COUNT(*) AS n FROM main.entities WHERE eid LIKE 'org-%'").get() as { n: number }).n };
      close();
      return result;
    };
    const unproven = await counterparty([]);
    expect(unproven.outcome.report?.dropped.party_not_proven).toBeGreaterThan(0);
    expect(unproven.names).toBe(0);
    expect(unproven.orgs).toBe(0);
    // The subject's link stays; the unproven counterparty is withheld for good, not retried.
    expect(unproven.parties).toEqual([undefined]);
    expect(unproven.outcome.report?.dropped.reference_unresolved).toBeUndefined();
    const proven = await counterparty(COMPANY_PARTY_TYPES);
    expect(proven.names).toBeGreaterThan(0);
    // One org: link 8107's subject is in no register, so its counterparty is not loaded either (needs).
    expect(proven.orgs).toBe(1);
    expect(proven.parties).toHaveLength(1);
    expect(proven.parties[0]).toMatch(/^org-[0-9a-f]{20}$/);
    expect(proven.outcome.report?.dropped.reference_unresolved).toBeUndefined();
  });

  it("keeps every person line under its own company's officer set, and no person row id anywhere else (legal)", async () => {
    const { db, close } = openStore({ dataDir: null });
    const officers = { ...lvUrOfficersLoader({ personRows: "names_no_id" }), fetch: fxLvUrOfficers.fetch };
    for (const loader of LV.map((l) => (l.meta.id === "lv-ur-officers" ? officers : l))) await runSync(db, loader, { fetcher: noNetwork, companyPartyTypes: COMPANY_PARTY_TYPES });
    const PERSON_ROW = /\bp-\d+-\d+\b/;
    const persons = db.prepare("SELECT e.id, e.eid FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id WHERE s.name = 'Person'").all() as { id: number; eid: string }[];
    expect(persons.length).toBeGreaterThan(0);
    for (const person of persons) {
      // The row holds its name only, from one officer set.
      const own = db.prepare("SELECT p.name AS prop, r.record_key FROM main.statements st JOIN main.props p ON p.id = st.prop_id JOIN main.records r ON r.id = st.record_id WHERE st.entity_id = ?").all(person.id) as { prop: string; record_key: string }[];
      expect(new Set(own.map((o) => o.prop))).toEqual(new Set(["name"]));
      const [setKey, ...others] = [...new Set(own.map((o) => o.record_key))];
      expect(others).toEqual([]);
      expect(setKey).toMatch(/^lv-\d{11}\|officers$/);
      // It is named only as the director of a Directorship in that set, whose organization is the set's company.
      const refs = db.prepare("SELECT p.name AS prop, st.entity_id, r.record_key FROM main.statements st JOIN main.props p ON p.id = st.prop_id JOIN main.records r ON r.id = st.record_id WHERE st.value = ?").all(person.eid) as { prop: string; entity_id: number; record_key: string }[];
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect([ref.prop, ref.record_key]).toEqual(["director", setKey]);
        const org = db.prepare("SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = ? AND p.name = 'organization'").all(ref.entity_id) as { value: string }[];
        expect(org.map((o) => o.value)).toEqual([setKey!.split("|")[0]]);
      }
    }
    // No person row id in event data, record keys, line ids or any other value.
    const events = db.prepare("SELECT data FROM main.events WHERE data IS NOT NULL").all() as { data: string }[];
    expect(events.filter((e) => PERSON_ROW.test(e.data))).toEqual([]);
    const keys = db.prepare("SELECT record_key, line_ids FROM main.records").all() as { record_key: string; line_ids: string | null }[];
    expect(keys.filter((k) => PERSON_ROW.test(k.record_key) || PERSON_ROW.test(k.line_ids ?? ""))).toEqual([]);
    const elsewhere = db.prepare("SELECT p.name AS prop, st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE p.name <> 'director'").all() as { prop: string; value: string }[];
    expect(elsewhere.filter((v) => PERSON_ROW.test(v.value))).toEqual([]);
    close();
  });

  it("nulls and counts a name in an officer's id column, and stores it nowhere in either mode (N1)", async () => {
    const ID_NAME = "Test Person Idcanary";
    const csv = () => lvOfficersCsv([
      { id: ID_NAME as never, n: 1, position: "BOARD_MEMBER", body: "EXECUTIVE_BOARD", name: "Test Person Q1", rights: "INDIVIDUALLY", registered: "2020-01-01" },
      { id: 5004, n: 1, position: "BOARD_MEMBER", body: "EXECUTIVE_BOARD", name: "Test Person Q2", rights: "INDIVIDUALLY", registered: "2020-01-01" },
    ]);
    for (const mode of ["names_no_id", "role_counts"] as const) {
      const dataDir = mkdtempSync(join(tmpdir(), "finora-lv-n1-"));
      const rawDir = mkdtempSync(join(tmpdir(), "finora-lv-n1-raw-"));
      dirs.push(dataDir, rawDir);
      const store = openStore({ dataDir });
      await runSync(store.db, fxLvUrRegister, { fetcher: noNetwork, rawCacheDir: rawDir });
      const officers = { ...lvUrOfficersLoader({ personRows: mode }), fetch: async (ctx: { now: string }) => ({ artifacts: [{ name: "officers.csv", bytes: csv(), fetchedAt: ctx.now }] }) };
      const outcome = await runSync(store.db, officers, { fetcher: noNetwork, rawCacheDir: rawDir, companyPartyTypes: COMPANY_PARTY_TYPES });
      expect(outcome.kind).toBe("content");
      expect(outcome.report?.dropped.free_text).toBe(1);
      // The control: the digit id is kept.
      const lineIds = (store.db.prepare("SELECT line_ids FROM main.records WHERE record_key = ?").get(`lv-${lvFx(1).code}|officers`) as { line_ids: string }).line_ids;
      expect(JSON.parse(lineIds)).toEqual([null, "5004"]);
      store.close();
      const hits = [...files(dataDir), ...files(rawDir)].filter((path) => readFileSync(path).toString("utf8").includes(ID_NAME));
      expect(hits, mode).toEqual([]);
    }
  });
});
