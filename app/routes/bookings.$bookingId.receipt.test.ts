import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBookingReceipt, guestBookingClearCookie, readGuestBookingSession } = vi.hoisted(() => ({
  getBookingReceipt: vi.fn(),
  guestBookingClearCookie: vi.fn(async () => "guest_booking=; Max-Age=0"),
  readGuestBookingSession: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    API_ORIGIN: "https://api.invalid",
    APP_ENV: "local",
    APP_ORIGIN: "https://tripdly.com",
  },
}));
vi.mock("~/api/bookings/bookings.server", () => ({ getBookingReceipt }));
vi.mock("~/booking/guest-booking-session.server", () => ({
  guestBookingClearCookie,
  readGuestBookingSession,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { loader } from "./bookings.$bookingId.receipt";

const SESSION_COOKIE = "better-auth.session_token=test-session";
const GUEST_TOKEN = "a".repeat(43);

function httpError(status: number, headers = new Headers()) {
  return new ApiRequestError(
    "http",
    status,
    {
      type: status === HTTP_STATUS.NOT_FOUND ? "BOOKING_NOT_FOUND" : "RECEIPT_UNAVAILABLE",
      title: "Receipt unavailable",
      status,
      detail: "Receipt unavailable",
    },
    headers,
  );
}

function receiptResponse() {
  return new Response("%PDF-1.4", {
    headers: {
      "cache-control": "public, max-age=300",
      "content-disposition": 'attachment; filename="Tripdly-receipt-TD-1001.pdf"',
      "content-length": "8",
      "content-type": "application/pdf",
    },
  });
}

function runLoader(cookie = "", bookingId = "booking-1") {
  const request = new Request(`https://tripdly.com/bookings/${bookingId}/receipt`, {
    headers: cookie ? { cookie } : undefined,
  });

  return {
    request,
    result: loader({
      request,
      params: { bookingId },
    } as Parameters<typeof loader>[0]),
  };
}

describe("booking receipt loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readGuestBookingSession.mockResolvedValue(null);
  });

  it("streams a signed-in customer receipt with safe headers", async () => {
    getBookingReceipt.mockResolvedValue(receiptResponse());
    const { request, result } = runLoader(SESSION_COOKIE);
    const response = await result;

    expect(getBookingReceipt).toHaveBeenCalledWith({ request, bookingId: "booking-1" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="Tripdly-receipt-TD-1001.pdf"',
    );
    expect(response.headers.get("content-length")).toBe("8");
    expect(await response.text()).toBe("%PDF-1.4");
  });

  it("uses the scoped guest token without requiring a session", async () => {
    readGuestBookingSession.mockResolvedValue({ bookingId: "booking-1", token: GUEST_TOKEN });
    getBookingReceipt.mockResolvedValue(receiptResponse());
    const { request, result } = runLoader();

    await expect(result).resolves.toBeInstanceOf(Response);
    expect(getBookingReceipt).toHaveBeenCalledWith({
      request,
      bookingId: "booking-1",
      guestToken: GUEST_TOKEN,
    });
  });

  it("preserves expected API errors and safe rate-limit headers", async () => {
    getBookingReceipt.mockRejectedValue(
      httpError(HTTP_STATUS.TOO_MANY_REQUESTS, new Headers({ "Retry-After": "60" })),
    );

    const response = await runLoader(SESSION_COOKIE).result;

    expect(response.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.text()).toBe("Receipt unavailable");
  });

  it("rejects a successful non-PDF API response", async () => {
    getBookingReceipt.mockResolvedValue(
      new Response("<script>alert('wrong route')</script>", {
        headers: {
          "content-disposition": "inline",
          "content-type": "text/html",
        },
      }),
    );

    const response = await runLoader(SESSION_COOKIE).result;

    expect(response.status).toBe(HTTP_STATUS.BAD_GATEWAY);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe("The receipt could not be downloaded. Please try again.");
  });

  it("forces unsafe PDF metadata to a generic attachment", async () => {
    getBookingReceipt.mockResolvedValue(
      new Response("%PDF-1.4", {
        headers: {
          "content-disposition": "inline",
          "content-length": "invalid",
          "content-type": "application/pdf",
        },
      }),
    );

    const response = await runLoader(SESSION_COOKIE).result;

    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="Tripdly-receipt.pdf"',
    );
    expect(response.headers.get("content-length")).toBeNull();
  });

  it("falls back to guest access when the account does not own the booking", async () => {
    readGuestBookingSession.mockResolvedValue({ bookingId: "booking-1", token: GUEST_TOKEN });
    getBookingReceipt.mockRejectedValueOnce(httpError(HTTP_STATUS.NOT_FOUND));
    getBookingReceipt.mockResolvedValueOnce(receiptResponse());

    await expect(runLoader(SESSION_COOKIE).result).resolves.toBeInstanceOf(Response);
    expect(getBookingReceipt).toHaveBeenCalledTimes(2);
    expect(getBookingReceipt).toHaveBeenLastCalledWith(
      expect.objectContaining({ guestToken: GUEST_TOKEN }),
    );
  });

  it("clears guest access when the API rejects the token", async () => {
    readGuestBookingSession.mockResolvedValue({ bookingId: "booking-1", token: GUEST_TOKEN });
    getBookingReceipt.mockRejectedValue(httpError(HTTP_STATUS.NOT_FOUND));

    const response = await runLoader().result.catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/bookings/lookup?status=invalid-link",
    );
    expect((response as Response).headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("sends an unauthenticated request to login", async () => {
    const response = await runLoader().result.catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/auth?redirectTo=%2Fbookings%2Fbooking-1%2Freceipt",
    );
    expect(getBookingReceipt).not.toHaveBeenCalled();
  });
});
