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

test("sends guests from a booking detail URL to login", async ({ page }) => {
  await page.goto("/bookings/booking-detail-1");

  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === "/auth" &&
      url.searchParams.get("redirectTo") === "/bookings/booking-detail-1"
    );
  });
});

test("renders the booking detail fixture", async ({ page }) => {
  await page.goto("/__visual/booking");

  await expect(page.getByRole("heading", { name: "Lexus UX F-Sport (2019)" })).toBeVisible();
  await expect(page.getByText("TD-1001")).toBeVisible();
  await expect(page.getByText("Trip Timeline")).toBeVisible();
  await expect(page.getByText("Murtala Muhammed Airport, Ikeja")).toBeVisible();
  await expect(page.getByText("Bola Adebayo")).toBeVisible();
  await expect(page.getByText("Payment Summary")).toBeVisible();
  await expect(page.getByText("Total Amount")).toBeVisible();
  await expect(page.getByRole("link", { name: /Back to Bookings/ }).first()).toBeVisible();
});

test("sends a list fixture row to login for its booking", async ({ page }) => {
  await page.goto("/__visual/bookings");
  await page.getByRole("link", { name: /Toyota Camry/ }).click();

  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === "/auth" &&
      url.searchParams.get("redirectTo") === "/bookings/booking-completed-1"
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
