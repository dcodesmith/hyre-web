import type { FieldMetadata } from "@conform-to/react";
import type { Car, User } from "@prisma/client";
import type { PromotionPricingPreview } from "~/types/promotion-pricing";

export type BookingCardProps = {
  readonly car: Car & { fuelUpgradeRate: number | null; pricingIncludesFuel: boolean };
  readonly isAvailable: boolean;
  readonly user: (User & { roles: { name: string }[]; phoneNumber?: string | null }) | null;
  readonly vatRate: number;
  readonly platformServiceFeeRate: number;
  readonly securityDetailRate: number;
  readonly partnerSlug?: string | null;
  readonly promotion?: { label: string; endDate: string } | null;
  readonly originalRates?: {
    dayRate: number;
    nightRate: number;
    fullDayRate: number;
    airportPickupRate: number;
  } | null;
  readonly promotionPricingPreview?: PromotionPricingPreview | null;
};

export interface BookingCredits {
  availableCredits: number;
  totalEarned: number;
  maxCreditsPerBooking: number;
}

export type GuestFieldsData = {
  nameField: FieldMetadata<string>;
  emailField: FieldMetadata<string>;
  phoneNumberField: FieldMetadata<string>;
};
