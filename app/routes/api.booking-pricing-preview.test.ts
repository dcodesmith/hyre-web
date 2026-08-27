import { beforeEach, describe, expect, it, vi } from "vitest";

const { previewBookingPricing } = vi.hoisted(() => ({
  previewBookingPricing: vi.fn(),
}));

vi.mock("~/api/bookings/bookings.server", () => ({ previewBookingPricing }));

import { loader } from "./api.booking-pricing-preview";

const preview = {
  currency: "NGN" as const,
  numberOfLegs: 1,
  discountCoverage: "NONE" as const,
  segments: [],
  baseTotal: 100000,
  compareAtBaseTotal: 100000,
  securityDetailCost: 0,
  fuelUpgradeCost: 0,
  platformFeeRatePercent: 5,
  platformFeeAmount: 5000,
  compareAtPlatformFeeAmount: 5000,
  subtotalBeforeDiscounts: 105000,
  compareAtSubtotalBeforeDiscounts: 105000,
  referralDiscountAmount: 0,
  creditsUsed: 0,
  subtotalAfterDiscounts: 105000,
  vatRatePercent: 7.5,
  vatAmount: 7875,
  compareAtVatAmount: 7875,
  totalAmount: 112875,
  compareAtTotalAmount: 112875,
  savingsAmount: 0,
};

describe("booking pricing preview resource", () => {
  beforeEach(() => {
    previewBookingPricing.mockReset();
  });

  it("returns the API-owned payable total for complete booking input", async () => {
    previewBookingPricing.mockResolvedValue({ data: preview });
    const params = new URLSearchParams({
      carId: "car-1",
      bookingType: "DAY",
      startDate: "2026-09-01T08:00:00.000Z",
      endDate: "2026-09-01T20:00:00.000Z",
      pickupTime: "9 AM",
      includeSecurityDetail: "false",
      requiresFullTank: "false",
      useCredits: "0",
    });
    const request = new Request(`https://tripdly.com/api/booking-pricing-preview?${params}`);

    const result = await loader({ request, params: {}, context: {} } as never);

    expect(previewBookingPricing).toHaveBeenCalledWith({
      request,
      body: expect.objectContaining({
        bookingType: "DAY",
        includeSecurityDetail: false,
        useCredits: 0,
      }),
    });
    expect(result).toMatchObject({
      data: { requestKey: params.toString(), preview, error: null },
    });
  });

  it("strips React Router fetcher params from the echoed request key", async () => {
    previewBookingPricing.mockResolvedValue({ data: preview });
    const params = new URLSearchParams({
      carId: "car-1",
      bookingType: "DAY",
      startDate: "2026-09-01T08:00:00.000Z",
      endDate: "2026-09-01T20:00:00.000Z",
      pickupTime: "9 AM",
      includeSecurityDetail: "false",
      requiresFullTank: "false",
      useCredits: "0",
    });
    params.set("_routes", "routes/api.booking-pricing-preview");
    const request = new Request(`https://tripdly.com/api/booking-pricing-preview?${params}`);

    const result = await loader({ request, params: {}, context: {} } as never);

    expect(result).toMatchObject({
      data: {
        requestKey:
          "carId=car-1&bookingType=DAY&startDate=2026-09-01T08%3A00%3A00.000Z&endDate=2026-09-01T20%3A00%3A00.000Z&pickupTime=9+AM&includeSecurityDetail=false&requiresFullTank=false&useCredits=0",
        preview,
        error: null,
      },
    });
  });

  it("rejects malformed preview parameters before calling the API", async () => {
    const params = new URLSearchParams({
      carId: "car-1",
      bookingType: "DAY",
      startDate: "not-a-date",
      endDate: "2026-09-01T20:00:00.000Z",
      pickupTime: "9 AM",
      includeSecurityDetail: "false",
      requiresFullTank: "false",
      useCredits: "0",
    });
    const request = new Request(`https://tripdly.com/api/booking-pricing-preview?${params}`);

    const result = await loader({ request, params: {}, context: {} } as never);

    expect(previewBookingPricing).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      init: { status: 400 },
      data: { preview: null },
    });
  });
});
