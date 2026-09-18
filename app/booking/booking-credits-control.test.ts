import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingCreditsControl } from "./booking-credits-control";

function renderControl(
  props: Partial<Parameters<typeof BookingCreditsControl>[0]> & {
    readonly checked?: boolean;
    readonly onCheckedChange?: (checked: boolean) => void;
  } = {},
) {
  return renderToStaticMarkup(
    createElement(BookingCreditsControl, {
      checked: props.checked ?? false,
      data: props.data,
      isLoadingBalance: props.isLoadingBalance ?? false,
      isPricingLoading: props.isPricingLoading ?? false,
      appliedCredits: props.appliedCredits ?? 0,
      onCheckedChange: props.onCheckedChange ?? (() => undefined),
    }),
  );
}

describe("BookingCreditsControl", () => {
  it("explains opt-in before a balance is loaded", () => {
    const markup = renderControl();

    expect(markup).toContain("Use booking credits");
    expect(markup).toContain("Turn this on to check and apply your banked referral rewards.");
    expect(markup).not.toContain('disabled=""');
  });

  it("shows loading copy and disables the switch while the balance loads", () => {
    const markup = renderControl({ checked: true, isLoadingBalance: true });

    expect(markup).toContain("Checking your available credits…");
    expect(markup).toContain('disabled=""');
  });

  it("shows available and max-cap copy when a balance is ready", () => {
    const markup = renderControl({
      data: { availableCredits: 15_000, maxCreditsPerBooking: 8_000, error: null },
    });

    expect(markup).toContain("Available: ₦15,000.");
    expect(markup).toContain("Up to ₦8,000 may apply before the booking percentage cap.");
  });

  it("disables the control when there is no usable balance", () => {
    const noCredits = renderControl({
      checked: true,
      data: { availableCredits: 0, maxCreditsPerBooking: 8_000, error: null },
    });
    expect(noCredits).toContain("You do not have booking credits available yet.");
    expect(noCredits).toContain('disabled=""');

    const noCap = renderControl({
      checked: true,
      data: { availableCredits: 15_000, maxCreditsPerBooking: 0, error: null },
    });
    expect(noCap).toContain('disabled=""');
  });

  it("keeps the switch usable after an error so the customer can retry", () => {
    const markup = renderControl({
      checked: true,
      data: {
        availableCredits: 0,
        maxCreditsPerBooking: 0,
        error: "Unable to check your booking credits. Please try again.",
      },
    });

    expect(markup).toContain("Unable to check your booking credits. Please try again.");
    expect(markup).not.toContain('disabled=""');
  });

  it("shows pricing and applied-credit copy after opt-in", () => {
    const pricing = renderControl({
      checked: true,
      isPricingLoading: true,
      data: { availableCredits: 15_000, maxCreditsPerBooking: 8_000, error: null },
    });
    expect(pricing).toContain("Calculating how much credit can be used…");

    const applied = renderControl({
      checked: true,
      appliedCredits: 4_500,
      data: { availableCredits: 15_000, maxCreditsPerBooking: 8_000, error: null },
    });
    expect(applied).toContain("₦4,500 will be applied to this booking.");
  });
});
