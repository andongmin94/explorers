import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests (tests/*.spec.ts) against a dev server of their own.
// Locally they use the installed Chrome; in CI run `npx playwright install
// chromium` first (CI=1 switches to Playwright's Chromium).
const port = 5199;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/cpu/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
