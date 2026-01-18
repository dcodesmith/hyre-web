import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Booking, BookingStatus, BookingType, Car } from "@prisma/client";
import { ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, redirect, useLoaderData, useSearchParams } from "@remix-run/react";
import { fromZonedTime } from "date-fns-tz";
import invariant from "tiny-invariant";
import CarCarousel from "~/components/Carousel";
import BookingCard from "~/components/booking/BookingCard";
import { VehicleSchema, BreadcrumbSchema } from "~/components/seo/StructuredData";
import { RatingSummary } from "~/components/reviews/RatingSummary";
import { ReviewCarousel } from "~/components/reviews/ReviewCarousel";
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
import { getCarRatings } from "~/services/reviews.server";
import type { AggregatedRatings } from "~/services/reviews.server";
import {
  getVehicleKeywords,
  generateCarSlug,
  extractCarIdFromSlug,
  generateMetaTags,
} from "~/utils/seo";
import { LAGOS_TIMEZONE } from "~/utils/timezone";
import { validateCSRF } from "~/utils/csrf-action.server";
import { env } from "~/utils/server/env.server";

/** Find a car by slug or full ID */
async function findCarBySlugOrId(slugOrId: string) {
  // First, check if it's a full CUID
  if (/^c[a-z0-9]{24}$/i.test(slugOrId)) {
    return prisma.car.findUnique({
      where: { id: slugOrId },
      include: { images: { select: { url: true } } },
    });
  }

  // Extract the short ID from the slug
  const shortId = extractCarIdFromSlug(slugOrId);
  if (!shortId) {
    return null;
  }

  // Find car where ID starts with the short ID
  const car = await prisma.car.findFirst({
    where: { id: { startsWith: shortId } },
    include: { images: { select: { url: true } } },
  });

  return car;
}

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);

  // Use the slug as-is for the redirect (it will be resolved in loader)
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
  const slugOrId = params.id;
  const url = new URL(request.url);

  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");
  const bookingType = url.searchParams.get("bookingType");
  const pickupTime = url.searchParams.get("pickupTime");
  const flightNumber = url.searchParams.get("flightNumber");

  // Run all independent queries in parallel for better performance
  const [user, car, rates] = await Promise.all([
    getSessionUser(request),
    findCarBySlugOrId(slugOrId),
    getRates(),
  ]);

  if (!car) {
    throw redirect("/");
  }

  // Generate the canonical slug for this car
  const canonicalSlug = generateCarSlug(car);

  // If accessed via raw ID or wrong slug, redirect to canonical slug URL (301 for SEO)
  if (slugOrId !== canonicalSlug) {
    const searchParams = url.searchParams.toString();
    const queryString = searchParams ? `?${searchParams}` : "";
    const redirectUrl = `/cars/${canonicalSlug}${queryString}`;
    throw redirect(redirectUrl, 301);
  }

  // Check availability only when all required parameters are present
  const isAvailable = await checkCarAvailability(car.id, {
    fromDate,
    toDate,
    bookingType,
    pickupTime,
    flightNumber,
  });

  // Fetch car ratings with error handling
  let ratings: AggregatedRatings = {
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
  try {
    ratings = await getCarRatings(car.id);
  } catch (error) {
    logger.error("[CAR_DETAILS] Error fetching car ratings", {
      carId: car.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Continue with empty ratings - page can still render
  }

  return {
    car,
    isAvailable,
    ratings,
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
    ENV: {
      DOMAIN: env.DOMAIN,
    },
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.car) {
    return [
      { title: "Car Not Found - Tripdly" },
      { name: "description", content: "The requested car could not be found." },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }

  const { car } = data;
  const carName = `${car.make} ${car.model} ${car.year}`;
  const price = `₦${Number(car.dayRate).toLocaleString()}`;
  const baseUrl = data?.ENV?.DOMAIN ?? "http://localhost:5173";
  // Use SEO-friendly slug for canonical URL
  const slug = generateCarSlug({ id: car.id, make: car.make, model: car.model, year: car.year });
  const carUrl = `${baseUrl}/cars/${slug}`;
  const imageUrl = car.images?.[0]?.url || `${baseUrl}/og-image.jpg`;

  const title = `${carName} in Lagos, Nigeria - Book Now | Tripdly`;
  const description = `Book ${carName} with professional chauffeur service in Lagos, Nigeria. ${car.color} ${car.vehicleType} available for day trips, airport pickups, and special events. Starting from ${price} per day. Safe, reliable, and exceptional service. Instant booking & secure payment.`;
  const keywords = getVehicleKeywords(car.make, car.model, car.vehicleType);

  return generateMetaTags({
    title,
    description,
    url: carUrl,
    image: imageUrl,
    type: "website",
    keywords,
    canonical: carUrl,
  });
};

export default function CarDetails() {
  const { car, isAvailable, ratings, user, vatRate, platformServiceFeeRate, securityDetailRate } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const carWithDates = {
    ...car,
    createdAt: new Date(car.createdAt),
    updatedAt: new Date(car.updatedAt),
  };

  const carImages = car.images.length > 0 ? car.images.map(({ url }) => url) : undefined;

  // SEO structured data
  const baseUrl = "https://tripdly.com";
  const carName = `${car.year} ${car.make} ${car.model}`;
  const carSlug = generateCarSlug(car);

  return (
    <div className="lg:max-w-6xl lg:space-y-4 lg:mx-auto">
      {/* Structured Data for SEO */}
      <VehicleSchema
        data={{
          name: carName,
          description: `Book a ${car.color} ${carName} with professional chauffeur service in Nigeria. ${car.vehicleType} with ${car.passengerCapacity} passenger capacity.`,
          image: car.images?.[0]?.url || `${baseUrl}/og-image.jpg`,
          url: `${baseUrl}/cars/${carSlug}`,
          brand: car.make,
          model: car.model,
          year: car.year,
          color: car.color,
          seatingCapacity: car.passengerCapacity,
          vehicleType: car.vehicleType,
          offers: {
            price: car.dayRate,
            priceCurrency: "NGN",
            availability: car.status === "AVAILABLE" ? "InStock" : "OutOfStock",
          },
        }}
      />
      <BreadcrumbSchema
        data={{
          items: [
            { name: "Home", url: baseUrl },
            { name: "Search", url: `${baseUrl}/search` },
            { name: carName, url: `${baseUrl}/cars/${carSlug}` },
          ],
        }}
      />
      <div className="lg:hidden bg-white">
        <div className="relative">
          <CarCarousel variant="booking" images={carImages} priority carName={carName} />
          <Link
            to={`/search?${searchParams.toString()}`}
            className="absolute top-4 left-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            aria-label="Back to search results"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Desktop: Back link and title */}
      <div className="hidden lg:block">
        <Link to={`/search?${searchParams.toString()}`} className="hover:underline mb-1 block">
          &larr; Back to search results
        </Link>
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">
          {car.make} {car.model} - {car.year}
        </h2>
      </div>

      {/* Main content grid */}
      <div className="lg:grid lg:grid-cols-[60%,40%] lg:gap-4">
        {/* Left column: Carousel and car details */}
        <div className="flex flex-col gap-4">
          {/* Desktop carousel */}
          <div className="hidden lg:block">
            <CarCarousel variant="booking" images={carImages} priority carName={carName} />
          </div>

          {/* Car details - accordion on mobile, regular on desktop */}
          <div className="px-4 lg:px-0">
            {/* Ratings Summary - Mobile */}
            {ratings.totalReviews > 0 && (
              <div className="mb-4 lg:hidden">
                <RatingSummary ratings={ratings} showDistribution={false} />
              </div>
            )}

            <Accordion type="single" collapsible className="w-full lg:hidden">
              <AccordionItem value="car-details" className="border-none">
                <AccordionTrigger className="text-sm font-semibold leading-7 text-gray-900 border-none py-2">
                  Car information and features
                </AccordionTrigger>
                <AccordionContent className="border-none px-4">
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

            {/* Desktop car details */}
            <div className="hidden lg:block">
              {/* Ratings Summary */}
              {ratings.totalReviews > 0 && (
                <div className="mb-6">
                  <RatingSummary ratings={ratings} showDistribution={true} />
                </div>
              )}

              <h3 className="text-base font-semibold leading-7 text-gray-900">
                Car information and features
              </h3>
              <div className="mt-4 border-t border-gray-100">
                <dl>
                  <div className="py-2 grid grid-cols-3 gap-4 px-0">
                    <dt className="text-sm font-medium leading-6 text-gray-900">Make & Model</dt>
                    <dd className="text-sm leading-6 text-gray-700 col-span-2">
                      {car.make} {car.model} {car.year}
                    </dd>
                  </div>
                  <div className="py-2 grid grid-cols-3 gap-4 px-0">
                    <dt className="text-sm font-medium leading-6 text-gray-900">Features</dt>
                    <dd className="text-sm leading-6 text-gray-700 col-span-2">
                      Air conditioning, GPS navigation system, Bluetooth connectivity, Cruise
                      control, Rear-view camera, USB ports
                    </dd>
                  </div>
                  <div className="py-2 grid grid-cols-3 gap-4">
                    <dt className="text-sm font-medium leading-6 text-gray-900">
                      Transmission Type
                    </dt>
                    <dd className="text-sm leading-6 text-gray-700 col-span-2">Automatic</dd>
                  </div>
                  <div className="py-2 grid grid-cols-3 gap-4">
                    <dt className="text-sm font-medium leading-6 text-gray-900">
                      Seating Capacity
                    </dt>
                    <dd className="text-sm leading-6 text-gray-700 col-span-2">7-seater</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Reviews Carousel - Visible on all screen sizes */}
            {ratings.totalReviews > 0 && (
              <div className="mt-8">
                <ReviewCarousel
                  endpoint={`/api/reviews/car/${car.id}`}
                  title="Reviews"
                  limit={10}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right column: Booking form - single instance */}
        <div className="px-4 lg:px-0 lg:sticky lg:top-4">
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
  );
}
