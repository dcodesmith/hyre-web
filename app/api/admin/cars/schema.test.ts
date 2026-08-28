import { describe, expect, it } from "vitest";

import { adminCarsResponseSchema } from "./schema";

const adminCar = {
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
  approvalStatus: "PENDING",
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
      id: "cm22345678901234567890123",
      url: "https://cdn.example.com/car.jpg",
      status: "PENDING",
      isPrimary: false,
      notes: null,
      approvedById: null,
      approvedAt: null,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
  ],
  documents: [
    {
      id: "cm32345678901234567890123",
      documentType: "MOT_CERTIFICATE",
      status: "PENDING",
      documentUrl: "owner-1/cm12345678901234567890123/documents/mot.pdf",
      notes: null,
      approvedById: null,
      approvedAt: null,
      carId: "cm12345678901234567890123",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      userId: null,
    },
  ],
} as const;

describe("admin car API schema", () => {
  it("accepts the review list response contract", () => {
    const response = {
      cars: [adminCar],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };

    expect(adminCarsResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects assets that omit moderation fields", () => {
    const { approvedById: _, ...imageWithoutModeration } = adminCar.images[0];
    const response = {
      cars: [{ ...adminCar, images: [imageWithoutModeration] }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };

    expect(adminCarsResponseSchema.safeParse(response).success).toBe(false);
  });
});
