import { describe, expect, it } from "vitest";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { getFleetCarStatusLabel, hasFleetCarPricing, needsFleetCarOnboarding } from "./fleet-car";

const fleetCar = {
  id: "car-1",
  make: "Lexus",
  model: "RX 350",
  year: 2023,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "owner-1",
  registrationNumber: "ABC123XY",
  status: "AVAILABLE",
  approvalStatus: "APPROVED",
  approvalNotes: null,
  submittedAt: "2026-09-07T12:00:00.000Z",
  hourlyRate: 10_000,
  dayRate: 80_000,
  nightRate: 60_000,
  fuelUpgradeRate: 20_000,
  fullDayRate: 150_000,
  airportPickupRate: 50_000,
  vehicleType: "SUV",
  serviceTier: "LUXURY",
  passengerCapacity: 4,
  pricingIncludesFuel: false,
  owner: {
    id: "owner-1",
    name: "Fleet Owner",
    username: null,
    email: "owner@example.com",
  },
  images: [],
  documents: [],
  insuranceVerifications: [],
  promotion: null,
} satisfies FleetCar;

describe("fleet car display labels", () => {
  it("uses the hireApp status wording", () => {
    expect(getFleetCarStatusLabel("AVAILABLE")).toBe("Available");
    expect(getFleetCarStatusLabel("BOOKED")).toBe("Booked");
    expect(getFleetCarStatusLabel("HOLD")).toBe("Hold");
    expect(getFleetCarStatusLabel("IN_SERVICE")).toBe("In Service");
  });
});

describe("fleet car setup status", () => {
  it("needs onboarding whenever submittedAt is null, regardless of pricing", () => {
    expect(needsFleetCarOnboarding({ ...fleetCar, submittedAt: null })).toBe(true);
    expect(
      needsFleetCarOnboarding({
        ...fleetCar,
        submittedAt: null,
        hourlyRate: null,
        dayRate: null,
        nightRate: null,
        fullDayRate: null,
        airportPickupRate: null,
        fuelUpgradeRate: null,
      }),
    ).toBe(true);
  });

  it("does not need onboarding once submittedAt is set", () => {
    expect(needsFleetCarOnboarding(fleetCar)).toBe(false);
    expect(
      needsFleetCarOnboarding({
        ...fleetCar,
        hourlyRate: null,
        dayRate: null,
        nightRate: null,
        fullDayRate: null,
        airportPickupRate: null,
        fuelUpgradeRate: null,
      }),
    ).toBe(false);
  });

  it("requires fuelUpgradeRate for complete pricing when fuel is not included", () => {
    expect(hasFleetCarPricing(fleetCar)).toBe(true);
    expect(hasFleetCarPricing({ ...fleetCar, fuelUpgradeRate: null })).toBe(false);
    expect(
      hasFleetCarPricing({
        ...fleetCar,
        pricingIncludesFuel: true,
        fuelUpgradeRate: null,
      }),
    ).toBe(true);
  });
});
