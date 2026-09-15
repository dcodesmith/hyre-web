import { describe, expect, it } from "vitest";

import type { FleetCar } from "~/api/fleet/cars/schema";
import {
  FLEET_CAR_ONBOARDING_STAGES,
  getFleetCarOnboardingStep,
  getFleetCarStatusLabel,
  hasFleetCarPricing,
  needsFleetCarOnboarding,
} from "./fleet-car";

const fleetCar = {
  id: "018f47a2-7b3c-7d4e-8f90-123456789471",
  publicRef: "0123456789abc471",
  make: "Lexus",
  model: "RX 350",
  year: 2023,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "018f47a2-7b3c-7d4e-8f90-123456789461",
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
    id: "018f47a2-7b3c-7d4e-8f90-123456789461",
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
    id: "018f47a2-7b3c-7d4e-8f90-123456789490",
    documentType: "VEHICLE_REGISTRATION" as const,
    status: "PENDING" as const,
    documentUrl: "https://cdn.example.com/registration.pdf",
    notes: null,
    approvedById: null,
    approvedAt: null,
    carId: "018f47a2-7b3c-7d4e-8f90-123456789471",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    userId: null,
  },
  {
    id: "018f47a2-7b3c-7d4e-8f90-123456789491",
    documentType: "MOT_CERTIFICATE" as const,
    status: "PENDING" as const,
    documentUrl: "https://cdn.example.com/mot.pdf",
    notes: null,
    approvedById: null,
    approvedAt: null,
    carId: "018f47a2-7b3c-7d4e-8f90-123456789471",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    userId: null,
  },
  {
    id: "018f47a2-7b3c-7d4e-8f90-123456789492",
    documentType: "INSURANCE_CERTIFICATE" as const,
    status: "PENDING" as const,
    documentUrl: "https://cdn.example.com/insurance.pdf",
    notes: null,
    approvedById: null,
    approvedAt: null,
    carId: "018f47a2-7b3c-7d4e-8f90-123456789471",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    userId: null,
  },
] satisfies FleetCar["documents"];

function onboardingImage(id: string, isPrimary = false): FleetCar["images"][number] {
  return {
    id,
    url: `https://cdn.example.com/${id}.jpg`,
    status: "PENDING",
    isPrimary,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
  };
}

const onboardingImages = [
  onboardingImage("018f47a2-7b3c-7d4e-8f90-123456789481", true),
  onboardingImage("018f47a2-7b3c-7d4e-8f90-123456789482"),
  onboardingImage("018f47a2-7b3c-7d4e-8f90-123456789483"),
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
  it("starts at documents until all three required documents are present", () => {
    expect(getFleetCarOnboardingStep(draftCar)).toBe("documents");
    expect(
      getFleetCarOnboardingStep({
        ...draftCar,
        documents: [onboardingDocuments[0]],
      }),
    ).toBe("documents");
    expect(
      getFleetCarOnboardingStep({
        ...draftCar,
        documents: onboardingDocuments.slice(0, 2),
      }),
    ).toBe("documents");
  });

  it("checks required document types instead of trusting the document count", () => {
    expect(
      getFleetCarOnboardingStep({
        ...draftCar,
        documents: [
          onboardingDocuments[1],
          onboardingDocuments[2],
          { ...onboardingDocuments[1], id: "duplicate-mot" },
        ],
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
        images: onboardingImages.slice(0, 2),
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

  it("does not add an insurance-recovery step after pricing is complete", () => {
    const readyForSubmit = {
      ...fleetCar,
      submittedAt: null,
      documents: onboardingDocuments,
      images: onboardingImages,
    } satisfies FleetCar;

    expect(getFleetCarOnboardingStep({ ...readyForSubmit, insuranceVerifications: [] })).toBe(
      "submit",
    );
    expect(FLEET_CAR_ONBOARDING_STAGES.map((stage) => stage.label)).toEqual([
      "Vehicle",
      "Documents",
      "Photos",
      "Pricing",
      "Submit",
    ]);
    expect(FLEET_CAR_ONBOARDING_STAGES).toHaveLength(5);
  });
});
