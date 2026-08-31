import { expect, type Page, test } from "@playwright/test";

import {
  MOCK_GUEST_BOOKING_ID,
  MOCK_GUEST_BOOKING_TOKEN,
  startMockGuestBookingApi,
  stopMockGuestBookingApi,
} from "./mock-guest-booking-api";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

test("requests and opens a read-only guest booking", async ({ context, page }) => {
  const api = await startMockGuestBookingApi();

  try {
    await setCookiePreference(page);
    await page.goto("/bookings/lookup");

    await expect(page.getByRole("heading", { name: "Find your booking" })).toBeVisible();
    await page.getByLabel("Booking reference").fill(" bk-guest-001 ");
    await page.getByLabel("Email address").fill(" Guest@Example.com ");
    await page.getByRole("button", { name: "Email me an access link" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Check your email" })).toBeVisible();
    await expect
      .poll(() => api.requests.accessBody)
      .toEqual({
        bookingReference: "BK-GUEST-001",
        email: "guest@example.com",
      });

    await page.goto(`/bookings/guest?token=${MOCK_GUEST_BOOKING_TOKEN}`);

    await expect(page).toHaveURL(`/bookings/${MOCK_GUEST_BOOKING_ID}`);
    await expect(page.getByRole("heading", { name: "Lexus UX F-Sport (2019)" })).toBeVisible();
    await expect(page.getByText("Guest access is read-only.")).toBeVisible();
    await expect(page.getByText("Murtala Muhammed Airport, Ikeja")).toBeVisible();
    await expect(page.getByText("Payment Summary")).toBeVisible();
    await expect(page.getByText("Total Amount")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to booking lookup" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel Booking" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Modify Booking" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Write a Review" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Extend Trip" })).toHaveCount(0);
    const receiptPath = `/bookings/${MOCK_GUEST_BOOKING_ID}/receipt`;
    await expect(page.getByRole("link", { name: "Download Receipt" })).toHaveAttribute(
      "href",
      receiptPath,
    );

    const receipt = await page.request.get(receiptPath);
    expect(receipt.status()).toBe(200);
    expect(receipt.headers()["cache-control"]).toBe("private, no-store");
    expect(receipt.headers()["content-disposition"]).toBe(
      'attachment; filename="Tripdly-receipt-BK-GUEST-001.pdf"',
    );
    expect((await receipt.body()).subarray(0, 4).toString()).toBe("%PDF");
    expect(api.requests.receiptToken).toBe(MOCK_GUEST_BOOKING_TOKEN);
    expect(api.requests.token).toBe(MOCK_GUEST_BOOKING_TOKEN);

    const guestCookie = (await context.cookies()).find((cookie) =>
      cookie.name.includes("guest_booking_"),
    );
    expect(guestCookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(guestCookie?.value).not.toContain(MOCK_GUEST_BOOKING_TOKEN);
  } finally {
    await stopMockGuestBookingApi(api);
  }
});

test("removes an invalid guest token from the browser URL", async ({ page }) => {
  const api = await startMockGuestBookingApi();

  try {
    await setCookiePreference(page);
    await page.goto(`/bookings/guest?token=${"b".repeat(43)}`);

    await expect(page).toHaveURL("/bookings/lookup?status=invalid-link");
    await expect(
      page.getByRole("alert").filter({ hasText: "Unable to open booking" }),
    ).toBeVisible();
    expect(page.url()).not.toContain("token");
  } finally {
    await stopMockGuestBookingApi(api);
  }
});
