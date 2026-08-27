import { expect, type Page, test } from "@playwright/test";

import { expectVisualScreenshot } from "../expect-visual-screenshot";

const consentKey = "tripdly-cookie-consent:v1";

async function visitReferrals(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
  await page.goto("/__visual/referrals");
  await page.evaluate(() => document.fonts.ready);
}

test("renders the referral program at its responsive breakpoint", async ({ page }) => {
  await visitReferrals(page);

  await expect(page.getByRole("heading", { name: "Referral Program" })).toBeVisible();
  await expectVisualScreenshot(page, "referrals.png", { fullPage: true });
});
