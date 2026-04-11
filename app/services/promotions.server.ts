import type { Promotion } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { Decimal } from "decimal.js";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { MAX_PROMOTION_PERCENTAGE } from "~/schemas/promotion.schema";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

export type ActivePromotion = Pick<
  Promotion,
  "id" | "name" | "discountValue" | "startDate" | "endDate" | "carId" | "createdAt"
>;

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateCalendarDateInput(dateValue: string, label: string): string {
  if (!CALENDAR_DATE_PATTERN.test(dateValue)) {
    throw new Error(`${label} must be in YYYY-MM-DD format`);
  }
  return dateValue;
}

function addOneDayToCalendarDate(dateValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  utcDate.setUTCDate(utcDate.getUTCDate() + 1);

  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utcDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPromotionSelectionCandidates(
  promotions: ActivePromotion[],
  carId: string,
): ActivePromotion[] {
  const carSpecificPromotions = promotions.filter((promotion) => promotion.carId === carId);
  if (carSpecificPromotions.length > 0) {
    return carSpecificPromotions;
  }
  return promotions.filter((promotion) => promotion.carId === null);
}

function chooseBestPromotionByDiscount(
  candidates: ActivePromotion[],
  baseAmount?: number,
): ActivePromotion | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  if (typeof baseAmount !== "number") {
    return candidates[0];
  }

  return candidates.reduce((best, current) => {
    const bestDiscount = getPromotionDiscountAmount(best, baseAmount);
    const currentDiscount = getPromotionDiscountAmount(current, baseAmount);

    if (currentDiscount.gt(bestDiscount)) return current;
    if (currentDiscount.eq(bestDiscount) && current.createdAt > best.createdAt) return current;
    return best;
  });
}

function intervalOverlaps(
  startA: Date,
  endAExclusive: Date,
  startB: Date,
  endBExclusive: Date,
): boolean {
  return startA < endBExclusive && endAExclusive > startB;
}

/**
 * Converts user-facing inclusive date inputs into persisted promotion bounds.
 * Storage is always [start, endExclusive) in the business timezone.
 */
export function toPromotionWindowExclusive(input: {
  startDate: string;
  endDateInclusive: string;
  timeZone?: string;
}): { startDate: Date; endDate: Date } {
  const timeZone = input.timeZone ?? LAGOS_TIMEZONE;
  const startDate = validateCalendarDateInput(input.startDate, "Start date");
  const endDateInclusive = validateCalendarDateInput(input.endDateInclusive, "End date");
  const endExclusiveDate = addOneDayToCalendarDate(endDateInclusive);

  return {
    startDate: fromZonedTime(`${startDate}T00:00:00`, timeZone),
    endDate: fromZonedTime(`${endExclusiveDate}T00:00:00`, timeZone),
  };
}

export function resolveBestPromotionForInterval(input: {
  promotions: ActivePromotion[];
  carId: string;
  intervalStart: Date;
  intervalEndExclusive: Date;
  baseAmount?: number;
}): ActivePromotion | null {
  const eligiblePromotions = input.promotions.filter((promotion) =>
    intervalOverlaps(
      promotion.startDate,
      promotion.endDate,
      input.intervalStart,
      input.intervalEndExclusive,
    ),
  );

  const candidates = getPromotionSelectionCandidates(eligiblePromotions, input.carId);
  return chooseBestPromotionByDiscount(candidates, input.baseAmount);
}

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
      endDate: { gt: referenceDate },
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

  const candidatePromotions = getPromotionSelectionCandidates(promotions, carId);
  const best = chooseBestPromotionByDiscount(candidatePromotions, baseAmount);

  if (candidatePromotions.length > 1 && typeof baseAmount !== "number") {
    logger.warn("Multiple active promotions in same scope without baseAmount; using newest", {
      ownerId,
      carId,
      promotionIds: candidatePromotions.map((p) => p.id),
    });
  }
  return best;
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
      endDate: { gt: referenceDate },
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
 * Fetch promotions that overlap a booking interval [start, endExclusive).
 */
export async function getOverlappingPromotionsForCar(
  carId: string,
  ownerId: string,
  intervalStart: Date,
  intervalEndExclusive: Date,
): Promise<ActivePromotion[]> {
  if (intervalEndExclusive <= intervalStart) {
    return [];
  }

  return prisma.promotion.findMany({
    where: {
      ownerId,
      isActive: true,
      startDate: { lt: intervalEndExclusive },
      endDate: { gt: intervalStart },
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
    include: {
      car: { select: { id: true, make: true, model: true, year: true, registrationNumber: true } },
    },
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
      startDate: { lt: data.endDate },
      endDate: { gt: data.startDate },
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
