import { describe, expect, it } from "vitest";

import { addonMutationSchema, adminAddonPriceSchema, adminAddonsSchema } from "./schema";

const price = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567890c1",
  addonId: "018f47a2-7b3c-7d4e-8f90-1234567890b1",
  amount: 15_000,
  effectiveSince: "2026-01-01T00:00:00.000Z",
  effectiveUntil: null,
  createdById: "018f47a2-7b3c-7d4e-8f90-123456789701",
  updatedById: "018f47a2-7b3c-7d4e-8f90-123456789701",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const addon = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567890b1",
  code: "PROTOCOL_SERVICE",
  name: "Protocol service",
  description: "Dedicated protocol officer",
  bookingTypes: ["DAY", "FULL_DAY"],
  pricingUnit: "PER_BOOKING" as const,
  financialTreatment: "PLATFORM" as const,
  isActive: true,
  createdById: "018f47a2-7b3c-7d4e-8f90-123456789701",
  updatedById: "018f47a2-7b3c-7d4e-8f90-123456789701",
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
