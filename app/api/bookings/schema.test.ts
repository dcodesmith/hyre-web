import { describe, expect, it } from "vitest";

import { bookingDetailSchema, bookingsByStatusSchema } from "./schema";

const listItem = {
  id: "booking-1",
  bookingReference: "TD-1001",
  status: "CONFIRMED",
  startDate: "2026-08-21T08:00:00.000Z",
  endDate: "2026-08-21T20:00:00.000Z",
  totalAmount: 15_000,
  car: {
    make: "Honda",
    model: "Accord",
    year: 2024,
    images: [{ url: "https://example.com/accord.jpg" }],
  },
};

describe("bookingsByStatusSchema", () => {
  it("keeps list fields, drops extras, and turns review into a flag", () => {
    const parsed = bookingsByStatusSchema.safeParse({
      CONFIRMED: [
        {
          ...listItem,
          canEdit: true,
          canCancel: true,
          pickupLocation: "Lagos",
          car: {
            ...listItem.car,
            owner: { name: "fleet" },
            images: [{ id: "img-1", url: "https://example.com/accord.jpg" }],
          },
          review: { id: "rev-1", user: { name: "Ada" } },
        },
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data).toEqual({
      CONFIRMED: [
        {
          ...listItem,
          reviewed: true,
        },
      ],
    });
  });

  it("accepts an empty map and treats a missing review as not reviewed", () => {
    const completed = { ...listItem, status: "COMPLETED" };

    expect(bookingsByStatusSchema.safeParse({}).success).toBe(true);
    expect(bookingsByStatusSchema.parse({ COMPLETED: [completed] }).COMPLETED?.[0]?.reviewed).toBe(
      false,
    );
    expect(
      bookingsByStatusSchema.parse({ COMPLETED: [{ ...completed, review: null }] }).COMPLETED?.[0]
        ?.reviewed,
    ).toBe(false);
  });

  it("rejects a row whose status does not match its group", () => {
    expect(bookingsByStatusSchema.safeParse({ COMPLETED: [listItem] }).success).toBe(false);
  });

  it("rejects a row without the list car or an unknown status", () => {
    expect(
      bookingsByStatusSchema.safeParse({
        ACTIVE: [{ ...listItem, car: undefined }],
      }).success,
    ).toBe(false);
    expect(
      bookingsByStatusSchema.safeParse({
        ACTIVE: [{ ...listItem, status: "ON_HOLD" }],
      }).success,
    ).toBe(false);
  });
});

describe("bookingDetailSchema", () => {
  it("keeps display fields and drops extras", () => {
    const parsed = bookingDetailSchema.safeParse({
      id: "booking-1",
      bookingReference: "TD-1001",
      status: "COMPLETED",
      paymentStatus: "PAID",
      type: "DAY",
      startDate: "2026-07-02T08:00:00.000Z",
      endDate: "2026-07-02T20:00:00.000Z",
      pickupLocation: "Ikeja",
      returnLocation: "Marina",
      totalAmount: 150_000,
      netTotal: 130_435,
      platformCustomerServiceFeeAmount: 9_130,
      platformCustomerServiceFeeRatePercent: 7,
      vatAmount: 10_435,
      vatRatePercent: 7.5,
      car: { make: "Lexus", model: "UX F-Sport", year: 2019, owner: { id: "owner-1" } },
      chauffeur: { name: "Bola Adebayo", phoneNumber: "0801" },
      flight: null,
      legs: [
        {
          id: "leg-1",
          legDate: "2026-07-02T00:00:00.000Z",
          legStartTime: "2026-07-02T08:00:00.000Z",
          legEndTime: "2026-07-02T20:00:00.000Z",
          extensions: [],
        },
      ],
      canEdit: false,
      user: { email: "hidden@example.com" },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.car).toEqual({ make: "Lexus", model: "UX F-Sport", year: 2019 });
    expect(parsed.data.chauffeur).toEqual({ name: "Bola Adebayo" });
    expect(parsed.data).not.toHaveProperty("canEdit");
    expect(parsed.data).not.toHaveProperty("user");
  });
});
