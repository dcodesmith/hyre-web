export type PromotionPricingSegmentKind = "PROMO" | "STANDARD";

export interface PromotionPricingSegment {
  kind: PromotionPricingSegmentKind;
  units: number;
  unitPrice: number;
  total: number;
  compareAtUnitPrice: number | null;
  label: string | null;
}

export type PromotionDiscountCoverage = "NONE" | "PARTIAL" | "FULL";

export interface PromotionPricingPreview {
  baseTotal: number;
  compareAtBaseTotal: number;
  discountCoverage: PromotionDiscountCoverage;
  segments: PromotionPricingSegment[];
}
