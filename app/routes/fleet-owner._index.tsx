import { BookingStatus, PaymentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { subDays } from "date-fns";
import { FleetOwnerDashboard } from "~/components/dashboard/fleet-owner";
import { OwnerDriverDashboard } from "~/components/dashboard/owner-driver";
import type { OwnerDriverDashboardData } from "~/components/dashboard/owner-driver/types";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { getMonthToDateBookingsValue } from "~/services/bookings.server";
import {
  getOwnerDriverDashboardData,
  getTodaysLegsFleetOwnerEarningSum,
  getFleetOwnerEarnings,
  getFleetOwnerRecentBookings,
  getFleetOwnerNextPayout,
} from "~/services/dashboard.server";
import { requireUserWithRole } from "~/utils/server/permissions.server";

// Type guard to narrow owner-driver data using discriminated union
function isOwnerDriverData(data: { dashboardType: string }): data is {
  dashboardType: "owner-driver";
} & OwnerDriverDashboardData {
  return data.dashboardType === "owner-driver";
}

export async function loader({ request }: LoaderFunctionArgs) {
  const fleetOwner = await requireUserWithRole(request, "fleetOwner");

  // If owner-driver, return simplified dashboard data
  if (fleetOwner.isOwnerDriver) {
    const ownerDriverData = await getOwnerDriverDashboardData(fleetOwner.id, fleetOwner.name);
    return { dashboardType: "owner-driver" as const, ...ownerDriverData };
  }

  // Otherwise, continue with fleet owner dashboard
  const carCount = await prisma.car.count({
    where: { ownerId: fleetOwner.id },
  });
  const bookingsValue = await getMonthToDateBookingsValue(fleetOwner.id);

  const chauffeurs = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          name: "chauffeur",
        },
      },
      fleetOwnerId: fleetOwner.id,
    },
  });

  const confirmedUnassignedBookings = await prisma.booking.findMany({
    where: {
      paymentStatus: "PAID",
      status: "CONFIRMED",
      car: {
        ownerId: fleetOwner.id,
      },
      chauffeurId: null,
    },
    include: {
      car: true,
      user: true,
      chauffeur: true,
    },
    orderBy: {
      startDate: "asc",
    },
  });

  const serializedConfirmedUnassignedBookings = confirmedUnassignedBookings.map((booking) => ({
    ...booking,
    totalAmount: booking.totalAmount.toNumber(),
    netTotal: booking.netTotal?.toNumber() ?? 0,
    vatAmount: booking.vatAmount?.toNumber(),
    platformCustomerServiceFeeAmount: booking.platformCustomerServiceFeeAmount?.toNumber(),
    fuelUpgradeCost: booking.fuelUpgradeCost?.toNumber(),
    securityDetailCost: booking.securityDetailCost?.toNumber(),
    vatRatePercent: booking.vatRatePercent?.toNumber() ?? 0,
    platformCustomerServiceFeeRatePercent:
      booking.platformCustomerServiceFeeRatePercent?.toNumber() ?? 0,
    platformFleetOwnerCommissionRatePercent:
      booking.platformFleetOwnerCommissionRatePercent?.toNumber() ?? 0,
    platformFleetOwnerCommissionAmount: booking.platformFleetOwnerCommissionAmount?.toNumber() ?? 0,
    referralDiscountAmount: booking.referralDiscountAmount?.toNumber() ?? 0,
    subtotalBeforeVat: booking.subtotalBeforeVat?.toNumber() ?? 0,
    fleetOwnerPayoutAmountNet: booking.fleetOwnerPayoutAmountNet?.toNumber() ?? 0,
  }));

  const stats = await prisma.$transaction([
    // Active bookings count
    prisma.booking.count({
      where: {
        status: "ACTIVE",
        car: { ownerId: fleetOwner.id },
      },
    }),
    // Completed bookings count
    prisma.booking.count({
      where: {
        status: "COMPLETED",
        car: { ownerId: fleetOwner.id },
      },
    }),
    // Cancelled bookings count
    prisma.booking.count({
      where: {
        status: "CANCELLED",
        car: { ownerId: fleetOwner.id },
      },
    }),
    // Available cars
    prisma.car.count({
      where: {
        ownerId: fleetOwner.id,
        status: "AVAILABLE",
      },
    }),
    // Booked cars
    prisma.car.count({
      where: {
        ownerId: fleetOwner.id,
        status: "BOOKED",
      },
    }),
    // Maintenance cars (IN_SERVICE or HOLD)
    prisma.car.count({
      where: {
        ownerId: fleetOwner.id,
        status: { in: ["IN_SERVICE", "HOLD"] },
      },
    }),
    // Available chauffeurs (not assigned to active bookings)
    prisma.user.count({
      where: {
        fleetOwnerId: fleetOwner.id,
        roles: { some: { name: "chauffeur" } },
        bookingsAsChauffeur: {
          none: {
            status: {
              in: ["ACTIVE", "CONFIRMED"],
            },
          },
        },
      },
    }),
    // On-duty chauffeurs (assigned to active bookings)
    prisma.user.count({
      where: {
        fleetOwnerId: fleetOwner.id,
        roles: { some: { name: "chauffeur" } },
        bookingsAsChauffeur: {
          some: {
            status: {
              in: ["ACTIVE", "CONFIRMED"],
            },
          },
        },
      },
    }),
  ]);

  const [
    activeBookingsCount,
    completedBookingsCount,
    cancelledBookingsCount,
    availableCarsCount,
    bookedCarsCount,
    maintenanceCarsCount,
    availableChauffeursCount,
    onDutyChauffeursCount,
  ] = stats;

  const today = new Date();

  const todayUtcYear = today.getUTCFullYear(); // Native Date method
  const todayUtcMonth = today.getUTCMonth(); // Native Date method (0-indexed)
  const todayUtcDay = today.getUTCDate(); // Native Date method

  // Construct start and end of "today" in UTC
  const startOfToday = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 0, 0, 0, 0));
  const endOfToday = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 23, 59, 59, 999));

  // Calculate 7-day fleet utilization
  const last7DaysStart = subDays(startOfToday, 6); // 6 days ago + today = 7 days

  // Get all booking legs for the fleet owner in the last 7 days
  const utilizationLegs = await prisma.bookingLeg.findMany({
    where: {
      legDate: { gte: last7DaysStart, lte: endOfToday },
      booking: {
        car: { ownerId: fleetOwner.id },
        status: { in: [BookingStatus.ACTIVE, BookingStatus.COMPLETED, BookingStatus.CONFIRMED] },
      },
    },
    select: {
      legDate: true,
      booking: {
        select: {
          carId: true,
        },
      },
    },
  });

  // Count unique car-days (a car booked on a specific day = 1 car-day)
  const carDaysBooked = new Set(
    utilizationLegs.map((leg) => `${leg.booking.carId}-${leg.legDate.toISOString().slice(0, 10)}`),
  ).size;

  // Total possible car-days = total cars × 7 days
  const totalCarDays = carCount * 7;
  const fleetUtilizationRate =
    totalCarDays > 0 ? Math.round((carDaysBooked / totalCarDays) * 100) : 0;

  const legs = await prisma.bookingLeg.findMany({
    where: {
      legDate: { gte: subDays(startOfToday, 89), lte: endOfToday },
      booking: {
        car: { ownerId: fleetOwner.id },
        status: { in: [BookingStatus.ACTIVE, BookingStatus.COMPLETED] },
        paymentStatus: PaymentStatus.PAID,
        chauffeurId: { not: null },
      },
    },
    select: { legDate: true, fleetOwnerEarningForLeg: true },
  });

  const daily = new Map<string, Decimal>();
  for (const l of legs) {
    const key = l.legDate.toISOString().slice(0, 10);
    const prev = daily.get(key) ?? new Decimal(0);
    daily.set(key, prev.add(l.fleetOwnerEarningForLeg));
  }
  const dailyRevenue = Array.from({ length: 90 }, (_, i) => {
    const date = subDays(startOfToday, i);
    const key = date.toISOString().slice(0, 10);
    const v = daily.get(key) ?? new Decimal(0);
    return { date, revenue: v.toNumber() };
  }).reverse();

  logger.info(`Booking legs fetched: ${legs.length}`);

  const ownerRevenueToday = await getTodaysLegsFleetOwnerEarningSum(fleetOwner.id);

  logger.info(`Owner revenue today: ${ownerRevenueToday.toString()}`);
  // Get today's stats
  const dateRangeFilter = {
    startDate: { lte: endOfToday },
    endDate: { gte: startOfToday },
  };

  const bookingCount = (status: BookingStatus) =>
    prisma.booking.count({
      where: {
        status,
        car: { ownerId: fleetOwner.id },
        AND: [dateRangeFilter],
      },
    });

  const todayStats = await prisma.$transaction([
    bookingCount("ACTIVE"),
    bookingCount("COMPLETED"),
    bookingCount("CANCELLED"),
    bookingCount("CONFIRMED"),
  ]);

  const [
    todayActiveBookings,
    todayCompletedBookings,
    todayCancelledBookings,
    todayConfirmedBookings,
  ] = todayStats;

  // Fetch shared dashboard data (earnings, recent bookings, next payout)
  const [earnings, recentBookings, nextPayout] = await Promise.all([
    getFleetOwnerEarnings(fleetOwner.id),
    getFleetOwnerRecentBookings(fleetOwner.id, 3),
    getFleetOwnerNextPayout(fleetOwner.id),
  ]);

  return {
    dashboardType: "fleet-owner" as const,
    carCount: carCount,
    bookingsValue: bookingsValue,
    confirmedUnassignedBookings: serializedConfirmedUnassignedBookings,
    chauffeurs,
    dashboardStats: {
      activeBookingsCount,
      completedBookingsCount,
      cancelledBookingsCount,
      availableCarsCount,
      bookedCarsCount,
      maintenanceCarsCount,
      availableChauffeursCount,
      onDutyChauffeursCount,
      fleetUtilizationRate,
    },
    dailyRevenue,
    fleetOwnerName: fleetOwner.name,
    todayStats: {
      activeBookings: todayActiveBookings,
      completedBookings: todayCompletedBookings,
      cancelledBookings: todayCancelledBookings,
      confirmedBookings: todayConfirmedBookings,
      projectedRevenue: ownerRevenueToday.toNumber(),
    },
    earnings,
    recentBookings,
    nextPayout,
  };
}

export default function FleetOwnerDashboardRoute() {
  const data = useLoaderData<typeof loader>();

  // If owner-driver, show simplified dashboard with type-safe validation
  if (isOwnerDriverData(data)) {
    // Type guard ensures data conforms to OwnerDriverDashboardData
    // Explicit prop mapping for compile-time type safety
    const {
      name,
      pendingApprovalBookings,
      liveBookings,
      upcomingBookings,
      recentBookings,
      personalDocuments,
      car,
      earnings,
      nextPayout,
    } = data;

    return (
      <OwnerDriverDashboard
        name={name}
        pendingApprovalBookings={pendingApprovalBookings}
        liveBookings={liveBookings}
        upcomingBookings={upcomingBookings}
        recentBookings={recentBookings}
        personalDocuments={personalDocuments}
        car={car}
        earnings={earnings}
        nextPayout={nextPayout}
      />
    );
  }

  // Fleet owner dashboard - all fields are guaranteed by the loader
  const {
    fleetOwnerName,
    todayStats,
    carCount,
    bookingsValue,
    confirmedUnassignedBookings,
    dashboardStats,
    dailyRevenue,
    chauffeurs,
    earnings,
    recentBookings,
    nextPayout,
  } = data;

  // TypeScript safety check - this should never happen at runtime
  if (
    !todayStats ||
    !confirmedUnassignedBookings ||
    !dashboardStats ||
    !dailyRevenue ||
    !chauffeurs ||
    !earnings ||
    !recentBookings
  ) {
    return (
      <div className="p-6">
        <p className="text-red-600">Unable to load dashboard data. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <FleetOwnerDashboard
      fleetOwnerName={fleetOwnerName || "Fleet Owner"}
      todayStats={todayStats}
      carCount={carCount}
      bookingsValue={bookingsValue}
      confirmedUnassignedBookings={confirmedUnassignedBookings}
      dashboardStats={dashboardStats}
      dailyRevenue={dailyRevenue}
      chauffeurs={chauffeurs}
      earnings={earnings}
      recentBookings={recentBookings}
      nextPayout={nextPayout}
    />
  );
}
