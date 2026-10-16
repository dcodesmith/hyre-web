import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchCars } = vi.hoisted(() => ({
  searchCars: vi.fn(),
}));

vi.mock("~/api/cars/cars.server", () => ({ searchCars }));

import { loader } from "./search";

const SEARCH_ID = "01994a1d-4263-7000-8000-000000000010";

function hasResponseInit(result: unknown): result is { init: ResponseInit } {
  return (
    typeof result === "object" &&
    result !== null &&
    "init" in result &&
    typeof result.init === "object" &&
    result.init !== null
  );
}

function headersFromResult(result: unknown) {
  return hasResponseInit(result) ? new Headers(result.init.headers) : new Headers();
}

function runLoader(search: string) {
  const args = {
    request: new Request(`https://tripdly.com/search?${search}`),
    params: {},
    context: {},
  } as Parameters<typeof loader>[0];

  return loader(args);
}

describe("search loader cache policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchCars.mockResolvedValue({
      data: { searchId: SEARCH_ID },
      headers: new Headers({ "Cache-Control": "public, max-age=60" }),
    });
  });

  it("does not publicly cache a search journey", async () => {
    const result = await runLoader("bookingType=DAY&from=2026-08-20&to=2026-08-21");

    expect(headersFromResult(result).get("Cache-Control")).toBe("private, no-store");
  });

  it("retains public caching for count-only responses without a journey", async () => {
    searchCars.mockResolvedValue({
      data: { pagination: { total: 3 } },
      headers: new Headers({ "Cache-Control": "public, max-age=60" }),
    });

    const result = await runLoader("countOnly=1");

    expect(headersFromResult(result).get("Cache-Control")).toBe("public, max-age=60");
    expect(searchCars).toHaveBeenCalledWith(expect.objectContaining({ searchId: undefined }));
  });
});
