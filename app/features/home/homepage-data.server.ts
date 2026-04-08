import { CarApprovalStatus, DiscountType, Status } from "@prisma/client";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import {
  type ActivePromotion,
  applyPromotionDiscount,
  getPromotionBadgeLabel,
} from "~/services/promotions.server";
import { getBatchCarRatings } from "~/services/reviews.server";
import type { AggregatedRatings } from "~/services/reviews.server";
import { categorizeCars, emptyCarCategories } from "./homepage.shared";
import type { HomePageCar } from "./homepage.shared";

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
        passengerCapacity: true,
        pricingIncludesFuel: true,
        vehicleType: true,
        serviceTier: true,
        images: { select: { url: true }, orderBy: { createdAt: "asc" }, take: 3 },
      },
      orderBy: [{ updatedAt: "desc" }, { dayRate: "asc" }],
      take: limit,
    });

    const serializedCars = cars.map((car) => ({
      ...car,
      createdAt: car.createdAt.toISOString(),
    }));

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

export interface PromotedCar extends HomePageCar {
  ownerId: string;
  originalDayRate: number;
  promotionLabel: string;
  promotionEndDate: string;
}

export async function getPromotedCars(limit = 12): Promise<{
  cars: PromotedCar[];
  ratings: Record<string, AggregatedRatings>;
}> {
  try {
    const now = new Date();

    const activePromotions = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        owner: { fleetOwnerStatus: "APPROVED", hasOnboarded: true },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activePromotions.length === 0) {
      return { cars: [], ratings: {} };
    }

    const carSpecificIds = activePromotions.filter((p) => p.carId !== null).map((p) => p.carId!);
    const fleetWideOwnerIds = activePromotions
      .filter((p) => p.carId === null)
      .map((p) => p.ownerId);

    const cars = await prisma.car.findMany({
      where: {
        status: { in: [Status.AVAILABLE, Status.BOOKED] },
        approvalStatus: CarApprovalStatus.APPROVED,
        OR: [
          ...(carSpecificIds.length > 0 ? [{ id: { in: carSpecificIds } }] : []),
          ...(fleetWideOwnerIds.length > 0 ? [{ ownerId: { in: fleetWideOwnerIds } }] : []),
        ],
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
      take: limit,
      orderBy: [{ updatedAt: "desc" }],
    });

    const promotedCars: PromotedCar[] = [];
    for (const car of cars) {
      const carSpecific = activePromotions.find(
        (p) => p.carId === car.id && p.ownerId === car.ownerId,
      );
      const fleetWide = activePromotions.find((p) => p.carId === null && p.ownerId === car.ownerId);
      const promo = carSpecific || fleetWide;
      if (!promo) continue;

      const discountedRate = applyPromotionDiscount(car.dayRate, promo as ActivePromotion);
      if (discountedRate >= car.dayRate) continue;

      promotedCars.push({
        ...car,
        createdAt: car.createdAt.toISOString(),
        originalDayRate: car.dayRate,
        dayRate: discountedRate,
        promotionLabel: getPromotionBadgeLabel(promo as ActivePromotion),
        promotionEndDate: promo.endDate.toISOString(),
      });
    }

    let ratings: Record<string, AggregatedRatings> = {};
    try {
      ratings = await getBatchCarRatings(promotedCars.map((c) => c.id));
    } catch {
      // Keep resilient
    }

    return { cars: promotedCars, ratings };
  } catch (error) {
    logger.error(
      "[HOME] Error fetching promoted cars",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { cars: [], ratings: {} };
  }
}
