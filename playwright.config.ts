import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.TEST_URL || process.env.APP_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    ignoreHTTPSErrors: Boolean(process.env.PROJECTHUB_TEST_TLS_CERT),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: process.env.TEST_URL
    ? undefined
    : {
        command: process.env.CI ? "node .next/standalone/server.js" : "npm run dev",
        env: { HOSTNAME: "127.0.0.1", PORT: "3000" },
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
      },
});
