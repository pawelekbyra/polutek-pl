import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.E2E_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3000";
const reuseExistingServer =
  !!process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_REUSE_SERVER === "true";
const webServerCommand = process.env.E2E_WEB_SERVER_COMMAND || "npm run dev";
const mainCreatorSlug =
  process.env.MAIN_CREATOR_SLUG ||
  process.env.E2E_CREATOR_SLUG ||
  "main-creator";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: reuseExistingServer
    ? undefined
    : {
        command: webServerCommand,
        url: baseURL,
        env: {
          ...process.env,
          ENABLE_DEMO_FALLBACKS: process.env.ENABLE_DEMO_FALLBACKS || "true",
          MAIN_CREATOR_SLUG: mainCreatorSlug,
        },
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
