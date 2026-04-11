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
import BookingCard from "~/components/booking/BookingCard";
import { CarDetailsMobileHero } from "~/components/car/CarDetailsMobileHero";
import { CarInformationFeatures } from "~/components/car/CarInformationFeatures";
import { CarReviewsSheet } from "~/components/car/CarReviewsSheet";
import { BreadcrumbSchema, VehicleSchema } from "~/components/seo/StructuredData";
import CarCarousel from "~/components/Carousel";
import logger from "~/lib/logger.server";
import { summarizePromotionPricingLegs } from "~/lib/promotion-pricing-preview";
import { getSessionUser, requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { availableCarsForSpecificRequest } from "~/services/availability-engine.server";
import {
  calculateRegularBookingTimes,
  resolvePromotionReferenceDate,
} from "~/services/booking-start-datetime.server";
import { calculatePromotionalLegPricing } from "~/services/bookings.server";
import { getRates } from "~/services/extensions.server";
import {
  getActivePromotionForCar,
  getDiscountedCarRates,
  getPromotionBadgeLabel,
} from "~/services/promotions.server";
import type { AggregatedRatings } from "~/services/reviews.server";
import type { PromotionPricingPreview } from "~/types/promotion-pricing";
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

function parseBookingType(value: string | null): BookingType | null {
  if (!value) return null;
  return Object.values(BookingType).includes(value as BookingType) ? (value as BookingType) : null;
}

function resolvePricingPreviewWindow(params: {
  fromDate: string | null;
  toDate: string | null;
  bookingType: BookingType | null;
  pickupTime: string | null;
}): { startDate: Date; endDate: Date } | null {
  const { fromDate, toDate, bookingType, pickupTime } = params;
  if (!fromDate || !toDate || !bookingType) return null;
  if (bookingType === BookingType.AIRPORT_PICKUP) return null;

  const effectivePickupTime =
    getEffectivePickupTime(bookingType, pickupTime) ??
    (bookingType === BookingType.DAY || bookingType === BookingType.FULL_DAY ? "8 AM" : null);
  if (!effectivePickupTime) return null;

  const regularTimeResult = calculateRegularBookingTimes(
    effectivePickupTime,
    bookingType,
    fromDate,
    toDate,
  );
  if ("error" in regularTimeResult) return null;

  return {
    startDate: regularTimeResult.startDateTime,
    endDate: regularTimeResult.endDateTime,
  };
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
  let originalRates: {
    dayRate: number;
    nightRate: number;
    fullDayRate: number;
    airportPickupRate: number;
  } | null = null;
  let promotionPricingPreview: PromotionPricingPreview | null = null;
  let effectiveCar = car;
  const selectedBookingType = parseBookingType(bookingType);

  try {
    const previewWindow = resolvePricingPreviewWindow({
      fromDate,
      toDate,
      bookingType: selectedBookingType,
      pickupTime,
    });

    if (previewWindow && selectedBookingType) {
      const pricingForSelection = await calculatePromotionalLegPricing({
        car: {
          dayRate: car.dayRate,
          nightRate: car.nightRate,
          hourlyRate: car.hourlyRate,
          fullDayRate: car.fullDayRate,
          airportPickupRate: car.airportPickupRate,
          id: car.id,
          ownerId: car.ownerId,
        },
        startDate: previewWindow.startDate,
        endDate: previewWindow.endDate,
        type: selectedBookingType,
      });

      promotionPricingPreview = summarizePromotionPricingLegs(
        pricingForSelection.legBreakdown.map((leg) => ({
          basePrice: leg.basePrice,
          finalPrice: leg.finalPrice,
          promotion: leg.promotion
            ? {
                id: leg.promotion.id,
                discountValue: leg.promotion.discountValue.toString(),
                name: leg.promotion.name,
              }
            : null,
        })),
      );

      if (
        promotionPricingPreview.discountCoverage !== "NONE" &&
        pricingForSelection.activePromotion
      ) {
        const activePromo = pricingForSelection.activePromotion;
        originalRates = {
          dayRate: car.dayRate,
          nightRate: car.nightRate,
          fullDayRate: car.fullDayRate,
          airportPickupRate: car.airportPickupRate,
        };
        promotion = {
          label: getPromotionBadgeLabel(activePromo),
          endDate: activePromo.endDate.toISOString(),
        };

        if (promotionPricingPreview.discountCoverage === "FULL") {
          const discounted = getDiscountedCarRates(car, activePromo);
          effectiveCar = { ...car, ...discounted };
        }
      }
    } else {
      const promotionReferenceDate =
        resolvePromotionReferenceDate({
          from: fromDate,
          to: toDate,
          bookingType,
          pickupTime,
          flightNumber,
        }) ?? new Date();

      let baseRateForSelection = car.dayRate;
      if (selectedBookingType === BookingType.NIGHT) baseRateForSelection = car.nightRate;
      else if (selectedBookingType === BookingType.FULL_DAY) baseRateForSelection = car.fullDayRate;
      else if (selectedBookingType === BookingType.AIRPORT_PICKUP) {
        baseRateForSelection = car.airportPickupRate;
      }

      const activePromo = await getActivePromotionForCar(
        car.id,
        car.ownerId,
        promotionReferenceDate,
        baseRateForSelection,
      );
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
    promotionPricingPreview,
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
    promotionPricingPreview,
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
      <CarDetailsMobileHero
        carImages={carImages}
        carName={carName}
        backToSearch={backToSearch}
        ratings={ratings}
        roundedRating={roundedRating}
        onOpenReviews={() => setIsReviewsOpen(true)}
      />

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

          <CarInformationFeatures car={car} />
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
            promotionPricingPreview={promotionPricingPreview}
          />
        </div>
      </div>

      {ratings.totalReviews > 0 && (
        <CarReviewsSheet
          open={isReviewsOpen}
          onOpenChange={setIsReviewsOpen}
          carId={car.id}
          ratings={ratings}
          subRatings={subRatings}
        />
      )}
    </div>
  );
}
