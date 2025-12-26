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

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);

  await requireUser(request, {
    redirectTo: `/auth?redirectTo=/cars/${params.id}`,
  });
}

/** Parse pickup time string (e.g., "7 AM", "11:30 PM") and return hours in 24h format */
function parsePickupTimeHours(pickupTime: string): number | null {
  const normalized = pickupTime.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number.parseInt(match[1]);
  const period = match[3];
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours;
}

/** Determine the effective pickup time based on booking type */
function getEffectivePickupTime(bookingType: string, pickupTime: string | null): string | null {
  if (bookingType === BookingType.NIGHT && !pickupTime) return "11 PM";
  return pickupTime;
}

/** Check car availability for the given parameters */
async function checkCarAvailability(
  carId: string,
  params: {
    fromDate: string | null;
    toDate: string | null;
    bookingType: string | null;
    pickupTime: string | null;
    flightNumber: string | null;
  },
): Promise<boolean> {
  const { fromDate, toDate, bookingType, pickupTime, flightNumber } = params;

  // Check if we have all required parameters
  const hasRequiredParams =
    fromDate &&
    toDate &&
    bookingType &&
    (pickupTime ||
      bookingType === BookingType.NIGHT ||
      (bookingType === BookingType.AIRPORT_PICKUP && flightNumber));

  if (!hasRequiredParams) return true;

  const effectivePickupTime = getEffectivePickupTime(bookingType, pickupTime);
  if (!effectivePickupTime) return true;

  const hours = parsePickupTimeHours(effectivePickupTime);
  if (hours === null) {
    logger.warn(
      `Invalid pickupTime format: "${effectivePickupTime}". Skipping availability check.`,
      {
        fromDate,
        toDate,
        bookingType,
      },
    );
    return true;
  }

  // Define window that covers booking overlaps across [from..to]
  const fromStart = new Date(`${fromDate}T00:00:00.000Z`);
  const toStart = new Date(`${toDate}T00:00:00.000Z`);
  const endWindow = new Date(toStart);
  endWindow.setUTCDate(endWindow.getUTCDate() + 1);
  endWindow.setUTCHours(5, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      carId,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
      AND: [{ startDate: { lt: endWindow } }, { endDate: { gt: fromStart } }],
    },
    select: { carId: true, type: true, startDate: true, endDate: true, status: true },
  });

  const lagosDateString = `${fromDate}T${hours.toString().padStart(2, "0")}:00:00`;
  const specificFrom = fromZonedTime(lagosDateString, LAGOS_TIMEZONE);

  logger.debug("Car details availability check", {
    carId,
    pickupTime,
    parsedHours: hours,
    specificFrom: specificFrom.toISOString(),
    fromDate,
    toDate,
    bookingType,
    bookingsCount: bookings.length,
  });

  const availableCarIds = availableCarsForSpecificRequest(
    [{ id: carId }] as Car[],
    bookings as Booking[],
    { bookingType: bookingType as BookingType, from: specificFrom },
  );

  return availableCarIds.includes(carId);
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

  // Check availability only when all required parameters are present
  const isAvailable = await checkCarAvailability(carId, {
    fromDate,
    toDate,
    bookingType,
    pickupTime,
    flightNumber,
  });

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

  const carImages = car.images.length > 0 ? car.images.map(({ url }) => url) : undefined;

  return (
    <>
      {/* MOBILE LAYOUT - Sticky header, scrollable content, sticky footer handled by BookingCard */}
      <div className="lg:hidden flex flex-col min-h-screen -mx-4 -mt-4">
        {/* Sticky Header - Carousel with Car Title */}
        <div className="sticky top-0 z-30 bg-white shadow-sm">
          <div className="relative">
            <CarCarousel variant="booking" images={carImages} priority />
            {/* Back button overlay */}
            <Link
              to={`/search?${searchParams.toString()}`}
              className="absolute top-4 left-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
              aria-label="Back to search results"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 pb-40">
          {/* Car Details Accordion */}
          <div className="px-4 pt-6">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="car-details" className="border-none">
                <AccordionTrigger className="text-sm font-semibold leading-7 text-gray-900 border-none py-2">
                  Car information and features
                </AccordionTrigger>
                <AccordionContent className="border-none">
                  <dl className="mt-1 text-sm">
                    <div className="py-2">
                      <dt className="font-medium text-gray-900">Make & Model</dt>
                      <dd className="mt-0.5 text-gray-700">
                        {car.make} {car.model} {car.year}
                      </dd>
                    </div>
                    <div className="py-2">
                      <dt className="font-medium text-gray-900">Features</dt>
                      <dd className="mt-0.5 text-gray-700">
                        Air conditioning, GPS, Bluetooth, Cruise control, Rear-view camera, USB
                      </dd>
                    </div>
                    <div className="py-2">
                      <dt className="font-medium text-gray-900">Transmission</dt>
                      <dd className="mt-0.5 text-gray-700">Automatic</dd>
                    </div>
                    <div className="py-2">
                      <dt className="font-medium text-gray-900">Seating</dt>
                      <dd className="mt-0.5 text-gray-700">7-seater</dd>
                    </div>
                  </dl>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Booking Card - Mobile version */}
          <div className="px-4">
            <BookingCard
              car={carWithDates}
              isAvailable={isAvailable}
              user={user as Parameters<typeof BookingCard>[0]["user"]}
              vatRate={vatRate}
              platformServiceFeeRate={platformServiceFeeRate}
              securityDetailRate={securityDetailRate}
              isMobile
            />
          </div>
        </div>
      </div>

      <div className="hidden lg:block max-w-6xl py-4 space-y-4 mx-auto">
        <Link to={`/search?${searchParams.toString()}`} className="hover:underline mb-1 block">
          &larr; Back to search results
        </Link>

        <h2 className="text-2xl sm:text-3xl font-bold mb-4">
          {car.make} {car.model} - {car.year}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-[60%,40%] gap-4">
          <div className="flex flex-col gap-4">
            <CarCarousel variant="booking" images={carImages} priority />

            {/* Desktop car details */}
            <div className="px-4">
              <h3 className="text-base font-semibold leading-7 text-gray-900">
                Car information and features
              </h3>

              <div className="mt-4 border-t border-gray-100">
                <dl>
                  <div className="py-3 grid grid-cols-3 gap-4 px-0">
                    <dt className="text-sm font-medium leading-6 text-gray-900">Make & Model</dt>
                    <dd className="text-sm leading-6 text-gray-700 col-span-2">
                      {car.make} {car.model} {car.year}
                    </dd>
                  </div>

                  <div className="py-3 grid grid-cols-3 gap-4 px-0">
                    <dt className="text-sm font-medium leading-6 text-gray-900">Features</dt>
                    <dd className="text-sm leading-6 text-gray-700 col-span-2">
                      Air conditioning, GPS navigation system, Bluetooth connectivity, Cruise
                      control, Rear-view camera, USB ports
                    </dd>
                  </div>

                  <div className="py-3 grid grid-cols-3 gap-4">
                    <dt className="text-sm font-medium leading-6 text-gray-900">
                      Transmission Type
                    </dt>
                    <dd className="text-sm leading-6 text-gray-700 col-span-2">Automatic</dd>
                  </div>

                  <div className="py-3 grid grid-cols-3 gap-4">
                    <dt className="text-sm font-medium leading-6 text-gray-900">
                      Seating Capacity
                    </dt>
                    <dd className="text-sm leading-6 text-gray-700 col-span-2">7-seater</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="sticky top-4 px-4">
            <BookingCard
              car={carWithDates}
              isAvailable={isAvailable}
              user={user as Parameters<typeof BookingCard>[0]["user"]}
              vatRate={vatRate}
              platformServiceFeeRate={platformServiceFeeRate}
              securityDetailRate={securityDetailRate}
            />
          </div>
        </div>
      </div>
    </>
  );
}
