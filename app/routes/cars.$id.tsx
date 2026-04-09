import {
  ArrowLeftIcon,
  SparklesIcon,
  UserIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { Booking, BookingStatus, BookingType, Car } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { useState } from "react";
import {
  ActionFunctionArgs,
  Link,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
  useLoaderData,
} from "react-router";
import invariant from "tiny-invariant";
import CarCarousel from "~/components/Carousel";
import BookingCard from "~/components/booking/BookingCard";
import { ReviewList } from "~/components/reviews/ReviewList";
import { StarRating } from "~/components/reviews/StarRating";
import { BreadcrumbSchema, VehicleSchema } from "~/components/seo/StructuredData";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import logger from "~/lib/logger.server";
import { getSessionUser, requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { availableCarsForSpecificRequest } from "~/services/availability-engine.server";
import { getRates } from "~/services/extensions.server";
import {
  getActivePromotionForCar,
  getDiscountedCarRates,
  getPromotionBadgeLabel,
  type ActivePromotion,
} from "~/services/promotions.server";
import type { AggregatedRatings } from "~/services/reviews.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { formatRating } from "~/utils/review-formatting";
import {
  extractCarIdFromSlug,
  generateCarSlug,
  generateMetaTags,
  getVehicleKeywords,
} from "~/utils/seo";
import { env } from "~/utils/server/env.server";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

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
  const partnerPrefix = params.slug ? `/partners/${params.slug}` : "";
  await requireUser(request, {
    redirectTo: `/auth?redirectTo=${partnerPrefix}/cars/${params.id}`,
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

function buildSearchBackLink(url: URL, partnerSlug?: string): string {
  const allowedParams = [
    "q",
    "serviceTier",
    "vehicleType",
    "color",
    "make",
    "model",
    "from",
    "to",
    "bookingType",
    "pickupTime",
    "flightNumber",
    "page",
  ];
  const backParams = new URLSearchParams();
  for (const key of allowedParams) {
    const value = url.searchParams.get(key);
    if (value) {
      backParams.set(key, value);
    }
  }
  const query = backParams.toString();
  const baseSearchPath = partnerSlug ? `/partners/${partnerSlug}/search` : "/search";
  return query ? `${baseSearchPath}?${query}` : baseSearchPath;
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
  const partnerSlug = params.slug;
  const url = new URL(request.url);

  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");
  const bookingType = url.searchParams.get("bookingType");
  const pickupTime = url.searchParams.get("pickupTime");
  const flightNumber = url.searchParams.get("flightNumber");
  const backToSearch = buildSearchBackLink(url, partnerSlug);

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
    const carBasePath = partnerSlug ? `/partners/${partnerSlug}/cars` : "/cars";
    const redirectUrl = `${carBasePath}/${canonicalSlug}${queryString}`;
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
  let subRatings: { car: number; chauffeur: number | null; service: number } = {
    car: 0,
    chauffeur: null,
    service: 0,
  };
  try {
    const subRatingRows = await prisma.review.findMany({
      where: { isVisible: true, booking: { carId: car.id } },
      select: { carRating: true, chauffeurRating: true, serviceRating: true },
    });
    if (subRatingRows.length > 0) {
      const avg = (vals: number[]) =>
        Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
      const overallRatings = subRatingRows.map((row) => {
        const values = [row.carRating, row.serviceRating];
        if (row.chauffeurRating != null) values.push(row.chauffeurRating);
        return values.reduce((sum, value) => sum + value, 0) / values.length;
      });
      const ratingDistribution: AggregatedRatings["ratingDistribution"] = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };
      for (const overallScore of overallRatings) {
        const bucket = Math.max(1, Math.min(5, Math.round(overallScore))) as 1 | 2 | 3 | 4 | 5;
        ratingDistribution[bucket] += 1;
      }

      const chauffeurRatings = subRatingRows
        .map((r) => r.chauffeurRating)
        .filter((value): value is number => value != null);

      ratings = {
        averageRating: avg(overallRatings),
        totalReviews: subRatingRows.length,
        ratingDistribution,
      };
      subRatings = {
        car: avg(subRatingRows.map((r) => r.carRating)),
        chauffeur: chauffeurRatings.length > 0 ? avg(chauffeurRatings) : null,
        service: avg(subRatingRows.map((r) => r.serviceRating)),
      };
    }
  } catch (error) {
    logger.error("[CAR_DETAILS] Error fetching car ratings", {
      carId: car.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Continue with empty ratings - page can still render
  }

  // Fetch active promotion and apply discounted rates
  let promotion: { label: string; endDate: string } | null = null;
  let originalRates: { dayRate: number; nightRate: number; fullDayRate: number; airportPickupRate: number } | null = null;
  let effectiveCar = car;

  try {
    const activePromo = await getActivePromotionForCar(car.id, car.ownerId);
    if (activePromo) {
      const discounted = getDiscountedCarRates(car, activePromo);
      originalRates = {
        dayRate: car.dayRate,
        nightRate: car.nightRate,
        fullDayRate: car.fullDayRate,
        airportPickupRate: car.airportPickupRate,
      };
      effectiveCar = { ...car, ...discounted };
      promotion = {
        label: getPromotionBadgeLabel(activePromo),
        endDate: activePromo.endDate.toISOString(),
      };
    }
  } catch (error) {
    logger.error("[CAR_DETAILS] Error fetching promotion", {
      carId: car.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return {
    car: effectiveCar,
    isAvailable,
    partnerSlug: partnerSlug ?? null,
    backToSearch,
    ratings,
    subRatings,
    promotion,
    originalRates,
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
  const partnerPrefix = data?.partnerSlug ? `/partners/${data.partnerSlug}` : "";
  // Use SEO-friendly slug for canonical URL
  const slug = generateCarSlug({ id: car.id, make: car.make, model: car.model, year: car.year });
  const carUrl = `${baseUrl}${partnerPrefix}/cars/${slug}`;
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
  const {
    car,
    isAvailable,
    partnerSlug,
    backToSearch,
    ratings,
    subRatings,
    promotion,
    originalRates,
    user,
    vatRate,
    platformServiceFeeRate,
    securityDetailRate,
  } = useLoaderData<typeof loader>();
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);

  const carWithDates = {
    ...car,
    createdAt: new Date(car.createdAt),
    updatedAt: new Date(car.updatedAt),
  };

  const carImages = car.images.length > 0 ? car.images.map(({ url }) => url) : undefined;
  const roundedRating = formatRating(ratings.averageRating);
  const ratingBreakdown = [5, 4, 3, 2, 1].map((stars) => {
    const count = ratings.ratingDistribution[stars as keyof typeof ratings.ratingDistribution] ?? 0;
    const percentage = ratings.totalReviews > 0 ? (count / ratings.totalReviews) * 100 : 0;
    return { stars, count, percentage };
  });

  // SEO structured data
  const baseUrl = "https://tripdly.com";
  const partnerPrefix = partnerSlug ? `/partners/${partnerSlug}` : "";
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
          url: `${baseUrl}${partnerPrefix}/cars/${carSlug}`,
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
            { name: "Search", url: `${baseUrl}${partnerPrefix}/search` },
            { name: carName, url: `${baseUrl}${partnerPrefix}/cars/${carSlug}` },
          ],
        }}
      />
      <div className="lg:hidden bg-white">
        <div className="relative">
          <CarCarousel variant="booking" images={carImages} priority carName={carName} />
          <Link
            to={backToSearch}
            className="absolute top-4 left-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            aria-label="Back to search results"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
        </div>
        {ratings.totalReviews > 0 && (
          <button
            type="button"
            className="w-full pt-4 pb-2 px-4 flex items-center justify-center gap-6"
            onClick={() => setIsReviewsOpen(true)}
          >
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-900 leading-none">{roundedRating}</span>
              <StarRating rating={ratings.averageRating} size="sm" />
            </div>
            <div className="w-px h-8 bg-gray-300" />
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-900 leading-none">{ratings.totalReviews}</span>
              <span className="text-sm text-gray-800 leading-none">
                {ratings.totalReviews === 1 ? "Review" : "Reviews"}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Desktop: Back link and title */}
      <div className="hidden lg:block">
        <Link to={backToSearch} className="hover:underline mb-1 block">
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
            {ratings.totalReviews > 0 && (
              <div className="mt-2 flex items-center gap-2 text-base text-gray-900">
                <span className="text-gray-900">&#9733;</span>
                <span className="font-semibold">{roundedRating}</span>
                <span className="text-gray-400">&middot;</span>
                <button
                  type="button"
                  className="underline underline-offset-2 hover:no-underline"
                  onClick={() => setIsReviewsOpen(true)}
                >
                  {ratings.totalReviews} {ratings.totalReviews === 1 ? "review" : "reviews"}
                </button>
              </div>
            )}
          </div>

          {/* Car details - accordion on mobile, regular on desktop */}
          <div className="px-4 lg:px-0">
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
            partnerSlug={partnerSlug}
            promotion={promotion}
            originalRates={originalRates}
          />
        </div>
      </div>

      {ratings.totalReviews > 0 && (
        <Sheet open={isReviewsOpen} onOpenChange={setIsReviewsOpen}>
          <SheetContent
            side="bottom"
            className="h-[92vh] max-h-[92vh] w-full overflow-y-auto rounded-t-3xl px-4 sm:px-6 lg:px-8"
          >
            <div className="mx-auto w-full max-w-5xl py-4 sm:py-6">
              {/* Mobile: stacked header then reviews. Desktop: two-column */}
              <div className="lg:grid lg:grid-cols-[280px,1fr] lg:gap-12">
                {/* Left panel (desktop) / Top section (mobile) */}
                <div className="mb-2 lg:mb-0">
                  {(() => {
                    const categoryRatings = [
                      {
                        label: "Vehicle quality",
                        value: subRatings.car,
                        Icon: WrenchScrewdriverIcon,
                      },
                      { label: "Driver quality", value: subRatings.chauffeur, Icon: UserIcon },
                      { label: "Service quality", value: subRatings.service, Icon: SparklesIcon },
                    ];
                    return (
                      <>
                        {/* Star + rating */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xl">&#9733;</span>
                          <span className="text-xl font-medium">{roundedRating}</span>
                        </div>

                        {/* Mobile: one horizontal strip (overall + categories) */}
                        <div className="-mx-4 mb-2 px-4 overflow-x-auto lg:hidden bg-gray-50 border-b scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none]">
                          <div className="inline-flex w-max items-stretch">
                            <div className="shrink-0 py-4 pr-4 border-r border-gray-200">
                              <p className="text-xs font-semibold text-gray-900 mb-3">
                                Overall rating
                              </p>
                              <div className="flex flex-col gap-1">
                                {ratingBreakdown.map(({ stars, percentage }) => (
                                  <div key={stars} className="flex items-center gap-2">
                                    <span className="w-3 text-xs leading-none text-gray-700">
                                      {stars}
                                    </span>
                                    <div className="h-1 w-40 rounded-full bg-gray-200 overflow-hidden">
                                      <div
                                        className="h-full bg-gray-900 transition-all duration-300"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {categoryRatings.map(({ label, value, Icon }) => (
                              <div
                                key={label}
                                className="shrink-0 px-4 py-4 border-r border-gray-200 last:border-r-0 flex flex-col justify-between"
                              >
                                <div className="flex flex-col">
                                  <p className="text-xs font-semibold text-gray-900 mb-2">
                                    {label}
                                  </p>
                                  <p className="text-xs leading-none font-semibold text-gray-900 mb-3">
                                    {value != null && value > 0 ? formatRating(value) : "—"}
                                  </p>
                                </div>

                                <Icon className="h-8 w-8 text-gray-700" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Desktop overall rating bars */}
                        <p className="hidden lg:block text-base font-semibold text-gray-900 mb-3">
                          Overall rating
                        </p>
                        <div className="hidden lg:flex lg:flex-col lg:gap-2 lg:mb-6">
                          {ratingBreakdown.map(({ stars, count, percentage }) => (
                            <div key={stars} className="flex items-center gap-3">
                              <span className="w-3 text-sm text-gray-700">{stars}</span>
                              <div className="h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
                                <div
                                  className="h-full bg-gray-900 transition-all duration-300"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="w-6 text-right text-sm text-gray-600">{count}</span>
                            </div>
                          ))}
                        </div>

                        {/* Desktop: stacked category rows on the left */}
                        <div className="hidden lg:block border-t border-gray-200">
                          {categoryRatings.map(({ label, value, Icon }) => (
                            <div
                              key={label}
                              className="flex items-center justify-between border-b border-gray-200 py-4"
                            >
                              <div className="flex items-center gap-3">
                                <Icon className="h-5 w-5 text-gray-700" />
                                <span className="text-[15px] font-medium text-gray-900">
                                  {label}
                                </span>
                              </div>
                              <span className="text-[15px] font-semibold text-gray-900">
                                {value != null && value > 0 ? formatRating(value) : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Right: reviews list */}
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">
                    {ratings.totalReviews} {ratings.totalReviews === 1 ? "review" : "reviews"}
                  </h3>
                  <ReviewList endpoint={`/api/reviews/car/${car.id}`} />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
