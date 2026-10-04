import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFleetBookings } = vi.hoisted(() => ({
  getFleetBookings: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/fleet/bookings/bookings.server", () => ({
  getFleetBookings,
}));

import type { Route } from "./+types/fleet-owner.bookings";
import { headers, loader } from "./fleet-owner.bookings";

const PATH = "/fleet-owner/bookings";
const booking = {
  id: "018f47a2-7b3c-7d4e-8f90-123456789401",
  bookingReference: "TD-1001",
};

function list(page: number, totalPages: number, items = page > totalPages ? [] : [booking]) {
  return {
    items,
    meta: { page, limit: 20, total: totalPages === 0 ? 0 : 21, totalPages },
  };
}

function loaderArgs(url: string): { args: Route.LoaderArgs; request: Request } {
  const request = new Request(url);
  return {
    request,
    args: {
      request,
      url: new URL(request.url),
      pattern: PATH,
      params: {},
      context: new RouterContextProvider(),
    },
  };
}

function expectRedirect(result: unknown, location: string) {
  expect(result).toBeInstanceOf(Response);
  if (!(result instanceof Response)) {
    throw new Error("Expected a redirect response");
  }
  expect(result.status).toBe(302);
  expect(result.headers.get("location")).toBe(location);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
}

describe("fleet-owner bookings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFleetBookings.mockResolvedValue({ data: list(1, 1) });
  });

  it("returns private no-store headers from the route", () => {
    expect(headers()).toEqual({ "Cache-Control": "private, no-store" });
  });

  it("loads the requested page with the API page size", async () => {
    getFleetBookings.mockResolvedValueOnce({ data: list(2, 3) });
    const { args, request } = loaderArgs(`https://tripdly.com${PATH}?page=2`);

    await expect(loader(args)).resolves.toEqual({
      bookings: [booking],
      page: 2,
      total: 21,
      totalPages: 3,
    });
    expect(getFleetBookings).toHaveBeenCalledWith({
      request,
      searchParams: new URLSearchParams({ page: "2", limit: "20" }),
    });
  });

  it("falls back to page 1 when the page query is not a positive integer", async () => {
    for (const page of ["abc", "0", "-2", "1.5"]) {
      getFleetBookings.mockClear();
      const { args, request } = loaderArgs(`https://tripdly.com${PATH}?page=${page}`);

      await expect(loader(args)).resolves.toMatchObject({ page: 1, totalPages: 1 });
      expect(getFleetBookings).toHaveBeenCalledWith({
        request,
        searchParams: new URLSearchParams({ page: "1", limit: "20" }),
      });
    }
  });

  it("redirects an out-of-range page to the last available page", async () => {
    getFleetBookings.mockResolvedValueOnce({ data: list(9, 2, []) });

    const result = await loader(loaderArgs(`https://tripdly.com${PATH}?page=9`).args).catch(
      (error: unknown) => error,
    );

    expectRedirect(result, `${PATH}?page=2`);
    expect(getFleetBookings).toHaveBeenCalledWith({
      request: expect.any(Request),
      searchParams: new URLSearchParams({ page: "9", limit: "20" }),
    });
  });

  it("redirects an empty result set back to the first page", async () => {
    getFleetBookings.mockResolvedValueOnce({ data: list(3, 0, []) });

    const result = await loader(loaderArgs(`https://tripdly.com${PATH}?page=3`).args).catch(
      (error: unknown) => error,
    );

    expectRedirect(result, PATH);
  });

  it("treats an empty first page as one page without redirecting", async () => {
    getFleetBookings.mockResolvedValueOnce({ data: list(1, 0, []) });

    await expect(loader(loaderArgs(`https://tripdly.com${PATH}`).args)).resolves.toEqual({
      bookings: [],
      page: 1,
      total: 0,
      totalPages: 1,
    });
  });
});
