import { describe, expect, it } from "vitest";

import {
  addonRateFormSchema,
  platformFeeFormSchema,
  toUtcIso,
  vatRateFormSchema,
} from "./rate-form-schema";

const validWindow = {
  effectiveSince: "2026-09-01T09:00",
  effectiveUntil: "2026-12-01T09:00",
  description: "",
};

describe("admin rate form schemas", () => {
  it("parses the API-supported platform, VAT, and add-on values", () => {
    expect(
      platformFeeFormSchema.safeParse({
        ...validWindow,
        feeType: "PLATFORM_SERVICE_FEE",
        ratePercent: "10.5",
      }).success,
    ).toBe(true);
    expect(vatRateFormSchema.safeParse({ ...validWindow, ratePercent: "7.5" }).success).toBe(true);
    expect(
      addonRateFormSchema.safeParse({
        ...validWindow,
        rateAmount: "15000",
      }).success,
    ).toBe(true);
  });

  it("rejects zero-length and reversed effective windows", () => {
    for (const effectiveUntil of ["2026-09-01T09:00", "2026-08-31T09:00"]) {
      const result = vatRateFormSchema.safeParse({
        ...validWindow,
        effectiveUntil,
        ratePercent: "7.5",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(["effectiveUntil"]);
      }
    }
  });

  it("rejects impossible local dates before converting them to UTC", () => {
    const result = addonRateFormSchema.safeParse({
      ...validWindow,
      effectiveSince: "2026-02-31T09:00",
      rateAmount: "15000",
    });

    expect(result.success).toBe(false);
  });

  it("serializes a validated local field as an explicit UTC instant", () => {
    expect(toUtcIso("2026-09-01T09:00")).toBe("2026-09-01T09:00:00.000Z");
  });
});
