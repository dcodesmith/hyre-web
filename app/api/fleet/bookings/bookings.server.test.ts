import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import { assignFleetBookingChauffeur, getFleetBooking, getFleetBookings } from "./bookings.server";

const bookingId = "018f47a2-7b3c-7d4e-8f90-123456789401";
const carId = "018f47a2-7b3c-7d4e-8f90-123456789471";
const chauffeurId = "018f47a2-7b3c-7d4e-8f90-1234567894a1";

const request = new Request("https://tripdly.com/fleet-owner/bookings", {
  headers: { cookie: "better-auth.session_token=session-1" },
});

const booking = {
  id: bookingId,
  bookingReference: "TD-1001",
  status: "CONFIRMED",
  type: "DAY",
  startDate: "2026-08-21T08:00:00.000Z",
  endDate: "2026-08-21T20:00:00.000Z",
  pickupLocation: "Ikeja",
  returnLocation: "Marina",
  specialRequests: null,
  flightNumber: null,
  customerName: "Ada Lovelace",
  car: {
    id: carId,
    make: "Honda",
    model: "Accord",
    year: 2024,
    registrationNumber: "ABC-123DE",
  },
  chauffeur: null,
  canAssignChauffeur: true,
};

function capturedRequest() {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init, headers: new Headers(init?.headers) };
}

describe("fleet booking BFF", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("GETs the booking list with the page query and session cookie", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        items: [booking],
        meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
      }),
    );

    const response = await getFleetBookings({
      request,
      searchParams: new URLSearchParams({ page: "2", limit: "20" }),
    });

    expect(response.data.meta.page).toBe(2);
    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/bookings?page=2&limit=20");
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
  });

  it("GETs one booking and URL-encodes the booking id", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ booking, assignableChauffeurs: [] }));

    await getFleetBooking({ request, bookingId: `${bookingId}/draft` });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe(
      `https://api.example/api/fleet-owner/bookings/${encodeURIComponent(`${bookingId}/draft`)}`,
    );
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
  });

  it("PATCHes a chauffeur assignment with the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ id: bookingId, chauffeur: { id: chauffeurId, name: "Bola Adebayo" } }),
    );

    const response = await assignFleetBookingChauffeur({
      request,
      bookingId,
      chauffeurId,
    });

    expect(response.data).toEqual({ id: bookingId, chauffeur: { id: chauffeurId } });
    const { url, init, headers } = capturedRequest();
    expect(url).toBe(`https://api.example/api/fleet-owner/bookings/${bookingId}/chauffeur`);
    expect(init?.method).toBe("PATCH");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ chauffeurId });
  });
});
