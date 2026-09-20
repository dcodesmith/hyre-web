import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingCreditsControl } from "./booking-credits-control";

function renderControl({
  availableCredits = 15_000,
  creditLimit = 12_500,
  checked = false,
}: {
  readonly availableCredits?: number;
  readonly creditLimit?: number;
  readonly checked?: boolean;
} = {}) {
  return renderToStaticMarkup(
    createElement(BookingCreditsControl, {
      availableCredits,
      creditLimit,
      checked,
      onCheckedChange: () => undefined,
    }),
  );
}

describe("BookingCreditsControl", () => {
  it("renders a standalone referral credit section with available and usable amounts", () => {
    const markup = renderControl();

    expect(markup).toContain('id="referral-credit-heading"');
    expect(markup).toContain("Referral credit");
    expect(markup).toContain("₦15,000 available");
    expect(markup).toContain("(Up to ₦12,500 can be used on this booking)");
    expect(markup).toContain("Apply referral credit");
    expect(markup).toContain('id="apply-referral-credit"');
    expect(markup).not.toContain("Use booking credits");
    expect(markup).not.toContain("Wallet");
  });

  it("keeps the switch on after the customer opts in", () => {
    const markup = renderControl({ checked: true });

    expect(markup).toContain("data-checked");
  });
});
