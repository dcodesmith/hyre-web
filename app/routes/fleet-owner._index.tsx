import { Decimal } from "@prisma/client/runtime/library";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ChartContainer } from "~/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import logger from "~/lib/logger.server";
import { formatDate } from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";
import { Prisma, BookingStatus, PaymentStatus } from "@prisma/client";
import { getMonthToDateBookingsValue } from "~/services/bookings.server";
import { requireUserWithRole } from "~/utils/permissions.server";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

type TimeRange = "week" | "month" | "year";

export async function loader({ request }: LoaderFunctionArgs) {
  const fleetOwner = await requireUserWithRole(request, "fleetOwner");

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
    // Cars under maintenance
    prisma.car.count({
      where: {
        ownerId: fleetOwner.id,
        status: "IN_SERVICE",
      },
    }),

    // Booked cars
    prisma.car.count({
      where: {
        ownerId: fleetOwner.id,
        status: "BOOKED",
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
  ]);

  const [
    activeBookingsCount,
    completedBookingsCount,
    cancelledBookingsCount,
    availableCarsCount,
    carsInMaintenanceCount,
    bookedCarsCount,
    availableChauffeursCount,
  ] = stats;

  const today = new Date();

  const last30Days = new Date(today);
  last30Days.setDate(today.getDate() - 29); // -29 to include today

  // Get completed bookings for the month
  const monthlyBookings = await prisma.booking.findMany({
    where: {
      car: { ownerId: fleetOwner.id },
      status: "COMPLETED",
      startDate: {
        gte: last30Days,
        lte: today,
      },
    },
    select: {
      endDate: true,
      startDate: true,
      totalAmount: true,
    },
  });

  // const oni = startOfDay(new Date()); // Today at 00:00:00

  const todayUtcYear = today.getUTCFullYear(); // Native Date method
  const todayUtcMonth = today.getUTCMonth(); // Native Date method (0-indexed)
  const todayUtcDay = today.getUTCDate(); // Native Date method

  // Construct start and end of "today" in UTC
  const startOfToday = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 0, 0, 0, 0));
  const endOfToday = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 23, 59, 59, 999));

  const dailyRev = await Promise.all(
    Array.from({ length: 30 }, async (_, index) => {
      const date = subDays(startOfToday, index); // Use subDays for clear subtraction

      const revenue = await getTodaysLegsTotalPrice(fleetOwner.id, date);
      return { date, revenue };
    }),
  );

  // TODO
  const legs = await prisma.bookingLeg.findMany({
    where: {
      legDate: { gte: subDays(startOfToday, 29), lte: endOfToday },
      booking: {
        car: { ownerId: fleetOwner.id },
      },
    },
    select: { legDate: true, totalDailyPrice: true, fleetOwnerEarningForLeg: true },
  });

  logger.info("Booking legs:", legs);

  const revenueByDay = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(startOfToday, i);
    const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const daySum = legs
      .filter((l) => l.legDate.toISOString().startsWith(key))
      .reduce((acc, l) => acc.add(l.fleetOwnerEarningForLeg), new Decimal(0));
    return { date, revenue: daySum };
  }).reverse();

  const dailyRevenue = dailyRev.slice().reverse();

  async function getTodaysLegsTotalPrice(
    fleetOwnerIdInput?: string,
    dateInput: Date = new Date(),
  ): Promise<Decimal> {
    const todayUtcYear = dateInput.getUTCFullYear(); // Native Date method
    const todayUtcMonth = dateInput.getUTCMonth(); // Native Date method (0-indexed)
    const todayUtcDay = dateInput.getUTCDate(); // Native Date method

    // Construct start and end of "today" in UTC
    const start = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 0, 0, 0, 0));
    const end = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 23, 59, 59, 999));

    let totalFleetOwnerEarningForToday = new Decimal(0);

    const bookingWhereClause: Prisma.BookingWhereInput = {
      status: { in: [BookingStatus.ACTIVE, BookingStatus.COMPLETED] },
      paymentStatus: PaymentStatus.PAID,
      chauffeurId: { not: null },
    };

    if (fleetOwnerIdInput) {
      bookingWhereClause.car = {
        ownerId: fleetOwnerIdInput,
      };
    }

    const bookingLegWhereClause: Prisma.BookingLegWhereInput = {
      legDate: { gte: start, lte: end },
      booking: bookingWhereClause,
      totalDailyPrice: { gt: 0 },
    };

    const relevantBookingLegs = await prisma.bookingLeg.findMany({
      where: bookingLegWhereClause,
      select: {
        legDate: true,
        totalDailyPrice: true,
        fleetOwnerEarningForLeg: true,
      },
    });

    for (const leg of relevantBookingLegs) {
      logger.info(
        `${format(leg.legDate, "yyyy-MM-dd")}: Leg price: ${leg.fleetOwnerEarningForLeg.toFixed(2)}, ${leg.totalDailyPrice.toFixed(2)}`,
      );
      const legPrice = new Decimal(leg.fleetOwnerEarningForLeg.toString());
      totalFleetOwnerEarningForToday = totalFleetOwnerEarningForToday.add(legPrice);
    }

    return totalFleetOwnerEarningForToday;
  }

  async function getTodaysLegsFleetOwnerEarningSum(
    fleetOwnerIdInput?: string,
    dateInput: Date = new Date(),
  ): Promise<Decimal> {
    // Determine the start and end of the given date in UTC
    const todayUtcYear = dateInput.getUTCFullYear();
    const todayUtcMonth = dateInput.getUTCMonth(); // 0-indexed (January is 0)
    const todayUtcDay = dateInput.getUTCDate();

    // Start of the day in UTC
    const startOfTodayUTC = new Date(
      Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 0, 0, 0, 0),
    );
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
    return totalSum ? totalSum : new Decimal(0);
  }

  const ownerRevenueToday = await getTodaysLegsFleetOwnerEarningSum(fleetOwner.id);
  const ownerRevenueToday2 = await getTodaysLegsTotalPrice(fleetOwner.id);

  logger.info(`Owner revenue today: ${ownerRevenueToday.toString()}`);
  logger.info(`Owner revenue today 2: ${ownerRevenueToday2.toString()}`);
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

  const todayRevenue = await prisma.booking.aggregate({
    where: {
      status: { in: [BookingStatus.ACTIVE, BookingStatus.COMPLETED, BookingStatus.CONFIRMED] },
      paymentStatus: PaymentStatus.PAID,
      car: { ownerId: fleetOwner.id },
      AND: [dateRangeFilter],
    },
    _sum: { totalAmount: true },
  });

  const [
    todayActiveBookings,
    todayCompletedBookings,
    todayCancelledBookings,
    todayConfirmedBookings,
  ] = todayStats;

  return json({
    carCount: carCount,
    bookingsValue: bookingsValue,
    confirmedUnassignedBookings,
    chauffeurs,
    dashboardStats: {
      activeBookingsCount,
      completedBookingsCount,
      cancelledBookingsCount,
      availableCarsCount,
      carsInMaintenanceCount,
      bookedCarsCount,
      availableChauffeursCount,
    },
    dailyRevenue,
    fleetOwnerName: fleetOwner.name,
    todayStats: {
      activeBookings: todayActiveBookings,
      completedBookings: todayCompletedBookings,
      cancelledBookings: todayCancelledBookings,
      confirmedBookings: todayConfirmedBookings,
      projectedRevenue: ownerRevenueToday,
    },
  });
}

function numberToWords(num: number) {
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const scales = ["", "Thousand", "Million", "Billion", "Trillion"];

  if (num === 0) return "Zero Naira";

  function recursiveNumberToWords(n: number): string {
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${units[n % 10]}` : "");
    if (n < 1000)
      return `${units[Math.floor(n / 100)]} Hundred${n % 100 ? ` and ${recursiveNumberToWords(n % 100)}` : ""}`;

    let scaleIndex = 0;
    let result = "";
    let remaining = n;

    while (remaining > 0) {
      if (remaining % 1000 !== 0) {
        result = `${recursiveNumberToWords(remaining % 1000)} ${scales[scaleIndex]} ${result}`;
      }
      remaining = Math.floor(remaining / 1000);
      scaleIndex++;
    }

    return result.trim();
  }

  return `${recursiveNumberToWords(Math.floor(num))} Naira`;
}

const getOrdinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function RevenueChart({
  data,
  timeRange,
}: {
  data: Array<{ date: Date; revenue: number }>;
  timeRange: TimeRange;
}) {
  const chartConfig = {
    revenue: {
      label: "Daily Revenue",
      theme: {
        light: "hsl(220 80% 50%)",
        dark: "hsl(220 80% 60%)",
      },
    },
  };

  // Filter data based on timeRange only
  const filteredData = useMemo(() => {
    return timeRange === "week" ? data.slice(-7) : data.slice(-30);
  }, [data, timeRange]);

  return (
    <ChartContainer className="h-[400px] w-full" config={chartConfig}>
      <BarChart data={filteredData} margin={{ top: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={timeRange === "year" ? "month" : "date"}
          tickFormatter={(value) => getOrdinal(new Date(value).getDate())}
          interval={0}
          className="text-xs [&_.recharts-cartesian-axis-tick]:md:block [&_.recharts-cartesian-axis-tick]:data-[value='0']:md:hidden [&_.recharts-cartesian-axis-tick]:data-[value='0']:hidden"
          padding={{ left: 0, right: 0 }}
        />
        <YAxis
          tickFormatter={(value) =>
            new Intl.NumberFormat("en-NG", {
              notation: "compact",
              style: "currency",
              currency: "NGN",
            }).format(value)
          }
          width={70}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length || payload[0].value === 0) return null;
            const formattedDate = new Date(label).toLocaleDateString("en-NG", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            // Insert the ordinal day
            const day = new Date(label).getDate();
            const dateWithOrdinal = formattedDate.replace(/\b\d+\b/, getOrdinal(day));

            return (
              <div className="rounded border border-neutral-200 bg-white p-3 shadow-xl">
                <div className="grid gap-2">
                  <div className="font-medium">{dateWithOrdinal}</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[var(--color-revenue)]" />
                    <div>
                      {new Intl.NumberFormat("en-NG", {
                        style: "currency",
                        currency: "NGN",
                      }).format(payload[0].value as number)}
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={50} />
      </BarChart>
    </ChartContainer>
  );
}

function WelcomeMessage({
  name,
  stats,
}: {
  name: string;
  stats: {
    activeBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    confirmedBookings: number;
    projectedRevenue: number;
  };
}) {
  const {
    activeBookings,
    completedBookings,
    cancelledBookings,
    confirmedBookings,
    projectedRevenue,
  } = stats;
  const today = new Date();

  const formattedDate = today.toLocaleDateString("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const day = new Date().getDate();
  const dateWithOrdinal = formattedDate.replace(/\b\d+\b/, getOrdinal(day));

  const formatBookingCount = (count: number, label: string) => {
    if (count === 0) return `no ${label} bookings`;
    return (
      <>
        <span className="font-bold">{count}</span> {label} {count === 1 ? "booking" : "bookings"}
      </>
    );
  };

  const hasAnyBookings =
    activeBookings > 0 || completedBookings > 0 || cancelledBookings > 0 || confirmedBookings > 0;

  if (!hasAnyBookings) {
    return (
      <div className="text-sm text-gray-700 mb-6">
        <p>
          Hello {name}, welcome to a new day! Your fleet is ready and waiting for new bookings. Keep
          up the great work in maintaining your excellent service standards. Here's to a successful
          day ahead!
        </p>
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-700 mb-6">
      Welcome {name.trim()},
      <div className="my-4">
        <p>
          For today <span className="font-bold">{dateWithOrdinal}</span> you have{" "}
          {formatBookingCount(stats.activeBookings, "active")},{" "}
          {formatBookingCount(stats.confirmedBookings, "upcoming")},{" "}
          {formatBookingCount(stats.completedBookings, "completed")}, and{" "}
          {formatBookingCount(stats.cancelledBookings, "cancelled")}.
        </p>
        <p>Your fleet is in excellent condition and fully prepared for new reservations.</p>
        {(stats.activeBookings || stats.completedBookings) > 0 && (
          <p>
            With a projected revenue of{" "}
            <span className="font-bold text-green-800 italic underline">
              {new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: "NGN",
              }).format(stats.projectedRevenue)}
            </span>{" "}
            for the day, your business is on track for continued success.{" "}
          </p>
        )}
      </div>
      Wishing you a productive day ahead!
    </div>
  );
}

export default function FleetOwnerDashboard() {
  const {
    fleetOwnerName,
    todayStats,
    carCount,
    bookingsValue,
    confirmedUnassignedBookings,
    dashboardStats,
    dailyRevenue,
    chauffeurs,
  } = useLoaderData<typeof loader>();
  const [timeRange, setTimeRange] = useState<TimeRange>("week");

  return (
    <div className="space-y-6 sm:p-4">
      <WelcomeMessage
        name={fleetOwnerName || "Fleet Owner"}
        stats={{ ...todayStats, projectedRevenue: Number(todayStats.projectedRevenue) }}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Fleet Overview"
          stats={[
            { label: "Total Cars", value: carCount },
            { label: "Available Cars", value: dashboardStats.availableCarsCount },
            { label: "In Maintenance", value: dashboardStats.carsInMaintenanceCount },
            { label: "Booked Cars", value: dashboardStats.bookedCarsCount },
          ]}
        />

        <StatsCard
          title="Bookings Overview"
          stats={[
            { label: "Active Bookings", value: dashboardStats.activeBookingsCount },
            { label: "Completed Bookings", value: dashboardStats.completedBookingsCount },
            { label: "Cancelled Bookings", value: dashboardStats.cancelledBookingsCount },
            {
              label: "Month Revenue",
              value: new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: "NGN",
              }).format(Number(bookingsValue)),
            },
          ]}
        />

        <StatsCard
          title="Chauffeur Overview"
          stats={[
            { label: "Total Chauffeurs", value: chauffeurs.length },
            { label: "Available Chauffeurs", value: dashboardStats.availableChauffeursCount },
            {
              label: "On Duty",
              value: chauffeurs.length - dashboardStats.availableChauffeursCount,
            },
          ]}
        />

        <StatsCard
          title="Unassigned Bookings"
          stats={[
            { label: "Total Unassigned", value: dashboardStats.activeBookingsCount },
            { label: "Available Chauffeurs", value: dashboardStats.availableChauffeursCount },
            {
              label: "On Duty",
              value: chauffeurs.length - dashboardStats.availableChauffeursCount,
            },
          ]}
        />
      </div>

      <div className="rounded border bg-white p-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-semibold text-gray-900">
              {timeRange === "week"
                ? "Week to Date"
                : timeRange === "month"
                  ? "Month to Date"
                  : "Year to Date"}{" "}
              Revenue Breakdown
            </h3>
            <p className="text-sm text-gray-600">
              Total:{" "}
              {new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: "NGN",
              }).format(
                dailyRevenue
                  .slice(timeRange === "week" ? -7 : -30)
                  .reduce((sum, day) => sum + Number(day.revenue), 0),
              )}
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(value) => {
              if (value) setTimeRange(value as TimeRange);
            }}
          >
            <ToggleGroupItem title="Week to Date" value="week">
              WTD
            </ToggleGroupItem>
            <ToggleGroupItem title="Month to Date" value="month" className="hidden sm:block">
              MTD
            </ToggleGroupItem>
            <ToggleGroupItem title="Year to Date" disabled value="year" className="hidden sm:block">
              YTD
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <RevenueChart
          data={dailyRevenue.map((item) => ({
            ...item,
            date: new Date(item.date),
            revenue: Number(item.revenue),
          }))}
          timeRange={timeRange}
        />
      </div>

      <div className="rounded border">
        <div className="p-4">
          <h2 className="text-base font-semibold">Confirmed Unassigned Bookings</h2>
        </div>
        <div className="divide-y">
          {confirmedUnassignedBookings.length > 0 ? (
            confirmedUnassignedBookings.map((booking) => (
              <div key={booking.id} className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
                  <div>
                    <div className="text-sm text-gray-500">Car</div>
                    <div>
                      {booking.car.make} {booking.car.model}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Booking Status</div>
                    <div>{booking.status}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Payment Status</div>
                    <div>{booking.paymentStatus}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Net Total Amount</div>
                    <div>
                      {new Intl.NumberFormat("en-NG", {
                        style: "currency",
                        currency: "NGN",
                      }).format(Number(booking.netTotal))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Fleet Owner Payout</div>
                    <div>
                      {new Intl.NumberFormat("en-NG", {
                        style: "currency",
                        currency: "NGN",
                      }).format(Number(booking.fleetOwnerPayoutAmountNet))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Start Date</div>
                    <div>{formatDate(booking.startDate)}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">End Date</div>
                    <div>{formatDate(booking.endDate)}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Chauffeur</div>
                    {booking.chauffeur ? (
                      <div title={booking.chauffeur.email}>{booking.chauffeur.name}</div>
                    ) : booking.status === "CONFIRMED" ? (
                      <Link
                        to={`/fleet-owner/bookings/${booking.id}?startDate=${booking.startDate}`}
                      >
                        Assign Chauffeur
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4">No confirmed unassigned bookings</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  stats,
}: {
  title: string;
  stats: Array<{ label: string; value: string | number }>;
}) {
  return (
    <Card className="rounded">
      <CardHeader className="px-4 py-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-1 text-sm">
          {stats.map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-gray-600">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
