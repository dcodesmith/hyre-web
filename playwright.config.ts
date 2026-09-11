import { defineConfig } from "@playwright/test";

const baseURL = "http://localhost:5174";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    browserName: "chromium",
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "en-GB",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile-375",
      use: { viewport: { width: 375, height: 812 } },
    },
    {
      name: "tablet-768",
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop-1280",
      use: { viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: {
    command: "CLOUDFLARE_ENV=e2e pnpm dev --port 5174",
    env: {
      VISUAL_TESTING: "true",
    },
    reuseExistingServer: false,
    timeout: 180_000,
    url: `${baseURL}/__visual/public-shell`,
  },
});
