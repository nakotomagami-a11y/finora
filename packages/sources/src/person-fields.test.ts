import { balticCheckDigit } from "@finora/domain";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { personFieldProblems } from "./person-fields.ts";
import type { ParsedRecord } from "./types.ts";

const code = () => {
  const first10 = ["3000", "1010", "00"].join("");
  return `${first10}${balticCheckDigit(first10)}`;
};
const roleSet = (overrides: Partial<ParsedRecord> = {}): ParsedRecord => ({
  recordKey: "lv-00000000001:officers",
  hashInput: ["Officer Alpha|board_member|2019-03-01"],
  entities: [{ eid: "p-1-0", schema: "Person", country: "lv", statements: [{ prop: "name", value: "Officer Alpha", itemId: "S03.LV.01" }] }],
  lineIds: ["4711"],
  ...overrides,
});

describe("PS6: no person identifier is a key, a hash input or a stored value", () => {
  it("passes a role set keyed on the company with row-local line ids", () => {
    expect(personFieldProblems(roleSet())).toEqual([]);
  });

  it("refuses a personal code in a record key, a hash input or a line id", () => {
    expect(personFieldProblems(roleSet({ recordKey: `lv-00000000001:${code()}` })).join()).toMatch(/personal-code pattern/);
    expect(personFieldProblems(roleSet({ hashInput: [`Officer Alpha|${code()}`] })).join()).toMatch(/personal-code pattern/);
    expect(personFieldProblems(roleSet({ lineIds: [["010190", "12345"].join("-")] })).join()).toMatch(/personal-code pattern/);
  });

  it("refuses an accession number whose prefix is not the issuer's CIK", () => {
    const filing = ["0001999999", "26", "000001"].join("-");
    expect(personFieldProblems(roleSet({ recordKey: `issuer:${filing}` }), { issuerCiks: ["0009900000"] }).join()).toMatch(/accession/);
    expect(personFieldProblems(roleSet({ recordKey: `issuer:${filing}` }), { issuerCiks: ["0001999999"] })).toEqual([]);
  });

  it("refuses an id property on a person", () => {
    const record = roleSet();
    record.entities[0]?.statements.push({ prop: "idNumber", value: "x", itemId: "S03.LV.01" });
    expect(personFieldProblems(record).join()).toMatch(/must drop it as personal_code/);
  });

  it("computes no HMAC and keeps no person key anywhere in sources (LAW-PSEUDONYM interim)", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
      });
    for (const file of walk(new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/createHmac|person_key|personKey/);
    }
  });
});
