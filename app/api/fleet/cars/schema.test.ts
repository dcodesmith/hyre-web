import { describe, expect, it } from "vitest";

import { fleetCarsSchema } from "./schema";

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
});
