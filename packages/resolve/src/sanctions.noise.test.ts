// sanctions.md §7: 2,000 generated fictional company names with no list overlap give no `listed`
// and fewer than 1% `possible_match` against a list of the same shape.
import { describe, expect, it } from "vitest";
import { screenCompany } from "./sanctions.ts";
import { testStore, type TestCompany, type TestEntry } from "./test-store.ts";

const FIRST = ["Amber", "Birch", "Cedar", "Delta", "Ember", "Fjord", "Granite", "Harbor", "Iris", "Juniper"];
const SECOND = ["Bakery", "Logistics", "Timber", "Works", "Foods", "Energy", "Systems", "Textiles", "Studio", "Garden"];
const LIST_FIRST = ["Northwind", "Ironclad", "Blackstone", "Redfield", "Crescent"];
const LIST_SECOND = ["Petroleum", "Armaments", "Shipping", "Metals", "Aviation"];

describe("screening noise", () => {
  it("gives no listed and under 1% possible matches on names with no list overlap", () => {
    const companies: TestCompany[] = [];
    for (let i = 0; i < 2000; i++) {
      const code = `4${String(i).padStart(10, "0")}`;
      companies.push({ eid: `lv-${code}`, country: "lv", code, name: `${FIRST[i % 10]} ${SECOND[Math.floor(i / 10) % 10]} ${i} SIA`, legalForm: "lv-sia" });
    }
    const entries: TestEntry[] = [];
    for (let i = 0; i < 200; i++) {
      entries.push({
        list: "eu",
        sourceId: "eu-fsf",
        id: String(900100 + i),
        names: [`${LIST_FIRST[i % 5]} ${LIST_SECOND[Math.floor(i / 5) % 5]} ${i + 5000}`],
        identifiers: [{ type: "registration", number: `9${String(i).padStart(7, "0")}`, country: "ru" }],
      });
    }
    const db = testStore(companies, entries);
    let possible = 0;
    for (const c of companies) {
      const hits = screenCompany(db, c.eid)!.hits;
      expect(hits.some((h) => h.status === "listed"), c.name).toBe(false);
      if (hits.some((h) => h.status === "possible_match")) possible++;
    }
    expect(possible / companies.length).toBeLessThan(0.01);
  });
});
