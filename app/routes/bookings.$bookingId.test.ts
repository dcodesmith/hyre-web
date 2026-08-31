import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cancelBooking,
  getBookingById,
  getGuestBooking,
  guestBookingClearCookie,
  readGuestBookingSession,
  updateBooking,
} = vi.hoisted(() => ({
  cancelBooking: vi.fn(),
  getBookingById: vi.fn(),
  getGuestBooking: vi.fn(),
  guestBookingClearCookie: vi.fn(async () => "guest_booking=; Max-Age=0"),
  readGuestBookingSession: vi.fn(),
  updateBooking: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/bookings/bookings.server", () => ({
  cancelBooking,
  getBookingById,
  getGuestBooking,
  updateBooking,
}));
vi.mock("~/booking/guest-booking-session.server", () => ({
  guestBookingClearCookie,
  readGuestBookingSession,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { action, loader, shouldRevalidate } from "./bookings.$bookingId";

const SESSION_COOKIE = "better-auth.session_token=test-session";

function httpError(status: number, detail: string, kind: "aborted" | "http" = "http") {
  return new ApiRequestError(kind, status, {
    type: "UPSTREAM_HTTP_ERROR",
    title: "Error",
    status,
    detail,
  });
}

async function runAction({
  bookingId = "booking-1",
  cookie = SESSION_COOKIE,
  form = { intent: "cancel" },
}: {
  bookingId?: string;
  cookie?: string;
  form?: Record<string, string>;
} = {}) {
  const formData = new FormData();

  for (const [name, value] of Object.entries(form)) {
    formData.set(name, value);
  }

  return action({
    request: new Request("https://hyre.example/bookings/booking-1", {
      method: "POST",
      headers: cookie ? { cookie } : undefined,
      body: formData,
    }),
    params: { bookingId },
  } as Parameters<typeof action>[0]);
}

const guestBooking = {
  bookingId: "booking-1",
  bookingReference: "BK-123",
  status: "CONFIRMED",
  paymentStatus: "PAID",
  bookingType: "DAY",
  startDate: "2026-09-21T08:00:00.000Z",
  endDate: "2026-09-21T20:00:00.000Z",
  pickupLocation: "Ikeja",
  returnLocation: "Lekki",
  specialRequests: null,
  cancellationReason: null,
  flightNumber: null,
  totalAmount: 50_000,
  currency: "NGN",
  accessExpiresAt: "2026-09-21T12:15:00.000Z",
  car: { make: "Toyota", model: "Camry", year: 2025, images: [] },
  chauffeur: { name: "Bola", phoneNumber: "08000000000" },
  legs: [
    {
      id: "leg-1",
      legDate: "2026-09-21T00:00:00.000Z",
      legStartTime: "2026-09-21T08:00:00.000Z",
      legEndTime: "2026-09-21T20:00:00.000Z",
      extensions: [],
    },
  ],
};

async function runLoader(cookie = "") {
  return loader({
    request: new Request("https://hyre.example/bookings/booking-1", {
      headers: cookie ? { cookie } : undefined,
    }),
    params: { bookingId: "booking-1" },
  } as Parameters<typeof loader>[0]);
}

describe("booking detail loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the redacted booking through a scoped guest session", async () => {
    readGuestBookingSession.mockResolvedValue({ bookingId: "booking-1", token: "a".repeat(43) });
    getGuestBooking.mockResolvedValue({ data: guestBooking });

    await expect(runLoader()).resolves.toMatchObject({
      accessMode: "guest",
      booking: {
        id: "booking-1",
        canEdit: false,
        canCancel: false,
        legs: [{ canExtend: false }],
      },
    });
    expect(getBookingById).not.toHaveBeenCalled();
    expect(getGuestBooking).toHaveBeenCalledWith({
      request: expect.any(Request),
      token: "a".repeat(43),
    });
  });

  it("falls back to valid guest access when a signed-in account does not own the booking", async () => {
    getBookingById.mockRejectedValue(httpError(HTTP_STATUS.NOT_FOUND, "Not found"));
    readGuestBookingSession.mockResolvedValue({ bookingId: "booking-1", token: "a".repeat(43) });
    getGuestBooking.mockResolvedValue({ data: guestBooking });

    await expect(runLoader(SESSION_COOKIE)).resolves.toMatchObject({ accessMode: "guest" });
  });

  it("clears guest access when the API no longer accepts the token", async () => {
    readGuestBookingSession.mockResolvedValue({ bookingId: "booking-1", token: "a".repeat(43) });
    getGuestBooking.mockRejectedValue(httpError(HTTP_STATUS.NOT_FOUND, "Not found"));

    const response = await runLoader().catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/bookings/lookup?status=invalid-link",
    );
    expect((response as Response).headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("booking detail action", () => {
  beforeEach(() => {
    cancelBooking.mockReset();
    updateBooking.mockReset();
  });

  it("rejects an unsupported intent", async () => {
    const result = await runAction({ form: { intent: "unknown" } });

    expect(cancelBooking).not.toHaveBeenCalled();
    expect(updateBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { error: "This booking action is not supported.", revalidate: false },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("sends guests to login", async () => {
    const response = await runAction({ cookie: "" }).catch((error: unknown) => error);

    expect(cancelBooking).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/auth?redirectTo=%2Fbookings%2Fbooking-1",
    );
  });

  it("sends expired sessions to login", async () => {
    cancelBooking.mockRejectedValueOnce(httpError(HTTP_STATUS.UNAUTHORIZED, "Unauthorized"));

    const response = await runAction().catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/auth?redirectTo=%2Fbookings%2Fbooking-1",
    );
  });

  it("returns the API detail for a 4xx cancel failure", async () => {
    cancelBooking.mockRejectedValueOnce(
      httpError(HTTP_STATUS.BAD_REQUEST, "Pickup is already underway."),
    );

    await expect(runAction()).resolves.toMatchObject({
      data: { error: "Pickup is already underway." },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("hides 5xx details behind a retry message", async () => {
    cancelBooking.mockRejectedValueOnce(
      httpError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );

    await expect(runAction()).resolves.toMatchObject({
      data: { error: "Failed to cancel booking. Please try again." },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
  });

  it("rethrows an aborted cancel", async () => {
    const aborted = httpError(HTTP_STATUS.CLIENT_CLOSED_REQUEST, "Aborted", "aborted");
    cancelBooking.mockRejectedValueOnce(aborted);

    await expect(runAction()).rejects.toBe(aborted);
  });

  it("returns ok after a successful cancel", async () => {
    cancelBooking.mockResolvedValueOnce({
      data: { id: "booking-1" },
      status: HTTP_STATUS.OK,
      headers: new Headers(),
    });

    await expect(runAction()).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(cancelBooking).toHaveBeenCalledWith({
      request: expect.any(Request),
      bookingId: "booking-1",
    });
  });

  it("returns field errors without calling the API for invalid modifications", async () => {
    const result = await runAction({
      form: {
        intent: "modify",
        pickupTime: "25:00",
        pickupAddress: "",
        sameLocation: "false",
        dropOffAddress: "",
      },
    });

    expect(updateBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: {
        fieldErrors: {
          pickupTime: ["Select a valid pickup time."],
          pickupAddress: ["Pickup address is required."],
          dropOffAddress: ["Drop-off address is required."],
        },
        revalidate: false,
      },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("updates a booking with the validated API payload", async () => {
    updateBooking.mockResolvedValueOnce({
      data: { id: "booking-1" },
      status: HTTP_STATUS.OK,
      headers: new Headers(),
    });

    const result = await runAction({
      form: {
        intent: "modify",
        pickupTime: "9 AM",
        pickupAddress: "Ikeja GRA",
        sameLocation: "false",
        dropOffAddress: "Victoria Island",
      },
    });

    expect(result).toMatchObject({ data: { ok: true } });
    expect(updateBooking).toHaveBeenCalledWith({
      request: expect.any(Request),
      bookingId: "booking-1",
      body: {
        pickupTime: "9 AM",
        pickupAddress: "Ikeja GRA",
        sameLocation: false,
        dropOffAddress: "Victoria Island",
      },
    });
  });

  it("returns the API detail for a 4xx modification failure", async () => {
    updateBooking.mockRejectedValueOnce(
      httpError(HTTP_STATUS.CONFLICT, "Booking changes closed 12 hours before pickup."),
    );

    await expect(
      runAction({
        form: {
          intent: "modify",
          pickupAddress: "Ikeja GRA",
          sameLocation: "true",
        },
      }),
    ).resolves.toMatchObject({
      data: { error: "Booking changes closed 12 hours before pickup." },
      init: { status: HTTP_STATUS.CONFLICT },
    });
  });

  it("hides 5xx modification details behind a retry message", async () => {
    updateBooking.mockRejectedValueOnce(
      httpError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );

    await expect(
      runAction({
        form: {
          intent: "modify",
          pickupAddress: "Ikeja GRA",
          sameLocation: "true",
        },
      }),
    ).resolves.toMatchObject({
      data: { error: "Failed to update booking. Please try again." },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
  });
});

describe("booking detail revalidation", () => {
  it("skips loader work only for local validation failures", () => {
    expect(
      shouldRevalidate({
        actionResult: { revalidate: false },
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);
    expect(
      shouldRevalidate({
        actionResult: { error: "Conflict" },
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);
  });
});
