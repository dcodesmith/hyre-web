import { describe, expect, it } from "vitest";

import { bookingsByStatusSchema } from "./schema";

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
    expect(bookingsByStatusSchema.safeParse({}).success).toBe(true);
    expect(bookingsByStatusSchema.parse({ COMPLETED: [listItem] }).COMPLETED[0]?.reviewed).toBe(
      false,
    );
    expect(
      bookingsByStatusSchema.parse({ COMPLETED: [{ ...listItem, review: null }] }).COMPLETED[0]
        ?.reviewed,
    ).toBe(false);
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
