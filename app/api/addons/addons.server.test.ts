import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import { getPublicAddons } from "./addons.server";

const addons = {
  addons: [
    {
      id: "cmaddonprotocol0000000001",
      code: "PROTOCOL_SERVICE",
      name: "Protocol service",
      description: "Dedicated protocol officer",
      pricingUnit: "PER_BOOKING",
      unitPrice: 15_000,
      currency: "NGN",
    },
  ],
};

describe("getPublicAddons", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("loads add-ons for the requested booking type", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(addons));
    const request = new Request("https://tripdly.com/cars/lexus-1");

    const response = await getPublicAddons({ request, bookingType: "AIRPORT_PICKUP" });

    expect(response.data).toEqual(addons);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.example/api/addons?bookingType=AIRPORT_PICKUP",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
  });
});
