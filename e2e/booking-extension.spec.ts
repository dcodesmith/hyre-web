import { expect, test } from "@playwright/test";

import {
  MOCK_EXTENSION_BOOKING_ID,
  MOCK_EXTENSION_ID,
  MOCK_EXTENSION_LEG_ID,
  MOCK_EXTENSION_TX_REF,
  startMockBookingExtensionApi,
  stopMockBookingExtensionApi,
} from "./mock-booking-extension-api";

test("extends an eligible booking leg and confirms its payment", async ({ context, page }) => {
  const api = await startMockBookingExtensionApi();

  try {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "customer-e2e-session",
        url: "http://localhost:5174",
      },
    ]);
    await page.route("https://checkout.flutterwave.com/**", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: "<title>Secure checkout</title><h1>Secure checkout</h1>",
      });
    });

    await page.goto(`/bookings/${MOCK_EXTENSION_BOOKING_ID}`);
    await page.getByRole("link", { name: "Extend Trip" }).click();
    await expect(page).toHaveURL(`/bookings/${MOCK_EXTENSION_BOOKING_ID}/extend`);
    await expect(page.getByRole("heading", { name: "Extend Trip" })).toBeVisible();

    await page.locator('select[name="hours"]').selectOption("2");
    await page.getByRole("button", { name: "Continue to payment" }).click();

    await expect(page).toHaveURL("https://checkout.flutterwave.com/pay/mock-extension");
    await expect
      .poll(() => api.requests.extensionBody)
      .toEqual({
        bookingLegId: MOCK_EXTENSION_LEG_ID,
        hours: 2,
        callbackUrl: "http://localhost:5173/bookings/payment-status",
      });
    expect(api.requests.extensionIdempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await page.goto(
      `/bookings/payment-status?tx_ref=${MOCK_EXTENSION_TX_REF}&transaction_id=123456`,
    );

    await expect(page.getByRole("heading", { name: "Extension payment confirmed" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View booking" })).toHaveAttribute(
      "href",
      `/bookings/${MOCK_EXTENSION_BOOKING_ID}`,
    );
    await expect
      .poll(() => api.requests.confirmationBody)
      .toEqual({
        extensionId: MOCK_EXTENSION_ID,
        txRef: MOCK_EXTENSION_TX_REF,
        transactionId: "123456",
      });
  } finally {
    await stopMockBookingExtensionApi(api);
  }
});
