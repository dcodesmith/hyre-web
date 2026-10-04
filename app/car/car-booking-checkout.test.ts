import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    readonly to: string;
    readonly children?: ReactNode;
    readonly [key: string]: unknown;
  }) => createElement("a", { href: to, ...props }, children),
}));

import type { BookingCostDisplay } from "~/booking/booking-estimate";
import { CarBookingCheckout } from "./car-booking-checkout";

const cost: BookingCostDisplay = {
  currency: "NGN",
  rentalRows: [
    {
      key: "rental",
      units: 1,
      unitPrice: 104_500,
      compareAtUnitPrice: 110_000,
      total: 104_500,
    },
  ],
  addons: [],
  fuelUpgradeCost: 0,
  platformFeeRatePercent: 0,
  platformFeeAmount: 0,
  vatRatePercent: 7.5,
  vatAmount: 7_837.5,
  referralDiscountAmount: 0,
  creditsUsed: 0,
  totalAmount: 112_337.5,
  compareAtTotalAmount: 118_250,
  savingsAmount: 5_912.5,
};

function renderCheckout(display: BookingCostDisplay = cost) {
  return renderToStaticMarkup(
    createElement(CarBookingCheckout, {
      price: null,
      schedule: null,
      tripArrivalTime: null,
      tripDuration: null,
      bookingType: "DAY",
      checkout: {
        guest: null,
        addons: null,
        credits: null,
        cost: display,
        pricingError: null,
        canPay: true,
        errorId: "booking-error",
        bookingErrors: [],
        isPaying: false,
        isSignedIn: true,
        signInHref: "/auth",
      },
    }),
  );
}

describe("CarBookingCheckout mobile total", () => {
  it("shows the compare-at total and combined savings", () => {
    const markup = renderCheckout();

    expect(markup).toContain("₦118,250");
    expect(markup).toContain("₦112,337.50");
    expect(markup).toContain("You save ₦5,912.50");
    expect(markup).toContain("line-through");
  });

  it("shows only the payable total when nothing is saved", () => {
    const markup = renderCheckout({
      ...cost,
      rentalRows: [{ ...cost.rentalRows[0], compareAtUnitPrice: null, unitPrice: 110_000 }],
      compareAtTotalAmount: null,
      savingsAmount: 0,
      totalAmount: 118_250,
    });

    expect(markup).toContain("₦118,250");
    expect(markup).not.toContain("You save");
    expect(markup).not.toContain("line-through");
  });
});
