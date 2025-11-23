import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { BookingStatus } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, redirect, useLoaderData, useSearchParams } from "@remix-run/react";
import { addHours, differenceInCalendarDays } from "date-fns";
import invariant from "tiny-invariant";
import CarCarousel from "~/components/Carousel";
import BookingCard from "~/components/booking/BookingCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { getSessionUser, requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { isCarAvailable } from "~/services/cars.server";
import { getRates } from "~/services/extensions.server";
import { validateCSRF } from "~/utils/csrf-action.server";

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

  // Run all independent queries in parallel for better performance
  const [user, car, rates, overlappingBookings] = await Promise.all([
    getSessionUser(request),
    prisma.car.findUnique({
      where: { id: carId },
      include: {
        images: { select: { url: true } },
      },
    }),
    getRates(),
    // Fetch booking types that are already taken for the selected date range
    fromDate && toDate
      ? prisma.booking.findMany({
          where: {
            carId,
            paymentStatus: "PAID",
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
            AND: [
              { startDate: { lt: new Date(`${toDate}T23:59:59.999Z`) } },
              { endDate: { gt: new Date(`${fromDate}T00:00:00.000Z`) } },
            ],
          },
          select: { type: true, startDate: true, endDate: true },
        })
      : Promise.resolve([]),
  ]);

  // Derive effective unavailability rules across types with better NIGHT handling
  const effectiveUnavailable = new Set<string>();
  if (fromDate && toDate) {
    // Base taken set by type (for DAY and FULL_DAY inference)
    const takenBookingTypes = new Set(overlappingBookings.map((b) => b.type));
    if (takenBookingTypes.has("DAY")) {
      effectiveUnavailable.add("DAY");
      effectiveUnavailable.add("FULL_DAY");
    }
    if (takenBookingTypes.has("FULL_DAY")) {
      effectiveUnavailable.add("FULL_DAY");
      effectiveUnavailable.add("DAY");
      effectiveUnavailable.add("NIGHT");
    }

    // NIGHT should only be unavailable if it overlaps the specific NIGHT window (23:00 -> 05:00 next day)
    const nightStart = new Date(fromDate);
    nightStart.setHours(23, 0, 0, 0);
    const nightEnd = new Date(toDate);
    nightEnd.setHours(5, 0, 0, 0);

    if (nightEnd <= nightStart) {
      nightEnd.setDate(nightEnd.getDate() + 1);
    }

    const nightBlocked = overlappingBookings.some((b) => {
      return new Date(b.startDate) < nightEnd && new Date(b.endDate) > nightStart;
    });
    if (nightBlocked) {
      effectiveUnavailable.add("NIGHT");
      // Business rule: a night booking on the selected date blocks DAY and FULL_DAY as well
      effectiveUnavailable.add("DAY");
      effectiveUnavailable.add("FULL_DAY");
    }
  }

  if (!car) {
    throw redirect("/");
  }

  // Only check availability if dates are provided
  let isAvailable = true;

  // Only check if we have booking type and time
  if (fromDate && toDate && bookingType && pickupTime) {
    // Parse pickupTime (e.g., "7 AM")
    const [timePart, period] = pickupTime.toUpperCase().split(" ");
    let hour = Number.parseInt(timePart);
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    const startDateTime = new Date(fromDate);
    startDateTime.setHours(bookingType === "NIGHT" ? 23 : hour);
    startDateTime.setMinutes(0, 0, 0);

    const endDateTime = new Date(toDate);
    if (bookingType === "NIGHT") {
      endDateTime.setHours(5, 0, 0, 0);
      // If end time is before or equal to start time, increment to next day
      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }
    } else if (bookingType === "DAY") {
      endDateTime.setHours(startDateTime.getHours() + 12, 0, 0, 0);
    } else if (bookingType === "FULL_DAY") {
      // Calculate based on 24hr blocks
      const daySpan = Math.max(1, differenceInCalendarDays(endDateTime, startDateTime));
      endDateTime.setTime(addHours(startDateTime, 24 * daySpan).getTime());
    }

    isAvailable = await isCarAvailable(carId, startDateTime, endDateTime);
  }

  return {
    car,
    isAvailable,
    unavailableBookingTypes: Array.from(effectiveUnavailable),
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
  const {
    car,
    isAvailable,
    user,
    vatRate,
    platformServiceFeeRate,
    securityDetailRate,
    unavailableBookingTypes,
  } = useLoaderData<typeof loader>();
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
            unavailableBookingTypes={unavailableBookingTypes}
          />
        </div>
      </div>
    </div>
  );
}
