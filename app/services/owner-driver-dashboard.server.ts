import { prisma } from "~/modules/db/db.server";
import { addDays } from "date-fns";
import type { OwnerDriverDashboardData } from "~/components/dashboard/owner-driver/types";
import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

export async function getOwnerDriverDashboardData(
  userId: string,
  userName: string | null,
): Promise<OwnerDriverDashboardData> {
  const now = new Date();

  // Use UTC timezone for consistent day boundaries across the application
  const todayUtcYear = now.getUTCFullYear();
  const todayUtcMonth = now.getUTCMonth(); // 0-indexed
  const todayUtcDay = now.getUTCDate();

  // Construct start and end of "today" in UTC
  const startOfToday = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 0, 0, 0, 0));
  const endOfToday = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 23, 59, 59, 999));

  // Calculate last 7 days (6 days ago + today = 7 days) in UTC
  const last7DaysStart = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay - 6, 0, 0, 0, 0));

  // Calculate last 30 days (29 days ago + today = 30 days) in UTC
  const last30DaysStart = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay - 29, 0, 0, 0, 0));

  const [car, activeBooking] = await Promise.all([
    prisma.car.findFirst({
      where: { ownerId: userId },
      include: { documents: true },
    }),
    prisma.booking.findFirst({
      where: {
        car: { ownerId: userId },
        status: "ACTIVE",
      },
      include: {
        car: { include: { owner: { include: { chauffeurs: true } } } },
        user: true,
        chauffeur: true,
        legs: {
          include: {
            extensions: true,
          },
        },
      },
    }),
  ]);

  const nextBooking = activeBooking
    ? null
    : await prisma.booking.findFirst({
        where: {
          car: { ownerId: userId },
          status: "CONFIRMED",
          startDate: { gte: now, lte: addDays(now, 1) },
        },
        include: {
          car: { include: { owner: { include: { chauffeurs: true } } } },
          user: true,
          chauffeur: true,
          legs: {
            include: {
              extensions: true,
            },
          },
        },
        orderBy: { startDate: "asc" },
      });

  // Get upcoming bookings (next 7 days)
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      car: { ownerId: userId },
      status: { in: ["CONFIRMED", "ACTIVE"] },
      startDate: { gte: now, lte: addDays(now, 7) },
    },
    include: {
      car: { include: { owner: { include: { chauffeurs: true } } } },
      user: true,
      chauffeur: true,
      legs: {
        include: {
          extensions: true,
        },
      },
    },
    orderBy: { startDate: "asc" },
    take: 10,
  });

  // Get earnings (using BookingLeg for accurate daily calculation)
  // For counts, we need distinct bookingIds to avoid inflating the count
  const whereWeek: Prisma.BookingLegWhereInput = {
    legDate: { gte: last7DaysStart, lte: endOfToday },
    booking: {
      car: { ownerId: userId },
      status: { in: ["ACTIVE", "COMPLETED"] },
      paymentStatus: "PAID",
    },
  };

  const whereMonth: Prisma.BookingLegWhereInput = {
    legDate: { gte: last30DaysStart, lte: endOfToday },
    booking: {
      car: { ownerId: userId },
      status: { in: ["ACTIVE", "COMPLETED"] },
      paymentStatus: "PAID",
    },
  };

  const [todayLegs, weekLegs, monthLegs, weekBookings, monthBookings] = await Promise.all([
    prisma.bookingLeg.aggregate({
      where: {
        legDate: { gte: startOfToday, lte: endOfToday },
        booking: {
          car: { ownerId: userId },
          status: { in: ["ACTIVE", "COMPLETED"] },
          paymentStatus: "PAID",
        },
      },
      _sum: { fleetOwnerEarningForLeg: true },
    }),
    prisma.bookingLeg.aggregate({
      where: whereWeek,
      _sum: { fleetOwnerEarningForLeg: true },
    }),
    prisma.bookingLeg.aggregate({
      where: whereMonth,
      _sum: { fleetOwnerEarningForLeg: true },
    }),
    // Get distinct bookingIds for week
    prisma.bookingLeg.findMany({
      where: whereWeek,
      distinct: ["bookingId"],
      select: { bookingId: true },
    }),
    // Get distinct bookingIds for month
    prisma.bookingLeg.findMany({
      where: whereMonth,
      distinct: ["bookingId"],
      select: { bookingId: true },
    }),
  ]);

  // Get recent completed bookings
  const recentBookings = await prisma.booking.findMany({
    where: {
      car: { ownerId: userId },
      status: "COMPLETED",
    },
    include: {
      car: { include: { owner: { include: { chauffeurs: true } } } },
      user: true,
      chauffeur: true,
      legs: {
        include: {
          extensions: true,
        },
      },
    },
    orderBy: { endDate: "desc" },
    take: 5,
  });

  // Get next payout info
  const nextPayout = await prisma.payoutTransaction.findFirst({
    where: {
      fleetOwnerId: userId,
      status: { in: ["PENDING_APPROVAL", "PENDING_DISBURSEMENT", "PROCESSING"] },
    },
    orderBy: { initiatedAt: "desc" },
  });

  return {
    name: userName || "Fleet Owner",
    currentOrNextBooking: activeBooking || nextBooking || undefined,
    upcomingBookings,
    recentBookings,
    car: car
      ? {
          id: car.id,
          make: car.make,
          model: car.model,
          year: car.year,
          registrationNumber: car.registrationNumber,
          status: car.status,
          motCertificate: car.documents?.find((doc) => doc.documentType === "MOT_CERTIFICATE"),
          insuranceCertificate: car.documents?.find(
            (doc) => doc.documentType === "INSURANCE_CERTIFICATE",
          ),
        }
      : undefined,
    earnings: {
      today: todayLegs._sum.fleetOwnerEarningForLeg?.toNumber() ?? 0,
      thisWeek: {
        amount: weekLegs._sum.fleetOwnerEarningForLeg?.toNumber() ?? 0,
        bookingCount: weekBookings.length, // Count of distinct bookings, not legs
      },
      thisMonth: {
        amount: monthLegs._sum.fleetOwnerEarningForLeg?.toNumber() ?? 0,
        bookingCount: monthBookings.length, // Count of distinct bookings, not legs
      },
    },
    nextPayout: nextPayout
      ? {
          id: nextPayout.id,
          amount: nextPayout.amountToPay.toNumber(),
          status: nextPayout.status,
          scheduledDate: nextPayout.processedAt || nextPayout.initiatedAt,
        }
      : undefined,
  };
}

export async function getTodaysLegsFleetOwnerEarningSum(
  fleetOwnerIdInput?: string,
  dateInput: Date = new Date(),
): Promise<Decimal> {
  // Determine the start and end of the given date in UTC
  const todayUtcYear = dateInput.getUTCFullYear();
  const todayUtcMonth = dateInput.getUTCMonth(); // 0-indexed (January is 0)
  const todayUtcDay = dateInput.getUTCDate();

  // Start of the day in UTC
  const startOfTodayUTC = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 0, 0, 0, 0));
  // End of the day in UTC
  const endOfTodayUTC = new Date(
    Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 23, 59, 59, 999),
  );

  // Construct the where clause for the related Booking entity
  const bookingWhereClause: Prisma.BookingWhereInput = {
    status: BookingStatus.ACTIVE,
    paymentStatus: PaymentStatus.PAID,
    chauffeurId: { not: null }, // Ensure a chauffeur is assigned
  };

  // Conditionally add filter for fleet owner if provided
  if (fleetOwnerIdInput) {
    bookingWhereClause.car = {
      ownerId: fleetOwnerIdInput,
    };
  }

  // Construct the main where clause for BookingLeg
  const bookingLegWhereClause: Prisma.BookingLegWhereInput = {
    legDate: {
      gte: startOfTodayUTC, // Leg date is on or after the start of today (UTC)
      lte: endOfTodayUTC, // Leg date is on or before the end of today (UTC)
    },
    booking: bookingWhereClause, // Apply filters on the related booking
    totalDailyPrice: { gt: 0 }, // Consider only legs with a positive total daily price
    // No explicit filter on fleetOwnerEarningForLeg itself, sum whatever value is present (positive, zero, or negative)
  };

  // Perform aggregation directly in the database
  const aggregationResult = await prisma.bookingLeg.aggregate({
    where: bookingLegWhereClause,
    _sum: {
      fleetOwnerEarningForLeg: true, // Sum this field
    },
  });

  // The result of _sum can be null if no records match the criteria
  const totalSum = aggregationResult._sum.fleetOwnerEarningForLeg;

  // Return the sum, or Decimal(0) if the sum is null
  return totalSum ?? new Decimal(0);
}
