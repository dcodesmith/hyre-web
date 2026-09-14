import { describe, expect, it } from "vitest";
import { z } from "zod";

import { carOnboardingPlateFormSchema } from "~/fleet/cars/car-onboarding-form-schema";

import { getZodConstraint } from "./get-zod-constraint";

describe("getZodConstraint", () => {
  it("restores string and number HTML constraints after Zod 4.6", () => {
    const schema = z.object({
      policyNumber: z.string().trim().min(3).max(100),
      amount: z.number().min(1).max(10),
      optionalName: z.string().min(2).max(20).optional(),
    });

    expect(getZodConstraint(schema)).toMatchObject({
      amount: { max: 10, min: 1, required: true },
      optionalName: { maxLength: 20, minLength: 2, required: false },
      policyNumber: { maxLength: 100, minLength: 3, required: true },
    });
  });

  it("keeps plate-form policy length constraints for Conform", () => {
    expect(getZodConstraint(carOnboardingPlateFormSchema)).toMatchObject({
      plateNumber: { required: true },
      policyNumber: { maxLength: 100, minLength: 3, required: true },
    });
  });
});
