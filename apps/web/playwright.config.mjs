import { defineConfig, devices } from "@playwright/test";
import { SECRET_NAMES, sentinelFor } from "../../scripts/check-bundle-secrets.mjs";

const PORT = 3100;
const ENGINE_SPECS = /(smoke|csp|titles|design\.keyboard|design\.overlays|design\.focus|theme|fonts|crash\.console)\.spec\.ts$/u;

// The e2e run uses the production build (`pnpm build` first), the same server `pnpm finora` starts.
/** @type {import("@playwright/test").PlaywrightTestConfig} */
const config = {
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, grepInvert: /@visual/u },
    // The same checks that depend on engine behaviour (focus, popovers, sheets, theme) run in all three engines.
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testMatch: ENGINE_SPECS },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testMatch: ENGINE_SPECS },
    // Screenshot comparison: Linux only, `pnpm e2e:visual` (CI job `visual`).
    { name: "visual", use: { ...devices["Desktop Chrome"] }, grep: /@visual/u },
  ],
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
  webServer: {
    command: "node scripts/run-next.mjs start",
    url: `http://127.0.0.1:${PORT}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // The shell may hand down a development NODE_ENV and another app's Next.js internals. The run script must
    // not let either reach the server: security-headers.spec.ts checks that the policy is the production one.
    // The secrets hold sentinel values, so secrets.spec.ts can look for them in what the running server sends.
    env: {
      FINORA_PORT: String(PORT),
      FINORA_DEMO: "1",
      NODE_ENV: "development",
      __NEXT_PRIVATE_TEST: "1",
      ...Object.fromEntries(SECRET_NAMES.map((name) => [name, sentinelFor(name)])),
    },
  },
};

export default defineConfig(config);
