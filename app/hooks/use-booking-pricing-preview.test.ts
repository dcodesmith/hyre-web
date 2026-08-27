import { describe, expect, it } from "vitest";

import { toPricingPreviewBody } from "~/booking/booking-create-form-schema";
import { parseSearchUrl } from "~/search/search-url";

describe("pricing preview request key", () => {
  it("builds a stable request key from URL booking params", () => {
    const params = new URLSearchParams(
      "from=2026-08-28&to=2026-08-28&bookingType=DAY&pickupTime=9+AM",
    );
    const search = parseSearchUrl(params);

    expect(search.pickupTime).toBe("9 AM");

    const preview = toPricingPreviewBody({
      carId: "cmmz1wtb80000bwb5nz3j2r2p",
      bookingType: "DAY",
      from: "2026-08-28",
      to: "2026-08-28",
      pickupTime: search.pickupTime ?? "",
    });

    expect(preview).not.toBeNull();
    if (preview == null) {
      return;
    }

    const clientKey = new URLSearchParams({
      carId: preview.carId,
      bookingType: preview.bookingType,
      startDate: preview.startDate,
      endDate: preview.endDate,
      pickupTime: preview.pickupTime,
      includeSecurityDetail: String(preview.includeSecurityDetail),
      requiresFullTank: String(preview.requiresFullTank),
      useCredits: String(preview.useCredits),
    }).toString();

    const serverKey = new URL(
      `https://tripdly.com/api/booking-pricing-preview?${clientKey}`,
    ).searchParams.toString();

    expect(serverKey).toBe(clientKey);
  });
});
