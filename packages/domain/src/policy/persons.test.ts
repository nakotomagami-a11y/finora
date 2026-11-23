import { describe, expect, it } from "vitest";
import { LEGAL_FORMS } from "../config/legal-forms.ts";
import { isNaturalPerson, naturalPersonCaption } from "./persons.ts";

describe("legal rule 5: sole traders are natural persons", () => {
  it("marks the sole-trader form of every country, and only those", () => {
    const natural = LEGAL_FORMS.filter((f) => f.naturalPerson).map((f) => f.code);
    expect(natural.sort()).toEqual(["ee-fie", "lt-ii", "lv-gim", "lv-ik", "lv-ind", "lv-zem", "lv-zvj", "us-sole"]);
    for (const code of natural) expect(isNaturalPerson({ schema: "Company", legalForm: code })).toBe(true);
  });

  it("treats a company form as a company and a Person as a person", () => {
    expect(isNaturalPerson({ schema: "Company", legalForm: "lv-sia" })).toBe(false);
    expect(isNaturalPerson({ schema: "Person", legalForm: null })).toBe(true);
  });

  it("over-protects an unknown legal form", () => {
    expect(isNaturalPerson({ schema: "Company", legalForm: "lv-unknown" })).toBe(true);
  });

  it("titles a natural person by legal form and code, never by name (L3)", () => {
    expect(naturalPersonCaption({ legalForm: "lv-ik", code: "TEST-0001" })).toBe("IK TEST-0001");
  });
});
