// Shared Vitest settings. Packages run in Node by default; a UI test opts into jsdom per file
// with a `// @vitest-environment jsdom` comment.
import { fileURLToPath } from "node:url";

// Tests always run as NODE_ENV=test, whatever the shell inherits: with an inherited "production",
// React loads its production build, which has no `act`.
process.env.NODE_ENV = "test";

const TESTS = ["{apps,packages}/*/{src,eslint}/**/*.test.{ts,tsx}", "fixtures/*.test.ts", "fixtures/src/**/*.test.ts"];
const NEVER = ["**/node_modules/**", "**/.next/**", "**/e2e/**"];
/** Test files that start sync workers (worker threads). */
const WORKER_TESTS = [
  "apps/cli/src/commands.test.ts",
  "packages/ingest/src/concurrency.test.ts",
  "packages/ingest/src/review-fixes.test.ts",
  "packages/ingest/src/s05-recheck.test.ts",
  "packages/ingest/src/work-dirs.test.ts",
];

export const finoraVitest = {
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./server-only.stub.mjs", import.meta.url)) },
  },
  test: {
    environment: "node",
    // next-intl imports `next/server` without a file extension, which Node only resolves after Vite transforms it.
    server: { deps: { inline: [/next-intl/u] } },
    env: { NODE_ENV: "test" },
    restoreMocks: true,
    // The whole suite runs in parallel; a loaded machine must not turn a slow test into a failure.
    testTimeout: 30_000,
    setupFiles: [fileURLToPath(new URL("./vitest.setup.mjs", import.meta.url))],
    // The files that start sync workers run in a forks pool of their own, one file at a time, after
    // the rest (qa, coordinator on suite stability): worker isolates torn down beside a full parallel
    // suite are where Node 24.20's V8 teardown fatal strikes (docs/running.md). scripts/vitest-run.mjs
    // retries a file that fatal kills, never a failed assertion.
    projects: [
      { extends: true, test: { name: "unit", include: TESTS, exclude: [...WORKER_TESTS, ...NEVER] } },
      { extends: true, test: { name: "workers", include: WORKER_TESTS, exclude: NEVER, pool: "forks", maxWorkers: 1, sequence: { groupOrder: 1 } } },
    ],
  },
};
