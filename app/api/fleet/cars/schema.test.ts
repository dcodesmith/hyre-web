import { describe, expect, it } from "vitest";

import { fleetCarSchema, fleetCarsSchema } from "./schema";

const fleetCar = {
  id: "cm12345678901234567890123",
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
  images: [
    {
      id: "image-1",
      url: "https://cdn.example.com/car.jpg",
      status: "APPROVED",
      isPrimary: true,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
  ],
  documents: [
    {
      id: "document-1",
      documentType: "MOT_CERTIFICATE",
      status: "PENDING",
      documentUrl: "https://cdn.example.com/mot.pdf",
      notes: null,
      approvedById: null,
      approvedAt: null,
      carId: "cm12345678901234567890123",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      userId: null,
    },
  ],
  insuranceVerifications: [
    {
      id: "ins-1",
      status: "SUCCEEDED",
      policyNumber: "POL-12345",
      policyStatus: "Active",
      policyExpiresAt: "2027-01-01T00:00:00.000Z",
      createdAt: "2026-09-07T12:00:00.000Z",
    },
  ],
  promotion: null,
} as const;

describe("fleet car API schema", () => {
  it("accepts the owner list/detail response contract", () => {
    expect(fleetCarsSchema.parse([fleetCar])).toEqual([fleetCar]);
  });

  it("rejects an incomplete car response", () => {
    const { registrationNumber: _, ...incompleteCar } = fleetCar;
    expect(fleetCarsSchema.safeParse([incompleteCar]).success).toBe(false);
  });

  it("accepts API draft cars whose required rates are null before pricing", () => {
    const draftCar = {
      ...fleetCar,
      status: "HOLD",
      approvalStatus: "PENDING",
      submittedAt: null,
      hourlyRate: null,
      dayRate: null,
      nightRate: null,
      fullDayRate: null,
      airportPickupRate: null,
      fuelUpgradeRate: null,
      images: [],
      documents: [],
      insuranceVerifications: [],
    };

    expect(fleetCarSchema.parse(draftCar)).toEqual(draftCar);
    expect(fleetCarsSchema.parse([draftCar])).toEqual([draftCar]);
  });

  it("parses nullable submittedAt and the latest insurance verification", () => {
    const pendingCar = {
      ...fleetCar,
      submittedAt: null,
      insuranceVerifications: [
        {
          id: "ins-1",
          status: "SUCCEEDED",
          policyNumber: "POL-12345",
          policyStatus: null,
          policyExpiresAt: null,
          createdAt: "2026-09-07T12:00:00.000Z",
        },
      ],
    };

    expect(fleetCarSchema.parse(pendingCar)).toEqual(pendingCar);
    expect(fleetCarSchema.parse({ ...fleetCar, insuranceVerifications: [] })).toEqual({
      ...fleetCar,
      insuranceVerifications: [],
    });
  });

  it("rejects cars that omit setup status fields or use invalid timestamps", () => {
    const { submittedAt: _, ...withoutSubmittedAt } = fleetCar;
    const { insuranceVerifications: __, ...withoutInsurance } = fleetCar;

    expect(fleetCarSchema.safeParse(withoutSubmittedAt).success).toBe(false);
    expect(fleetCarSchema.safeParse(withoutInsurance).success).toBe(false);
    expect(fleetCarSchema.safeParse({ ...fleetCar, submittedAt: "not-a-date" }).success).toBe(
      false,
    );
    expect(
      fleetCarSchema.safeParse({
        ...fleetCar,
        insuranceVerifications: [
          {
            id: "ins-1",
            status: "SUCCEEDED",
            policyNumber: "POL-12345",
            policyStatus: null,
            policyExpiresAt: "not-a-date",
            createdAt: "2026-09-07T12:00:00.000Z",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      fleetCarSchema.safeParse({
        ...fleetCar,
        insuranceVerifications: [{ id: "ins-1", status: "SUCCEEDED" }],
      }).success,
    ).toBe(false);
  });
});
