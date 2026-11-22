// Samples are assembled at runtime so this file never contains a literal secret, personal
// code or local path itself (the guard scans its own repo).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkPath, compileDenylist, isBalticPersonalCode, scanText } from "./rules.mjs";

const rules = (text, denylist) => scanText(text, denylist).map((f) => f.rule);

/** Builds a valid Estonian/Lithuanian personal code from its first ten digits. */
function withChecksum(first10) {
  const weighted = (w) => w.reduce((s, wi, i) => s + wi * Number(first10[i]), 0) % 11;
  let check = weighted([1, 2, 3, 4, 5, 6, 7, 8, 9, 1]);
  if (check === 10) check = weighted([3, 4, 5, 6, 7, 8, 9, 1, 2, 3]) % 10;
  return first10 + check;
}

describe("secrets", () => {
  const cases = {
    "github-token": "gh" + "p_" + "a".repeat(36),
    "anthropic-key": "sk-" + "ant-" + "b".repeat(30),
    "aws-key": "AK" + "IA" + "C".repeat(16),
    "private-key": "-----BEGIN RSA " + "PRIVATE KEY-----",
    "assigned-secret": "api" + "_key = '" + "d".repeat(20) + "'",
    "telegram-bot-token": "123456789" + ":AA" + "e".repeat(33),
  };
  for (const [name, sample] of Object.entries(cases)) {
    it(`flags a ${name}`, () => assert.ok(rules(`value ${sample} end`).includes(`secret:${name}`)));
  }

  it("ignores ordinary words around keys", () => {
    assert.deepEqual(rules("the token is read from the environment, never hard-coded"), []);
  });
});

describe("local machine details", () => {
  it("flags a Windows user-profile path", () => {
    assert.ok(rules("C:" + "\\Users\\someone\\project").includes("local:user-profile-path"));
  });

  it("flags a Git Bash user-profile path", () => {
    assert.ok(rules("/c/" + "Users/someone/x").includes("local:user-profile-path"));
  });

  it("flags any absolute Windows path", () => {
    assert.ok(rules("data lives in " + "D:" + "/work/data").includes("local:absolute-windows-path"));
  });

  it("does not mistake URLs or regex classes for drive paths", () => {
    assert.deepEqual(rules("see https://example.com/a and [A-Za-z]:x"), []);
  });
});

describe("personal data", () => {
  it("flags emails but allows GitHub noreply and example domains", () => {
    assert.ok(rules("mail " + "jane.doe" + "@" + "mail.test").includes("personal:email"));
    assert.deepEqual(rules("bot " + "123+bot" + "@users.noreply.github.com" + " and a" + "@example.com"), []);
  });

  it("validates Estonian/Lithuanian personal codes by checksum", () => {
    const valid = withChecksum("3770714" + "123");
    assert.equal(isBalticPersonalCode(valid), true);
    const wrongCheck = valid.slice(0, 10) + ((Number(valid[10]) + 1) % 10);
    assert.equal(isBalticPersonalCode(wrongCheck), false);
    assert.ok(rules(`code ${valid}`).includes("personal:ee-lt-personal-code"));
  });

  it("ignores 11-digit numbers that are not personal codes", () => {
    assert.equal(isBalticPersonalCode("9" + "0".repeat(10)), false);
  });

  it("flags Latvian personal codes, including masked ones", () => {
    assert.ok(rules("pk " + "140777" + "-" + "12345").includes("personal:lv-personal-code"));
    assert.ok(rules("pk " + "140777" + "-" + "*".repeat(5)).includes("personal:lv-masked-personal-code"));
  });

  it("flags US social security numbers and phone numbers", () => {
    assert.ok(rules("ssn " + "123" + "-45-" + "6789").includes("personal:us-ssn"));
    assert.ok(rules("call " + "+370 " + "612 34567").includes("personal:phone-number"));
  });
});

describe("private denylist", () => {
  const denylist = compileDenylist(["# private names", "", "Example Corp", "fixture wind"].join("\n"));

  it("matches whole names case- and accent-insensitively", () => {
    assert.ok(rules("We beat EXAMPLE corp easily", denylist).includes("denylist:entry-1"));
    assert.ok(rules("Éxample Corp", denylist).includes("denylist:entry-1"));
  });

  it("matches across spacing, dots and hyphens, and inside domains", () => {
    // Domains built from parts under the reserved .invalid TLD, so the tree holds no registrable name (H4).
    assert.ok(rules(`see ${["fixturewind", "invalid"].join(".")}`, denylist).includes("denylist:entry-2"));
    assert.ok(rules("fixture-wind data", denylist).includes("denylist:entry-2"));
    assert.ok(rules(["examplecorp", "invalid"].join("."), denylist).includes("denylist:entry-1"));
  });

  it("does not match inside longer words", () => {
    assert.deepEqual(rules("counterexample corporate", denylist), []);
  });

  it("reports the entry number, never the matched text", () => {
    const [finding] = scanText("Example Corp", denylist);
    assert.deepEqual(finding, { line: 1, rule: "denylist:entry-1" });
  });
});

describe("paths", () => {
  it("blocks env files but allows the example", () => {
    assert.deepEqual(checkPath(".env.local"), ["path:env-file"]);
    assert.deepEqual(checkPath("apps/web/.env"), ["path:env-file"]);
    assert.deepEqual(checkPath(".env.example"), []);
  });

  it("blocks local-only folders and key files", () => {
    assert.ok(checkPath("research/.cache/lv/officers.csv").includes("path:local-only-dir"));
    assert.ok(checkPath(".local/notes.md").includes("path:local-only-dir"));
    assert.ok(checkPath("research/local/lv/members.csv").includes("path:local-only-dir"));
    assert.ok(checkPath(".data/finora.db").includes("path:local-only-dir"));
    assert.ok(checkPath("apps/cli/.data/finora.db-wal").includes("path:local-only-dir"));
    // The control: names that only look alike are not local-only.
    assert.ok(!checkPath("research/locale/notes.md").includes("path:local-only-dir"));
    assert.ok(!checkPath("packages/x/src/data/rows.ts").includes("path:local-only-dir"));
    assert.ok(checkPath("deploy/server.pem").includes("path:key-file"));
  });

  it("blocks datasets except small text fixtures", () => {
    assert.ok(checkPath("data/companies.csv", { bytes: 10 }).includes("path:data-file"));
    assert.deepEqual(checkPath("packages/x/fixtures/sample.csv", { bytes: 2_000 }), []);
    assert.ok(checkPath("packages/x/fixtures/big.csv", { bytes: 60_000 }).includes("path:data-file"));
  });

  it("blocks large files and unreviewed binaries", () => {
    assert.ok(checkPath("docs/a.md", { bytes: 2_000_000 }).includes("path:too-large"));
    assert.ok(checkPath("docs/shot.png", { binary: true }).includes("path:unreviewed-binary"));
    assert.deepEqual(checkPath("docs/shot.png", { binary: true, reviewedMedia: true }), []);
  });

  it("checks file names against the denylist", () => {
    const denylist = compileDenylist("Example Corp");
    assert.ok(checkPath("docs/example-corp-review.md", {}, denylist).includes("denylist:entry-1"));
  });
});
