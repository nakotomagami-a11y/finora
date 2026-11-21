import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { rawColourLines } from "./check-tokens.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-tokens.mjs");

/** Runs the check against a scratch project holding the given files. */
function run(files) {
  const root = mkdtempSync(join(tmpdir(), "finora-tokens-"));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, FINORA_CHECK_ROOT: root }, encoding: "utf8" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("a hex colour, rgb() and hsl() are raw colours", () => {
  assert.equal(rawColourLines("color: #fff;\nbackground: rgb(1 2 3);\nborder: hsl(0 0% 0%);\nok: var(--ink);").length, 3);
});

test("a token reference is not a raw colour", () => {
  assert.equal(rawColourLines('className="bg-surface text-ink border-line-strong"').length, 0);
});

test("a planted hex colour in a component fails the check, naming the file and line", () => {
  const result = run({ "apps/web/src/Card.tsx": 'export const x = <div style={{ color: "#ff0000" }} />;\n' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /apps\/web\/src\/Card\.tsx:1/u);
});

test("an arbitrary Tailwind colour value fails the check", () => {
  const result = run({ "packages/ui/src/primitives/x.tsx": 'export const c = "bg-[#123456] text-[rgb(1,2,3)]";\n' });
  assert.equal(result.status, 1);
});

test("the token file itself may hold colours, and clean code passes", () => {
  const result = run({
    "packages/ui/src/tokens.css": ":root { --bg: #0f0e0d; }\n",
    "apps/web/src/Card.tsx": 'export const c = "bg-surface text-ink";\n',
  });
  assert.equal(result.status, 0, result.stderr);
});

test("a colour in a test file is ignored", () => {
  const result = run({ "apps/web/src/Card.test.tsx": 'const expected = "#ff0000";\n' });
  assert.equal(result.status, 0, result.stderr);
});
