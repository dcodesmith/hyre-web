import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { prisma } from "~/modules/db/db.server";
import { getMonthToDateBookingsValue } from "~/services/bookings.server";
import { requireUserWithRole } from "~/utils/permissions.server";

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

  return json({ carCount, bookingsValue, bookings, chauffeurs });
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
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + units[n % 10] : "");
    if (n < 1000)
      return (
        units[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " and " + recursiveNumberToWords(n % 100) : "")
      );

    let scaleIndex = 0;
    let result = "";

    while (n > 0) {
      if (n % 1000 !== 0) {
        result = recursiveNumberToWords(n % 1000) + " " + scales[scaleIndex] + " " + result;
      }
      n = Math.floor(n / 1000);
      scaleIndex++;
    }

    return result.trim();
  }

  return recursiveNumberToWords(Math.floor(num)) + " Naira";
}

export default function FleetOwnerDashboard() {
  const { carCount, bookingsValue, bookings } = useLoaderData<typeof loader>();

  const totalBookingsValue = bookings.reduce(
    (acc, booking) => acc + Number(booking.totalAmount),
    0,
  );

  const amountInWords = numberToWords(totalBookingsValue);

  return (
    <div className="space-y-4">
      {carCount} cars
      <br />
      {new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
      }).format(Number(bookingsValue))}{" "}
      <span className="text-sm text-gray-500">({amountInWords})</span>
      <br />
      {new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
      }).format(Number(totalBookingsValue))}
      <br />
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
