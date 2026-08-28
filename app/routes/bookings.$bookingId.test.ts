import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancelBooking, updateBooking } = vi.hoisted(() => ({
  cancelBooking: vi.fn(),
  updateBooking: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/bookings/bookings.server", () => ({
  cancelBooking,
  getBookingById: vi.fn(),
  updateBooking,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { action, shouldRevalidate } from "./bookings.$bookingId";

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
