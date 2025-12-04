import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { addHours, addDays, subHours, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  getTimeUntilBooking,
  getTimeRemainingForLiveBooking,
  getEffectiveLegEndTime,
} from "./booking-utils";
import type { BookingWithRelations } from "~/types";
import { LAGOS_TIMEZONE } from "~/utils/timezone";
import { Decimal } from "decimal.js";

function createLagosDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return toZonedTime(date, LAGOS_TIMEZONE);
}

function createMockBookingLeg(
  overrides: Partial<BookingWithRelations["legs"][0]> = {},
): BookingWithRelations["legs"][0] {
  const now = new Date();
  return {
    id: `leg-${Math.random().toString(36).substring(7)}`,
    bookingId: "booking-1",
    legDate: now,
    legStartTime: now,
    legEndTime: addHours(now, 12),
    extensions: [],
    createdAt: now,
    updatedAt: now,
    totalDailyPrice: new Decimal(100),
    notes: null,
    fleetOwnerEarningForLeg: new Decimal(100),
    itemsNetValueForLeg: new Decimal(100),
    platformCommissionAmountOnLeg: new Decimal(100),
    platformCommissionRateOnLeg: new Decimal(100),
    ...overrides,
  };
}

function createMockBooking(overrides: Partial<BookingWithRelations> = {}): BookingWithRelations {
  const now = new Date();
  return {
    id: "booking-1",
    bookingReference: "BK-001",
    createdAt: now,
    updatedAt: now,
    startDate: addDays(now, 1),
    endDate: addDays(now, 2),
    status: "CONFIRMED",
    paymentStatus: "PAID",
    type: "DAY",
    carId: "car-1",
    userId: "user-1",
    pickupLocation: "Location A",
    returnLocation: "Location B",
    legs: [],
    car: {} as BookingWithRelations["car"],
    user: null,
    chauffeur: null,
    chauffeurId: "chauffeur-1",
    cancelledAt: null,
    cancellationReason: null,
    overallPayoutStatus: "PAID_OUT",
    guestUser: null,
    paymentIntent: "payment-intent-1",
    fleetOwnerPayoutAmountNet: new Decimal(100),
    totalAmount: new Decimal(100),
    netTotal: new Decimal(100),
    vatAmount: new Decimal(100),
    referralReferrerUserId: null,
    platformCustomerServiceFeeAmount: new Decimal(100),
    platformCustomerServiceFeeRatePercent: new Decimal(100),
    platformFleetOwnerCommissionAmount: new Decimal(100),
    platformFleetOwnerCommissionRatePercent: new Decimal(100),
    subtotalBeforeVat: new Decimal(100),
    vatRatePercent: new Decimal(100),
    fuelUpgradeCost: new Decimal(100),
    referralDiscountAmount: new Decimal(100),
    referralStatus: "NONE",
    referralCreditsUsed: new Decimal(100),
    referralCreditsReserved: new Decimal(100),
    securityDetailCost: new Decimal(100),
    paymentId: "payment-1",
    specialRequests: null,
    ...overrides,
  };
}

describe("getTimeUntilBooking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return null if booking has already started", () => {
    const now = new Date("2024-01-15T12:00:00Z");
    vi.setSystemTime(now);

    const booking = createMockBooking({
      startDate: subHours(now, 1),
    });

    const result = getTimeUntilBooking(booking);
    expect(result).toBeNull();
  });

  it("should return null if booking starts exactly now", () => {
    const now = new Date("2024-01-15T12:00:00Z");
    vi.setSystemTime(now);

    const booking = createMockBooking({
      startDate: now,
    });

    const result = getTimeUntilBooking(booking);
    expect(result).toBeNull();
  });

  it("should return minutes only when less than 1 hour", () => {
    const now = new Date("2024-01-15T12:00:00Z");
    vi.setSystemTime(now);

    const booking = createMockBooking({
      startDate: addHours(now, 0.5), // 30 minutes from now
    });

    const result = getTimeUntilBooking(booking);
    expect(result).toBe("30min");
  });

  it("should return hours and minutes when 1 hour or more but less than 1 day", () => {
    const now = new Date("2024-01-15T12:00:00Z");
    vi.setSystemTime(now);

    const booking = createMockBooking({
      startDate: addHours(now, 3.5), // 3 hours 30 minutes from now
    });

    const result = getTimeUntilBooking(booking);
    expect(result).toBe("3h 30min");
  });

  it("should return days and hours when 1 day or more", () => {
    const now = new Date("2024-01-15T12:00:00Z");
    vi.setSystemTime(now);

    const booking = createMockBooking({
      startDate: addDays(now, 2), // 2 days from now
    });

    const result = getTimeUntilBooking(booking);
    expect(result).toMatch(/^2d \d+h$/);
  });

  it("should handle exact hour boundaries", () => {
    const now = new Date("2024-01-15T12:00:00Z");
    vi.setSystemTime(now);

    const booking = createMockBooking({
      startDate: addHours(now, 5), // Exactly 5 hours from now
    });

    const result = getTimeUntilBooking(booking);
    expect(result).toBe("5h 0min");
  });
});

describe("getEffectiveLegEndTime", () => {
  it("should return original end time when no extensions exist", () => {
    const legEndTime = new Date("2024-01-15T18:00:00Z");
    const leg = {
      legEndTime,
      extensions: [],
    };

    const result = getEffectiveLegEndTime(leg);
    expect(result.getTime()).toBe(legEndTime.getTime());
  });

  it("should return original end time when extensions have inactive status", () => {
    const legEndTime = new Date("2024-01-15T18:00:00Z");
    const leg = {
      legEndTime,
      extensions: [
        {
          status: "PENDING",
          extensionEndTime: new Date("2024-01-15T20:00:00Z"),
        },
        {
          status: "CANCELLED",
          extensionEndTime: new Date("2024-01-15T21:00:00Z"),
        },
      ],
    };

    const result = getEffectiveLegEndTime(leg);
    expect(result.getTime()).toBe(legEndTime.getTime());
  });

  it("should return extension end time when active extension extends beyond original end time", () => {
    const legEndTime = new Date("2024-01-15T18:00:00Z");
    const extensionEndTime = new Date("2024-01-15T20:00:00Z");
    const leg = {
      legEndTime,
      extensions: [
        {
          status: "ACTIVE",
          extensionEndTime,
        },
      ],
    };

    const result = getEffectiveLegEndTime(leg);
    expect(result.getTime()).toBe(extensionEndTime.getTime());
  });

  it("should return original end time when extension end time is before original end time", () => {
    const legEndTime = new Date("2024-01-15T18:00:00Z");
    const extensionEndTime = new Date("2024-01-15T16:00:00Z");
    const leg = {
      legEndTime,
      extensions: [
        {
          status: "CONFIRMED",
          extensionEndTime,
        },
      ],
    };

    const result = getEffectiveLegEndTime(leg);
    expect(result.getTime()).toBe(legEndTime.getTime());
  });

  it("should return the latest extension end time when multiple active extensions exist", () => {
    const legEndTime = new Date("2024-01-15T18:00:00Z");
    const extension1EndTime = new Date("2024-01-15T19:00:00Z");
    const extension2EndTime = new Date("2024-01-15T20:00:00Z");
    const extension3EndTime = new Date("2024-01-15T21:00:00Z");
    const leg = {
      legEndTime,
      extensions: [
        {
          status: "ACTIVE",
          extensionEndTime: extension1EndTime,
        },
        {
          status: "CONFIRMED",
          extensionEndTime: extension3EndTime, // Latest
        },
        {
          status: "ACTIVE",
          extensionEndTime: extension2EndTime,
        },
      ],
    };

    const result = getEffectiveLegEndTime(leg);
    expect(result.getTime()).toBe(extension3EndTime.getTime());
  });

  it("should only consider CONFIRMED and ACTIVE extensions", () => {
    const legEndTime = new Date("2024-01-15T18:00:00Z");
    const activeExtensionEndTime = new Date("2024-01-15T20:00:00Z");
    const pendingExtensionEndTime = new Date("2024-01-15T22:00:00Z");
    const leg = {
      legEndTime,
      extensions: [
        {
          status: "ACTIVE",
          extensionEndTime: activeExtensionEndTime,
        },
        {
          status: "PENDING",
          extensionEndTime: pendingExtensionEndTime, // Should be ignored
        },
      ],
    };

    const result = getEffectiveLegEndTime(leg);
    expect(result.getTime()).toBe(activeExtensionEndTime.getTime());
  });
});

describe("getTimeRemainingForLiveBooking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return null when booking has no legs", () => {
    const booking = createMockBooking({
      legs: [],
    });

    const result = getTimeRemainingForLiveBooking(booking);
    expect(result).toBeNull();
  });

  it("should return null when no leg is found for today", () => {
    const now = createLagosDate(2024, 1, 15, 12, 0);
    vi.setSystemTime(now);

    const booking = createMockBooking({
      legs: [
        createMockBookingLeg({
          legDate: subDays(now, 2), // 2 days ago
          legStartTime: subDays(now, 2),
          legEndTime: subDays(now, 2),
        }),
        createMockBookingLeg({
          legDate: addDays(now, 2), // 2 days from now
          legStartTime: addDays(now, 2),
          legEndTime: addDays(now, 2),
        }),
      ],
    });

    const result = getTimeRemainingForLiveBooking(booking);
    expect(result).toBeNull();
  });

  it("should return time remaining when today's leg is still active", () => {
    const now = createLagosDate(2024, 1, 15, 12, 0);
    vi.setSystemTime(now);

    const legEndTime = addHours(now, 3); // Ends in 3 hours
    const booking = createMockBooking({
      legs: [
        createMockBookingLeg({
          legDate: now,
          legStartTime: subHours(now, 2),
          legEndTime,
        }),
      ],
    });

    const result = getTimeRemainingForLiveBooking(booking);
    expect(result).toEqual({
      time: "3h 0min",
      isNextLeg: false,
      isEnded: false,
    });
  });

  it("should return minutes only when less than 1 hour remaining", () => {
    const now = createLagosDate(2024, 1, 15, 12, 0);
    vi.setSystemTime(now);

    const legEndTime = addHours(now, 0.5); // Ends in 30 minutes
    const booking = createMockBooking({
      legs: [
        createMockBookingLeg({
          legDate: now,
          legStartTime: subHours(now, 2),
          legEndTime,
        }),
      ],
    });

    const result = getTimeRemainingForLiveBooking(booking);
    expect(result).toEqual({
      time: "30min",
      isNextLeg: false,
      isEnded: false,
    });
  });

  it("should return time until next leg when today's leg has ended and next leg exists", () => {
    const now = createLagosDate(2024, 1, 15, 12, 0);
    vi.setSystemTime(now);

    const todayLegEndTime = subHours(now, 1); // Ended 1 hour ago
    const nextLegStartTime = addHours(now, 2); // Starts in 2 hours
    const booking = createMockBooking({
      legs: [
        createMockBookingLeg({
          legDate: now,
          legStartTime: subHours(now, 5),
          legEndTime: todayLegEndTime,
        }),
        createMockBookingLeg({
          legDate: addDays(now, 1),
          legStartTime: nextLegStartTime,
          legEndTime: addHours(nextLegStartTime, 12),
        }),
      ],
    });

    const result = getTimeRemainingForLiveBooking(booking);
    expect(result).toEqual({
      time: "2h 0min",
      isNextLeg: true,
      isEnded: false,
    });
  });

  it("should return 'Ended' when today's leg has ended and no next leg exists", () => {
    const now = createLagosDate(2024, 1, 15, 12, 0);
    vi.setSystemTime(now);

    const todayLegEndTime = subHours(now, 1); // Ended 1 hour ago
    const booking = createMockBooking({
      legs: [
        createMockBookingLeg({
          legDate: now,
          legStartTime: subHours(now, 5),
          legEndTime: todayLegEndTime,
        }),
      ],
    });

    const result = getTimeRemainingForLiveBooking(booking);
    expect(result).toEqual({
      time: "Ended",
      isNextLeg: false,
      isEnded: true,
    });
  });

  it("should consider extensions when calculating effective end time", () => {
    const now = createLagosDate(2024, 1, 15, 12, 0);
    vi.setSystemTime(now);

    const originalLegEndTime = subHours(now, 1); // Original end time was 1 hour ago
    const extensionEndTime = addHours(now, 2); // But extension extends it to 2 hours from now
    const booking = createMockBooking({
      legs: [
        createMockBookingLeg({
          legDate: now,
          legStartTime: subHours(now, 5),
          legEndTime: originalLegEndTime,
          extensions: [
            {
              id: "ext-1",
              status: "ACTIVE",
              extensionEndTime,
            } as BookingWithRelations["legs"][0]["extensions"][0],
          ],
        }),
      ],
    });

    const result = getTimeRemainingForLiveBooking(booking);
    expect(result).toEqual({
      time: "2h 0min",
      isNextLeg: false,
      isEnded: false,
    });
  });

  it("should handle legs sorted by start time correctly", () => {
    const now = createLagosDate(2024, 1, 15, 12, 0);
    vi.setSystemTime(now);

    const legEndTime = addHours(now, 3);
    // Legs provided in wrong order - should be sorted
    const booking = createMockBooking({
      legs: [
        createMockBookingLeg({
          legDate: addDays(now, 1),
          legStartTime: addDays(now, 1),
          legEndTime: addDays(now, 1),
        }),
        createMockBookingLeg({
          legDate: now,
          legStartTime: subHours(now, 2),
          legEndTime,
        }),
      ],
    });

    const result = getTimeRemainingForLiveBooking(booking);
    expect(result).toEqual({
      time: "3h 0min",
      isNextLeg: false,
      isEnded: false,
    });
  });

  it("should handle multiple legs with today's leg in the middle", () => {
    const now = createLagosDate(2024, 1, 15, 12, 0);
    vi.setSystemTime(now);

    const todayLegEndTime = subHours(now, 1); // Ended 1 hour ago
    const nextLegStartTime = addHours(now, 4); // Next leg starts in 4 hours
    const booking = createMockBooking({
      legs: [
        createMockBookingLeg({
          legDate: subDays(now, 1),
          legStartTime: subDays(now, 1),
          legEndTime: subDays(now, 1),
        }),
        createMockBookingLeg({
          legDate: now,
          legStartTime: subHours(now, 5),
          legEndTime: todayLegEndTime,
        }),
        createMockBookingLeg({
          legDate: addDays(now, 1),
          legStartTime: nextLegStartTime,
          legEndTime: addHours(nextLegStartTime, 12),
        }),
      ],
    });

    const result = getTimeRemainingForLiveBooking(booking);
    expect(result).toEqual({
      time: "4h 0min",
      isNextLeg: true,
      isEnded: false,
    });
  });

  it("should return minutes for next leg when less than 1 hour", () => {
    const now = createLagosDate(2024, 1, 15, 12, 0);
    vi.setSystemTime(now);

    const todayLegEndTime = subHours(now, 1);
    const nextLegStartTime = addHours(now, 0.5); // 30 minutes from now
    const booking = createMockBooking({
      legs: [
        createMockBookingLeg({
          legDate: now,
          legStartTime: subHours(now, 5),
          legEndTime: todayLegEndTime,
        }),
        createMockBookingLeg({
          legDate: addDays(now, 1),
          legStartTime: nextLegStartTime,
          legEndTime: addHours(nextLegStartTime, 12),
        }),
      ],
    });

    const result = getTimeRemainingForLiveBooking(booking);
    expect(result).toEqual({
      time: "30min",
      isNextLeg: true,
      isEnded: false,
    });
  });
});
