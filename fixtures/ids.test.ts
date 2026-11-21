import { eidKind, isFixtureLei, isFixtureRegisterCode, isValidLei, isValidRegisterCode } from "@finora/domain";
import { describe, expect, it } from "vitest";
import { generateWorld } from "./src/world.ts";

const world = generateWorld();

describe("every fixture id follows its fixture rule (§3.4, qa #9)", () => {
  it("LV, EE and LT codes carry (true check digit + 1) mod 10, so no register can have issued them", () => {
    for (const c of world.companies.filter((c) => c.country !== "us")) {
      const country = c.country as "lv" | "ee" | "lt";
      expect(isValidRegisterCode(country, c.code), c.eid).toBe(false);
      expect(isFixtureRegisterCode(country, c.code), c.eid).toBe(true);
      expect(c.eid).toBe(`${country}-${c.code}`);
      expect(eidKind(c.eid), c.eid).toBe(country);
    }
  });

  it("LV codes use the fixture prefixes", () => {
    for (const c of world.companies.filter((c) => c.country === "lv")) expect(c.code).toMatch(/^(40003|40103|40203|50003|90000)\d{6}$/);
  });

  it("SEC filers sit in the reserved CIK range 99xxxxxxxx", () => {
    for (const c of world.companies.filter((c) => c.country === "us")) {
      expect(c.eid).toMatch(/^us-cik-99\d{8}$/);
      expect(eidKind(c.eid)).toBe("sec");
    }
  });

  it("US state records carry the FX prefix", () => {
    for (const r of world.stateRecords) {
      expect(r.eid).toMatch(/^us-(ny|co|ct|pa)-FX\d{4}$/);
      expect(eidKind(r.eid)).toBe("usState");
    }
  });

  it("fixture LEIs fail mod 97 by design", () => {
    const leis = world.companies.map((c) => c.lei).filter((l): l is string => l !== null);
    expect(leis.length).toBeGreaterThan(10);
    for (const lei of leis) {
      expect(isValidLei(lei), lei).toBe(false);
      expect(isFixtureLei(lei), lei).toBe(true);
    }
  });

  it("fixture tickers are ZZFX01 to ZZFX13, which no real listing can be", () => {
    const tickers = world.companies.map((c) => c.ticker).filter((t): t is string => t !== null);
    expect(tickers).toEqual(Array.from({ length: 13 }, (_, i) => `ZZFX${String(i + 1).padStart(2, "0")}`));
  });

  it("the refused sole-trader id has the LV personal-code shape but fails its checksum, so it is nobody's code", () => {
    const refused = world.companies.filter((c) => c.registrationNumber !== c.code);
    expect(refused).toHaveLength(1);
    const v = refused[0]!.registrationNumber;
    expect(v).toMatch(/^\d{11}$/);
    const weights = [1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const check = (1101 - weights.reduce((sum, w, i) => sum + w * Number(v[i]), 0)) % 11;
    expect(check).not.toBe(Number(v[10]));
  });

  it("role-row ids are row-local numbers, never code-shaped", () => {
    for (const r of world.roleSets) for (const l of r.lines) expect(l.rowId).toMatch(/^\d{4}$/);
  });

  it("the check digits themselves agree with the specs (a valid code built from the same body passes)", () => {
    const lv = world.companies.find((c) => c.country === "lv")!.code;
    const body = lv.slice(0, -1);
    const valid = Array.from({ length: 10 }, (_, d) => `${body}${d}`).filter((code) => isValidRegisterCode("lv", code));
    expect(valid).toHaveLength(1);
    expect(isFixtureRegisterCode("lv", valid[0]!)).toBe(false);
  });
});
