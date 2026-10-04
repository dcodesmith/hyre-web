import { describe, expect, it } from "vitest";

import {
  fleetBookingAssignmentSchema,
  fleetBookingDetailSchema,
  fleetBookingsSchema,
} from "./schema";

const bookingId = "018f47a2-7b3c-7d4e-8f90-123456789401";
const carId = "018f47a2-7b3c-7d4e-8f90-123456789471";
const chauffeurId = "018f47a2-7b3c-7d4e-8f90-1234567894a1";

const booking = {
  id: bookingId,
  bookingReference: "TD-1001",
  status: "CONFIRMED",
  type: "AIRPORT_PICKUP",
  startDate: "2026-08-21T08:00:00.000Z",
  endDate: "2026-08-21T20:00:00.000Z",
  pickupLocation: "Murtala Muhammed Airport",
  returnLocation: "Victoria Island",
  specialRequests: null,
  flightNumber: "P4 7123",
  customerName: "Ada Lovelace",
  car: {
    id: carId,
    make: "Honda",
    model: "Accord",
    year: 2024,
    registrationNumber: "ABC-123DE",
  },
  chauffeur: null,
  canAssignChauffeur: true,
};

const list = {
  items: [booking],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe("fleet booking API schemas", () => {
  it("parses list, detail, and assignment responses", () => {
    const parsedList = fleetBookingsSchema.parse({
      ...list,
      items: [
        { ...booking, paymentStatus: "PAID", chauffeur: { ...chauffeur(), email: "hidden" } },
      ],
    });
    const parsedDetail = fleetBookingDetailSchema.parse({
      booking,
      assignableChauffeurs: [chauffeur({ isOwnerDriver: true })],
      ownerId: "hidden",
    });
    const parsedAssignment = fleetBookingAssignmentSchema.parse({
      id: bookingId,
      bookingReference: "TD-1001",
      chauffeur: chauffeur(),
    });

    expect(parsedList.items[0]?.chauffeur).toEqual({
      id: chauffeurId,
      name: "Bola Adebayo",
      image: null,
    });
    expect(parsedList.meta).toEqual(list.meta);
    expect(parsedDetail.assignableChauffeurs[0]?.isOwnerDriver).toBe(true);
    expect(parsedDetail.booking.flightNumber).toBe("P4 7123");
    expect(parsedAssignment).toEqual({ id: bookingId, chauffeur: { id: chauffeurId } });
    expect(fleetBookingAssignmentSchema.parse({ id: bookingId, chauffeur: null })).toEqual({
      id: bookingId,
      chauffeur: null,
    });
    expect(
      fleetBookingsSchema.parse({
        ...list,
        items: [],
        meta: { ...list.meta, total: 0, totalPages: 0 },
      }).items,
    ).toEqual([]);
  });

  it("rejects incomplete or invalid booking payloads", () => {
    expect(
      fleetBookingsSchema.safeParse({ ...list, items: [{ ...booking, status: "ON_HOLD" }] })
        .success,
    ).toBe(false);
    expect(
      fleetBookingsSchema.safeParse({ ...list, items: [{ ...booking, startDate: "2026-08-21" }] })
        .success,
    ).toBe(false);
    expect(
      fleetBookingsSchema.safeParse({ ...list, items: [{ ...booking, id: "booking-1" }] }).success,
    ).toBe(false);
    expect(
      fleetBookingsSchema.safeParse({ ...list, meta: { ...list.meta, page: 0 } }).success,
    ).toBe(false);
    expect(
      fleetBookingsSchema.safeParse({ ...list, meta: { ...list.meta, total: -1 } }).success,
    ).toBe(false);
    expect(
      fleetBookingDetailSchema.safeParse({
        booking,
        assignableChauffeurs: [chauffeur({ isOwnerDriver: undefined })],
      }).success,
    ).toBe(false);
    expect(
      fleetBookingAssignmentSchema.safeParse({ id: bookingId, chauffeur: { name: "Bola" } })
        .success,
    ).toBe(false);
  });
});

function chauffeur(overrides: Record<string, unknown> = {}) {
  return {
    id: chauffeurId,
    name: "Bola Adebayo",
    image: null,
    isOwnerDriver: false,
    ...overrides,
  };
}
