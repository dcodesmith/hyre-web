import { describe, expect, it } from "vitest";

import { addonMutationSchema, adminAddonPriceSchema, adminAddonsSchema } from "./schema";

const price = {
  id: "cmaddonprice0000000000001",
  addonId: "cmaddonprotocol0000000001",
  amount: 15_000,
  effectiveSince: "2026-01-01T00:00:00.000Z",
  effectiveUntil: null,
  createdById: "admin-1",
  updatedById: "admin-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const addon = {
  id: "cmaddonprotocol0000000001",
  code: "PROTOCOL_SERVICE",
  name: "Protocol service",
  description: "Dedicated protocol officer",
  bookingTypes: ["DAY", "FULL_DAY"],
  pricingUnit: "PER_BOOKING" as const,
  financialTreatment: "PLATFORM" as const,
  isActive: true,
  createdById: "admin-1",
  updatedById: "admin-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("admin add-on schemas", () => {
  it("parses the admin catalog, mutation, and price contracts", () => {
    expect(adminAddonsSchema.parse({ addons: [{ ...addon, prices: [price] }] })).toEqual({
      addons: [{ ...addon, prices: [price] }],
    });
    expect(addonMutationSchema.parse({ ...addon, actor: "hidden" })).toEqual(addon);
    expect(adminAddonPriceSchema.parse({ ...price, actor: "hidden" })).toEqual(price);
  });

  it("rejects an unknown booking type or pricing unit", () => {
    expect(
      adminAddonsSchema.safeParse({
        addons: [{ ...addon, prices: [], bookingTypes: ["HOURLY"] }],
      }).success,
    ).toBe(false);
    expect(
      adminAddonsSchema.safeParse({
        addons: [{ ...addon, prices: [], pricingUnit: "PER_HOUR" }],
      }).success,
    ).toBe(false);
  });
});
