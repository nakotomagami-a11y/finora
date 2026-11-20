import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/run-next.mjs start",
    url: `http://127.0.0.1:${PORT}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { FINORA_PORT: String(PORT), FINORA_DEMO: "1" },
  },
};

export default defineConfig(config);
