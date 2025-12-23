import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Booking, BookingStatus, BookingType, Car } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, redirect, useLoaderData, useSearchParams } from "@remix-run/react";
import { fromZonedTime } from "date-fns-tz";
import invariant from "tiny-invariant";
import CarCarousel from "~/components/Carousel";
import BookingCard from "~/components/booking/BookingCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import logger from "~/lib/logger.server";
import { getSessionUser, requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { availableCarsForSpecificRequest } from "~/services/availability-engine.server";
import { getRates } from "~/services/extensions.server";
import { LAGOS_TIMEZONE } from "~/utils/timezone";
import { validateCSRF } from "~/utils/csrf-action.server";
import { AIRPORT_PICKUP_BOOKING_TYPE } from "~/components/bookingTypes";

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);

  await requireUser(request, {
    redirectTo: `/auth?redirectTo=/cars/${params.id}`,
  });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  invariant(params.id, "Car ID is required");
  const carId = params.id;
  const url = new URL(request.url);

  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");
  const bookingType = url.searchParams.get("bookingType");
  const pickupTime = url.searchParams.get("pickupTime");
  const flightNumber = url.searchParams.get("flightNumber");

  // Run all independent queries in parallel for better performance
  const [user, car, rates] = await Promise.all([
    getSessionUser(request),
    prisma.car.findUnique({
      where: { id: carId },
      include: {
        images: { select: { url: true } },
      },
    }),
    getRates(),
  ]);

  if (!car) {
    throw redirect("/");
  }

  // Only check availability if all required search parameters are provided
  let isAvailable = true;

  // Only check availability if we have all required parameters including pickup time
  // Exception: NIGHT bookings can default to "11 PM" if no pickup time is specified
  // Exception: AIRPORT_PICKUP bookings require flightNumber instead of pickupTime
  if (
    fromDate &&
    toDate &&
    bookingType &&
    (pickupTime ||
      bookingType === BookingType.NIGHT ||
      (bookingType === BookingType.AIRPORT_PICKUP && flightNumber))
  ) {
    // Derive effective pickup time: for NIGHT bookings, default to "11 PM" if missing
    // For AIRPORT_PICKUP, use a default time (12 PM) for availability checks
    const effectivePickupTime =
      bookingType === AIRPORT_PICKUP_BOOKING_TYPE
        ? "12 PM" // Default time for airport pickup (can be adjusted based on flight schedules)
        : bookingType === BookingType.NIGHT && !pickupTime
          ? "11 PM"
          : pickupTime;

    // Normalize and validate pickup time format (e.g., "7 AM", "11:30 PM")
    const normalizedPickupTime = effectivePickupTime?.trim().toUpperCase();
    const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i;
    const timeMatch = normalizedPickupTime?.match(timeRegex);

    if (timeMatch) {
      // Parse the validated time
      let hours = Number.parseInt(timeMatch[1]);
      const period = timeMatch[3];

      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      // Define a superset window that covers DAY/NIGHT/FULL_DAY/AIRPORT_PICKUP overlaps across [from..to]
      // fromDate and toDate are date-only strings (e.g., "2025-12-13") for all booking types
      const fromStart = new Date(`${fromDate}T00:00:00.000Z`);
      const toStart = new Date(`${toDate}T00:00:00.000Z`);
      const endWindow = new Date(toStart);
      endWindow.setUTCDate(endWindow.getUTCDate() + 1); // include last night spillover
      endWindow.setUTCHours(5, 0, 0, 0); // up to 05:00 of the day after 'to'

      // Fetch only bookings for this car with date range filter
      const bookings = await prisma.booking.findMany({
        where: {
          carId: carId,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
          AND: [{ startDate: { lt: endWindow } }, { endDate: { gt: fromStart } }],
        },
        select: { carId: true, type: true, startDate: true, endDate: true, status: true },
      });

      // Create a date string in Lagos timezone and convert to UTC
      const lagosDateString = `${fromDate}T${hours.toString().padStart(2, "0")}:00:00`;
      const specificFrom = fromZonedTime(lagosDateString, LAGOS_TIMEZONE);

      logger.debug("Car details availability check with specific pickup time", {
        carId,
        pickupTime,
        parsedHours: hours,
        specificFrom: specificFrom.toISOString(),
        fromDate,
        toDate,
        bookingType,
        bookingsCount: bookings.length,
        bookings: bookings.map((b) => ({
          carId: b.carId,
          start: b.startDate.toISOString(),
          end: b.endDate.toISOString(),
        })),
      });

      const availableCarIds = availableCarsForSpecificRequest(
        [{ id: carId }] as Car[],
        bookings as Booking[],
        {
          bookingType: bookingType as BookingType,
          from: specificFrom,
        },
      );

      isAvailable = availableCarIds.includes(carId);
    } else {
      // Invalid pickup time format - skip availability check and show car as available
      logger.warn(
        `Invalid pickupTime format: "${effectivePickupTime}". Skipping availability check.`,
        { fromDate, toDate, bookingType },
      );
    }
  }

  return {
    car,
    isAvailable,
    user: user
      ? {
          ...user,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        }
      : null,
    vatRate: rates.vatRatePercent.toNumber(),
    platformServiceFeeRate: rates.platformCustomerServiceFeeRatePercent.toNumber(),
    securityDetailRate: rates.securityDetailRate.toNumber(),
  };
};

export default function CarDetails() {
  const { car, isAvailable, user, vatRate, platformServiceFeeRate, securityDetailRate } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const carWithDates = {
    ...car,
    createdAt: new Date(car.createdAt),
    updatedAt: new Date(car.updatedAt),
  };

  return (
    <div className="max-w-6xl md:py-4 space-y-4 -mx-4 md:mx-auto -mt-4 md:mt-0">
      <Link to={`/?${searchParams.toString()}`} className=" hover:underline mb-1 md:block hidden">
        &larr; Back to search results
      </Link>

      <h2 className="text-2xl sm:text-3xl font-bold mb-4 hidden md:block">
        {car.make} {car.model} - {car.year}
      </h2>
      <h2 className="sr-only md:hidden">
        {car.make} {car.model} - {car.year}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-[60%,40%] gap-4">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <CarCarousel
              images={car.images.length > 0 ? car.images.map(({ url }) => url) : undefined}
            />
            {/* Mobile-only back button overlay */}
            <Link
              to={`/?${searchParams.toString()}`}
              className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition-opacity md:hidden"
              aria-label="Back to search results"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </Link>
          </div>

          {/* Desktop version - always visible */}
          <div className="px-4 hidden md:block">
            <div className="px-0">
              <h3 className="text-base font-semibold leading-7 text-gray-900">
                Car information and features
              </h3>
            </div>

            <div className="mt-4 border-t border-gray-100">
              <dl>
                <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                  <dt className="text-sm font-medium leading-6 text-gray-900">Make & Model</dt>
                  <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                    {car.make} {car.model} {car.year}
                  </dd>
                </div>

                <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                  <dt className="text-sm font-medium leading-6 text-gray-900">Features</dt>
                  <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                    Air conditioning, GPS navigation system, Bluetooth connectivity, Cruise control,
                    Rear-view camera, USB ports
                  </dd>
                </div>

                <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                  <dt className="text-sm font-medium leading-6 text-gray-900">Transmission Type</dt>
                  <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                    Automatic
                  </dd>
                </div>

                <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                  <dt className="text-sm font-medium leading-6 text-gray-900">Seating Capacity</dt>
                  <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                    7-seater
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Mobile version - accordion */}
          <div className="px-4 md:hidden">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="car-details" className="border-none">
                <AccordionTrigger className="text-base font-semibold leading-7 text-gray-900 border-none">
                  Car information and features
                </AccordionTrigger>
                <AccordionContent className="border-none">
                  <dl className="mt-2">
                    <div className="py-3">
                      <dt className="text-sm font-medium leading-6 text-gray-900">Make & Model</dt>
                      <dd className="mt-1 text-sm leading-6 text-gray-700">
                        {car.make} {car.model} {car.year}
                      </dd>
                    </div>

                    <div className="py-3">
                      <dt className="text-sm font-medium leading-6 text-gray-900">Features</dt>
                      <dd className="mt-1 text-sm leading-6 text-gray-700">
                        Air conditioning, GPS navigation system, Bluetooth connectivity, Cruise
                        control, Rear-view camera, USB ports
                      </dd>
                    </div>

                    <div className="py-3">
                      <dt className="text-sm font-medium leading-6 text-gray-900">
                        Transmission Type
                      </dt>
                      <dd className="mt-1 text-sm leading-6 text-gray-700">Automatic</dd>
                    </div>

                    <div className="py-3">
                      <dt className="text-sm font-medium leading-6 text-gray-900">
                        Seating Capacity
                      </dt>
                      <dd className="mt-1 text-sm leading-6 text-gray-700">7-seater</dd>
                    </div>
                  </dl>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 px-2 sm:px-4">
          <BookingCard
            car={carWithDates}
            isAvailable={isAvailable}
            user={user as any}
            vatRate={vatRate}
            platformServiceFeeRate={platformServiceFeeRate}
            securityDetailRate={securityDetailRate}
          />
        </div>
      </div>
    </div>
  );
}
