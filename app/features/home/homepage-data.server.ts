import { CarApprovalStatus, Status } from "@prisma/client";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import {
  type ActivePromotion,
  applyPromotionDiscount,
  getActivePromotionsForCars,
  getPromotionBadgeLabel,
} from "~/services/promotions.server";
import { getBatchCarRatings } from "~/services/reviews.server";
import type { AggregatedRatings } from "~/services/reviews.server";
import { categorizeCars, emptyCarCategories } from "./homepage.shared";

export async function getHomePageFleetData(options?: {
  ownerId?: string;
  limit?: number;
  logContext?: string;
}): Promise<{
  categories: ReturnType<typeof categorizeCars>;
  ratings: Record<string, AggregatedRatings>;
}> {
  const ownerId = options?.ownerId;
  const limit = options?.limit ?? 50;
  const logContext = options?.logContext ?? "HOME";

  try {
    const cars = await prisma.car.findMany({
      where: {
        status: { in: [Status.AVAILABLE, Status.BOOKED] },
        approvalStatus: CarApprovalStatus.APPROVED,
        owner: { fleetOwnerStatus: "APPROVED", hasOnboarded: true },
        ...(ownerId ? { ownerId } : {}),
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        createdAt: true,
        dayRate: true,
        ownerId: true,
        passengerCapacity: true,
        pricingIncludesFuel: true,
        vehicleType: true,
        serviceTier: true,
        images: { select: { url: true }, orderBy: { createdAt: "asc" }, take: 3 },
      },
      orderBy: [{ updatedAt: "desc" }, { dayRate: "asc" }],
      take: limit,
    });

    let promoMap = new Map<string, ActivePromotion>();
    try {
      const carsForPromo = cars.map((c) => ({ id: c.id, ownerId: c.ownerId }));
      promoMap = await getActivePromotionsForCars(carsForPromo);
    } catch {
      // Continue without promotions
    }

    const serializedCars = cars.map((car) => {
      const promo = promoMap.get(car.id);
      if (!promo) {
        return { ...car, createdAt: car.createdAt.toISOString() };
      }
      const discountedRate = applyPromotionDiscount(car.dayRate, promo);
      return {
        ...car,
        createdAt: car.createdAt.toISOString(),
        isOnPromotion: true,
        originalDayRate: car.dayRate,
        dayRate: discountedRate,
        promotionLabel: getPromotionBadgeLabel(promo),
      };
    });

    const categories = categorizeCars(serializedCars);

    let ratings: Record<string, AggregatedRatings> = {};
    try {
      ratings = await getBatchCarRatings(cars.map((car) => car.id));
    } catch {
      // Keep page render resilient when ratings fail.
    }

    return { categories, ratings };
  } catch (error) {
    logger.error(
      `[${logContext}] Error fetching homepage fleet data`,
      error instanceof Error ? error.message : "Unknown error",
    );
    return {
      categories: emptyCarCategories(),
      ratings: {},
    };
  }
}

