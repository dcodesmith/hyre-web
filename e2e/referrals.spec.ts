import { expect, type Page, test } from "@playwright/test";

import { MOCK_REFERRAL_CODE, startMockReferralApi, stopMockReferralApi } from "./mock-referral-api";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

async function stubClipboardWrite(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });
}

test("sends guests from /referrals to login", async ({ page }) => {
  await page.goto("/referrals");

  await expect(page).toHaveURL((url) => {
    return url.pathname === "/auth" && url.searchParams.get("redirectTo") === "/referrals";
  });
});

test("loads the signed-in referral summary from the API", async ({ context, page }) => {
  const api = await startMockReferralApi();

  try {
    await setCookiePreference(page);
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "e2e-session",
        url: "http://localhost:5174",
      },
    ]);
    await page.goto("/referrals");

    await expect(page).toHaveURL(/\/referrals$/);
    await expect(page.getByRole("heading", { name: "Referral Program" })).toBeVisible();
    await expect(page.locator("code")).toContainText(MOCK_REFERRAL_CODE);
    // wrangler.jsonc APP_ORIGIN, not Playwright's :5174 origin
    await expect(page.getByLabel("Share Link:")).toHaveValue(
      `http://localhost:5173/auth?ref=${MOCK_REFERRAL_CODE}`,
    );
    await expect(page.getByLabel("Share Link:")).not.toHaveValue(
      "https://api.example/auth?ref=ABCD2345",
    );
    await expect(page.getByLabel("Referral statistics")).toContainText("Available Credits");
    await expect(page.getByRole("heading", { name: "Recent Rewards" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Referrals" })).toBeVisible();
  } finally {
    await stopMockReferralApi(api);
  }
});

test("renders referral details and copies the referral code", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/referrals");

  await expect(page.getByRole("heading", { name: "Referral Program" })).toBeVisible();
  await expect(page.locator("code")).toContainText("ADA2026X");
  await expect(page.getByLabel("Referral statistics")).toContainText("Available Credits");
  await expect(page.getByRole("heading", { name: "Recent Rewards" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Referrals" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();

  await stubClipboardWrite(page);
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();

  await page.getByRole("button", { name: "Copy referral link" }).click();
  await expect(page.getByText("Referral link copied to clipboard.")).toBeVisible();
});

test("shows when the referral program is disabled", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/referrals?disabled=true");

  await expect(page.getByText("Referral Program Temporarily Disabled")).toBeVisible();
  await expect(page.getByText("New referrals cannot be processed at this time.")).toBeVisible();
});
