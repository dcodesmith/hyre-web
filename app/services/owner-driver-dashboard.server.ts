import { prisma } from "~/modules/db/db.server";
import { addDays } from "date-fns";
import type { OwnerDriverDashboardData } from "~/components/dashboard/owner-driver/types";
import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

// Constants for dashboard time ranges
const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;
const UPCOMING_BOOKINGS_LIMIT = 10;
const RECENT_BOOKINGS_LIMIT = 3;

/**
 * Type for booking with Decimal fields that need to be serialized
 */
type BookingWithDecimals = {
  totalAmount: Decimal;
  netTotal?: Decimal | null;
  vatAmount?: Decimal | null;
  platformCustomerServiceFeeAmount?: Decimal | null;
  platformCustomerServiceFeeRatePercent?: Decimal | null;
  platformFleetOwnerCommissionRatePercent?: Decimal | null;
  vatRatePercent?: Decimal | null;
  fuelUpgradeCost?: Decimal | null;
  securityDetailCost?: Decimal | null;
  fleetOwnerPayoutAmountNet?: Decimal | null;
};

/**
 * Gets UTC day boundaries (start and end of day) for a given date.
 * Used to ensure consistent day boundaries across the application regardless of timezone.
 *
 * @param date - The date to get boundaries for
 * @returns Object with start and end Date objects for the UTC day
 */
function getUtcDayBoundaries(date: Date): { start: Date; end: Date } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed
  const day = date.getUTCDate();
  return {
    start: new Date(Date.UTC(year, month, day, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, day, 23, 59, 59, 999)),
  };
}

const bookingIncludeWithRelations = {
  car: { include: { owner: { include: { chauffeurs: true } } } },
  user: true,
  chauffeur: true,
  legs: {
    include: {
      extensions: true,
    },
  },
} as const;

/**
 * Serializes Decimal fields in a booking to numbers for client-side rendering.
 * Prisma returns Decimal types for precise calculations, but these need to be
 * converted to numbers for JSON serialization and client-side use.
 *
 * @param booking - Booking object with Decimal fields
 * @returns Booking with Decimal fields converted to numbers
 */
const serializeBooking = <T extends BookingWithDecimals>(
  booking: T,
): T & {
  totalAmount: number;
  netTotal: number | null;
  vatAmount: number | null;
  platformCustomerServiceFeeAmount: number | null;
  platformCustomerServiceFeeRatePercent: number | null;
  platformFleetOwnerCommissionRatePercent: number | null;
  vatRatePercent: number | null;
  fuelUpgradeCost: number | null;
  securityDetailCost: number | null;
  fleetOwnerPayoutAmountNet: number | null;
} => ({
  ...booking,
  totalAmount: booking.totalAmount.toNumber(),
  netTotal: booking.netTotal?.toNumber() ?? null,
  vatAmount: booking.vatAmount?.toNumber() ?? null,
  platformCustomerServiceFeeAmount: booking.platformCustomerServiceFeeAmount?.toNumber() ?? null,
  platformCustomerServiceFeeRatePercent:
    booking.platformCustomerServiceFeeRatePercent?.toNumber() ?? null,
  platformFleetOwnerCommissionRatePercent:
    booking.platformFleetOwnerCommissionRatePercent?.toNumber() ?? null,
  vatRatePercent: booking.vatRatePercent?.toNumber() ?? null,
  fuelUpgradeCost: booking.fuelUpgradeCost?.toNumber() ?? null,
  securityDetailCost: booking.securityDetailCost?.toNumber() ?? null,
  fleetOwnerPayoutAmountNet: booking.fleetOwnerPayoutAmountNet?.toNumber() ?? null,
});

/**
 * Fetches comprehensive dashboard data for an owner-driver.
 * Includes bookings, earnings, documents, car info, and payout information.
 *
 * @param userId - The ID of the owner-driver user
 * @param userName - The name of the user (fallback to "Fleet Owner" if null)
 * @returns Promise resolving to the complete dashboard data
 */
export async function getOwnerDriverDashboardData(
  userId: string,
  userName: string | null,
): Promise<OwnerDriverDashboardData> {
  const now = new Date();

  // Use UTC timezone for consistent day boundaries across the application
  const { start: startOfToday, end: endOfToday } = getUtcDayBoundaries(now);
  const todayUtcYear = now.getUTCFullYear();
  const todayUtcMonth = now.getUTCMonth(); // 0-indexed
  const todayUtcDay = now.getUTCDate();

  // Calculate last 7 days (6 days ago + today = 7 days) in UTC
  const last7DaysStart = new Date(
    Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay - (DAYS_IN_WEEK - 1), 0, 0, 0, 0),
  );

  // Calculate last 30 days (29 days ago + today = 30 days) in UTC
  const last30DaysStart = new Date(
    Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay - (DAYS_IN_MONTH - 1), 0, 0, 0, 0),
  );

  const [user, car, pendingApprovalBookings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { documents: true },
    }),
    prisma.car.findFirst({
      where: { ownerId: userId },
      include: { documents: true },
    }),
    // Get CONFIRMED bookings without chauffeur (pending owner-driver acceptance)
    prisma.booking.findMany({
      where: {
        car: { ownerId: userId },
        status: "CONFIRMED",
        chauffeurId: null, // Not yet accepted
        paymentStatus: "PAID",
      },
      include: bookingIncludeWithRelations,
      orderBy: { startDate: "asc" },
    }),
  ]);

  const liveBookings = await prisma.booking.findMany({
    where: {
      car: { ownerId: userId },
      status: "ACTIVE",
      chauffeurId: { not: null },
      paymentStatus: "PAID",
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: bookingIncludeWithRelations,
    orderBy: { startDate: "asc" },
  });

  // Get upcoming bookings (next 7 days) - only accepted bookings (with chauffeur assigned) that are not live
  // Exclude ACTIVE bookings and CONFIRMED bookings that are currently live
  const liveBookingIds = liveBookings.map((b) => b.id);
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      car: { ownerId: userId },
      status: "CONFIRMED",
      chauffeurId: { not: null }, // Only show accepted bookings (with chauffeur assigned)
      paymentStatus: "PAID",
      startDate: { gte: now, lte: addDays(now, DAYS_IN_WEEK) },
      id: { notIn: liveBookingIds }, // Exclude live bookings
    },
    include: bookingIncludeWithRelations,
    orderBy: { startDate: "asc" },
    take: UPCOMING_BOOKINGS_LIMIT,
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

  // Fetch earnings and booking counts in parallel for performance
  // Using BookingLeg for accurate daily calculation - a booking spanning multiple days
  // has separate legs for each day, so we sum earnings from legs and count distinct bookings
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
    // Get distinct bookingIds for week to avoid inflating count
    // (a booking with multiple legs should only count once)
    prisma.bookingLeg.findMany({
      where: whereWeek,
      distinct: ["bookingId"],
      select: { bookingId: true },
    }),
    // Get distinct bookingIds for month to avoid inflating count
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
    include: bookingIncludeWithRelations,
    orderBy: { endDate: "desc" },
    take: RECENT_BOOKINGS_LIMIT,
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
    pendingApprovalBookings: pendingApprovalBookings.map(serializeBooking),
    liveBookings: liveBookings.map(serializeBooking),
    upcomingBookings: upcomingBookings.map(serializeBooking),
    recentBookings: recentBookings.map(serializeBooking),
    personalDocuments: {
      nin: user?.documents?.find((doc) => doc.documentType === "NIN"),
      driversLicense: user?.documents?.find((doc) => doc.documentType === "DRIVERS_LICENSE"),
      lasdri: user?.documents?.find((doc) => doc.documentType === "LASDRI"),
    },
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
          lasdriCertificate: car.documents?.find((doc) => doc.documentType === "LASDRI"),
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

/**
 * Calculates the sum of fleet owner earnings for booking legs on a specific date.
 * Only includes active bookings that are paid and have a chauffeur assigned.
 *
 * @param fleetOwnerIdInput - Optional fleet owner ID to filter by. If not provided, sums all fleet owners.
 * @param dateInput - The date to calculate earnings for (defaults to today)
 * @returns Promise resolving to the total earnings as a Decimal (returns Decimal(0) if no matches)
 */
export async function getTodaysLegsFleetOwnerEarningSum(
  fleetOwnerIdInput?: string,
  dateInput: Date = new Date(),
): Promise<Decimal> {
  // Determine the start and end of the given date in UTC
  const { start: startOfTodayUTC, end: endOfTodayUTC } = getUtcDayBoundaries(dateInput);

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
