import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancelBooking } = vi.hoisted(() => ({
  cancelBooking: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/bookings/bookings.server", () => ({
  cancelBooking,
  getBookingById: vi.fn(),
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { action } from "./bookings.$bookingId";

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

describe("booking detail cancel action", () => {
  beforeEach(() => {
    cancelBooking.mockReset();
  });

  it("rejects a missing cancel intent", async () => {
    const result = await runAction({ form: { intent: "modify" } });

    expect(cancelBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { error: "This booking cannot be cancelled." },
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
});
