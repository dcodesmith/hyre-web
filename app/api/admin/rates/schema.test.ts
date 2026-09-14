import { describe, expect, it } from "vitest";

import { adminRatesSchema } from "./schema";

const rates = {
  platformFeeRates: [
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789105",
      feeType: "PLATFORM_SERVICE_FEE" as const,
      ratePercent: 10,
      effectiveSince: "2026-01-01T00:00:00.000Z",
      effectiveUntil: null,
      description: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      active: true,
    },
  ],
  taxRates: [
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789107",
      ratePercent: 7.5,
      effectiveSince: "2026-01-01T00:00:00.000Z",
      effectiveUntil: null,
      description: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      active: true,
    },
  ],
};

describe("adminRatesSchema", () => {
  it("keeps fee and VAT windows and drops add-on rates", () => {
    const parsed = adminRatesSchema.parse({
      ...rates,
      addonRates: [{ rateAmount: 15_000 }],
    });

    expect(parsed).toEqual(rates);
    expect(parsed).not.toHaveProperty("addonRates");
  });
});
