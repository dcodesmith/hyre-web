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

import type { TripDurationResponse } from "~/api/flights/schema";
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

function renderCheckout(
  display: BookingCostDisplay = cost,
  trip: {
    readonly tripArrivalTime: string | null;
    readonly tripDuration: TripDurationResponse | null;
    readonly tripDurationError?: string | null;
  } = {
    tripArrivalTime: null,
    tripDuration: null,
  },
) {
  return renderToStaticMarkup(
    createElement(CarBookingCheckout, {
      price: null,
      schedule: null,
      tripArrivalTime: trip.tripArrivalTime,
      tripDuration: trip.tripDuration,
      tripDurationError: trip.tripDurationError ?? null,
      bookingType: "DAY",
      checkout: {
        guest: null,
        phone: null,
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
  it("shows the compare-at rate, payable total, and savings in the breakdown", () => {
    const markup = renderCheckout();

    expect(markup).toContain("Book a service");
    expect(markup).toContain("₦110,000");
    expect(markup).toContain("₦112,337.50");
    expect(markup).toContain("You save");
    expect(markup).toContain("₦5,912.50");
    expect(markup).toContain("line-through");
    expect(markup).toContain("Pay Now");
    expect(markup).not.toContain("fixed inset-x-0");
    expect(markup).not.toContain("Trip Details");
    expect(markup).not.toContain("Unable to estimate the drive");
    const panelId = markup.match(/aria-controls="([^"]+)"/)?.[1];
    expect(panelId).toBeTruthy();
    expect(markup).toContain(`id="${panelId}"`);
  });

  it("shows airport trip details after the flight and drop-off are known", () => {
    const markup = renderCheckout(cost, {
      tripArrivalTime: "2026-10-23T17:45:00.000Z",
      tripDuration: { durationMinutes: 34, distanceMeters: 12_800, isEstimate: true },
    });

    expect(markup).toContain("Trip Details");
    expect(markup).toContain("Flight Arrival");
    expect(markup).toContain("6:45 PM");
    expect(markup).toContain("Pickup Time");
    expect(markup).toContain("7:25 PM");
    expect(markup).toContain("Estimated Drive");
    expect(markup).toContain("41 mins");
    expect(markup).toContain("Distance");
    expect(markup).toContain("12.8 km");
    expect(markup).toContain("Estimated Drop-off");
    expect(markup).toContain("8:06 PM");
    expect(markup).not.toContain("Unable to estimate the drive");
  });

  it("shows a drive estimate error when the duration is unavailable", () => {
    const markup = renderCheckout(cost, {
      tripArrivalTime: "2026-10-23T17:45:00.000Z",
      tripDuration: null,
      tripDurationError: "Unable to estimate the drive. Please try again.",
    });

    expect(markup).toContain("Unable to estimate the drive. Please try again.");
    expect(markup).not.toContain("Trip Details");
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
