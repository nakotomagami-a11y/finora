import type { ParsedEntity, ParsedRecord, PartyRef } from "@finora/sources";
import { describe, expect, it } from "vitest";
import { applyGates, partyProven } from "./gates.ts";
import { companyRecord, fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, sync } from "./test-helpers.ts";

// The LV and EE member files (lv-people.md, ee-people.md): every type value the registers use.
const COMPANY_TYPES = ["LEGAL_ENTITY", "FOREIGN_ENTITY", "J"];

const member = (n: number, party: Partial<PartyRef>): PartyRef => {
  const eid = `org-${String(n).padStart(20, "0")}`;
  const entities: ParsedEntity[] = [
    { eid, schema: "Company", country: "lv", statements: [{ prop: "name", value: `Member Holding ${n}`, itemId: "S04.LV.01" }] },
    {
      eid: `rel-9${n}-0`,
      schema: "Ownership",
      country: "lv",
      statements: [
        { prop: "asset", value: "lv-00000000001", itemId: "S04.LV.01" },
        { prop: "owner", value: eid, itemId: "S04.LV.01" },
      ],
    },
  ];
  return { entities, ...party };
};

const membersRecord = (parties: PartyRef[]): ParsedRecord => ({ recordKey: "lv-00000000001:members", hashInput: [JSON.stringify(parties)], entities: [], parties });

describe("the proven-company party gate (council final round; LAW-LLC-MEMBERS interim)", () => {
  it("loads a party the register types as a company, one case per type value", () => {
    const lookup = () => null;
    for (const type of COMPANY_TYPES) expect(partyProven(member(1, { type }), COMPANY_TYPES, lookup), type).toBe(true);
    for (const type of ["JOINT_OWNERS", "NATURAL_PERSON", "F", "", null]) expect(partyProven(member(1, { type }), COMPANY_TYPES, lookup), String(type)).toBe(false);
  });

  it("loads a party whose code resolves to a company, never to a sole trader or to nothing", () => {
    const lookup = (_c: string, code: string) => (code === "1" ? { naturalPerson: false } : code === "2" ? { naturalPerson: true } : null);
    expect(partyProven(member(1, { code: { country: "lv", value: "1" } }), COMPANY_TYPES, lookup)).toBe(true);
    expect(partyProven(member(1, { code: { country: "lv", value: "2" } }), COMPANY_TYPES, lookup)).toBe(false);
    expect(partyProven(member(1, { code: { country: "lv", value: "3" } }), COMPANY_TYPES, lookup)).toBe(false);
  });

  it("in a sync, loads proven members only and counts the rest by reason", async () => {
    const db = memoryDb();
    const register = fakeSource({ id: "lv-register" }, { records: [companyRecord(1), companyRecord(2), companyRecord(3, { legalForm: "lv-ik" })] });
    await sync(db, register);

    const members = fakeSource({ id: "lv-members", items: ["S04.LV.01"] }, {
      records: [
        membersRecord([
          member(1, { type: "LEGAL_ENTITY" }),
          member(2, { type: "JOINT_OWNERS" }),
          member(3, { code: { country: "lv", value: "00000000002" } }),
          member(4, { code: { country: "lv", value: "00000000003" } }),
          member(5, {}),
        ]),
      ],
    });
    const outcome = await sync(db, members, { companyPartyTypes: COMPANY_TYPES });
    expect(outcome.report?.dropped).toEqual({ party_not_proven: 3 });
    const owners = (db.prepare("SELECT value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE p.name = 'owner' ORDER BY value").all() as { value: string }[]).map((r) => r.value);
    expect(owners).toEqual([`org-${"1".padStart(20, "0")}`, `org-${"3".padStart(20, "0")}`]);
    expect(count(db, "SELECT COUNT(*) AS n FROM main.statements WHERE value LIKE 'Member Holding 2%' OR value LIKE 'Member Holding 4%' OR value LIKE 'Member Holding 5%'")).toBe(0);
  });
});

// data-baltics' N4 contract on S05 (cf3e83a), reviewed by the architect: `needs` and the hash.
describe("a party that needs another (PartyRef.needs)", () => {
  const subject = (value: string): PartyRef => ({ code: { country: "lv", value }, entities: [] });
  const named = (n: number, needs: number): PartyRef => ({ type: "FOREIGN_ENTITY", needs, entities: [{ eid: `org-${String(n).padStart(20, "0")}`, schema: "Organization", country: "intl", statements: [{ prop: "name", value: `Needs Holding ${n}`, itemId: "S04.LV.01" }] }] });
  const lookup = (_c: string, code: string) => (code === "1" ? { naturalPerson: false } : null);
  const loaded = (parties: PartyRef[]) => applyGates(membersRecord(parties), { companyPartyTypes: COMPANY_TYPES, lookup }).entities.map((e) => e.eid);

  it("loads only beside the party it needs; the control loads", () => {
    expect(loaded([subject("1"), named(1, 0)])).toEqual([`org-${"1".padStart(20, "0")}`]);
    expect(loaded([subject("9"), named(1, 0)])).toEqual([]);
  });

  it("follows a chain, and fails closed on its own or a later index", () => {
    expect(loaded([subject("9"), named(1, 0), named(2, 1)])).toEqual([]);
    expect(loaded([subject("1"), named(1, 0), named(2, 1)])).toHaveLength(2);
    expect(loaded([named(1, 0)])).toEqual([]);
    expect(loaded([named(1, 1), subject("1")])).toEqual([]);
  });

  it("an unproven party's name is masked in the record hash: a change to it alone writes nothing (control: proven, it is written)", async () => {
    const run = async (code: string) => {
      const db = memoryDb();
      await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
      const links = fakeSource({ id: "lv-links", items: ["S04.LV.01"] }, { records: [] });
      const record = (name: string): ParsedRecord => ({ ...membersRecord([subject(code), { ...named(1, 0), entities: [{ ...named(1, 0).entities[0]!, statements: [{ prop: "name", value: name, itemId: "S04.LV.01" }] }] }]), hashInput: ["link", name] });
      links.state.records = [record("Needs Holding A")];
      await sync(db, links, { companyPartyTypes: COMPANY_TYPES });
      links.state.records = [record("Needs Holding B")];
      links.state.asOf = { in_file_field: "2026-11-02" };
      return (await sync(db, links, { companyPartyTypes: COMPANY_TYPES })).report;
    };
    expect((await run("99999999999"))?.unchanged).toBe(1);
    expect((await run("00000000001"))?.written).toBe(1);
  });

  it("each refused value has its own marker: a proven value going from 12 to 21 is written though 1 and 2 are refused (qa, coordinator)", async () => {
    const db = memoryDb();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
    const short = (n: number, value: string): PartyRef => ({ type: "JOINT_OWNERS", entities: [{ eid: `org-${String(n).padStart(20, "0")}`, schema: "Organization", country: "intl", statements: [{ prop: "name", value, itemId: "S04.LV.01" }] }] });
    const record = (shares: string): ParsedRecord => ({ ...membersRecord([subject("00000000001"), short(1, "1"), short(2, "2")]), hashInput: ["shares", shares] });
    const links = fakeSource({ id: "lv-links", items: ["S04.LV.01"] }, { records: [record("12")] });
    await sync(db, links, { companyPartyTypes: COMPANY_TYPES });
    links.state.records = [record("21")];
    links.state.asOf = { in_file_field: "2026-11-02" };
    expect((await sync(db, links, { companyPartyTypes: COMPANY_TYPES })).report?.written).toBe(1);
  });

  it("only names are masked: a change to an unproven party's code still changes the hash (legal scope)", () => {
    const party = (code: string): PartyRef => ({ type: "JOINT_OWNERS", entities: [{ eid: "org-00000000000000000009", schema: "Organization", country: "intl", statements: [{ prop: "name", value: "Scope Holding", itemId: "S04.LV.01" }, { prop: "alias", value: "Scope Alias", itemId: "S04.LV.01" }, { prop: "registrationNumber", value: code, itemId: "S04.LV.01" }] }] });
    const refused = applyGates(membersRecord([subject("00000000001"), party("777")]), { companyPartyTypes: COMPANY_TYPES, lookup }).refused;
    expect(refused).toEqual(expect.arrayContaining(["Scope Holding", "Scope Alias"]));
    expect(refused).not.toContain("777");
  });

  it("a quoted name inside a JSON hash element is masked too: a change to it alone writes nothing (legal: any name in a member line)", async () => {
    const run = async (proven: boolean) => {
      const db = memoryDb();
      await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
      const holder = (name: string): PartyRef => ({ type: proven ? "LEGAL_ENTITY" : "JOINT_OWNERS", entities: [{ eid: "org-00000000000000000007", schema: "Organization", country: "intl", statements: [{ prop: "name", value: name, itemId: "S04.LV.01" }] }] });
      const record = (name: string): ParsedRecord => ({ ...membersRecord([subject("00000000001"), holder(name)]), hashInput: [JSON.stringify(["", "JOINT_OWNERS", "", name, "10"])] });
      const links = fakeSource({ id: "lv-links", items: ["S04.LV.01"] }, { records: [record('SIA "Quoted Holding A"')] });
      await sync(db, links, { companyPartyTypes: COMPANY_TYPES });
      links.state.records = [record('SIA "Quoted Holding B"')];
      links.state.asOf = { in_file_field: "2026-11-02" };
      return (await sync(db, links, { companyPartyTypes: COMPANY_TYPES })).report;
    };
    expect((await run(false))?.unchanged).toBe(1);
    expect((await run(true))?.written).toBe(1);
  });

  it("markers follow the gate's order, not sort order: renaming one refused name past another writes nothing (G2)", async () => {
    const db = memoryDb();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
    const unproven = (n: number, name: string): PartyRef => ({ type: "JOINT_OWNERS", entities: [{ eid: `org-${String(n).padStart(20, "0")}`, schema: "Organization", country: "intl", statements: [{ prop: "name", value: name, itemId: "S04.LV.01" }] }] });
    const record = (first: string): ParsedRecord => ({ ...membersRecord([subject("00000000001"), unproven(1, first), unproven(2, "Mid Holding")]), hashInput: ["link", first, "Mid Holding"] });
    const links = fakeSource({ id: "lv-links", items: ["S04.LV.01"] }, { records: [record("Beta Holding")] });
    await sync(db, links, { companyPartyTypes: COMPANY_TYPES });
    links.state.records = [record("Zeta Holding")];
    links.state.asOf = { in_file_field: "2026-11-02" };
    expect((await sync(db, links, { companyPartyTypes: COMPANY_TYPES })).report?.unchanged).toBe(1);
  });

  it("G4: an unproven FOREIGN_ENTITY holder's quoted name, changed alone, leaves the hash as it was", async () => {
    const db = memoryDb();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
    const foreign = (name: string): PartyRef => ({ type: "FOREIGN_ENTITY", needs: 0, entities: [{ eid: "org-00000000000000000098", schema: "Organization", country: "intl", statements: [{ prop: "name", value: name, itemId: "S04.LV.01" }] }] });
    const record = (name: string): ParsedRecord => ({ ...membersRecord([subject("00000000001"), foreign(name)]), hashInput: [JSON.stringify(["link", "FOREIGN_ENTITY", name])] });
    // No company types configured, as under role_counts with no proof: the holder is unproven.
    const links = fakeSource({ id: "lv-links", items: ["S04.LV.01"] }, { records: [record('Sample "Quoted" Trading A')] });
    await sync(db, links);
    links.state.records = [record('Sample "Quoted" Trading B')];
    links.state.asOf = { in_file_field: "2026-11-02" };
    expect((await sync(db, links)).report?.unchanged).toBe(1);
  });

  it("a renamed duplicate moves no other value's marker (qa NIT on a866354)", async () => {
    const db = memoryDb();
    await sync(db, fakeSource({ id: "lv-register" }, { records: [companyRecord(1)] }));
    const unproven = (n: number, name: string): PartyRef => ({ type: "JOINT_OWNERS", entities: [{ eid: `org-${String(n).padStart(20, "0")}`, schema: "Organization", country: "intl", statements: [{ prop: "name", value: name, itemId: "S04.LV.01" }] }] });
    // Only the third name is in the hash input: its marker is all the hash can follow.
    const record = (second: string): ParsedRecord => ({ ...membersRecord([subject("00000000001"), unproven(1, "Same Holding"), unproven(2, second), unproven(3, "Other Holding")]), hashInput: ["link", "Other Holding"] });
    const links = fakeSource({ id: "lv-links", items: ["S04.LV.01"] }, { records: [record("Same Holding")] });
    await sync(db, links, { companyPartyTypes: COMPANY_TYPES });
    links.state.records = [record("Renamed Holding")];
    links.state.asOf = { in_file_field: "2026-11-02" };
    expect((await sync(db, links, { companyPartyTypes: COMPANY_TYPES })).report?.unchanged).toBe(1);
  });
});
