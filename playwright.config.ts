import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * Derive a dedicated E2E database URL from the dev DATABASE_URL
 * by appending "_e2e" to the database name.
 *
 * e.g. postgresql://user@localhost:5432/mydb → postgresql://user@localhost:5432/mydb_e2e
 */
function getE2EDatabaseUrl(): string {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error("DATABASE_URL must be set in .env to derive the E2E database URL");
  }
  const url = new URL(devUrl);
  const dbName = url.pathname.slice(1).replace(/\?.*/, "");
  url.pathname = `/${dbName}_e2e`;
  return url.toString();
}

const e2eDatabaseUrl = getE2EDatabaseUrl();

// Make available to globalSetup (runs in the same process as config evaluation)
process.env.E2E_DATABASE_URL = e2eDatabaseUrl;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: [["html"], ["list"]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev --port 5174",
    url: "http://localhost:5174",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      E2E_TESTING: "true",
      EMAIL_PROVIDER: "console",
      DATABASE_URL: e2eDatabaseUrl,
      DOMAIN: "http://localhost:5174",
    },
  },
});
