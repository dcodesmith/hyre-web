import { describe, expect, it } from "vitest";

import {
  bookingDetailSchema,
  bookingsByStatusSchema,
  cancelBookingResponseSchema,
  createBookingResponseSchema,
} from "./schema";

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
      currency: "usd",
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
      canCancel: true,
      user: { email: "hidden@example.com" },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.car).toEqual({ make: "Lexus", model: "UX F-Sport", year: 2019 });
    expect(parsed.data.chauffeur).toEqual({ name: "Bola Adebayo" });
    expect(parsed.data.currency).toBe("USD");
    expect(parsed.data.canCancel).toBe(true);
    expect(parsed.data).not.toHaveProperty("canEdit");
    expect(parsed.data).not.toHaveProperty("user");
  });

  it("drops an invalid currency instead of failing the booking", () => {
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
      currency: "naira",
      car: { make: "Lexus", model: "UX F-Sport", year: 2019 },
      chauffeur: null,
      flight: null,
      legs: [],
      canCancel: false,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.currency).toBeUndefined();
  });

  it("coerces numeric strings and rejects values that Number() would turn into 0", () => {
    const payload = {
      id: "booking-1",
      bookingReference: "TD-1001",
      status: "COMPLETED",
      paymentStatus: "PAID",
      type: "DAY",
      startDate: "2026-07-02T08:00:00.000Z",
      endDate: "2026-07-02T20:00:00.000Z",
      pickupLocation: "Ikeja",
      returnLocation: "Marina",
      totalAmount: "150000.50",
      netTotal: null,
      car: { make: "Lexus", model: "UX F-Sport", year: 2019 },
      chauffeur: null,
      flight: null,
      legs: [],
      canCancel: false,
    };

    expect(bookingDetailSchema.parse(payload).totalAmount).toBe(150_000.5);
    expect(bookingDetailSchema.parse(payload).netTotal).toBeNull();
    expect(bookingDetailSchema.safeParse({ ...payload, totalAmount: "" }).success).toBe(false);
    expect(bookingDetailSchema.safeParse({ ...payload, totalAmount: null }).success).toBe(false);
    expect(bookingDetailSchema.safeParse({ ...payload, totalAmount: false }).success).toBe(false);
    expect(bookingDetailSchema.safeParse({ ...payload, netTotal: "" }).success).toBe(false);
    expect(bookingDetailSchema.safeParse({ ...payload, canCancel: undefined }).success).toBe(false);
  });
});

describe("createBookingResponseSchema", () => {
  const created = {
    bookingId: "booking-1",
    txRef: "tx-1",
    totalAmount: 63_000,
    currency: "NGN",
    bookingStatus: "PENDING",
    reservationExpiresAt: "2026-08-21T10:00:00.000Z",
  };

  it("requires an https checkout URL", () => {
    expect(
      createBookingResponseSchema.safeParse({
        ...created,
        checkoutUrl: "https://checkout.flutterwave.com/pay",
      }).success,
    ).toBe(true);
    expect(
      createBookingResponseSchema.safeParse({
        ...created,
        checkoutUrl: "http://checkout.flutterwave.com/pay",
      }).success,
    ).toBe(false);
    expect(
      createBookingResponseSchema.safeParse({
        ...created,
        checkoutUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});

describe("cancelBookingResponseSchema", () => {
  it("only requires the cancelled booking id", () => {
    expect(cancelBookingResponseSchema.parse({ id: "booking-1", status: "CANCELLED" })).toEqual({
      id: "booking-1",
    });
  });
});
