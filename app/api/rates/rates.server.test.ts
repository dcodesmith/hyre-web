import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import { FALLBACK_PUBLIC_RATES, getPublicRates, loadPublicRates } from "./rates.server";

const publicRates = {
  platformCustomerServiceFeeRatePercent: 10,
  vatRatePercent: 7.5,
};

describe("getPublicRates", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("loads the flat public rates contract", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(publicRates));

    const response = await getPublicRates({
      request: new Request("https://tripdly.com/cars/lexus-1"),
    });

    expect(response.data).toEqual(publicRates);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.example/api/rates");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
  });
});

describe("loadPublicRates", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns parsed rates when the public request succeeds", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(publicRates));

    await expect(loadPublicRates()).resolves.toEqual(publicRates);
  });

  it("uses documented fallbacks when the public request fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));

    await expect(loadPublicRates()).resolves.toEqual(FALLBACK_PUBLIC_RATES);
  });

  it("uses documented fallbacks when a public rate is negative", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        ...publicRates,
        vatRatePercent: -7.5,
      }),
    );

    await expect(loadPublicRates()).resolves.toEqual(FALLBACK_PUBLIC_RATES);
  });

  it("uses documented fallbacks when the response is not the public contract", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        platformFeeRates: [],
        taxRates: [],
        addonRates: [],
      }),
    );

    await expect(loadPublicRates()).resolves.toEqual(FALLBACK_PUBLIC_RATES);
  });

  it("rethrows an aborted public rates request", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockImplementation(async (_url, init) => {
      init?.signal?.throwIfAborted();
      return Response.json(publicRates);
    });

    await expect(
      loadPublicRates({
        request: new Request("https://tripdly.com/cars/lexus-1", { signal: controller.signal }),
      }),
    ).rejects.toMatchObject({ kind: "aborted" });
  });
});
