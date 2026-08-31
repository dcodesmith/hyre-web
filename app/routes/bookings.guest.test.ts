import { beforeEach, describe, expect, it, vi } from "vitest";

const { createGuestBookingSession, getGuestBooking, guestBookingSetCookie } = vi.hoisted(() => ({
  createGuestBookingSession: vi.fn(),
  getGuestBooking: vi.fn(),
  guestBookingSetCookie: vi.fn(async () => "guest_booking=encrypted; HttpOnly"),
}));

vi.mock("~/api/bookings/bookings.server", () => ({ getGuestBooking }));
vi.mock("~/booking/guest-booking-session.server", () => ({
  createGuestBookingSession,
  guestBookingSetCookie,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { loader } from "./bookings.guest";

const TOKEN = "a".repeat(43);

async function runLoader(token = TOKEN) {
  return loader({
    request: new Request(`https://tripdly.com/bookings/guest?token=${token}`),
    params: {},
  } as Parameters<typeof loader>[0]);
}

describe("guest booking token exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the token server-side and redirects to the clean booking URL", async () => {
    getGuestBooking.mockResolvedValue({
      data: {
        bookingId: "booking-1",
        accessExpiresAt: "2099-01-01T00:15:00.000Z",
      },
    });
    createGuestBookingSession.mockReturnValue({
      bookingId: "booking-1",
      token: TOKEN,
      expiresAt: Date.parse("2099-01-01T00:15:00.000Z"),
    });

    const response = await runLoader().catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/bookings/booking-1");
    expect((response as Response).headers.get("set-cookie")).not.toContain(TOKEN);
    expect((response as Response).headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("rejects malformed tokens without calling the API", async () => {
    const response = await runLoader("not-a-token").catch((error: unknown) => error);

    expect(getGuestBooking).not.toHaveBeenCalled();
    expect((response as Response).headers.get("location")).toBe(
      "/bookings/lookup?status=invalid-link",
    );
  });

  it("removes a rejected token from the URL", async () => {
    getGuestBooking.mockRejectedValue(
      new ApiRequestError("http", HTTP_STATUS.NOT_FOUND, {
        type: "BOOKING_NOT_FOUND",
        title: "Not found",
        status: HTTP_STATUS.NOT_FOUND,
        detail: "Not found",
        instance: "/api/bookings/guest-access",
      }),
    );

    const response = await runLoader().catch((error: unknown) => error);

    expect((response as Response).headers.get("location")).toBe(
      "/bookings/lookup?status=invalid-link",
    );
    expect((response as Response).headers.get("location")).not.toContain(TOKEN);
  });

  it("removes the token when the protected session cannot be created", async () => {
    getGuestBooking.mockResolvedValue({
      data: {
        bookingId: "booking-1",
        accessExpiresAt: "2099-01-01T00:15:00.000Z",
      },
    });
    createGuestBookingSession.mockImplementation(() => {
      throw new Error("WEB_SESSION_SECRET is required");
    });

    const response = await runLoader().catch((error: unknown) => error);

    expect((response as Response).headers.get("location")).toBe(
      "/bookings/lookup?status=unavailable",
    );
    expect((response as Response).headers.get("location")).not.toContain(TOKEN);
  });
});
