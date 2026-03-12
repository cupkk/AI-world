import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.PLAYWRIGHT_PORT || 4173);
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${e2ePort} --host 127.0.0.1 --strictPort`,
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
