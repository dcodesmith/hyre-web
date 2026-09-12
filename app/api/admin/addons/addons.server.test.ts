import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import {
  createAdminAddon,
  createAdminAddonPrice,
  endAdminAddonPrice,
  getAdminAddons,
  updateAdminAddon,
} from "./addons.server";

const request = new Request("https://tripdly.com/admin/addon-rates", {
  headers: { cookie: "better-auth.session_token=session-1" },
});

const addon = {
  id: "cmaddonprotocol0000000001",
  code: "PROTOCOL_SERVICE",
  name: "Protocol service",
  description: "Dedicated protocol officer",
  bookingTypes: ["DAY"],
  pricingUnit: "PER_BOOKING",
  financialTreatment: "PLATFORM",
  isActive: true,
  createdById: "admin-1",
  updatedById: "admin-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const price = {
  id: "cmaddonprice0000000000001",
  addonId: addon.id,
  amount: 15_000,
  effectiveSince: "2026-01-01T00:00:00.000Z",
  effectiveUntil: null,
  createdById: "admin-1",
  updatedById: "admin-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function capturedRequest() {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init, headers: new Headers(init?.headers) };
}

describe("admin add-ons BFF", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("GETs the admin catalog with the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ addons: [{ ...addon, prices: [price] }] }));

    const response = await getAdminAddons({ request });

    expect(response.data.addons[0]?.code).toBe("PROTOCOL_SERVICE");
    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/admin/addons");
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
  });

  it("POSTs a new add-on", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(addon));

    await createAdminAddon({
      request,
      body: {
        code: "PROTOCOL_SERVICE",
        name: "Protocol service",
        bookingTypes: ["DAY"],
        pricingUnit: "PER_BOOKING",
        financialTreatment: "PLATFORM",
        isActive: true,
      },
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/admin/addons");
    expect(init?.method).toBe("POST");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      code: "PROTOCOL_SERVICE",
      name: "Protocol service",
      bookingTypes: ["DAY"],
      pricingUnit: "PER_BOOKING",
      financialTreatment: "PLATFORM",
      isActive: true,
    });
  });

  it("PATCHes an add-on and URL-encodes its id", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...addon, isActive: false }));

    await updateAdminAddon({
      request,
      addonId: "addon/1+x",
      body: {
        name: "Protocol service",
        description: null,
        bookingTypes: ["DAY"],
        isActive: false,
      },
    });

    const { url, init } = capturedRequest();
    expect(url).toBe("https://api.example/api/admin/addons/addon%2F1%2Bx");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Protocol service",
      description: null,
      bookingTypes: ["DAY"],
      isActive: false,
    });
  });

  it("POSTs a price window", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(price));

    await createAdminAddonPrice({
      request,
      addonId: addon.id,
      body: { amount: 20_000, effectiveSince: "2027-04-01T09:00:00.000Z" },
    });

    const { url, init } = capturedRequest();
    expect(url).toBe(`https://api.example/api/admin/addons/${addon.id}/prices`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      amount: 20_000,
      effectiveSince: "2027-04-01T09:00:00.000Z",
    });
  });

  it("ends a price with PATCH and no body", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ ...price, effectiveUntil: "2026-09-12T12:00:00.000Z" }),
    );

    await endAdminAddonPrice({
      request,
      addonId: "addon/1+x",
      priceId: "price/2+y",
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/admin/addons/addon%2F1%2Bx/prices/price%2F2%2By/end");
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBeUndefined();
    expect(headers.get("content-type")).toBeNull();
  });
});
