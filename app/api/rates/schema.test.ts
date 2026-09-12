import { describe, expect, it } from "vitest";

import { publicRatesSchema } from "./schema";

describe("publicRatesSchema", () => {
  it("parses the flat public rates contract", () => {
    const parsed = publicRatesSchema.safeParse({
      platformCustomerServiceFeeRatePercent: 10,
      vatRatePercent: 7.5,
      securityDetailRate: 15_000,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      platformCustomerServiceFeeRatePercent: 10,
      vatRatePercent: 7.5,
    });
    expect(parsed.data).not.toHaveProperty("securityDetailRate");
  });

  it("strips admin rate-history fields", () => {
    const parsed = publicRatesSchema.safeParse({
      platformCustomerServiceFeeRatePercent: 10,
      vatRatePercent: 7.5,
      securityDetailRate: 15_000,
      platformFleetOwnerCommissionRatePercent: 15,
      platformFeeRates: [{ ratePercent: 10 }],
      taxRates: [{ ratePercent: 7.5 }],
      addonRates: [{ rateAmount: 15_000 }],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      platformCustomerServiceFeeRatePercent: 10,
      vatRatePercent: 7.5,
    });
    expect(parsed.data).not.toHaveProperty("addonRates");
  });

  it("rejects a missing public rate field", () => {
    expect(
      publicRatesSchema.safeParse({
        platformCustomerServiceFeeRatePercent: 10,
      }).success,
    ).toBe(false);
  });

  it.each(["platformCustomerServiceFeeRatePercent", "vatRatePercent"] as const)(
    "rejects a negative %s",
    (field) => {
      expect(
        publicRatesSchema.safeParse({
          platformCustomerServiceFeeRatePercent: 10,
          vatRatePercent: 7.5,
          [field]: -1,
        }).success,
      ).toBe(false);
    },
  );
});
