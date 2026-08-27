import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  env: {
    APP_ENV: "local",
    APP_ORIGIN: "http://localhost:5173",
  },
}));

import {
  createPaymentStatusSession,
  paymentStatusClearCookie,
  paymentStatusSetCookie,
  readPaymentStatusSession,
} from "./payment-status-session.server";

describe("payment status session", () => {
  it("encrypts and restores the guest status credential in an HttpOnly cookie", async () => {
    const session = createPaymentStatusSession({
      bookingId: "booking-1",
      txRef: "tx-1",
      paymentStatusToken: "guest-secret-token",
      reservationExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    const setCookie = await paymentStatusSetCookie(session);
    const cookie = setCookie.split(";")[0];

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain("guest-secret-token");
    await expect(
      readPaymentStatusSession(
        new Request("http://localhost:5173/bookings/payment-status", {
          headers: { Cookie: cookie },
        }),
      ),
    ).resolves.toEqual(session);
  });

  it("clears the scoped credential after a terminal status", () => {
    expect(paymentStatusClearCookie()).toContain("payment_status=;");
    expect(paymentStatusClearCookie()).toContain("Max-Age=0");
  });
});
