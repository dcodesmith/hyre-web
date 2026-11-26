import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import { startMockFleetOwnerAuthApi, stopMockFleetOwnerAuthApi } from "./mock-fleet-owner-auth-api";

async function choosePayoutBank(page: Page, name: string) {
  const bank = page.getByRole("combobox", { name: "Bank" });
  const option = page.getByRole("option", { name, exact: true });

  await bank.scrollIntoViewIfNeeded();
  await expect(async () => {
    await bank.click();
    await bank.fill(name);
    await expect(option).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await option.click();
  await expect(bank).toHaveValue(name);
}

async function signInFleetOwner(context: BrowserContext, page: Page, baseURL: string) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "tripdly-cookie-consent:v1",
      JSON.stringify({ analytics: false, timestamp: 1 }),
    );
  });
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "e2e-session",
      url: baseURL,
    },
  ]);
}

test("completes staged fleet-owner onboarding through phone, identity, payout, driving, and submit", async ({
  baseURL,
  context,
  page,
}) => {
  const api = await startMockFleetOwnerAuthApi({ stagedOnboarding: true });

  try {
    await signInFleetOwner(context, page, baseURL ?? "http://localhost:5174");
    await page.goto("/fleet-owner");
    await expect(page).toHaveURL("/fleet-owner/onboarding");
    await expect(page.getByRole("heading", { name: "Become a fleet owner" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verify your phone number" })).toBeVisible();

    const phone = page.getByLabel("Phone number");
    const sendCode = page.getByRole("button", { name: "Send verification code" });
    await expect(async () => {
      await phone.fill("+2348012345678");
      await expect(phone).toHaveValue("+2348012345678");
      await sendCode.click();
      await expect(page.getByRole("heading", { name: "Enter verification code" })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass();
    await expect(page.getByText("Code sent to +2348012345678")).toBeVisible();

    await page.getByLabel("Verification code").fill("123456");
    await page.getByRole("button", { name: "Verify phone" }).click();
    await expect(page.getByRole("heading", { name: "Select account type" })).toBeVisible();

    await page.getByLabel("National Identification Number").fill("12345678901");
    await page.getByRole("button", { name: "Verify Identity" }).click();
    await expect(page.getByText("Identity verified")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Set payout account" })).toBeVisible();
    await expect(page.getByText("JOHN MIDDLE DOE")).toBeVisible();

    await choosePayoutBank(page, "GTBank");
    await page.getByLabel("Account Number").fill("0123456789");
    await page.getByRole("button", { name: "Add Bank" }).click();
    await expect(page.getByRole("heading", { name: "Driving credentials" })).toBeVisible();

    await page.getByRole("radio", { name: "No" }).check();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByRole("heading", { name: "Review and submit" })).toBeVisible();
    await expect(page.getByText("Driving the car yourself")).toBeVisible();

    await page.getByRole("button", { name: "Submit details" }).click();
    await expect(page.getByRole("heading", { name: "Submitted for review" })).toBeVisible();
    await expect(page.getByText("Review in progress")).toBeVisible();
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
