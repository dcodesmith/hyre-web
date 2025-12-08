import { EarningsSnapshot, RecentActivity, NextPayoutCard, WelcomeMessage } from "../shared";
import { UpcomingBookingsCard } from "./UpcomingTimeline";
import { CarStatusCard } from "./CarStatusCard";
import { PendingApprovalCard } from "./PendingApprovalCard";
import { LiveBookingsCard } from "./LiveBookingsCard";
import { PersonalDocumentsCard } from "./PersonalDocumentsCard";
import type { OwnerDriverDashboardData } from "./types";

export function OwnerDriverDashboard({
  name,
  pendingApprovalBookings,
  liveBookings,
  upcomingBookings,
  recentBookings,
  personalDocuments,
  car,
  earnings,
  nextPayout,
}: OwnerDriverDashboardData) {
  const activeBookingCount = liveBookings.length;

  return (
    <div className="@container/main space-y-6 p-2 md:p-6 max-w-7xl mx-auto">
      <WelcomeMessage
        name={name}
        activeBookingCount={activeBookingCount}
        weeklyEarnings={earnings.thisWeek.amount}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PendingApprovalCard bookings={pendingApprovalBookings} />

        <LiveBookingsCard bookings={liveBookings} />

        <UpcomingBookingsCard bookings={upcomingBookings} />
      </div>

      <EarningsSnapshot earnings={earnings} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RecentActivity bookings={recentBookings} />

        <NextPayoutCard payout={nextPayout} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CarStatusCard car={car} />
        <PersonalDocumentsCard
          documents={
            personalDocuments || { nin: undefined, driversLicense: undefined, lasdri: undefined }
          }
        />
      </div>
    </div>
  );
}
