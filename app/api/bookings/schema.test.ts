import { describe, expect, it } from "vitest";

import {
  bookingDetailSchema,
  bookingMutationResponseSchema,
  bookingsByStatusSchema,
  createBookingResponseSchema,
  createExtensionResponseSchema,
  guestBookingAccessRequestResponseSchema,
  guestBookingAccessTokenSchema,
  guestBookingDetailSchema,
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
    const payload = {
      id: "booking-1",
      userId: "user-1",
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
          canExtend: false,
          maxExtendableHours: 0,
        },
      ],
      canEdit: false,
      canCancel: true,
      modificationCutoffAt: "2026-07-01T20:00:00.000Z",
      review: {
        id: "review-1",
        overallRating: 5,
        carRating: 4,
        chauffeurRating: 5,
        serviceRating: 5,
        comment: "Excellent trip",
        createdAt: "2026-07-03T10:00:00.000Z",
        user: { id: "user-1", name: "Ada", image: null },
        isVisible: true,
        moderationNotes: "hidden",
      },
      user: { email: "hidden@example.com" },
    };
    const parsed = bookingDetailSchema.safeParse(payload);

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    const booking = parsed.data.booking;
    expect(booking.car).toEqual({ make: "Lexus", model: "UX F-Sport", year: 2019 });
    expect(booking.chauffeur).toEqual({ name: "Bola Adebayo" });
    expect(booking.currency).toBe("USD");
    expect(booking.canEdit).toBe(false);
    expect(booking.canCancel).toBe(true);
    expect(booking.legs[0]).toMatchObject({
      canExtend: false,
      maxExtendableHours: 0,
    });
    expect(booking.modificationCutoffAt).toBe("2026-07-01T20:00:00.000Z");
    expect(booking.review).toEqual({
      id: "review-1",
      overallRating: 5,
      carRating: 4,
      chauffeurRating: 5,
      serviceRating: 5,
      comment: "Excellent trip",
      createdAt: "2026-07-03T10:00:00.000Z",
      user: { id: "user-1", name: "Ada", image: null },
    });
    expect(booking).not.toHaveProperty("user");
    expect(parsed.data.customerUserId).toBe("user-1");

    const hidden = bookingDetailSchema.parse({
      ...payload,
      review: { ...payload.review, isVisible: false },
    });
    expect(hidden.booking.review).toBeNull();
    expect(hidden.reviewVisibility).toBe(false);
  });

  it("drops an invalid currency instead of failing the booking", () => {
    const parsed = bookingDetailSchema.safeParse({
      id: "booking-1",
      userId: "user-1",
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
      canEdit: false,
      canCancel: false,
      modificationCutoffAt: "2026-07-01T20:00:00.000Z",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.booking.currency).toBeUndefined();
  });

  it("coerces numeric strings and rejects values that Number() would turn into 0", () => {
    const payload = {
      id: "booking-1",
      userId: "user-1",
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
      canEdit: false,
      canCancel: false,
      modificationCutoffAt: "2026-07-01T20:00:00.000Z",
    };

    expect(bookingDetailSchema.parse(payload).booking.totalAmount).toBe(150_000.5);
    expect(bookingDetailSchema.parse(payload).booking.netTotal).toBeNull();
    expect(bookingDetailSchema.safeParse({ ...payload, totalAmount: "" }).success).toBe(false);
    expect(bookingDetailSchema.safeParse({ ...payload, totalAmount: null }).success).toBe(false);
    expect(bookingDetailSchema.safeParse({ ...payload, totalAmount: false }).success).toBe(false);
    expect(bookingDetailSchema.safeParse({ ...payload, netTotal: "" }).success).toBe(false);
    expect(bookingDetailSchema.safeParse({ ...payload, canEdit: undefined }).success).toBe(false);
    expect(bookingDetailSchema.safeParse({ ...payload, canCancel: undefined }).success).toBe(false);
    expect(
      bookingDetailSchema.safeParse({ ...payload, modificationCutoffAt: undefined }).success,
    ).toBe(false);
  });
});

describe("guest booking access schemas", () => {
  const detail = {
    bookingId: "booking-1",
    bookingReference: "BK-123",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    bookingType: "DAY",
    startDate: "2026-09-21T08:00:00.000Z",
    endDate: "2026-09-21T20:00:00.000Z",
    pickupLocation: "Ikeja",
    returnLocation: "Lekki",
    specialRequests: null,
    cancellationReason: null,
    flightNumber: null,
    totalAmount: 50_000,
    currency: "NGN",
    accessExpiresAt: "2026-09-21T12:15:00.000Z",
    car: {
      make: "Toyota",
      model: "Camry",
      year: 2025,
      images: ["https://cdn.example.com/car.jpg"],
    },
    chauffeur: { name: "Bola", phoneNumber: "08000000000" },
    legs: [
      {
        id: "leg-1",
        legDate: "2026-09-21T00:00:00.000Z",
        legStartTime: "2026-09-21T08:00:00.000Z",
        legEndTime: "2026-09-21T20:00:00.000Z",
        extensions: [],
      },
    ],
  };

  it("validates the explicit guest detail response", () => {
    expect(
      guestBookingDetailSchema.parse({ ...detail, user: { email: "hidden@example.com" } }),
    ).toEqual(detail);
    expect(
      guestBookingAccessRequestResponseSchema.parse({
        message: "If those booking details match, we sent an access link.",
      }),
    ).toEqual({
      message: "If those booking details match, we sent an access link.",
    });
  });

  it("requires the API's 32-byte base64url token shape", () => {
    expect(guestBookingAccessTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(guestBookingAccessTokenSchema.safeParse("too-short").success).toBe(false);
    expect(guestBookingAccessTokenSchema.safeParse(`${"a".repeat(42)}+`).success).toBe(false);
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

describe("createExtensionResponseSchema", () => {
  it("requires the extension identity and an https checkout URL", () => {
    const response = {
      extensionId: "extension-1",
      paymentIntentId: "ext-tx-1",
    };

    expect(
      createExtensionResponseSchema.safeParse({
        ...response,
        checkoutUrl: "https://checkout.flutterwave.com/pay/ext-tx-1",
      }).success,
    ).toBe(true);
    expect(
      createExtensionResponseSchema.safeParse({
        ...response,
        checkoutUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});

describe("bookingMutationResponseSchema", () => {
  it("only requires the mutated booking id", () => {
    expect(bookingMutationResponseSchema.parse({ id: "booking-1", status: "CONFIRMED" })).toEqual({
      id: "booking-1",
    });
  });
});
