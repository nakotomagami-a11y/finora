// sanctions.md §7, one named case per rule; R8 (architecture: name only → possible; id match →
// listed; the entry's own different registration number → ruled out).
import { afterEach, describe, expect, it } from "vitest";
import { clearPersonList, PERSON_LISTS, setPersonList } from "./person-index.ts";
import { screenCompany, screenName } from "./sanctions.ts";
import { addOfficers, purposeContext, testStore, type TestCompany } from "./test-store.ts";

const EXAMPLE: TestCompany = { eid: "lv-40003000018", country: "lv", code: "40003000018", name: "Example Company 1 AS", legalForm: "lv-as", lei: "FX000000000000000044" };
const ENERGY: TestCompany = { eid: "lv-50003000024", country: "lv", code: "50003000024", name: "Test Energy 7 SIA", legalForm: "lv-sia", lei: "FX000000000000000723" };
const BAKERY: TestCompany = { eid: "ee-10000031", country: "ee", code: "10000031", name: "Sample Bakery 2 OÜ", legalForm: "ee-ou" };
const HOLDING: TestCompany = { eid: "lv-40203000059", country: "lv", code: "40203000059", name: "Ābeļu Holding 21 AS", legalForm: "lv-as" };
const PLACEHOLDER: TestCompany = { eid: "lv-40103000014", country: "lv", code: "40103000014", name: "Placeholder Bakery 1 SIA", legalForm: "lv-sia" };
const TRADER: TestCompany = { eid: "lv-50003001104", country: "lv", code: "50003001104", name: "Sample Trader 500 IK", legalForm: "lv-ik" };

afterEach(() => {
  for (const id of PERSON_LISTS) clearPersonList(id);
});

const holdAll = (entries: { list: string; entryId: string; names: string[]; listDate?: string | null }[] = []) => {
  for (const sourceId of PERSON_LISTS) {
    setPersonList(sourceId, {
      asOf: "2026-11-20",
      loadedAt: "",
      entries: entries.filter((e) => e.list === sourceId).map((e) => ({ list: e.list, entryId: e.entryId, names: e.names, program: null, listDate: e.listDate ?? null, birthYear: null, nationalities: [] })),
    });
  }
};
const checkedAll = PERSON_LISTS.map((sourceId) => ({ sourceId, state: "checked", asOf: "2026-11-20" }));


const statuses = (db: ReturnType<typeof testStore>, eid: string) => screenCompany(db, eid)!.hits.map((h) => [h.sourceId, h.status, h.basis]);

describe("sanctions screening (sanctions.md §7)", () => {
  it("listed-by-registration-and-country", () => {
    const db = testStore([EXAMPLE], [{ list: "eu", sourceId: "eu-fsf", id: "900001", names: ["Other Name Entirely"], identifiers: [{ type: "registration", number: "40003000018", country: "lv" }] }]);
    const result = screenCompany(db, EXAMPLE.eid)!;
    expect(result.hits.map((h) => [h.status, h.basis])).toEqual([["listed", "registration"]]);
    expect(result.hits[0]!.identifiers).toEqual([{ type: "registration", number: "40003000018", country: "lv" }]);
    expect(result.hits[0]!.companyIdentifiers[0]).toEqual({ type: "registration", number: "40003000018", country: "lv" });
    expect(result.hits[0]).toMatchObject({ asOf: "2026-11-20", listingDate: "2026-03-01" });
  });

  it("bare-number-is-possible-match", () => {
    const db = testStore([BAKERY], [{ list: "ofac", sourceId: "us-ofac-sdn", id: "90000005", names: ["Mock Harbor Works"], identifiers: [{ type: "registration", number: "10000031" }] }]);
    expect(statuses(db, BAKERY.eid)).toEqual([["us-ofac-sdn", "possible_match", "bare_number"]]);
  });

  it("lei-listed", () => {
    const db = testStore([EXAMPLE], [{ list: "ofac", sourceId: "us-ofac-sdn", id: "90000002", names: ["Sample Web Traders"], lei: "FX000000000000000044" }]);
    expect(statuses(db, EXAMPLE.eid)).toEqual([["us-ofac-sdn", "listed", "lei"]]);
  });

  it("lv-fid-code-listed", () => {
    const db = testStore([PLACEHOLDER], [], [{ companyEid: PLACEHOLDER.eid, date: "2026-03-05" }]);
    const result = screenCompany(db, PLACEHOLDER.eid)!;
    expect(result.hits.map((h) => [h.sourceId, h.status, h.basis, h.listingDate])).toEqual([["lv-fid-frozen", "listed", "frozen_assets", "2026-03-05"]]);
  });

  it("esma-lei-listed", () => {
    const db = testStore([ENERGY], [{ list: "esma", sourceId: "esma-ncasp", itemId: "S11.ALL.03", id: "FX000000000000000723", names: ["Unrelated Exchange Name"], lei: "FX000000000000000723" }]);
    expect(statuses(db, ENERGY.eid)).toEqual([["esma-ncasp", "listed", "lei"]]);
  });

  it("name-exact-possible-match", () => {
    const db = testStore([BAKERY], [{ list: "uk", sourceId: "uk-sanctions-list", id: "FX0009", names: ["SAMPLE BAKERY 2"] }]);
    const result = screenCompany(db, BAKERY.eid)!;
    expect(result.hits.map((h) => [h.status, h.basis, h.matchedName])).toEqual([["possible_match", "name_exact", "SAMPLE BAKERY 2"]]);
  });

  it("name-fuzzy-090", () => {
    const db = testStore([HOLDING], [
      { list: "uk", sourceId: "uk-sanctions-list", id: "FX0010", names: ["Abelu Holdings 21"] },
      { list: "uk", sourceId: "uk-sanctions-list", id: "FX0011", names: ["Abelu Trading 21"] },
    ]);
    expect(statuses(db, HOLDING.eid)).toEqual([["uk-sanctions-list", "possible_match", "name_fuzzy"]]);
  });

  it("weak-alias-alone-no-match", () => {
    const db = testStore([BAKERY], [{ list: "ofac", sourceId: "us-ofac-sdn", id: "90000007", names: ["Wholly Different Works"], weak: ["Sample Bakery 2"] }]);
    expect(screenCompany(db, BAKERY.eid)!.hits).toEqual([]);
  });

  it("ruled-out-by-own-country-id", () => {
    const db = testStore([EXAMPLE], [{ list: "eu", sourceId: "eu-fsf", id: "900010", names: ["Example Company 1"], identifiers: [{ type: "registration", number: "40003999999", country: "lv" }] }]);
    const hit = screenCompany(db, EXAMPLE.eid)!.hits[0]!;
    expect([hit.status, hit.basis]).toEqual(["ruled_out", "name_exact"]);
    expect(hit.ruledOutBy).toEqual({ type: "registration", number: "40003999999", country: "lv" });
  });

  it("address-country-never-rules-out", () => {
    // A registration number of another country, and a different address country, rule nothing out.
    const db = testStore([EXAMPLE], [{ list: "eu", sourceId: "eu-fsf", id: "900011", names: ["Example Company 1"], identifiers: [{ type: "registration", number: "77001", country: "ae" }] }]);
    expect(statuses(db, EXAMPLE.eid)).toEqual([["eu-fsf", "possible_match", "name_exact"]]);
  });

  it("officer-possible-match-only", () => {
    const db = testStore([ENERGY], []);
    addOfficers(db, ENERGY.eid, ["Officer Golf 600", "Officer Juliet 326"]);
    const purposed = purposeContext("compliance_screening");
    holdAll([{ list: "eu-fsf", entryId: "900004", names: ["Officer Golf 600"], listDate: "2026-03-01" }]);
    const result = screenCompany(db, ENERGY.eid, { purposed })!;
    expect(result.officers).toEqual({
      status: "screened",
      lists: checkedAll,
      matches: [{ list: "eu-fsf", entryId: "900004", listDate: "2026-03-01", status: "possible_match", signal: "officer_sanctions_possible_match" }],
    });
    expect(result.hits).toEqual([]);
    expect(screenCompany(db, ENERGY.eid)!.officers).toBeNull();
  });

  it("officers-never-clean-while-a-list-is-not-loaded (cto, qa, legal on S06)", () => {
    const db = testStore([ENERGY], []);
    addOfficers(db, ENERGY.eid, ["Officer Golf 600"]);
    const purposed = purposeContext("compliance_screening");
    // Nothing held: not checked, every list named.
    const none = screenCompany(db, ENERGY.eid, { purposed })!.officers;
    expect(none).toEqual({ status: "not_checked", lists: PERSON_LISTS.map((sourceId) => ({ sourceId, state: "not_checked", reason: "index_not_loaded" })), matches: [] });
    // Only the EU list held: still not checked, naming the OFAC and UK lists.
    setPersonList("eu-fsf", { asOf: "2026-11-20", loadedAt: "", entries: [] });
    const partial = screenCompany(db, ENERGY.eid, { purposed })!.officers;
    expect(partial?.status).toBe("not_checked");
    const missing = partial && "lists" in partial ? partial.lists.filter((l) => l.state === "not_checked").map((l) => l.sourceId) : [];
    expect(missing).toEqual(["us-ofac-sdn", "us-ofac-cons", "uk-sanctions-list"]);
    // All held: screened, each list with its as-of date.
    holdAll();
    expect(screenCompany(db, ENERGY.eid, { purposed })!.officers).toEqual({ status: "screened", lists: checkedAll, matches: [] });
  });

  it("officers-only-behind-the-purpose-gate", () => {
    const db = testStore([ENERGY], []);
    addOfficers(db, ENERGY.eid, ["Officer Golf 600"]);
    setPersonList("eu-fsf", { asOf: "2026-11-20", loadedAt: "", entries: [{ list: "eu-fsf", entryId: "900004", names: ["Officer Golf 600"], program: null, listDate: null, birthYear: null, nationalities: [] }] });
    // No purpose, a blocked purpose or an expired session: the gate asks, and nothing is matched.
    expect(screenCompany(db, ENERGY.eid, { purposed: purposeContext(null) })!.officers).toEqual({ status: "needs_purpose" });
    expect(screenCompany(db, ENERGY.eid, { purposed: purposeContext("compliance_screening", "2026-11-23T10:00:00.000Z") })!.officers).toEqual({ status: "needs_purpose" });
    expect(() => screenCompany(db, ENERGY.eid, { purposed: purposeContext("credit_decision") })).toThrow();
    // A purposed read is logged for this company, with the purpose in force.
    screenCompany(db, ENERGY.eid, { purposed: purposeContext("supplier_check") });
    expect(db.prepare("SELECT company_eid, section, purpose_id FROM user.purpose_log").all()).toEqual([{ company_eid: ENERGY.eid, section: "S11", purpose_id: "supplier_check" }]);
  });

  it("sole-trader-no-level", () => {
    const db = testStore([TRADER], [{ list: "eu", sourceId: "eu-fsf", id: "900012", names: ["Sample Trader 500"], identifiers: [{ type: "registration", number: "50003001104", country: "lv" }] }]);
    const purposed = purposeContext("counterparty_check");
    expect(screenCompany(db, TRADER.eid, { purposed })!.ownName?.status).toBe("not_checked");
    holdAll([{ list: "eu-fsf", entryId: "900013", names: ["Sample Trader 500"] }]);
    const result = screenCompany(db, TRADER.eid, { purposed })!;
    expect(result.naturalPerson).toBe(true);
    expect(result.hits).toEqual([]);
    expect(result.ownName).toEqual({ status: "screened", lists: checkedAll, matches: [{ list: "eu-fsf", entryId: "900013", listDate: null, status: "possible_match" }] });
    expect(screenCompany(db, TRADER.eid, { purposed: purposeContext(null) })!.ownName).toEqual({ status: "needs_purpose" });
    expect(screenCompany(db, TRADER.eid)!.ownName).toBeNull();
  });

  it("mcp-name-only-no-persons", () => {
    const db = testStore([], [{ list: "eu", sourceId: "eu-fsf", id: "900001", names: ["Example Company 1"], identifiers: [{ type: "registration", number: "40003000018", country: "lv" }] }]);
    setPersonList("eu-fsf", { asOf: "2026-11-20", loadedAt: "", entries: [{ list: "eu-fsf", entryId: "900003", names: ["Example Company 1"], program: null, listDate: null, birthYear: null, nationalities: [] }] });
    const { hits, listsNotChecked } = screenName(db, "example company 1");
    expect(hits.map((h) => [h.entryEid, h.status])).toEqual([["sanc-eu-900001", "possible_match"]]);
    expect(hits[0]!.identifiers).toEqual([{ type: "registration", number: "40003000018", country: "lv" }]);
    // The other stored lists never synced here: named as not checked, never a clean answer.
    expect(listsNotChecked).toEqual(["us-ofac-sdn", "us-ofac-cons", "uk-sanctions-list", "esma-ncasp", "lv-fid-frozen"]);
    expect(screenName(db, "Nobody Listed Here").hits).toEqual([]);
  });

  it("never screens a list entry or a person row as a company", () => {
    const db = testStore([], [{ list: "eu", sourceId: "eu-fsf", id: "900001", names: ["Example Company 1"] }]);
    expect(screenCompany(db, "sanc-eu-900001")).toBeNull();
    expect(screenCompany(db, "lv-00000000000")).toBeNull();
  });
});
