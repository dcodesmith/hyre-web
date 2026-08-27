import { expect, test } from "@playwright/test";

test("sends guests from /referrals to login", async ({ page }) => {
  await page.goto("/referrals");

  await expect(page).toHaveURL((url) => {
    return url.pathname === "/auth" && url.searchParams.get("redirectTo") === "/referrals";
  });
});

test("renders referral details and copies the referral code", async ({
  context,
  page,
  baseURL,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(baseURL ?? "http://localhost:5174").origin,
  });
  await page.goto("/__visual/referrals");

  await expect(page.getByRole("heading", { name: "Referral Program" })).toBeVisible();
  await expect(page.locator("code")).toContainText("ADA2026X");
  await expect(page.getByLabel("Referral statistics")).toContainText("Available Credits");
  await expect(page.getByRole("heading", { name: "Recent Rewards" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Referrals" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();

  await page.getByRole("button", { name: "Copy", exact: true }).click();

  await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe("ADA2026X");

  await page.getByRole("button", { name: "Copy referral link" }).click();

  await expect(page.getByText("Referral link copied to clipboard.")).toBeVisible();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    "https://tripdly.com/auth?ref=ADA2026X",
  );
});

test("shows when the referral program is disabled", async ({ page }) => {
  await page.goto("/__visual/referrals?disabled=true");

  await expect(page.getByText("Referral Program Temporarily Disabled")).toBeVisible();
  await expect(page.getByText("New referrals cannot be processed at this time.")).toBeVisible();
});
