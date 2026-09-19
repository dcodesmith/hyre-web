import { describe, expect, it } from "vitest";
import {
  fleetCarSubmissionSchema,
  fleetDraftCarCreatedSchema,
  fleetVehicleVerificationSchema,
} from "./onboarding-schema";
import { fleetCarSchema } from "./schema";

const succeededVehicleVerification = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567894f5",
  status: "SUCCEEDED",
  vehicle: {
    plateNumber: "KJA123AB",
    chassisNumber: "1HGCM82633A004352",
    make: "Toyota",
    model: "Camry",
    year: 2020,
    color: "Black",
    passengerCapacity: 5,
  },
  eligibility: { isEligible: true, reasons: [], minimumYear: 2011 },
  expiresAt: "2026-09-08T12:00:00.000Z",
  carId: null,
};

const fleetCar = {
  id: "018f47a2-7b3c-7d4e-8f90-123456789101",
  publicRef: "0123456789abc101",
  make: "Toyota",
  model: "Camry",
  year: 2020,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "018f47a2-7b3c-7d4e-8f90-123456789461",
  registrationNumber: "KJA123AB",
  status: "HOLD",
  approvalStatus: "PENDING",
  approvalNotes: null,
  submittedAt: null,
  hourlyRate: null,
  dayRate: null,
  nightRate: null,
  fuelUpgradeRate: null,
  fullDayRate: null,
  airportPickupRate: null,
  vehicleType: "SEDAN",
  serviceTier: "STANDARD",
  passengerCapacity: 5,
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
};

describe("fleet car onboarding API schemas", () => {
  it("parses SUCCEEDED vehicle verification with eligibility", () => {
    expect(fleetVehicleVerificationSchema.parse(succeededVehicleVerification)).toEqual(
      succeededVehicleVerification,
    );
    expect(
      fleetVehicleVerificationSchema.parse({
        ...succeededVehicleVerification,
        vehicle: { ...succeededVehicleVerification.vehicle, year: 2014 },
        eligibility: {
          isEligible: false,
          reasons: ["VEHICLE_YEAR_BELOW_MINIMUM"],
          minimumYear: 2011,
        },
      }).eligibility,
    ).toEqual({ isEligible: false, reasons: ["VEHICLE_YEAR_BELOW_MINIMUM"], minimumYear: 2011 });
    expect(
      fleetVehicleVerificationSchema.safeParse({
        ...succeededVehicleVerification,
        eligibility: { isEligible: true, reasons: [] },
      }).success,
    ).toBe(false);
  });

  it("allows nullable vehicle verification fields except required color", () => {
    expect(
      fleetVehicleVerificationSchema.parse({
        ...succeededVehicleVerification,
        vehicle: {
          plateNumber: "KJA123AB",
          chassisNumber: null,
          make: null,
          model: null,
          year: null,
          color: "Black",
          passengerCapacity: null,
        },
        eligibility: { isEligible: false, reasons: [], minimumYear: 2011 },
      }).vehicle,
    ).toEqual({
      plateNumber: "KJA123AB",
      chassisNumber: null,
      make: null,
      model: null,
      year: null,
      color: "Black",
      passengerCapacity: null,
    });
    expect(
      fleetVehicleVerificationSchema.safeParse({
        ...succeededVehicleVerification,
        vehicle: {
          plateNumber: "KJA123AB",
          chassisNumber: null,
          make: null,
          model: null,
          year: null,
          passengerCapacity: null,
        },
      }).success,
    ).toBe(false);
  });

  it("accepts a created draft car by id only", () => {
    expect(fleetDraftCarCreatedSchema.parse({ id: fleetCar.id, extra: true })).toEqual({
      id: fleetCar.id,
    });
    expect(fleetDraftCarCreatedSchema.safeParse({}).success).toBe(false);
  });

  it("parses submission requirements without an insurance gate", () => {
    const submission = {
      success: true,
      requirements: {
        hasDocuments: true,
        hasImages: true,
        hasPricing: true,
      },
    };

    expect(fleetCarSubmissionSchema.parse(submission)).toEqual(submission);
    expect(fleetCarSubmissionSchema.parse(submission).requirements).not.toHaveProperty(
      "hasInsuranceVerification",
    );
  });

  it("parses the current fleet-car draft response", () => {
    expect(fleetCarSchema.parse(fleetCar)).toEqual(fleetCar);
  });
});
