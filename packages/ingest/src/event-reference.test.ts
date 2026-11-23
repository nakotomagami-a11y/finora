// S05: a company id in event data (the other side of an LV reorganisation) is a reference under
// ruling 4 (qa 7070488242, legal 7070480407): an LV register code that happens to fit the EE/LT
// personal-code check is kept when the store holds that company; every other shape is refused,
// counted, or scanned like any other text. The recovery case is in `s05-review.test.ts`.
import { idIsPersonalCode, isBalticPersonalCode, isFixtureRegisterCode, isValidRegisterCode } from "@finora/domain";
import { describe, expect, it } from "vitest";
import { applyGates } from "./gates.ts";

function first(prefix: string, test: (code: string) => boolean): string {
  for (let i = 0; i < 1_000_000; i++) {
    const code = `${prefix}${String(i).padStart(11 - prefix.length, "0")}`;
    if (test(code)) return code;
  }
  throw new Error(`no code for ${prefix}`);
}
const fixture = (code: string) => isFixtureRegisterCode("lv", code);
const registerDigit = (code: string) => fixture(code) || isValidRegisterCode("lv", code);

/** The 688 case: a fixture-shaped LV code that also passes the EE/LT personal-code check. */
const OVERLAP = first("40003", (c) => fixture(c) && isBalticPersonalCode(c) && !idIsPersonalCode("lv", c));
/** LV personal-code shapes (a real DDMMYY date, the 32 prefix) that still pass a register check digit. */
const DATE_SHAPED = first("010190", registerDigit);
const PREFIX_32 = first("32", registerDigit);
/** An EE personal code dressed as an LV eid: no LV check digit. */
const EE_PERSON = first("3900101", (c) => isBalticPersonalCode(c) && !registerDigit(c));
/** A bad check digit that fits no personal-code shape. */
const BAD_DIGIT = first("40003", (c) => !registerDigit(c) && !isBalticPersonalCode(c) && !idIsPersonalCode("lv", c));

const gate = (other: string, known: readonly string[] = []) => {
  const result = applyGates(
    { recordKey: "r1", hashInput: [], entities: [], events: [{ entityEid: "lv-40003000022", type: "register.reorganisation", date: "2026-01-01", itemId: "S02.LV.01", data: { other } }] },
    { companyPartyTypes: [], lookup: () => ({ naturalPerson: false }), knownCompany: (eid) => known.includes(eid) },
  );
  return { data: result.events[0]?.data, drops: result.drops.map((d) => d.reason) };
};

describe("entity ids in event data (S05 ruling 4)", () => {
  it("keeps a company id the store holds, even when its digits fit the EE/LT personal-code check", () => {
    const value = `lv-${OVERLAP}`;
    expect(gate(value, [value])).toEqual({ data: { other: value }, drops: [] });
  });

  it("refuses and counts the same id while the store does not hold it", () => {
    expect(gate(`lv-${OVERLAP}`)).toEqual({ data: {}, drops: ["reference_unresolved"] });
  });

  it("refuses an LV personal-code shape even with a register check digit, held or not", () => {
    for (const code of [DATE_SHAPED, PREFIX_32]) {
      const value = `lv-${code}`;
      expect(gate(value, [value]).data, code.slice(0, 2)).toEqual({});
    }
  });

  it("refuses an EE personal code dressed as an lv- id, and a bad check digit, held or not", () => {
    for (const code of [EE_PERSON, BAD_DIGIT]) {
      const value = `lv-${code}`;
      expect(gate(value, [value]).data).toEqual({});
    }
    expect(gate(`lv-${BAD_DIGIT}`, [`lv-${BAD_DIGIT}`]).drops).toEqual(["invalid_code"]);
  });

  it("scans an lv- token inside free text, and a bare code, as before", () => {
    const value = `lv-${OVERLAP}`;
    expect(gate(`merged into ${value}`, [value])).toEqual({ data: {}, drops: ["personal_code"] });
    expect(gate(`merged into ${OVERLAP}`, [value])).toEqual({ data: {}, drops: ["personal_code"] });
  });
});
