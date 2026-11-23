// Every sample hit is built at run time from parts, so this file never holds one itself (qa).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { lvCheckDigit } from "../packages/domain/src/ids/check-digits.ts";
import { brandStems, isValidIsin, parseAllowlist, scanPath, scanText, summary } from "./check-outside-names.mjs";

const j = (...parts) => parts.join("");
const host = [j("north", "bay"), j("wid", "gets"), "com"].join(".");
const org = [j("North", "bay"), "Trading", "SIA"].join(" ");

function validLei(body18) {
  const n = BigInt([...`${body18}00`].map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55))).join(""));
  return `${body18}${String(98n - (n % 97n)).padStart(2, "0")}`;
}
function validIsin(body11) {
  for (let d = 0; d <= 9; d++) if (isValidIsin(`${body11}${d}`)) return `${body11}${d}`;
  throw new Error("no check digit");
}
function validLvCode() {
  for (let n = 4000300100; ; n++) {
    const digit = lvCheckDigit(String(n));
    if (digit !== null) return `${n}${digit}`;
  }
}
const classes = (findings) => findings.map((f) => f.cls);

describe("check-outside-names: the classes (qa 7066865925 a-e)", () => {
  it("a: finds a hostname in prose, a URL and an email domain", () => {
    assert.deepEqual(classes(scanText("x.md", `see ${host} for more`)), ["host"]);
    assert.deepEqual(classes(scanText("x.ts", `fetch("https://api.${host}/v1")`)), ["host"]);
    assert.deepEqual(classes(scanText("x.md", `${j("ops", "@")}${host}`)), ["host"]);
  });

  it("a: skips reserved test domains, item ids and code that only looks like a host", () => {
    for (const text of [`data.${j("exam", "ple")}.lv`, `files.${j("exam", "ple")}.com`, ["rpc", "invalid"].join("."), ["svc", "test"].join("."), "S01.LV.01 and m03.x.02", "rows.at(-1) and p.news", "localhost:3000"]) {
      assert.deepEqual(scanText("x.ts", text), [], text);
    }
  });

  it("b: finds an organisation-shaped phrase, and passes a plainly fictional one", () => {
    assert.deepEqual(classes(scanText("x.ts", `name: "${org}"`)), ["org"]);
    for (const name of [`Example ${org}`, "Paraugs Koks SIA", "Näidis Freight OÜ", "Sample 4 Holdings LLC"]) assert.deepEqual(scanText("x.ts", `"${name}"`), [], name);
    assert.deepEqual(scanText("x.md", "SHOW AS CAVEAT"), [], "all-caps words are not a name");
  });

  it("c: finds a ticker in a ticker field or as a cashtag in prose, never a ZZFX fixture", () => {
    assert.deepEqual(classes(scanText("x.ts", `ticker: "${j("QX", "RZ")}"`)), ["ticker"]);
    assert.deepEqual(classes(scanText("x.md", `bought $${j("QX", "RZ")} today`)), ["ticker"]);
    assert.deepEqual(scanText("x.ts", 'symbol: "ZZFX07"'), []);
    assert.deepEqual(scanText("x.sh", `echo $${j("PA", "TH")}`), [], "a shell variable is not a cashtag");
  });

  it("d: finds a real-shaped register code, LEI, ISIN and CIK; passes fixture and placeholder ids", () => {
    const code = validLvCode();
    assert.deepEqual(classes(scanText("x.ts", `"lv-${code}"`)), ["id"]);
    const fixture = `${code.slice(0, 10)}${(Number(code[10]) + 1) % 10}`;
    assert.deepEqual(scanText("x.ts", `"lv-${fixture}"`), []);
    assert.deepEqual(scanText("x.ts", '"lv-00000000003"'), []);
    assert.deepEqual(classes(scanText("x.ts", validLei(j("5493", "00ABCDEFGHIJ0Q")))), ["id"]);
    assert.deepEqual(classes(scanText("x.ts", validIsin(j("US", "0Q7833100")))), ["id"]);
    assert.deepEqual(classes(scanText("x.md", `CIK ${String(Number(j("12", "34567"))).padStart(10, "0")}`)), ["id"]);
    assert.deepEqual(scanText("x.md", "CIK 9900000042 and a CIK of 10 digits"), []);
  });

  it("e: finds a stem of a private denylist entry, case- and accent-insensitively", () => {
    const stems = brandStems(["# private", j("zorb", "lexa"), "two words"].join("\n"));
    assert.equal(stems.length, 1);
    assert.deepEqual(classes(scanText("x.md", `the ${j("Zörb", "lexas")} feed`, { stems })), ["brand"]);
  });
});

describe("check-outside-names: qa's gaps and false positives (7070905192)", () => {
  it("finds a regex-escaped host", () => {
    assert.deepEqual(classes(scanText("x.mjs", `const re = /${j("north", "bay")}\.com/;`)), ["host"]);
  });

  it("in prose, finds a two-label host on any country TLD outside code spans", () => {
    assert.deepEqual(classes(scanText("x.md", `see ${[j("north", "bay"), "de"].join(".")} for more`)), ["host"]);
    assert.deepEqual(scanText("x.ts", `see ${[j("north", "bay"), "de"].join(".")}`), [], "in code, only the known TLD list");
    assert.deepEqual(scanText("x.md", "the field `meta.id` and the format dd.mm"), []);
  });

  it("finds a bare 11-digit LV register code with a real check digit; passes fixture and other numbers", () => {
    const code = validLvCode();
    assert.deepEqual(classes(scanText("x.md", `code ${code}`)), ["id"]);
    assert.deepEqual(scanText("x.md", `code ${code.slice(0, 10)}${(Number(code[10]) + 1) % 10}`), []);
    assert.deepEqual(scanText("x.md", "an id of 30000000001"), []);
  });

  it("counts a string literal whose whole value is a host on any TLD, as officialHosts are written (qa 7071031499)", () => {
    const hosts = ["de", "io", "com", "lv"].map((tld, i) => `"${j("zyx", ["prices", "api", "data", "reg"][i])}.${tld}"`);
    const line = `officialHosts: [${hosts.join(", ")}], homepage: "https://${j("zyx", "home")}.at/start"`;
    assert.deepEqual(classes(scanText("x.ts", line)), ["host", "host", "host", "host", "host"]);
    assert.deepEqual(scanText("x.ts", 'const file = "global.json"; const a = "rpc.invalid";'), []);
  });

  it("skips code that reads like a host: upper-case members, word TLDs and file names", () => {
    for (const text of ["FX.LV.register", "COUNTS.us + LOCAL.us", "e.urls.global", 'name: "global.json"', "see slices.md and data.csv"]) {
      assert.deepEqual(scanText("x.ts", text), [], text);
    }
  });

  it("still finds a host after a scheme in any case, a www host on a word TLD, and a brand-case host", () => {
    assert.deepEqual(classes(scanText("x.ts", `"https://API.${j("north", "bay")}.global/v1"`)), ["host"]);
    assert.deepEqual(classes(scanText("x.md", `www.${j("north", "bay")}.news`)), ["host"]);
    assert.deepEqual(classes(scanText("x.md", `the ${j("North", "Bay")}.gov portal`)), ["host"]);
  });
});

describe("check-outside-names: allowlist, scope and output", () => {
  it("keeps a hit listed in the allowlist with its category; a host entry covers its subdomains", () => {
    const allow = parseAllowlist([`public-body ${host}`, `fictional ${org}`].join("\n"));
    const findings = scanText("x.md", `api.${host} and ${org}`, { allow });
    assert.deepEqual(findings.map((f) => f.kept), ["public-body", "fictional"]);
  });

  it("refuses an allowlist line without a known category", () => {
    assert.throws(() => parseAllowlist(`friendly ${host}`), /a line needs one of/);
  });

  it("skips out-of-scope files and reports an unreviewed binary outside the baselines", () => {
    const text = Buffer.from(`see ${host}`);
    for (const path of ["package.json", "pnpm-lock.yaml", "LICENSE", "node_modules/x/a.md", ".agent-office/m.md"]) assert.deepEqual(scanPath(path, text), [], path);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]);
    assert.deepEqual(classes(scanPath("fixtures/a.png", png)), ["binary"]);
    assert.deepEqual(scanPath("apps/web/e2e/__screenshots__/a.png", png), []);
    const reviewedMedia = new Set([createHash("sha256").update(png).digest("hex")]);
    assert.deepEqual(scanPath("docs/design/a.png", png, { reviewedMedia }), []);
  });

  it("never repeats the matched text: findings carry a line and a class, and the summary counts", () => {
    const allow = parseAllowlist(`tool ${host}`);
    const results = [{ path: "x.md", findings: scanText("x.md", [`${host}`, org, `ticker: "${j("QX", "RZ")}"`].join("\n"), { allow }) }];
    const line = summary("a..b", results);
    assert.equal(line, "outside names: sweep a..b: 2 unresolved; kept by C15: 1 (tool 1)");
    const serialised = JSON.stringify(results) + line;
    for (const secret of [host, org, j("QX", "RZ")]) assert.ok(!serialised.includes(secret), "no matched text");
  });
});
