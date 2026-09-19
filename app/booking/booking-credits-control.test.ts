import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingCreditsControl } from "./booking-credits-control";

function renderControl(checked = false) {
  return renderToStaticMarkup(
    createElement(BookingCreditsControl, {
      checked,
      onCheckedChange: () => undefined,
    }),
  );
}

describe("BookingCreditsControl", () => {
  it("renders the label and switch without helper copy or wallet chrome", () => {
    const markup = renderControl();

    expect(markup).toContain("Use booking credits");
    expect(markup).toContain('id="apply-booking-credits"');
    expect(markup).not.toContain("Turn this on");
    expect(markup).not.toContain("Available:");
    expect(markup).not.toContain("Wallet");
  });

  it("keeps the switch on after the customer opts in", () => {
    const markup = renderControl(true);

    expect(markup).toContain("data-checked");
  });
});
