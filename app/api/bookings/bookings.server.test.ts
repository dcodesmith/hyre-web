import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import { getBookingReceipt } from "./bookings.server";

const request = new Request("https://tripdly.com/bookings/booking-1/receipt", {
  headers: { cookie: "better-auth.session_token=session-1" },
});

describe("booking receipt", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response("%PDF-1.4", {
        headers: { "content-type": "application/pdf" },
      }),
    );
  });

  it("forwards the signed-in session for a customer receipt", async () => {
    await getBookingReceipt({ request, bookingId: "booking/1" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);

    expect(String(url)).toBe("https://api.example/api/bookings/booking%2F1/receipt");
    expect(headers.get("accept")).toBe("application/pdf");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("x-guest-booking-token")).toBeNull();
  });

  it("forwards only the scoped token for a guest receipt", async () => {
    await getBookingReceipt({
      request,
      bookingId: "booking-1",
      guestToken: "a".repeat(43),
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);

    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("x-guest-booking-token")).toBe("a".repeat(43));
  });
});
