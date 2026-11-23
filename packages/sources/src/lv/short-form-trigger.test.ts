// The short-form re-count trigger (legal 7096149394, qa 7096154351): in `names_no_id` the officers
// parse counts, over natural-person names it reads anyway, the ones the short-form rule would admit
// and the ones in capitals. Numbers only. In role_counts no name is read, so no check runs.
import { describe, expect, it } from "vitest";
import type { ParseCheck, RawArtifact } from "../types.ts";
import { lvMembersCsv, lvOfficersCsv } from "./lv-people/fixture.ts";
import { lvUrMembersLoader, lvUrOfficersLoader, shortFormRuleTrips } from "./lv-people/lv-people.ts";

const art = (name: string, bytes: Uint8Array): RawArtifact => ({ name, bytes, fetchedAt: "2026-11-21T00:00:00Z" });

async function checksOf(personRows: "names_no_id" | "role_counts", names: string[]): Promise<Partial<Record<ParseCheck, number>>> {
  const checks: Partial<Record<ParseCheck, number>> = {};
  const rows = names.map((name, i) => ({ id: 8000 + i, n: 1, position: "BOARD_MEMBER", name, rights: "INDIVIDUALLY", registered: "2020-01-01" }));
  const loader = lvUrOfficersLoader({ personRows, shortForms: true });
  for await (const _ of loader.parse([art("officers.csv", lvOfficersCsv(rows))], { now: "2026-11-21T00:00:00Z", onCheck: (c) => void (checks[c] = (checks[c] ?? 0) + 1) })) {
    // records are not needed here
  }
  return checks;
}

describe("the officers parse counts person names for the re-count check", () => {
  it("counts a person name the short-form rule would admit, and one in capitals; controls count neither", async () => {
    expect(await checksOf("names_no_id", ["Test Person Planted AS", "TEST PERSON PLANTED", "Test Person Plain", "Test Person Other"])).toEqual({
      lv_person_names: 4,
      lv_person_names_short_form: 1,
      lv_person_names_capitals: 1,
    });
    expect(await checksOf("names_no_id", ["Test Person Plain", "Test Person Other"])).toEqual({ lv_person_names: 2 });
  });

  it("runs no check in role_counts, where no person name is read", async () => {
    expect(await checksOf("role_counts", ["Test Person Planted AS", "TEST PERSON PLANTED"])).toEqual({});
  });
});

describe("shortFormRuleTrips", () => {
  it("trips on any person name the rule would admit, or on more than 1% in capitals", () => {
    expect(shortFormRuleTrips({ lv_person_names: 1000, lv_person_names_short_form: 1 })).toBe(true);
    expect(shortFormRuleTrips({ lv_person_names: 1000, lv_person_names_capitals: 11 })).toBe(true);
    expect(shortFormRuleTrips({ lv_person_names: 1000, lv_person_names_capitals: 10 })).toBe(false);
    expect(shortFormRuleTrips({ lv_person_names: 282262, lv_person_names_capitals: 44 })).toBe(false);
    expect(shortFormRuleTrips({})).toBe(false);
  });
});

describe("with the short-form rule off", () => {
  it("drops a foreign holder proven only by a short form, keeps a three-letter form, and changes the parserVersion", async () => {
    const rows = lvMembersCsv([
      { id: 8101, n: 2, type: "FOREIGN_ENTITY", name: "Example Shipping AS", shares: "5", nominal: "1.00" },
      { id: 8102, n: 2, type: "FOREIGN_ENTITY", name: "Example Holding GmbH", shares: "5", nominal: "1.00" },
    ]);
    const names = async (shortForms: boolean) => {
      const out: string[] = [];
      for await (const r of lvUrMembersLoader({ shortForms }).parse([art("members.csv", rows)], { now: "2026-11-21T00:00:00Z" })) {
        for (const p of r.parties ?? []) for (const e of p.entities) for (const s of e.statements) if (s.prop === "name") out.push(s.value);
      }
      return out;
    };
    expect(await names(true)).toEqual(["Example Shipping AS", "Example Holding GmbH"]);
    expect(await names(false)).toEqual(["Example Holding GmbH"]);
    expect(lvUrMembersLoader({ shortForms: false }).parserVersion).not.toBe(lvUrMembersLoader({ shortForms: true }).parserVersion);
    expect(lvUrOfficersLoader({ personRows: "names_no_id", shortForms: false }).parserVersion).not.toBe(lvUrOfficersLoader({ personRows: "names_no_id", shortForms: true }).parserVersion);
  });
});
