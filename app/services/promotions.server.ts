import type { Promotion } from "@prisma/client";
import { Decimal } from "decimal.js";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { MAX_PROMOTION_PERCENTAGE } from "~/schemas/promotion.schema";

export type ActivePromotion = Pick<
  Promotion,
  "id" | "name" | "discountValue" | "startDate" | "endDate" | "carId" | "createdAt"
>;

function getPromotionDiscountAmount(promotion: ActivePromotion, baseAmount: number): Decimal {
  const value = new Decimal(promotion.discountValue.toString());
  return new Decimal(baseAmount).mul(value).div(100);
}

/**
 * Find the best active promotion for a car at a given point in time.
 * Car-specific promotions take priority over fleet-wide (carId=null) ones.
 * Among same-scope promotions, the one with the highest effective discount wins.
 * If no baseAmount is provided, falls back to most recently created.
 */
export async function getActivePromotionForCar(
  carId: string,
  ownerId: string,
  referenceDate: Date = new Date(),
  baseAmount?: number,
): Promise<ActivePromotion | null> {
  const promotions = await prisma.promotion.findMany({
    where: {
      ownerId,
      isActive: true,
      startDate: { lte: referenceDate },
      endDate: { gte: referenceDate },
      OR: [{ carId }, { carId: null }],
    },
    select: {
      id: true,
      name: true,
      discountValue: true,
      startDate: true,
      endDate: true,
      carId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (promotions.length === 0) return null;

  const sameScopePromotions = promotions.filter((p) => p.carId === carId);
  const candidatePromotions =
    sameScopePromotions.length > 0
      ? sameScopePromotions
      : promotions.filter((p) => p.carId === null);

  if (candidatePromotions.length === 0) return null;
  if (candidatePromotions.length === 1) return candidatePromotions[0];

  if (typeof baseAmount !== "number") {
    logger.warn("Multiple active promotions in same scope without baseAmount; using newest", {
      ownerId,
      carId,
      promotionIds: candidatePromotions.map((p) => p.id),
    });
    return candidatePromotions[0];
  }

  return candidatePromotions.reduce((best, current) => {
    const bestDiscount = getPromotionDiscountAmount(best, baseAmount);
    const currentDiscount = getPromotionDiscountAmount(current, baseAmount);

    if (currentDiscount.gt(bestDiscount)) return current;
    if (currentDiscount.eq(bestDiscount) && current.createdAt > best.createdAt) return current;
    return best;
  });
}

/**
 * Apply a percentage promotion discount to an original rate.
 * Returns the discounted rate, clamped to a minimum of 1 (smallest currency
 * unit) so no rate ever reaches zero — a zero-rate booking would break
 * platform fee and payout calculations.
 */
export function applyPromotionDiscount(originalRate: number, promotion: ActivePromotion): number {
  const value = new Decimal(promotion.discountValue.toString());
  const discount = new Decimal(originalRate).mul(value).div(100);
  return Math.max(1, new Decimal(originalRate).minus(discount).toNumber());
}

/**
 * Given a car's rate fields and a promotion, return all rates with the discount applied.
 */
export function getDiscountedCarRates(
  car: {
    dayRate: number;
    nightRate: number;
    hourlyRate: number;
    fullDayRate: number;
    airportPickupRate: number;
  },
  promotion: ActivePromotion,
) {
  return {
    dayRate: applyPromotionDiscount(car.dayRate, promotion),
    nightRate: applyPromotionDiscount(car.nightRate, promotion),
    hourlyRate: applyPromotionDiscount(car.hourlyRate, promotion),
    fullDayRate: applyPromotionDiscount(car.fullDayRate, promotion),
    airportPickupRate: applyPromotionDiscount(car.airportPickupRate, promotion),
  };
}

/**
 * Batch-fetch active promotions for multiple cars across owners.
 * Returns a map of carId -> ActivePromotion.
 * Only fetches promotions that target the requested cars or are fleet-wide.
 */
export async function getActivePromotionsForCars(
  cars: { id: string; ownerId: string }[],
  referenceDate: Date = new Date(),
): Promise<Map<string, ActivePromotion>> {
  if (cars.length === 0) return new Map();

  const ownerIds = [...new Set(cars.map((c) => c.ownerId))];
  const carIds = cars.map((c) => c.id);

  const promotions = await prisma.promotion.findMany({
    where: {
      ownerId: { in: ownerIds },
      isActive: true,
      startDate: { lte: referenceDate },
      endDate: { gte: referenceDate },
      OR: [{ carId: { in: carIds } }, { carId: null }],
    },
    select: {
      id: true,
      name: true,
      discountValue: true,
      startDate: true,
      endDate: true,
      carId: true,
      ownerId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Build lookup: ownerId -> (carId | "fleet") -> promotion
  // Only keeps the first (newest) per scope since results are ordered by createdAt desc
  const lookup = new Map<string, Map<string, ActivePromotion>>();
  for (const p of promotions) {
    let ownerMap = lookup.get(p.ownerId);
    if (!ownerMap) {
      ownerMap = new Map();
      lookup.set(p.ownerId, ownerMap);
    }
    const key = p.carId ?? "fleet";
    if (!ownerMap.has(key)) {
      ownerMap.set(key, p);
    }
  }

  const result = new Map<string, ActivePromotion>();

  for (const car of cars) {
    const ownerMap = lookup.get(car.ownerId);
    if (!ownerMap) continue;

    const carSpecific = ownerMap.get(car.id);
    if (carSpecific) {
      result.set(car.id, carSpecific);
      continue;
    }

    const fleetWide = ownerMap.get("fleet");
    if (fleetWide) {
      result.set(car.id, fleetWide);
    }
  }

  return result;
}

/**
 * Compute the display-friendly promotion label for a car card badge.
 * e.g. "20% OFF"
 */
export function getPromotionBadgeLabel(promotion: ActivePromotion): string {
  const value = new Decimal(promotion.discountValue.toString());
  return `${value.toNumber()}% OFF`;
}

/**
 * Fetch all promotions for an owner (for the fleet-owner dashboard).
 */
export async function getOwnerPromotions(ownerId: string) {
  return prisma.promotion.findMany({
    where: { ownerId },
    include: { car: { select: { id: true, make: true, model: true, year: true } } },
    orderBy: [{ isActive: "desc" }, { endDate: "desc" }],
  });
}

/**
 * Create a new promotion. If carId is null, it applies to all of the owner's fleet.
 */
export async function createPromotion(data: {
  ownerId: string;
  carId?: string | null;
  name?: string;
  discountValue: number;
  startDate: Date;
  endDate: Date;
}) {
  if (data.discountValue <= 0) {
    throw new Error("Discount value must be positive");
  }
  if (data.discountValue > MAX_PROMOTION_PERCENTAGE) {
    throw new Error(`Discount cannot exceed ${MAX_PROMOTION_PERCENTAGE}%`);
  }
  if (data.endDate <= data.startDate) {
    throw new Error("End date must be after start date");
  }

  if (data.carId) {
    const car = await prisma.car.findFirst({
      where: { id: data.carId, ownerId: data.ownerId },
      select: { id: true },
    });
    if (!car) {
      throw new Error("Car not found for owner");
    }
  }

  // Same-scope overlap check only. Car-specific promos override fleet-wide
  // at resolution time, so cross-scope overlaps are intentionally allowed.
  const conflictingPromotion = await prisma.promotion.findFirst({
    where: {
      ownerId: data.ownerId,
      isActive: true,
      startDate: { lte: data.endDate },
      endDate: { gte: data.startDate },
      carId: data.carId ?? null,
    },
    select: { id: true, carId: true, startDate: true, endDate: true },
  });

  if (conflictingPromotion) {
    throw new Error(
      "An overlapping promotion already exists for this scope. Deactivate or reschedule it first.",
    );
  }

  const promotion = await prisma.promotion.create({
    data: {
      ownerId: data.ownerId,
      carId: data.carId ?? null,
      name: data.name,
      discountValue: data.discountValue,
      startDate: data.startDate,
      endDate: data.endDate,
    },
  });

  logger.info("Promotion created", {
    promotionId: promotion.id,
    ownerId: data.ownerId,
    carId: data.carId,
    discountPercent: data.discountValue,
  });

  return promotion;
}

/**
 * Deactivate a promotion (soft-disable rather than delete).
 */
export async function deactivatePromotion(promotionId: string, ownerId: string) {
  return prisma.promotion.update({
    where: { id: promotionId, ownerId },
    data: { isActive: false },
  });
}
