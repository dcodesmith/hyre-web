import { expect, type Page, test } from "@playwright/test";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

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
  await setCookiePreference(page);
  await page.goto("/__visual/booking");

  await expect(page.getByRole("heading", { name: "Lexus UX F-Sport (2019)" })).toBeVisible();
  await expect(page.getByText("TD-1001")).toBeVisible();
  await expect(page.getByText("Trip Timeline")).toBeVisible();
  await expect(page.getByText("Murtala Muhammed Airport, Ikeja")).toBeVisible();
  await expect(page.getByText("Bola Adebayo")).toBeVisible();
  await expect(page.getByText("Payment Summary")).toBeVisible();
  await expect(page.getByText("Total Amount")).toBeVisible();
  await expect(page.getByRole("link", { name: /Back to Bookings/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel Booking" })).toHaveCount(0);
});

test("renders the cancellable booking fixture and confirm dialog", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/booking-cancel");

  const cancelTrigger = page.getByRole("button", { name: "Cancel Booking" });
  const confirmDialog = page.getByRole("dialog", { name: "Cancel Booking" });
  await expect(cancelTrigger).toBeVisible();
  await expect(async () => {
    if (await confirmDialog.isVisible()) {
      return;
    }

    await cancelTrigger.scrollIntoViewIfNeeded();
    await cancelTrigger.click();
    await expect(confirmDialog).toBeVisible();
  }).toPass();

  await expect(page).toHaveURL(/\/__visual\/booking-cancel$/);
  await expect(page.getByText("This action cannot be undone")).toBeVisible();
  await expect(page.getByText("A refund will be processed automatically.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yes, Cancel Booking" })).toBeVisible();

  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await expect(page).toHaveURL(/\/__visual\/booking-cancel$/);
  await expect(confirmDialog).toHaveCount(0);
});

test("closes the cancel dialog after a successful confirm", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/booking-cancel");

  const cancelTrigger = page.getByRole("button", { name: "Cancel Booking" });
  const confirmDialog = page.getByRole("dialog", { name: "Cancel Booking" });
  await expect(async () => {
    if (await confirmDialog.isVisible()) {
      return;
    }

    await cancelTrigger.scrollIntoViewIfNeeded();
    await cancelTrigger.click();
    await expect(confirmDialog).toBeVisible();
  }).toPass();

  await page.getByRole("button", { name: "Yes, Cancel Booking" }).click();

  await expect(confirmDialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/__visual\/booking-cancel$/);
});

test("sends an unauthenticated cancel POST to login", async ({ page, baseURL }) => {
  const response = await page.request.post("/bookings/booking-detail-1", {
    form: { intent: "cancel" },
    headers: {
      origin: new URL(baseURL ?? "http://localhost:5174").origin,
      "sec-fetch-site": "same-origin",
    },
  });

  expect(new URL(response.url()).pathname).toBe("/auth");
  expect(new URL(response.url()).searchParams.get("redirectTo")).toBe("/bookings/booking-detail-1");
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
