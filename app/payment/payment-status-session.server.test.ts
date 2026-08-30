import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  env: {
    APP_ENV: "local",
    APP_ORIGIN: "http://localhost:5173",
  },
}));

import {
  createExtensionPaymentStatusSession,
  createPaymentStatusSession,
  paymentStatusClearCookies,
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
        session.txRef,
      ),
    ).resolves.toEqual(session);
  });

  it("clears the scoped credential after a terminal status", async () => {
    const cookies = await paymentStatusClearCookies("tx-1");

    expect(cookies).toHaveLength(2);
    expect(cookies.every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
  });

  it("stores the extension identity without a guest payment token", async () => {
    const session = createExtensionPaymentStatusSession({
      bookingId: "booking-1",
      extensionId: "extension-1",
      txRef: "ext-tx-1",
    });
    const setCookie = await paymentStatusSetCookie(session);
    const cookie = setCookie.split(";")[0];

    await expect(
      readPaymentStatusSession(
        new Request("http://localhost:5173/bookings/payment-status", {
          headers: { Cookie: cookie },
        }),
        session.txRef,
      ),
    ).resolves.toEqual(session);
    expect(setCookie).not.toContain("extension-1");
  });

  it("keeps concurrent payment callbacks in separate cookies", async () => {
    const first = createExtensionPaymentStatusSession({
      bookingId: "booking-1",
      extensionId: "extension-1",
      txRef: "ext-tx-1",
    });
    const second = createExtensionPaymentStatusSession({
      bookingId: "booking-2",
      extensionId: "extension-2",
      txRef: "ext-tx-2",
    });
    const firstCookie = (await paymentStatusSetCookie(first)).split(";")[0];
    const secondCookie = (await paymentStatusSetCookie(second)).split(";")[0];
    const request = new Request("http://localhost:5173/bookings/payment-status", {
      headers: { Cookie: `${firstCookie}; ${secondCookie}` },
    });

    await expect(readPaymentStatusSession(request, first.txRef)).resolves.toEqual(first);
    await expect(readPaymentStatusSession(request, second.txRef)).resolves.toEqual(second);
    expect(firstCookie.split("=")[0]).not.toBe(secondCookie.split("=")[0]);
  });

  it("keeps a minimum polling lifetime when the reservation expiry is stale", () => {
    const now = new Date("2026-08-27T15:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      const session = createPaymentStatusSession({
        bookingId: "booking-1",
        txRef: "tx-1",
        paymentStatusToken: "guest-secret-token",
        reservationExpiresAt: "2026-08-27T14:00:00.000Z",
      });

      expect(session.expiresAt).toBe(now.getTime() + 5 * 60 * 1000);
    } finally {
      vi.useRealTimers();
    }
  });
});
