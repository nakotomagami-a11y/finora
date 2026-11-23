import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { retryable } from "./vitest-run.mjs";

const fatal = "# Fatal error in , line 0\n# Check failed: jit_page_->allocations_.erase(addr) == 1.\n";
const crashed = "Caused by: Error: Worker exited unexpectedly with exit code 2147483651 during started state while running test file packages/ingest/src/concurrency.test.ts\n";
const summary = (failed) => `\n Test Files  ${failed ? "1 failed | " : ""}136 passed (137)\n      Tests  ${failed ? "1 failed | " : ""}1236 passed (1241)\n     Errors  1 error\n`;

test("the known V8 fatal alone, with no test failed: the crashed file is retried", () => {
  assert.deepEqual(retryable(fatal + crashed + summary(false)), ["packages/ingest/src/concurrency.test.ts"]);
});

test("a failed test anywhere: no retry, even with the fatal", () => {
  assert.equal(retryable(fatal + crashed + summary(true)), null);
});

test("a fork that died some other way: no retry", () => {
  assert.equal(retryable(crashed + summary(false)), null);
});

test("the fatal without a crashed file named: no retry", () => {
  assert.equal(retryable(fatal + summary(false)), null);
});

test("a real crashed run's output (dev-desktop-1, Node 24.20): retryable returns the crashed file", () => {
  // vitest printed "Test Files 136 passed (137)" and "Errors 1 error" for it, never "failed".
  const real = readFileSync(new URL("./fixtures/vitest-v8-crash.txt", import.meta.url), "utf8");
  assert.deepEqual(retryable(real), ["packages/ingest/src/concurrency.test.ts"]);
});

test("the fatal in one fork and another fork dead some other way: no retry (qa NIT)", () => {
  const other = "Caused by: Error: Worker exited unexpectedly with exit code 1 during started state while running test file packages/x/src/oom.test.ts\n";
  assert.equal(retryable(fatal + crashed + other + summary(false)), null);
});
