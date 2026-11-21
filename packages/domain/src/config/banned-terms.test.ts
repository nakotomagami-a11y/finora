import { describe, expect, it } from "vitest";
import { findBannedTerms } from "./banned-terms.ts";

describe("findBannedTerms", () => {
  it.each(["Clear", "cleared by the register", "It is safe", "safely", "Avoid this", "a scam", "Fraudulent filing", "fraudster"])(
    "flags %s in English",
    (text) => {
      expect(findBannedTerms(text, "en").length).toBeGreaterThan(0);
    },
  );

  it("matches whole words only", () => {
    expect(findBannedTerms("Unclearly worded notice, clearance sale", "en")).toEqual([]);
    expect(findBannedTerms("Reset the filters", "en")).toEqual([]);
  });

  it("flags letter grades and credit-score wording", () => {
    expect(findBannedTerms("Rating: B+", "en")).toEqual([{ kind: "grade", term: "Rating: B+" }]);
    expect(findBannedTerms("Credit score unavailable", "en")).toEqual([{ kind: "score", term: "credit score" }]);
    expect(findBannedTerms("Tax authority's rating: A", "en").length).toBeGreaterThan(0);
  });

  it("matches word stems in the Baltic languages", () => {
    expect(findBannedTerms("Tai švarus verslas", "lt")).toEqual([{ kind: "stem", term: "švar" }]);
    expect(findBannedTerms("Droša izvēle", "lv")).toEqual([{ kind: "stem", term: "droš" }]);
    expect(findBannedTerms("See on puhas", "et")).toEqual([{ kind: "stem", term: "puhas" }]);
  });
});
