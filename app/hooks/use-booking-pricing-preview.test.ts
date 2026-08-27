import { describe, expect, it } from "vitest";

import { parseSearchUrl } from "~/search/search-url";
import { bookingPricingPreviewSearchParams } from "./use-booking-pricing-preview";

describe("pricing preview request key", () => {
  it("builds a stable request key from URL booking params", () => {
    const params = new URLSearchParams(
      "from=2026-08-28&to=2026-08-28&bookingType=DAY&pickupTime=9+AM",
    );
    const search = parseSearchUrl(params);

    expect(search.pickupTime).toBe("9 AM");

    const clientKey = bookingPricingPreviewSearchParams({
      carId: "cmmz1wtb80000bwb5nz3j2r2p",
      bookingType: "DAY",
      from: "2026-08-28",
      to: "2026-08-28",
      pickupTime: search.pickupTime ?? "",
    })?.toString();

    expect(clientKey).toBe(
      "carId=cmmz1wtb80000bwb5nz3j2r2p&bookingType=DAY&startDate=2026-08-28T08%3A00%3A00.000Z&endDate=2026-08-28T20%3A00%3A00.000Z&pickupTime=9+AM&includeSecurityDetail=false&requiresFullTank=false&useCredits=0",
    );
  });
});
