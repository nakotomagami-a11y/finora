// Shared Vitest settings. Packages run in Node by default; a UI test opts into jsdom per file
// with a `// @vitest-environment jsdom` comment.
import { fileURLToPath } from "node:url";

// Tests always run as NODE_ENV=test, whatever the shell inherits: with an inherited "production",
// React loads its production build, which has no `act`.
process.env.NODE_ENV = "test";

export const finoraVitest = {
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./server-only.stub.mjs", import.meta.url)) },
  },
  test: {
    include: ["{apps,packages}/*/{src,eslint}/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
    environment: "node",
    env: { NODE_ENV: "test" },
    restoreMocks: true,
    // The whole suite runs in parallel; a loaded machine must not turn a slow test into a failure.
    testTimeout: 30_000,
    setupFiles: [fileURLToPath(new URL("./vitest.setup.mjs", import.meta.url))],
  },
};
