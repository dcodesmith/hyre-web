import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ChartContainer } from "~/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { prisma } from "~/modules/db/db.server";
import { getMonthToDateBookingsValue } from "~/services/bookings.server";
import { requireUserWithRole } from "~/utils/permissions.server";

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

  const bookings = await prisma.booking.findMany({
    where: {
      paymentStatus: "PAID",
      status: {
        not: "CANCELLED",
      },
      car: {
        ownerId: fleetOwner.id,
      },
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
        bookingsAsChauffeur: { none: { status: "ACTIVE" } },
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

  const dailyRevenue = Array.from({ length: 29 }, (_, index) => {
    const date = new Date(last30Days);
    date.setDate(last30Days.getDate() + index);

    const day = date.getDate().toString();

    const dayBookings = monthlyBookings.filter(
      (booking) => new Date(booking.startDate).getDate().toString() === day,
    );

    const revenue = dayBookings.reduce((sum, booking) => sum + Number(booking.totalAmount), 0);

    return { date, revenue };
  });

  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  // Get today's stats
  const todayStats = await prisma.$transaction([
    // Today's active bookings
    prisma.booking.count({
      where: {
        status: "ACTIVE",
        car: { ownerId: fleetOwner.id },
        endDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),
    // Today's completed bookings
    prisma.booking.count({
      where: {
        status: "COMPLETED",
        car: { ownerId: fleetOwner.id },
        startDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),
    // Today's cancelled bookings
    prisma.booking.count({
      where: {
        status: "CANCELLED",
        car: { ownerId: fleetOwner.id },
        startDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),
    // Today's confirmed bookings
    prisma.booking.count({
      where: {
        status: "CONFIRMED",
        car: { ownerId: fleetOwner.id },
        startDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),
    // Today's projected revenue
    prisma.booking.aggregate({
      where: {
        car: { ownerId: fleetOwner.id },
        endDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ["ACTIVE", "CONFIRMED", "COMPLETED"],
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),
  ]);

  const [
    todayActiveBookings,
    todayCompletedBookings,
    todayCancelledBookings,
    todayConfirmedBookings,
    todayRevenue,
  ] = todayStats;

  return json({
    carCount: carCount,
    bookingsValue: bookingsValue,
    bookings,
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
      projectedRevenue: todayRevenue._sum.totalAmount || 0,
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

// Function to add ordinal suffix
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
  const today = new Date();

  const formattedDate = today.toLocaleDateString("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Insert the ordinal day
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
    stats.activeBookings > 0 ||
    stats.completedBookings > 0 ||
    stats.cancelledBookings > 0 ||
    stats.confirmedBookings > 0;

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
      Welcome {name},
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
            <span className="font-bold text-green-800 italic">
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
    bookings,
    dashboardStats,
    dailyRevenue,
    chauffeurs,
  } = useLoaderData<typeof loader>();
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

  const totalBookingsValue = bookings.reduce(
    (acc, booking) => acc + Number(booking.totalAmount),
    0,
  );

  const amountInWords = numberToWords(totalBookingsValue);

  return (
    <div className="space-y-6 p-4">
      <WelcomeMessage name={fleetOwnerName} stats={todayStats} />

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
                  .reduce((sum, day) => sum + day.revenue, 0),
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
            <ToggleGroupItem title="Month to Date" value="month">
              MTD
            </ToggleGroupItem>
            <ToggleGroupItem title="Year to Date" disabled value="year">
              YTD
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <RevenueChart
          data={dailyRevenue.map((item) => ({ ...item, date: new Date(item.date) }))}
          timeRange={timeRange}
        />
      </div>

      <div className="rounded-md border">
        <div className="p-4">
          <h2 className="text-xl font-semibold">Recent Bookings</h2>
        </div>
        <div className="divide-y">
          {bookings.map((booking) => (
            <div key={booking.id} className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
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
                  <div className="text-sm text-gray-500">Total Amount</div>
                  <div>
                    {new Intl.NumberFormat("en-NG", {
                      style: "currency",
                      currency: "NGN",
                    }).format(Number(booking.totalAmount))}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">Start Date</div>
                  <div>{new Date(booking.startDate).toLocaleString()}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">End Date</div>
                  <div>{new Date(booking.endDate).toLocaleString()}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">Chauffeur</div>
                  {booking.chauffeur ? (
                    <div title={booking.chauffeur.email}>{booking.chauffeur.name}</div>
                  ) : booking.status === "CONFIRMED" ? (
                    <Link to={`/fleet-owner/bookings/${booking.id}?startDate=${booking.startDate}`}>
                      Assign Chauffeur
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
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
