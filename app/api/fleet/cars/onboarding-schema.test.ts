import { describe, expect, it } from "vitest";
import {
  fleetCarSubmissionSchema,
  fleetInsuranceVerificationSchema,
  fleetVehicleVerificationSchema,
} from "./onboarding-schema";
import { fleetCarSchema } from "./schema";

const succeededVehicleVerification = {
  id: "ver-1",
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
  eligibility: { isEligible: true, reasons: [] },
  expiresAt: "2026-09-08T12:00:00.000Z",
  carId: null,
};

const fleetCar = {
  id: "cm12345678901234567890123",
  make: "Toyota",
  model: "Camry",
  year: 2020,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "owner-1",
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
    id: "owner-1",
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
        eligibility: { isEligible: false, reasons: ["VEHICLE_YEAR_BELOW_MINIMUM"] },
      }).eligibility,
    ).toEqual({ isEligible: false, reasons: ["VEHICLE_YEAR_BELOW_MINIMUM"] });
  });

  it("allows nullable vehicle verification fields", () => {
    expect(
      fleetVehicleVerificationSchema.parse({
        ...succeededVehicleVerification,
        vehicle: {
          plateNumber: "KJA123AB",
          chassisNumber: null,
          make: null,
          model: null,
          year: null,
          color: null,
          passengerCapacity: null,
        },
        eligibility: { isEligible: false, reasons: [] },
      }).vehicle,
    ).toEqual({
      plateNumber: "KJA123AB",
      chassisNumber: null,
      make: null,
      model: null,
      year: null,
      color: null,
      passengerCapacity: null,
    });
  });

  it("parses insurance verification including nullable policy fields", () => {
    const succeeded = {
      id: "ins-1",
      carId: "car-1",
      status: "SUCCEEDED",
      policyNumber: "POL-12345",
      policyStatus: "Active",
      policyExpiresAt: "2027-01-01T00:00:00.000Z",
      providerRef: "ins-ref",
      createdAt: "2026-09-07T12:00:00.000Z",
    };

    expect(fleetInsuranceVerificationSchema.parse(succeeded)).toEqual(succeeded);
    expect(
      fleetInsuranceVerificationSchema.parse({
        ...succeeded,
        policyStatus: null,
        policyExpiresAt: null,
        providerRef: null,
      }),
    ).toMatchObject({ policyStatus: null, policyExpiresAt: null, providerRef: null });
  });

  it("parses submission requirements", () => {
    const submission = {
      success: true,
      requirements: {
        hasDocuments: true,
        hasImages: true,
        hasPricing: true,
        hasInsuranceVerification: true,
      },
    };

    expect(fleetCarSubmissionSchema.parse(submission)).toEqual(submission);
  });

  it("parses the current fleet-car draft response", () => {
    expect(fleetCarSchema.parse(fleetCar)).toEqual(fleetCar);
  });
});
