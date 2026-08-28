import type { FleetOwnerPromotion } from "~/api/fleet/promotions/schema";
import { SERVICE_TIMEZONE } from "~/time/timezone";

export type PromotionStatus = "active" | "upcoming" | "expired" | "inactive";

const promotionDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SERVICE_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function getPromotionStatus(
  promotion: Pick<FleetOwnerPromotion, "isActive" | "startDate" | "endDate">,
  now: string,
): PromotionStatus {
  if (!promotion.isActive) {
    return "inactive";
  }

  if (now < promotion.startDate) {
    return "upcoming";
  }

  return now >= promotion.endDate ? "expired" : "active";
}

export function formatPromotionDateRange(
  promotion: Pick<FleetOwnerPromotion, "startDate" | "endDate">,
) {
  const start = new Date(promotion.startDate);
  const inclusiveEnd = new Date(new Date(promotion.endDate).getTime() - 1);

  return promotionDateFormat.formatRange(start, inclusiveEnd);
}
