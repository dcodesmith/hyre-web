import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import { createReview, updateReview } from "./reviews.server";

const request = new Request("https://tripdly.com/bookings/booking-1", {
  method: "POST",
  headers: { cookie: "better-auth.session_token=session-1" },
});

const ratings = {
  overallRating: 5,
  carRating: 4,
  chauffeurRating: 5,
  serviceRating: 4,
  comment: "Great trip",
};

describe("customer review mutations", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(Response.json({ id: "review-1" }));
  });

  it("creates a review with the signed-in session", async () => {
    await createReview({ request, body: { bookingId: "booking-1", ...ratings } });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example/api/reviews/create");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("cookie")).toBe("better-auth.session_token=session-1");
    expect(JSON.parse(String(init?.body))).toEqual({ bookingId: "booking-1", ...ratings });
  });

  it("updates a review through its encoded API path", async () => {
    await updateReview({ request, reviewId: "review/1", body: ratings });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example/api/reviews/review%2F1");
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).get("cookie")).toBe("better-auth.session_token=session-1");
    expect(JSON.parse(String(init?.body))).toEqual(ratings);
  });
});
