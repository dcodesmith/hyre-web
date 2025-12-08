import { KeyMetrics, QuickActions, RevenueAtRisk, RevenueChart, UnassignedBookingsTable } from "./";
import { EarningsSnapshot, RecentActivity, NextPayoutCard, WelcomeMessage } from "../shared";
import type { BookingWithRelations } from "~/types";

interface FleetOwnerDashboardProps {
  readonly fleetOwnerName: string;
  readonly todayStats: {
    readonly activeBookings: number;
    readonly completedBookings: number;
    readonly cancelledBookings: number;
    readonly confirmedBookings: number;
    readonly projectedRevenue: number;
  };
  readonly carCount: number;
  readonly bookingsValue: number;
  readonly confirmedUnassignedBookings: Array<{
    readonly id: string;
    readonly startDate: Date;
    readonly endDate: Date;
    readonly totalAmount: number;
    readonly status: string;
    readonly paymentStatus: string;
    readonly netTotal: number | null;
    readonly fleetOwnerPayoutAmountNet: number | null;
    readonly car: {
      readonly make: string;
      readonly model: string;
      readonly registrationNumber: string;
    };
    readonly user: {
      readonly name: string | null;
      readonly email: string;
    } | null;
  }>;
  readonly dashboardStats: {
    readonly activeBookingsCount: number;
    readonly completedBookingsCount: number;
    readonly cancelledBookingsCount: number;
    readonly availableCarsCount: number;
    readonly bookedCarsCount: number;
    readonly maintenanceCarsCount: number;
    readonly availableChauffeursCount: number;
    readonly onDutyChauffeursCount: number;
    readonly fleetUtilizationRate: number;
  };
  readonly dailyRevenue: Array<{ readonly date: Date; readonly revenue: number }>;
  readonly chauffeurs: Array<{ readonly id: string }>;
  readonly earnings: {
    readonly today: number;
    readonly thisWeek: {
      readonly amount: number;
      readonly bookingCount: number;
    };
    readonly thisMonth: {
      readonly amount: number;
      readonly bookingCount: number;
    };
  };
  readonly recentBookings: BookingWithRelations[];
  readonly nextPayout?: {
    readonly id: string;
    readonly amount: number;
    readonly status: string;
    readonly scheduledDate: Date;
  };
}

export function FleetOwnerDashboard({
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
}: FleetOwnerDashboardProps) {
  const activeBookingCount = todayStats.activeBookings;

  return (
    <div className="@container/main space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <WelcomeMessage
        name={fleetOwnerName || "Fleet Owner"}
        activeBookingCount={activeBookingCount}
        weeklyEarnings={earnings.thisWeek.amount}
      />

      {confirmedUnassignedBookings.length > 0 && (
        <RevenueAtRisk
          unassignedBookings={confirmedUnassignedBookings.map((booking) => ({
            id: booking.id,
            startDate: booking.startDate,
            totalAmount: booking.totalAmount,
          }))}
        />
      )}

      <KeyMetrics
        carCount={carCount}
        availableCarsCount={dashboardStats.availableCarsCount}
        bookedCarsCount={dashboardStats.bookedCarsCount}
        maintenanceCarsCount={dashboardStats.maintenanceCarsCount}
        activeBookingsCount={dashboardStats.activeBookingsCount}
        completedBookingsCount={dashboardStats.completedBookingsCount}
        cancelledBookingsCount={dashboardStats.cancelledBookingsCount}
        chauffeurCount={chauffeurs.length}
        availableChauffeursCount={dashboardStats.availableChauffeursCount}
        onDutyChauffeursCount={dashboardStats.onDutyChauffeursCount}
        monthlyRevenue={Number(bookingsValue)}
        todayStats={todayStats}
      />

      <EarningsSnapshot earnings={earnings} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RecentActivity bookings={recentBookings} />
        <NextPayoutCard payout={nextPayout} />
      </div>

      <QuickActions
        unassignedBookingsCount={confirmedUnassignedBookings.length}
        availableChauffeursCount={dashboardStats.availableChauffeursCount}
      />

      <RevenueChart
        data={dailyRevenue.map((item) => ({
          ...item,
          date: new Date(item.date),
          revenue: item.revenue,
        }))}
      />

      <UnassignedBookingsTable bookings={confirmedUnassignedBookings} />
    </div>
  );
}
