#!/usr/bin/env node
// `vitest run`, with one narrow retry (qa on 902fcd5): Node 24.20 on Windows sometimes kills a test
// fork with a native V8 fatal while worker threads tear down (`jit_page_` check; docs/running.md,
// S12 decides the product side). When that fatal is the run's only problem (no test failed), the
// crashed file runs once more on its own and the run says so. Any other failure fails as before.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const V8_FATAL = /jit_page_->allocations_\.erase/;
const CRASHED_FILE = /Worker exited unexpectedly with exit code \d+ during \w+ state while running test file (\S+)/g;
const FAILED = /^\s*(Test Files|Tests)\s+\d+ failed/m;

function vitest(args) {
  const run = spawnSync("pnpm", ["exec", "vitest", "run", ...args], { encoding: "utf8", shell: process.platform === "win32", maxBuffer: 256 * 1024 * 1024 });
  process.stdout.write(run.stdout ?? "");
  process.stderr.write(run.stderr ?? "");
  return { status: run.status ?? 1, output: `${run.stdout ?? ""}\n${run.stderr ?? ""}` };
}

/** The files to rerun, or null when the failure is anything but the known V8 fatal alone. */
export function retryable(output) {
  if (!V8_FATAL.test(output) || FAILED.test(output)) return null;
  const files = [...output.matchAll(CRASHED_FILE)].map((m) => m[1]);
  return files.length > 0 ? [...new Set(files)] : null;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const first = vitest(process.argv.slice(2));
  if (first.status === 0) process.exit(0);
  const files = retryable(first.output);
  if (!files) process.exit(first.status);
  console.log(`\nvitest-run: the known V8 teardown fatal ended ${files.join(", ")} with no test failed; running it once more.`);
  const again = vitest(files);
  console.log(again.status === 0 ? "vitest-run: the rerun passed." : "vitest-run: the rerun failed.");
  process.exit(again.status);
}
