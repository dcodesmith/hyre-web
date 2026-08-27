import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createBooking,
  getPublicCar,
  getCarReviews,
  readAuthUser,
  createPaymentStatusSession,
  paymentStatusSetCookie,
  requirePaymentStatusCookieSecret,
} = vi.hoisted(() => ({
  createBooking: vi.fn(),
  getPublicCar: vi.fn(),
  getCarReviews: vi.fn(),
  readAuthUser: vi.fn(),
  createPaymentStatusSession: vi.fn((value) => ({ ...value, expiresAt: Date.now() + 60_000 })),
  paymentStatusSetCookie: vi.fn(async () => "payment_status=encrypted; HttpOnly"),
  requirePaymentStatusCookieSecret: vi.fn(),
}));

vi.mock("~/api/bookings/bookings.server", () => ({ createBooking }));
vi.mock("~/api/cars/cars.server", () => ({ getPublicCar }));
vi.mock("~/api/reviews/reviews.server", () => ({ getCarReviews }));
vi.mock("cloudflare:workers", () => ({
  env: { APP_ORIGIN: "https://tripdly.com" },
}));
vi.mock("~/auth/session.server", () => ({ readAuthUser }));
vi.mock("~/auth/guest-only.server", () => ({
  AUTH_NO_STORE: { "Cache-Control": "private, no-store" },
}));
vi.mock("~/payment/payment-status-session.server", () => ({
  createPaymentStatusSession,
  paymentStatusSetCookie,
  requirePaymentStatusCookieSecret,
}));

import { ApiRequestError } from "~/api/api.server";
import { action } from "./cars.$carSlug";

const CAR_ID = "cmmz4f7x00000l804jj2d6ikn";
const IDEMPOTENCY_KEY = "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c";

const pricing = {
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

function bookingForm(guest = false) {
  const form = new FormData();
  form.set("carId", CAR_ID);
  form.set("idempotencyKey", IDEMPOTENCY_KEY);
  form.set("expectedTotalAmount", "112875");
  form.set("bookingType", "DAY");
  form.set("from", "2026-09-01");
  form.set("to", "2026-09-01");
  form.set("pickupTime", "9 AM");
  form.set("pickupAddress", "Lekki Phase 1");
  form.set("sameLocation", "true");
  if (guest) {
    form.set("name", "Ada Lovelace");
    form.set("email", "ada@example.com");
    form.set("phoneNumber", "08012345678");
  }
  return form;
}

function runAction(form: FormData) {
  return action({
    request: new Request(`https://tripdly.com/cars/lexus-${CAR_ID}`, {
      method: "POST",
      body: form,
    }),
    params: { carSlug: `lexus-${CAR_ID}` },
    context: {},
  } as never);
}

describe("car booking action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createBooking.mockResolvedValue({
      data: {
        bookingId: "booking-1",
        txRef: "tx-1",
        checkoutUrl: "https://checkout.flutterwave.test/pay",
        totalAmount: 112875,
        currency: "NGN",
        bookingStatus: "PENDING",
        reservationExpiresAt: new Date(Date.now() + 600_000).toISOString(),
        paymentStatusToken: "guest-token",
      },
    });
  });

  it("creates a guest booking with the displayed total and attempt key", async () => {
    readAuthUser.mockResolvedValue(null);

    const response = await runAction(bookingForm(true)).catch((error: unknown) => error);

    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: IDEMPOTENCY_KEY,
        body: expect.objectContaining({
          expectedTotalAmount: "112875",
          guestName: "Ada Lovelace",
          callbackUrl: "https://tripdly.com/bookings/payment-status",
        }),
      }),
    );
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe(
      "https://checkout.flutterwave.test/pay",
    );
    expect((response as Response).headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(createPaymentStatusSession).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatusToken: "guest-token" }),
    );
  });

  it("creates an authenticated booking without guest identity fields", async () => {
    readAuthUser.mockResolvedValue({ email: "ada@example.com", name: "Ada" });

    await runAction(bookingForm()).catch(() => undefined);

    const body = createBooking.mock.calls[0][0].body;
    expect(body).not.toHaveProperty("guestEmail");
    expect(body).not.toHaveProperty("guestName");
    expect(body).not.toHaveProperty("guestPhone");
  });

  it("returns revised pricing and retry metadata instead of silently accepting a change", async () => {
    readAuthUser.mockResolvedValue({ email: "ada@example.com", name: "Ada" });
    createBooking.mockRejectedValue(
      new ApiRequestError(
        "http",
        409,
        {
          type: "BOOKING_PRICE_CHANGED",
          title: "Booking Price Changed",
          status: 409,
          detail: "Review the updated price before continuing.",
          errorCode: "BOOKING_PRICE_CHANGED",
          details: { currentPricing: { ...pricing, totalAmount: 115000 } },
        },
        new Headers({ "Retry-After": "3", "X-Request-ID": "request-1" }),
      ),
    );

    const result = await runAction(bookingForm());

    expect(result).toMatchObject({
      data: {
        currentPricing: { totalAmount: 115000 },
        errorCode: "BOOKING_PRICE_CHANGED",
      },
      init: { status: 409 },
    });
    const headers = new Headers(result.init?.headers);
    expect(headers.get("Retry-After")).toBe("3");
    expect(headers.get("X-Request-ID")).toBe("request-1");
  });

  it("does not send a guest to checkout without a status credential", async () => {
    readAuthUser.mockResolvedValue(null);
    createBooking.mockResolvedValue({
      data: {
        bookingId: "booking-1",
        txRef: "tx-1",
        checkoutUrl: "https://checkout.flutterwave.test/pay",
        totalAmount: 112875,
        currency: "NGN",
        bookingStatus: "PENDING",
        reservationExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
    });

    const result = await runAction(bookingForm(true));

    expect(result).toMatchObject({
      init: { status: 502 },
      data: { currentPricing: undefined },
    });
    expect(createPaymentStatusSession).not.toHaveBeenCalled();
  });
});
