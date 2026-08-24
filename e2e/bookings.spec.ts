import { expect, test } from "@playwright/test";

test("sends guests from /bookings to login", async ({ page }) => {
  await page.goto("/bookings");

  await expect(page).toHaveURL((url) => {
    return url.pathname === "/auth" && url.searchParams.get("redirectTo") === "/bookings";
  });
});

test("keeps the bookings tab on the login redirect", async ({ page }) => {
  await page.goto("/bookings?status=completed");

  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === "/auth" &&
      url.searchParams.get("redirectTo") === "/bookings?status=completed"
    );
  });
});

test("renders the bookings list fixture and empty tab", async ({ page }) => {
  await page.goto("/__visual/bookings");

  await expect(page.getByRole("heading", { name: "Your Bookings" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Completed/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { name: /Toyota Camry/ })).toBeVisible();

  await page.getByRole("link", { name: /Active/ }).click();

  await expect(page).toHaveURL(/status=active/);
  await expect(page.getByText("No active bookings")).toBeVisible();
});
