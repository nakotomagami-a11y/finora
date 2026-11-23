import { describe, expect, it } from "vitest";
import { parseAll } from "../../intl/sanctions-test-helpers.ts";
import type { RawArtifact } from "../../types.ts";
import { lvBalanceSheetsCsv, lvIncomeStatementsCsv, lvStatementsCsv } from "./fixture.ts";
import { lvUrAnnualReports, readTable } from "./lv-financials.ts";

const art = (name: string, bytes: Uint8Array): RawArtifact => ({ name, bytes, fetchedAt: "2026-11-21T00:00:00Z" });

/** The same file with its data lines in another order (a fixed shuffle, so the test is repeatable). */
function shuffled(bytes: Uint8Array): Uint8Array {
  const [header, ...lines] = new TextDecoder().decode(bytes).split("\r\n").filter((l) => l !== "");
  const order = lines.map((line, i) => ({ line, key: (i * 7919) % 13 })).sort((a, b) => a.key - b.key || a.line.localeCompare(b.line));
  return new TextEncoder().encode([header, ...order.map((o) => o.line)].join("\n") + "\n");
}

const byKey = (records: { recordKey: string }[]) => new Map(records.map((r) => [r.recordKey, r]));

describe("lv-ur-annual-reports: the statement-id join", () => {
  it("gives the same records whatever the order of the three files", async () => {
    const plain = await parseAll(lvUrAnnualReports, [art("financial_statements.csv", lvStatementsCsv()), art("balance_sheets.csv", lvBalanceSheetsCsv()), art("income_statements.csv", lvIncomeStatementsCsv())]);
    const mixed = await parseAll(lvUrAnnualReports, [art("financial_statements.csv", shuffled(lvStatementsCsv())), art("balance_sheets.csv", shuffled(lvBalanceSheetsCsv())), art("income_statements.csv", shuffled(lvIncomeStatementsCsv()))]);
    const a = byKey(plain.records);
    const b = byKey(mixed.records);
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
    for (const [key, record] of a) {
      const other = b.get(key)!;
      expect({ ...other, rowRef: undefined }, key).toEqual({ ...record, rowRef: undefined });
    }
    expect(mixed.drops.sort()).toEqual(plain.drops.sort());
  });

  it("never stages a line of a statement outside the selection", async () => {
    // The balance file holds a stray line of an unselected statement whose every value is "x":
    // reading it would count a conflicting line or a bad amount.
    const { drops, records } = await parseAll(lvUrAnnualReports, [art("financial_statements.csv", lvStatementsCsv()), art("balance_sheets.csv", lvBalanceSheetsCsv()), art("income_statements.csv", lvIncomeStatementsCsv())]);
    expect(drops).not.toContain("conflicting_line");
    expect(records.flatMap((r) => r.dropped ?? [])).toEqual([]);
    const seen: string[] = [];
    for (const row of readTable(lvBalanceSheetsCsv(), ["statement_id", "cash"], (first) => first === "5007")) seen.push(row.get("statement_id"));
    expect(seen).toEqual(["5007"]);
  });

  it("counts a second line for a selected statement and keeps the first", async () => {
    const text = new TextDecoder().decode(lvBalanceSheetsCsv());
    const line = text.split("\r\n").find((l) => l.startsWith("5007;"))!;
    const doubled = new TextEncoder().encode(`${text}${line.replace(/;7000;/, ";1;")}\r\n`);
    const { records, drops } = await parseAll(lvUrAnnualReports, [art("financial_statements.csv", lvStatementsCsv()), art("balance_sheets.csv", doubled), art("income_statements.csv", lvIncomeStatementsCsv())]);
    expect(drops).toContain("conflicting_line");
    expect(records.find((r) => r.hashInput[0] === "5007")!.reports![0]!.facts.find((f) => f.concept === "cash")?.value).toBe(7000);
  });
});
