// S05: a company id in event data (the other side of an LV reorganisation) that the store holds is a
// reference, not free text, so an LV register code that happens to fit the EE/LT personal-code check
// is kept; an id the store does not hold is scanned like any other text.
import { idIsPersonalCode, isBalticPersonalCode, isFixtureRegisterCode } from "@finora/domain";
import { describe, expect, it } from "vitest";
import { applyGates } from "./gates.ts";

/** The first fixture-shaped LV code that also passes the EE/LT personal-code check. */
function overlapCode(): string {
  for (let i = 0; ; i++) {
    const code = `40003${String(i).padStart(6, "0")}`;
    if (isFixtureRegisterCode("lv", code) && isBalticPersonalCode(code) && !idIsPersonalCode("lv", code)) return code;
  }
}

const gate = (other: string, known: readonly string[] = []) =>
  applyGates(
    { recordKey: "r1", hashInput: [], entities: [], events: [{ entityEid: "lv-40003000022", type: "register.reorganisation", date: "2026-01-01", itemId: "S02.LV.01", data: { other } }] },
    { companyPartyTypes: [], lookup: () => ({ naturalPerson: false }), knownCompany: (eid) => known.includes(eid) },
  );

describe("entity ids in event data", () => {
  it("keeps a company id the store holds, even when its digits fit the EE/LT personal-code check", () => {
    const value = `lv-${overlapCode()}`;
    expect(gate(value, [value]).events[0]?.data).toEqual({ other: value });
  });

  it("scans an id the store does not hold, and free text with a code", () => {
    expect(gate(`lv-${overlapCode()}`).events[0]?.data).toEqual({});
    expect(gate(`merged into ${overlapCode()}`).events[0]?.data).toEqual({});
  });
});
