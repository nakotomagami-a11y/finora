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
});
