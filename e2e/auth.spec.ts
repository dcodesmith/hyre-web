import { expect, test } from "@playwright/test";

test("renders the customer login form", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Terms of Service/ })).toBeVisible();
});

test("sends an unauthenticated verify visit back to login", async ({ page }) => {
  await page.goto("/verify");
  await expect(page).toHaveURL(/\/auth$/);
});
