// Shared Vitest settings. Packages run in Node by default; a UI test opts into jsdom per file
// with a `// @vitest-environment jsdom` comment.
import { fileURLToPath } from "node:url";

export const finoraVitest = {
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./server-only.stub.mjs", import.meta.url)) },
  },
  test: {
    include: ["{apps,packages}/*/{src,eslint}/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
    environment: "node",
    restoreMocks: true,
  },
};
