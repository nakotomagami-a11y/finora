#!/usr/bin/env node
// `vitest run`, with one narrow retry (qa on 902fcd5): Node 24.20 on Windows sometimes kills a test
// fork with a native V8 fatal while worker threads tear down (`jit_page_` check; docs/running.md,
// S12 decides the product side). When that fatal is the run's only problem (no test failed, and
// every crashed fork printed it), the crashed files run once more on their own and the run says so.
// Any other failure fails as before. Output streams live; a copy is kept for the check.
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const V8_FATAL = /jit_page_->allocations_\.erase/g;
const CRASHED_FILE = /Worker exited unexpectedly with exit code \d+ during \w+ state while running test file (\S+)/g;
const FAILED = /^\s*(Test Files|Tests)\s+\d+ failed/m;

function vitest(args) {
  return new Promise((done) => {
    const child = spawn("pnpm", ["exec", "vitest", "run", ...args], { shell: process.platform === "win32", stdio: ["inherit", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      output += chunk;
    });
    child.on("close", (status) => done({ status: status ?? 1, output }));
  });
}

/** The files to rerun, or null when the failure is anything but the known V8 fatal alone. */
export function retryable(output) {
  if (FAILED.test(output)) return null;
  const fatals = (output.match(V8_FATAL) ?? []).length;
  const crashed = [...output.matchAll(CRASHED_FILE)].map((m) => m[1]);
  // Every crashed fork must have printed the fatal: one that died another way is never retried (qa NIT).
  if (crashed.length === 0 || fatals < crashed.length) return null;
  return [...new Set(crashed)];
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const first = await vitest(process.argv.slice(2));
  if (first.status === 0) process.exit(0);
  const files = retryable(first.output);
  if (!files) process.exit(first.status);
  console.log(`\nvitest-run: the known V8 teardown fatal ended ${files.join(", ")} with no test failed; running it once more.`);
  const again = await vitest(files);
  console.log(again.status === 0 ? "vitest-run: the rerun passed." : "vitest-run: the rerun failed.");
  process.exit(again.status);
}
