import type {
  PromotionDiscountCoverage,
  PromotionPricingPreview,
  PromotionPricingSegment,
} from "~/types/promotion-pricing";

type PromotionLegSummaryInput = {
  basePrice: number;
  finalPrice: number;
  promotion: {
    id: string;
    discountValue: number | string;
    name?: string | null;
  } | null;
};

function formatPromotionLabel(
  promotion: NonNullable<PromotionLegSummaryInput["promotion"]>,
): string {
  if (promotion.name?.trim()) {
    return promotion.name.trim();
  }
  const discount = Number(promotion.discountValue);
  const value = Number.isInteger(discount) ? discount.toString() : discount.toString();
  return `${value}% OFF`;
}

function createSegmentKey(input: PromotionLegSummaryInput): string {
  if (input.promotion) {
    return `promo:${input.promotion.id}:${input.basePrice}:${input.finalPrice}`;
  }
  return `standard:${input.basePrice}`;
}

function computeCoverage({
  discountedUnits,
  totalUnits,
}: {
  discountedUnits: number;
  totalUnits: number;
}): PromotionDiscountCoverage {
  if (discountedUnits === 0) return "NONE";
  if (discountedUnits === totalUnits) return "FULL";
  return "PARTIAL";
}

/**
 * Builds a UI-friendly pricing preview from per-leg promo pricing.
 * Produces split rows so partial-overlap discounts are transparent to customers.
 */
export function summarizePromotionPricingLegs(
  legs: PromotionLegSummaryInput[],
): PromotionPricingPreview {
  if (legs.length === 0) {
    return {
      baseTotal: 0,
      compareAtBaseTotal: 0,
      discountCoverage: "NONE",
      segments: [],
    };
  }

  const segmentsByKey = new Map<string, PromotionPricingSegment>();
  let baseTotal = 0;
  let compareAtBaseTotal = 0;
  let discountedUnits = 0;

  for (const leg of legs) {
    baseTotal += leg.finalPrice;
    compareAtBaseTotal += leg.basePrice;

    if (leg.promotion) {
      discountedUnits += 1;
    }

    const key = createSegmentKey(leg);
    const existing = segmentsByKey.get(key);

    if (existing) {
      existing.units += 1;
      existing.total += leg.finalPrice;
      continue;
    }

    segmentsByKey.set(key, {
      kind: leg.promotion ? "PROMO" : "STANDARD",
      units: 1,
      unitPrice: leg.finalPrice,
      total: leg.finalPrice,
      compareAtUnitPrice: leg.promotion ? leg.basePrice : null,
      label: leg.promotion ? formatPromotionLabel(leg.promotion) : null,
    });
  }

  const segments = [...segmentsByKey.values()].sort((a, b) => {
    if (a.kind === b.kind) return 0;
    return a.kind === "PROMO" ? -1 : 1;
  });

  return {
    baseTotal,
    compareAtBaseTotal,
    discountCoverage: computeCoverage({ discountedUnits, totalUnits: legs.length }),
    segments,
  };
}
