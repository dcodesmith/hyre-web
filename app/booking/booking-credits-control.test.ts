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
    const applyLabel = "Apply referral credit";
    const usableAmount = "-₦12,500";
    const helperCopy = "Your available credit is ₦15,000. You can use ₦12,500 for this booking.";

    expect(markup).toContain('id="referral-credit-heading"');
    expect(markup).toContain("Referral credit");
    expect(markup).toContain('role="checkbox"');
    expect(markup).toContain('aria-checked="false"');
    expect(markup).toContain('id="apply-referral-credit"');
    expect(markup).toContain('for="apply-referral-credit"');
    expect(markup).toContain(applyLabel);
    expect(markup.indexOf(usableAmount)).toBeGreaterThan(markup.indexOf(applyLabel));
    expect(markup.indexOf(usableAmount)).toBeLessThan(markup.indexOf(helperCopy));
    expect(markup).toContain(helperCopy);
    expect(markup).not.toContain("Use booking credits");
    expect(markup).not.toContain("Wallet");
    expect(markup).not.toContain('role="switch"');
  });

  it("keeps the checkbox on after the customer opts in", () => {
    const markup = renderControl({ checked: true });

    expect(markup).toContain('role="checkbox"');
    expect(markup).toContain('aria-checked="true"');
  });
});
