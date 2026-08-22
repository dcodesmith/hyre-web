import { expect, test } from "@playwright/test";

test("renders the customer login form", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("link", { name: "Tripdly" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Referral code (optional)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Terms/ })).toBeVisible();
});

test("logo returns to the home page", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("link", { name: "Tripdly" }).click();
  await expect(page).toHaveURL("/");
});

test("shows inline field errors without native validation", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Email address is not valid.")).toBeVisible();
  await expect(
    page.getByText("You must accept the Terms of Service and Privacy Policy"),
  ).toBeVisible();
});

test("clears only the terms error after the checkbox is checked", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Continue" }).click();

  const termsError = page.getByText("You must accept the Terms of Service and Privacy Policy");
  await expect(termsError).toBeVisible();

  await page.getByRole("checkbox", { name: /Terms/ }).check();

  await expect(termsError).toBeHidden();
  await expect(page.getByText("Email address is not valid.")).toBeVisible();
});

test("sends an unauthenticated verify visit back to login", async ({ page }) => {
  await page.goto("/verify");
  await expect(page).toHaveURL(/\/auth$/);
});

test("locks a valid referral from the URL and leaves an invalid one editable", async ({ page }) => {
  await page.goto("/auth?ref=ABCD2345");
  await expect(page.getByText("Referral code: ABCD2345")).toBeVisible();
  await expect(page.getByPlaceholder("Referral code (optional)")).toHaveCount(0);

  await page.goto("/auth?ref=nope");
  await expect(page.getByPlaceholder("Referral code (optional)")).toBeVisible();
  await expect(page.getByText("Referral code: NOPE")).toHaveCount(0);
});

test("keeps redirectTo and referral when verify has no pending OTP", async ({ page }) => {
  await page.goto("/verify?redirectTo=/cars/test-car&ref=ABCD2345");
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === "/auth" &&
      url.searchParams.get("redirectTo") === "/cars/test-car" &&
      url.searchParams.get("ref") === "ABCD2345"
    );
  });
});
