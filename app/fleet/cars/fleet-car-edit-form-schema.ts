import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";

import { fleetCarStatusSchema } from "~/api/fleet/cars/schema";

export const editableFleetCarStatusSchema = fleetCarStatusSchema.exclude(["BOOKED"]);

function positiveInteger(label: string) {
  return z.coerce
    .number({ error: `${label} is required` })
    .int(`${label} must be a whole number`)
    .positive(`${label} must be greater than zero`);
}

const optionalFuelRateSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.union([positiveInteger("Fuel upgrade rate"), z.null()]),
);

export const fleetCarEditFormSchema = z
  .object({
    dayRate: positiveInteger("Day rate"),
    hourlyRate: positiveInteger("Hourly rate"),
    nightRate: positiveInteger("Night rate"),
    fullDayRate: positiveInteger("Full day rate"),
    airportPickupRate: positiveInteger("Airport pickup rate"),
    fuelUpgradeRate: optionalFuelRateSchema,
    pricingIncludesFuel: z
      .string()
      .optional()
      .transform((value) => value === "on"),
    status: editableFleetCarStatusSchema.optional(),
  })
  .superRefine(({ fuelUpgradeRate, pricingIncludesFuel }, context) => {
    if (!pricingIncludesFuel && fuelUpgradeRate == null) {
      context.addIssue({
        code: "custom",
        message: "Fuel upgrade rate is required when pricing does not include fuel",
        path: ["fuelUpgradeRate"],
      });
    }
  });

export type FleetCarEditActionData = {
  readonly revalidate?: false;
  readonly submission?: SubmissionResult<string[]>;
};
