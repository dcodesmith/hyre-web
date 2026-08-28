import { describe, expect, it } from "vitest";

import { fleetCarEditFormSchema } from "./fleet-car-edit-form-schema";

const validForm = {
  dayRate: "80000",
  hourlyRate: "10000",
  nightRate: "60000",
  fullDayRate: "150000",
  airportPickupRate: "50000",
  fuelUpgradeRate: "20000",
  vehicleType: "SUV",
  serviceTier: "LUXURY",
  passengerCapacity: "4",
  status: "HOLD",
};

describe("fleetCarEditFormSchema", () => {
  it("coerces editable car fields for the API request", () => {
    expect(fleetCarEditFormSchema.parse(validForm)).toEqual({
      dayRate: 80_000,
      hourlyRate: 10_000,
      nightRate: 60_000,
      fullDayRate: 150_000,
      airportPickupRate: 50_000,
      fuelUpgradeRate: 20_000,
      pricingIncludesFuel: false,
      vehicleType: "SUV",
      serviceTier: "LUXURY",
      passengerCapacity: 4,
      status: "HOLD",
    });
  });

  it("requires a fuel upgrade rate when fuel is not included", () => {
    const result = fleetCarEditFormSchema.safeParse({
      ...validForm,
      fuelUpgradeRate: "",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["fuelUpgradeRate"]);
  });

  it("allows an empty fuel upgrade rate when fuel is included", () => {
    const result = fleetCarEditFormSchema.parse({
      ...validForm,
      fuelUpgradeRate: "",
      pricingIncludesFuel: "on",
    });

    expect(result.pricingIncludesFuel).toBe(true);
    expect(result.fuelUpgradeRate).toBeNull();
  });
});
