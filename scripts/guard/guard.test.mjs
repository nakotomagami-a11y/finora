// End-to-end: runs guard.mjs against a throwaway git repository.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
let repo;

function git(...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
}

function guard(args, { input = "", env = {} } = {}) {
  const result = spawnSync(process.execPath, [join(repo, "scripts/guard/guard.mjs"), ...args], {
    cwd: repo,
    input,
    encoding: "utf8",
    env: { ...process.env, FINORA_GUARD_DENYLIST: "", ...env },
  });
  return { code: result.status, out: result.stdout + result.stderr };
}

function commit(file, body, message = "Add file") {
  writeFileSync(join(repo, file), body);
  git("add", file);
  git("commit", "-q", "--no-verify", "-m", message);
  return git("rev-parse", "HEAD").trim();
}

before(() => {
  repo = mkdtempSync(join(tmpdir(), "guard-test-"));
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Guard Test");
  git("config", "user.email", "guard" + "@example.com");
  git("config", "core.autocrlf", "false");
  mkdirSync(join(repo, "scripts/guard"), { recursive: true });
  for (const f of ["guard.mjs", "rules.mjs"]) copyFileSync(join(HERE, f), join(repo, "scripts/guard", f));
  commit("README.md", "# test\n", "Init");
});

after(() => rmSync(repo, { recursive: true, force: true }));

describe("guard.mjs", () => {
  it("passes clean staged changes", () => {
    writeFileSync(join(repo, "notes.md"), "Plain notes.\n");
    git("add", "notes.md");
    const { code, out } = guard(["staged"]);
    assert.equal(code, 0, out);
    git("reset", "-q");
  });

  it("blocks a staged secret and reports file and line without the secret", () => {
    const secret = "sk-" + "ant-" + "z".repeat(30);
    writeFileSync(join(repo, "config.md"), `line one\nkey: ${secret}\n`);
    git("add", "config.md");
    const { code, out } = guard(["staged"]);
    assert.equal(code, 1);
    assert.match(out, /config\.md:2\s+secret:anthropic-key/);
    assert.ok(!out.includes(secret), "the secret must not be echoed");
    git("reset", "-q");
  });

  it("blocks denylisted names from the environment without echoing them", () => {
    writeFileSync(join(repo, "plan.md"), "We compare against Example Corp.\n");
    git("add", "plan.md");
    const { code, out } = guard(["staged"], { env: { FINORA_GUARD_DENYLIST: "Example Corp" } });
    assert.equal(code, 1);
    assert.match(out, /denylist:entry-1/);
    assert.ok(!/Example Corp/i.test(out));
    git("reset", "-q");
  });

  it("fails when the denylist is required but missing", () => {
    const { code } = guard(["text", "-"], { input: "hello", env: { FINORA_GUARD_REQUIRE_DENYLIST: "true" } });
    assert.equal(code, 2);
  });

  it("checks commit messages", () => {
    const file = join(repo, "MSG");
    writeFileSync(file, "Fix path in " + "C:" + "\\Users\\someone\\x\n");
    const { code, out } = guard(["message", file]);
    assert.equal(code, 1);
    assert.match(out, /commit message:1\s+local:user-profile-path/);
  });

  it("blocks unreviewed images until they are reviewed", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    writeFileSync(join(repo, "shot.png"), png);
    git("add", "shot.png");
    assert.equal(guard(["staged"]).code, 1);
    assert.equal(guard(["review", join(repo, "shot.png")]).code, 0);
    git("add", "scripts/guard/reviewed-media.txt");
    const { code, out } = guard(["staged"]);
    assert.equal(code, 0, out);
    git("commit", "-q", "--no-verify", "-m", "Add reviewed screenshot");
  });

  it("scans every commit about to be pushed, including messages", () => {
    const base = git("rev-parse", "HEAD").trim();
    commit("a.md", "fine\n", "Clean commit");
    const bad = commit("b.md", "fine too\n", "Mention " + "jane" + "@" + "mail.test");
    const { code, out } = guard(["push"], { input: `refs/heads/main ${bad} refs/heads/main ${base}\n` });
    assert.equal(code, 1);
    assert.match(out, new RegExp(`${bad.slice(0, 10)} message:1\\s+personal:email`));
  });

  it("scans a range in CI, and a zero base means all commits", () => {
    const { code, out } = guard(["range", "0000000000000000000000000000000000000000", "HEAD"]);
    assert.equal(code, 1);
    assert.match(out, /personal:email/);
  });

  it("audits every tracked file", () => {
    const { out } = guard(["tree"]);
    assert.match(out, /tracked files/);
  });
});
