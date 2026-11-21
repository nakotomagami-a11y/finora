import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const ENGINE_SPECS = /(smoke|csp|design\.keyboard|design\.overlays|theme|fonts)\.spec\.ts$/u;

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
    env: { FINORA_PORT: String(PORT), FINORA_DEMO: "1" },
  },
};

export default defineConfig(config);
