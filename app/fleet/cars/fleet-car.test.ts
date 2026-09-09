import { describe, expect, it } from "vitest";

import type { FleetCar } from "~/api/fleet/cars/schema";
import {
  getFleetCarOnboardingStep,
  getFleetCarStatusLabel,
  hasFleetCarPricing,
  needsFleetCarOnboarding,
} from "./fleet-car";

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

const onboardingDocuments = [
  {
    id: "document-1",
    documentType: "MOT_CERTIFICATE" as const,
    status: "PENDING" as const,
    documentUrl: "https://cdn.example.com/mot.pdf",
    notes: null,
    approvedById: null,
    approvedAt: null,
    carId: "car-1",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    userId: null,
  },
  {
    id: "document-2",
    documentType: "INSURANCE_CERTIFICATE" as const,
    status: "PENDING" as const,
    documentUrl: "https://cdn.example.com/insurance.pdf",
    notes: null,
    approvedById: null,
    approvedAt: null,
    carId: "car-1",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    userId: null,
  },
] satisfies FleetCar["documents"];

const onboardingImages = [
  {
    id: "image-1",
    url: "https://cdn.example.com/car.jpg",
    status: "PENDING" as const,
    isPrimary: true,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
  },
] satisfies FleetCar["images"];

const draftCar = {
  ...fleetCar,
  submittedAt: null,
  hourlyRate: null,
  dayRate: null,
  nightRate: null,
  fuelUpgradeRate: null,
  fullDayRate: null,
  airportPickupRate: null,
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

describe("fleet car onboarding step", () => {
  it("starts at documents until both certificates are present", () => {
    expect(getFleetCarOnboardingStep(draftCar)).toBe("documents");
    expect(
      getFleetCarOnboardingStep({
        ...draftCar,
        documents: [onboardingDocuments[0]],
      }),
    ).toBe("documents");
  });

  it("progresses documents -> photos -> pricing -> submit", () => {
    expect(
      getFleetCarOnboardingStep({
        ...draftCar,
        documents: onboardingDocuments,
      }),
    ).toBe("photos");
    expect(
      getFleetCarOnboardingStep({
        ...draftCar,
        documents: onboardingDocuments,
        images: onboardingImages,
      }),
    ).toBe("pricing");
    expect(
      getFleetCarOnboardingStep({
        ...fleetCar,
        submittedAt: null,
        documents: onboardingDocuments,
        images: onboardingImages,
      }),
    ).toBe("submit");
  });

  it("stays on pricing until every required rate is set", () => {
    const readyForPricing = {
      ...fleetCar,
      submittedAt: null,
      documents: onboardingDocuments,
      images: onboardingImages,
    } satisfies FleetCar;

    expect(getFleetCarOnboardingStep({ ...readyForPricing, hourlyRate: null })).toBe("pricing");
    expect(getFleetCarOnboardingStep({ ...readyForPricing, fuelUpgradeRate: null })).toBe(
      "pricing",
    );
    expect(
      getFleetCarOnboardingStep({
        ...readyForPricing,
        pricingIncludesFuel: true,
        fuelUpgradeRate: null,
      }),
    ).toBe("submit");
  });

  it("keeps insurance recovery inside submit rather than adding a sixth step", () => {
    const readyForSubmit = {
      ...fleetCar,
      submittedAt: null,
      documents: onboardingDocuments,
      images: onboardingImages,
    } satisfies FleetCar;
    const expiredInsurance = {
      id: "ins-1",
      status: "SUCCEEDED" as const,
      policyNumber: "POL-12345",
      policyStatus: "Expired",
      policyExpiresAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const failedInsurance = {
      ...expiredInsurance,
      status: "FAILED" as const,
      policyStatus: "Failed",
      policyExpiresAt: "2027-01-01T00:00:00.000Z",
    };

    expect(getFleetCarOnboardingStep({ ...readyForSubmit, insuranceVerifications: [] })).toBe(
      "submit",
    );
    expect(
      getFleetCarOnboardingStep({
        ...readyForSubmit,
        insuranceVerifications: [failedInsurance],
      }),
    ).toBe("submit");
    expect(
      getFleetCarOnboardingStep({
        ...readyForSubmit,
        insuranceVerifications: [expiredInsurance],
      }),
    ).toBe("submit");
  });
});
