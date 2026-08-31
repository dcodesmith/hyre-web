import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  env: {
    APP_ENV: "local",
    APP_ORIGIN: "http://localhost:5173",
  },
}));

import {
  createGuestBookingSession,
  guestBookingClearCookie,
  guestBookingSetCookie,
  readGuestBookingSession,
} from "./guest-booking-session.server";

const TOKEN = "a".repeat(43);

describe("guest booking session", () => {
  it("encrypts and scopes the guest token in an HttpOnly cookie", async () => {
    const session = createGuestBookingSession({
      bookingId: "booking-1",
      token: TOKEN,
      accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    const setCookie = await guestBookingSetCookie(session);
    const cookie = setCookie.split(";")[0];

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain(TOKEN);
    await expect(
      readGuestBookingSession(
        new Request("http://localhost:5173/bookings/booking-1", {
          headers: { Cookie: cookie },
        }),
        "booking-1",
      ),
    ).resolves.toEqual(session);
    await expect(
      readGuestBookingSession(
        new Request("http://localhost:5173/bookings/booking-2", {
          headers: { Cookie: cookie },
        }),
        "booking-2",
      ),
    ).resolves.toBeNull();
  });

  it("rejects an expired session and creates a clearing cookie", async () => {
    const now = new Date("2026-08-30T16:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      const session = createGuestBookingSession({
        bookingId: "booking-1",
        token: TOKEN,
        accessExpiresAt: new Date(now.getTime() + 1000).toISOString(),
      });
      const cookie = (await guestBookingSetCookie(session)).split(";")[0];
      vi.setSystemTime(new Date(now.getTime() + 2000));

      await expect(
        readGuestBookingSession(
          new Request("http://localhost:5173/bookings/booking-1", {
            headers: { Cookie: cookie },
          }),
          "booking-1",
        ),
      ).resolves.toBeNull();
      await expect(guestBookingClearCookie("booking-1")).resolves.toContain("Max-Age=0");
    } finally {
      vi.useRealTimers();
    }
  });
});
