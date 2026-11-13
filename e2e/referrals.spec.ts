import { expect, type Page, test } from "@playwright/test";

import { clickUntilVisible } from "./click-until";
import { MOCK_REFERRAL_CODE, startMockReferralApi, stopMockReferralApi } from "./mock-referral-api";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

async function stubClipboardWrite(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      writable: true,
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
    await expect(page.getByLabel("Your Referral Code")).toHaveValue(MOCK_REFERRAL_CODE);
    // wrangler.jsonc APP_ORIGIN, not Playwright's :5174 origin
    await expect(page.getByLabel("Your Referral Link")).toHaveValue(
      `http://localhost:5173/r/${MOCK_REFERRAL_CODE}`,
    );
    await expect(page.getByLabel("Your Referral Link")).not.toHaveValue(
      "https://api.example/r/ABCD2345",
    );
    await expect(page.getByText("Available Credits")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Referral History" })).toBeVisible();
  } finally {
    await stopMockReferralApi(api);
  }
});

test("renders referral details and copies the referral code", async ({ page }) => {
  await setCookiePreference(page);
  await stubClipboardWrite(page);
  await page.goto("/__visual/referrals");

  await expect(page.getByRole("heading", { name: "Referral Program" })).toBeVisible();
  await expect(page.getByLabel("Your Referral Code")).toHaveValue("ADA2026X");
  await expect(page.getByText("Available Credits")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Referral History" })).toBeVisible();

  await clickUntilVisible(
    page.getByLabel("Your Referral Code").locator("..").getByRole("button", { name: "Copy" }),
    page.getByRole("button", { name: "Copied!" }),
  );

  await clickUntilVisible(
    page.getByLabel("Your Referral Link").locator("..").getByRole("button", { name: "Copy" }),
    page.getByRole("button", { name: "Copied!" }),
  );
});

test("shows when the referral program is disabled", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/referrals?disabled=true");

  await expect(page.getByText("Referral program temporarily closed")).toBeVisible();
  await expect(page.getByText("New referrals cannot be processed at this time.")).toBeVisible();
});
