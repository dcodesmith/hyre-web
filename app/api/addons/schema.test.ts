import { describe, expect, it } from "vitest";

import { publicAddonsSchema } from "./schema";

const addon = {
  id: "cmaddonprotocol0000000001",
  code: "PROTOCOL_SERVICE",
  name: "Protocol service",
  description: "Dedicated protocol officer",
  pricingUnit: "PER_BOOKING" as const,
  unitPrice: 15_000,
  currency: "NGN" as const,
};

describe("publicAddonsSchema", () => {
  it("parses the public add-on catalog contract", () => {
    expect(publicAddonsSchema.parse({ addons: [addon, { ...addon, description: null }] })).toEqual({
      addons: [addon, { ...addon, description: null }],
    });
  });

  it("strips extra fields and rejects an invalid catalog row", () => {
    expect(
      publicAddonsSchema.parse({
        addons: [{ ...addon, internalNotes: "hidden" }],
        securityDetailRate: 15_000,
      }),
    ).toEqual({ addons: [addon] });
    expect(publicAddonsSchema.safeParse({ addons: [{ ...addon, currency: "USD" }] }).success).toBe(
      false,
    );
    expect(
      publicAddonsSchema.safeParse({ addons: [{ ...addon, pricingUnit: "PER_HOUR" }] }).success,
    ).toBe(false);
    expect(publicAddonsSchema.safeParse({ addons: [{ ...addon, id: "addon-1" }] }).success).toBe(
      false,
    );
  });
});
