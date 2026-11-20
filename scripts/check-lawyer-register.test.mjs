import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkRegister, mappedIds, registerIds } from "./check-lawyer-register.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const register = "| id | Question |\n|---|---|\n| LAW-ONE | first |\n| LAW-TWO | second |\n";
const slices = "### S01 x\n| LAW-ONE | `a.test.ts` |\n| LAW-TWO | `b.test.ts` |\n### S02 y\n";

test("a marker naming a register row passes", () => {
  const files = [{ path: "docs/a.md", text: "Interim value [pending: lawyer LAW-ONE] applies." }];
  assert.deepEqual(checkRegister({ registerText: register, slicesText: slices, files }), []);
});

test("a marker naming no row fails", () => {
  const files = [{ path: "docs/a.md", text: "x\n[pending: lawyer LAW-THREE]\n" }];
  const [problem] = checkRegister({ registerText: register, slicesText: slices, files });
  assert.match(problem, /docs\/a\.md:2: LAW-THREE is not a row/);
});

test("a marker without an id fails", () => {
  const files = [{ path: "docs/a.md", text: "[pending: lawyer]" }];
  assert.match(checkRegister({ registerText: register, slicesText: slices, files })[0], /must name a register id/);
});

test("a marker in backticks is an example and is ignored", () => {
  const files = [{ path: "docs/a.md", text: "Write `[pending: lawyer]` or `[pending: lawyer LAW-NINE]`." }];
  assert.deepEqual(checkRegister({ registerText: register, slicesText: slices, files }), []);
});

test("a register row missing from the S01 test map fails", () => {
  const partial = "### S01 x\n| LAW-ONE | `a.test.ts` |\n### S02 y\n";
  const [problem] = checkRegister({ registerText: register, slicesText: partial, files: [] });
  assert.match(problem, /LAW-TWO has no enforcing test/);
});

test("the real register is fully mapped in S01", () => {
  const ids = registerIds(readFileSync(join(ROOT, "docs/plan/lawyer-register.md"), "utf8"));
  const mapped = mappedIds(readFileSync(join(ROOT, "docs/plan/slices.md"), "utf8"));
  assert.ok(ids.size >= 33);
  assert.deepEqual([...ids].filter((id) => !mapped.has(id)), []);
});
