// S05 memory and SEC-6: an LV file is fetched into the sync's work dir and parsed from there in
// chunks, with the same records as from memory; the annual-report files go through the shared CSV
// reader, so a quoted line break keeps its row and a quote left open fails the file.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseAll } from "../intl/sanctions-test-helpers.ts";
import type { FetchContext, PoliteFetch, RawArtifact } from "../types.ts";
import { lvBalanceSheetsCsv, lvIncomeStatementsCsv, lvStatementsCsv } from "./lv-financials/fixture.ts";
import { lvUrAnnualReports } from "./lv-financials/lv-financials.ts";
import { lvRegisterCsv } from "./lv-ur-register/fixture.ts";
import { lvUrRegister } from "./lv-ur-register/lv-ur-register.ts";
import { fetchCkanFile, readCsv } from "./shared.ts";

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const art = (name: string, bytes: Uint8Array): RawArtifact => ({ name, bytes, fetchedAt: "2026-11-21T00:00:00Z" });

/** A portal answer and a file, honouring `toFile` the way the polite fetcher does. */
function portal(fileName: string, body: Uint8Array): { fetcher: PoliteFetch; asked: string[] } {
  const asked: string[] = [];
  const fetcher: PoliteFetch = async (url, init) => {
    asked.push(init?.toFile ? "file" : "memory");
    if (url.includes("package_show")) {
      const json = { result: { resources: [{ url: `https://data.gov.lv/dati/dataset/x/resource/y/download/${fileName}`, format: "CSV", last_modified: "2026-11-20T21:00:00" }] } };
      return { status: 200, headers: {}, bytes: new TextEncoder().encode(JSON.stringify(json)) };
    }
    if (!init?.toFile) return { status: 200, headers: {}, bytes: body };
    writeFileSync(init.toFile, body);
    return { status: 200, headers: {}, bytes: new Uint8Array(), file: { path: init.toFile, size: body.byteLength, sha256: "test" } };
  };
  return { fetcher, asked };
}

describe("LV files stream to the work dir and parse in chunks", () => {
  it("fetches the file to disk and parses the same records as from memory", async () => {
    dir = mkdtempSync(join(tmpdir(), "finora-lv-stream-"));
    const { fetcher, asked } = portal("register.csv", lvRegisterCsv());
    const ctx: FetchContext = { fetcher, keys: {}, now: "2026-11-21T00:00:00Z", lastToken: null, workDir: dir };
    const streamed = await fetchCkanFile(ctx, "uz", "register.csv");
    expect(asked).toEqual(["memory", "file"]);
    expect(streamed[0]!.file?.path).toBe(join(dir, "register.csv"));
    expect(streamed[0]!.bytes.byteLength).toBe(0);
    const fromDisk = await parseAll(lvUrRegister, streamed);
    const fromMemory = await parseAll(lvUrRegister, [art("register.csv", lvRegisterCsv())]);
    expect(fromDisk.records).toEqual(fromMemory.records);
    expect(lvUrRegister.asOf(streamed)).toEqual(lvUrRegister.asOf([art("register.csv", lvRegisterCsv()), streamed[1]!]));
  });

  it("splits no row across chunks, however small", () => {
    const rows = (bytes: Uint8Array) => [...readCsv(bytes, ";", ["regcode", "name"])].map((r) => [r.get("regcode"), r.get("name")]);
    const whole = rows(lvRegisterCsv());
    dir = mkdtempSync(join(tmpdir(), "finora-lv-stream-"));
    const path = join(dir, "register.csv");
    writeFileSync(path, lvRegisterCsv());
    const file: RawArtifact = { name: "register.csv", bytes: new Uint8Array(), fetchedAt: "", file: { path, size: lvRegisterCsv().byteLength, sha256: "" } };
    expect([...readCsv(file, ";", ["regcode", "name"])].map((r) => [r.get("regcode"), r.get("name")])).toEqual(whole);
  });
});

describe("lv-ur-annual-reports reads with the shared CSV reader (SEC-6)", () => {
  const files = (balance: Uint8Array) => [art("financial_statements.csv", lvStatementsCsv()), art("balance_sheets.csv", balance), art("income_statements.csv", lvIncomeStatementsCsv())];

  it("keeps a row whole when a quoted field holds a line break", async () => {
    const text = new TextDecoder().decode(lvBalanceSheetsCsv());
    const [header, ...lines] = text.split("\r\n");
    // A quoted value with a line break in a column the loader does not read.
    const extra = [`${header};note`, ...lines.filter((l) => l !== "").map((l, i) => `${l};${i === 0 ? '"two\r\nlines"' : ""}`)].join("\r\n") + "\r\n";
    const plain = await parseAll(lvUrAnnualReports, files(lvBalanceSheetsCsv()));
    const quoted = await parseAll(lvUrAnnualReports, files(new TextEncoder().encode(extra)));
    expect(quoted.records.map((r) => r.reports)).toEqual(plain.records.map((r) => r.reports));
  });

  it("fails the file on a quote left open", async () => {
    const broken = new TextEncoder().encode(`${new TextDecoder().decode(lvBalanceSheetsCsv())}"5099;1\r\n`);
    await expect(parseAll(lvUrAnnualReports, files(broken))).rejects.toMatchObject({ name: "csv_malformed" });
  });
});
