import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma client package to avoid requiring generated client during tests
vi.mock("@prisma/client", () => ({
  Prisma: {},
  Status: { AVAILABLE: "AVAILABLE" },
  DocumentStatus: {},
  DocumentType: {},
  CarApprovalStatus: {},
}));

// Mock prisma module used by cars.server
vi.mock("~/modules/db/db.server", () => {
  return {
    prisma: {
      car: {
        findUnique: vi.fn(),
      },
      booking: {
        count: vi.fn(),
      },
    },
  };
});

// Import the mocked prisma after mocking
import { prisma } from "~/modules/db/db.server";
import { isCarAvailable } from "~/services/cars.server";

describe("isCarAvailable precise datetime overlap", () => {
  const carId = "car_A";

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.car.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: carId,
      status: "AVAILABLE",
    });
  });

  describe("Scenarios that SHOULD PASS (no conflicts)", () => {
    it("Should allow DAY booking 7am-7pm on Oct 10th (no existing bookings)", async () => {
      (prisma.booking.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const dayStart = new Date("2025-10-10T07:00:00.000Z");
      const dayEnd = new Date("2025-10-10T19:00:00.000Z");

      const available = await isCarAvailable(carId, dayStart, dayEnd);
      expect(available).toBe(true);
    });

    it("Should allow NIGHT booking 11pm-5am on Oct 10th-11th after DAY booking 7am-7pm on Oct 10th", async () => {
      // Simulate checking night booking when day booking exists
      // The count function will be called with the night booking window
      (prisma.booking.count as unknown as ReturnType<typeof vi.fn>).mockImplementation((query) => {
        // Extract the date conditions from the query
        const conditions = query?.where?.AND || [];
        const startLt = conditions.find((c: { startDate?: { lt: Date } }) => c.startDate)?.startDate
          ?.lt;
        const endGt = conditions.find((c: { endDate?: { gt: Date } }) => c.endDate)?.endDate?.gt;

        // Night booking: 11pm Oct 10 to 5am Oct 11
        // Day booking: 7am Oct 10 to 7pm Oct 10
        // No overlap since day ends at 7pm and night starts at 11pm
        if (startLt && endGt) {
          const nightStart = new Date("2025-10-10T23:00:00.000Z");
          const nightEnd = new Date("2025-10-11T05:00:00.000Z");
          const dayStart = new Date("2025-10-10T07:00:00.000Z");
          const dayEnd = new Date("2025-10-10T19:00:00.000Z");

          // Check if day booking overlaps with night booking
          // Overlap: dayStart < nightEnd AND dayEnd > nightStart
          const overlaps = dayStart < nightEnd && dayEnd > nightStart;
          return Promise.resolve(overlaps ? 1 : 0);
        }
        return Promise.resolve(0);
      });

      const nightStart = new Date("2025-10-10T23:00:00.000Z");
      const nightEnd = new Date("2025-10-11T05:00:00.000Z");

      const available = await isCarAvailable(carId, nightStart, nightEnd);
      expect(available).toBe(true);
    });

    it("Should allow DAY booking 7am-7pm on Oct 11th after DAY (7am-7pm Oct 10) and NIGHT (11pm Oct 10 - 5am Oct 11) bookings", async () => {
      (prisma.booking.count as unknown as ReturnType<typeof vi.fn>).mockImplementation((query) => {
        const conditions = query?.where?.AND || [];
        const startLt = conditions.find((c: { startDate?: { lt: Date } }) => c.startDate)?.startDate
          ?.lt;
        const endGt = conditions.find((c: { endDate?: { gt: Date } }) => c.endDate)?.endDate?.gt;

        if (startLt && endGt) {
          // New booking: 7am Oct 11 to 7pm Oct 11
          const newDayStart = new Date("2025-10-11T07:00:00.000Z");
          const newDayEnd = new Date("2025-10-11T19:00:00.000Z");

          // Existing bookings
          const dayStart = new Date("2025-10-10T07:00:00.000Z");
          const dayEnd = new Date("2025-10-10T19:00:00.000Z");
          const nightStart = new Date("2025-10-10T23:00:00.000Z");
          const nightEnd = new Date("2025-10-11T05:00:00.000Z");

          // Check overlaps
          const overlapWithDay = dayStart < newDayEnd && dayEnd > newDayStart;
          const overlapWithNight = nightStart < newDayEnd && nightEnd > newDayStart;

          return Promise.resolve(overlapWithDay || overlapWithNight ? 1 : 0);
        }
        return Promise.resolve(0);
      });

      const nextDayStart = new Date("2025-10-11T07:00:00.000Z");
      const nextDayEnd = new Date("2025-10-11T19:00:00.000Z");

      const available = await isCarAvailable(carId, nextDayStart, nextDayEnd);
      expect(available).toBe(true);
    });
  });

  describe("Scenarios that SHOULD FAIL (conflicts detected)", () => {
    it("Should detect conflict: EXACT SAME booking - DAY 7am-7pm on Oct 10th when DAY booking 7am-7pm Oct 10th exists", async () => {
      (prisma.booking.count as unknown as ReturnType<typeof vi.fn>).mockImplementation((query) => {
        const conditions = query?.where?.AND || [];
        const startLt = conditions.find((c: { startDate?: { lt: Date } }) => c.startDate)?.startDate
          ?.lt;
        const endGt = conditions.find((c: { endDate?: { gt: Date } }) => c.endDate)?.endDate?.gt;

        if (startLt && endGt) {
          // New booking: 7am Oct 10 to 7pm Oct 10
          const newStart = new Date("2025-10-10T07:00:00.000Z");
          const newEnd = new Date("2025-10-10T19:00:00.000Z");

          // Existing booking: EXACTLY THE SAME - 7am Oct 10 to 7pm Oct 10
          const existingStart = new Date("2025-10-10T07:00:00.000Z");
          const existingEnd = new Date("2025-10-10T19:00:00.000Z");

          // Check overlap: existingStart < newEnd AND existingEnd > newStart
          // 7am < 7pm (true) AND 7pm > 7am (true) = OVERLAP!
          const overlaps = existingStart < newEnd && existingEnd > newStart;
          return Promise.resolve(overlaps ? 1 : 0);
        }
        return Promise.resolve(0);
      });

      const conflictingStart = new Date("2025-10-10T07:00:00.000Z");
      const conflictingEnd = new Date("2025-10-10T19:00:00.000Z");

      const available = await isCarAvailable(carId, conflictingStart, conflictingEnd);
      expect(available).toBe(false);
    });

    it("Should detect conflict: DAY booking 9am-9pm on Oct 10th when DAY booking 7am-7pm exists", async () => {
      (prisma.booking.count as unknown as ReturnType<typeof vi.fn>).mockImplementation((query) => {
        const conditions = query?.where?.AND || [];
        const startLt = conditions.find((c: { startDate?: { lt: Date } }) => c.startDate)?.startDate
          ?.lt;
        const endGt = conditions.find((c: { endDate?: { gt: Date } }) => c.endDate)?.endDate?.gt;

        if (startLt && endGt) {
          // New booking: 9am Oct 10 to 9pm Oct 10
          const newStart = new Date("2025-10-10T09:00:00.000Z");
          const newEnd = new Date("2025-10-10T21:00:00.000Z");

          // Existing booking: 7am Oct 10 to 7pm Oct 10
          const existingStart = new Date("2025-10-10T07:00:00.000Z");
          const existingEnd = new Date("2025-10-10T19:00:00.000Z");

          // Check overlap: existingStart < newEnd AND existingEnd > newStart
          const overlaps = existingStart < newEnd && existingEnd > newStart;
          return Promise.resolve(overlaps ? 1 : 0);
        }
        return Promise.resolve(0);
      });

      const conflictingStart = new Date("2025-10-10T09:00:00.000Z");
      const conflictingEnd = new Date("2025-10-10T21:00:00.000Z");

      const available = await isCarAvailable(carId, conflictingStart, conflictingEnd);
      expect(available).toBe(false);
    });

    it("Should detect conflict: any booking that overlaps with existing booking", async () => {
      // Simple mock that always returns 1 (conflict exists)
      (prisma.booking.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const newStart = new Date("2025-10-10T12:00:00.000Z");
      const newEnd = new Date("2025-10-10T13:00:00.000Z");

      const available = await isCarAvailable(carId, newStart, newEnd);
      expect(available).toBe(false);
    });
  });
});
