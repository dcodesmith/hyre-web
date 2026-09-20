import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  Form: ({
    children,
    ...props
  }: {
    readonly children?: ReactNode;
    readonly [key: string]: unknown;
  }) => createElement("form", props, children),
  Link: ({
    to,
    children,
    ...props
  }: {
    readonly to: string;
    readonly children?: ReactNode;
    readonly [key: string]: unknown;
  }) => createElement("a", { href: to, ...props }, children),
  useLocation: () => ({ pathname: "/cars/lexus--0123456789abcdef", search: "" }),
  useNavigation: () => ({ formMethod: undefined, formAction: undefined }),
}));

vi.mock("~/auth/use-public-user", () => ({
  usePublicUser: () => ({ email: "ada@example.com", name: "Ada" }),
}));

import type { BookingPricingPreview } from "~/api/bookings/schema";
import { CarBookingPayForm } from "./car-booking-pay-form";

const preview = {
  currency: "NGN",
  numberOfLegs: 1,
  discountCoverage: "NONE",
  segments: [],
  baseTotal: 100_000,
  compareAtBaseTotal: 100_000,
  addons: [],
  addonTotal: 0,
  fuelUpgradeCost: 0,
  platformFeeRatePercent: 5,
  platformFeeAmount: 5_000,
  compareAtPlatformFeeAmount: 5_000,
  subtotalBeforeDiscounts: 105_000,
  compareAtSubtotalBeforeDiscounts: 105_000,
  referralDiscountAmount: 10_000,
  creditsUsed: 2_500,
  subtotalAfterDiscounts: 92_500,
  vatRatePercent: 7.5,
  vatAmount: 6_937.5,
  compareAtVatAmount: 7_875,
  totalAmount: 99_437.5,
  compareAtTotalAmount: 112_875,
  savingsAmount: 13_437.5,
} satisfies BookingPricingPreview;

const cost = {
  currency: "NGN",
  rentalRows: [
    {
      key: "rental",
      units: 1,
      unitPrice: 100_000,
      compareAtUnitPrice: null,
      total: 100_000,
    },
  ],
  addons: [],
  fuelUpgradeCost: 0,
  platformFeeRatePercent: 5,
  platformFeeAmount: 5_000,
  vatRatePercent: 7.5,
  vatAmount: 6_937.5,
  referralDiscountAmount: 10_000,
  creditsUsed: 2_500,
  totalAmount: 99_437.5,
  savingsAmount: 13_437.5,
};

function renderPayForm({
  preview: currentPreview,
  isPricingLoading,
  pricingError,
  useCredits,
}: {
  readonly preview: BookingPricingPreview | null;
  readonly isPricingLoading: boolean;
  readonly pricingError?: string | null;
  readonly useCredits?: number;
}) {
  return renderToStaticMarkup(
    createElement(CarBookingPayForm, {
      carId: "018f47a2-7b3c-7d4e-8f90-1234567890ab",
      bookingType: "DAY",
      from: "2026-09-01",
      to: "2026-09-01",
      pickupTime: "9 AM",
      flightNumber: "",
      pickupAddress: "Lekki Phase 1",
      dropOffAddress: "",
      sameLocation: true,
      addons: [],
      selectedAddonIds: [],
      useCredits: useCredits ?? 2_500,
      onAddonSelectionChange: () => undefined,
      cost,
      preview: currentPreview,
      pricingError: pricingError ?? null,
      isPricingLoading,
      price: null,
      schedule: null,
      credits: null,
      tripArrivalTime: null,
      tripDuration: null,
    }),
  );
}

describe("CarBookingPayForm credits", () => {
  it("writes requested credits into the hidden create payload", () => {
    const markup = renderPayForm({ preview, isPricingLoading: false, useCredits: 2_500 });

    expect(markup).toContain('name="useCredits"');
    expect(markup).toContain('value="2500"');
    expect(markup).toContain('name="expectedTotalAmount"');
    expect(markup).toContain('value="99437.5"');
  });

  it("cannot pay while credit balance or pricing is loading", () => {
    const loading = renderPayForm({ preview, isPricingLoading: true });
    expect(loading).toContain('disabled=""');

    const ready = renderPayForm({ preview, isPricingLoading: false });
    expect(ready).not.toContain('disabled=""');
  });

  it("keeps the API preview as the payable total", () => {
    const markup = renderPayForm({ preview, isPricingLoading: false });

    expect(markup).toContain("₦99,437.50");
    expect(markup).toContain("Referral discount");
    expect(markup).toContain("Referral credit");
  });
});
