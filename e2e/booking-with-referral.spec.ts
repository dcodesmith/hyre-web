import { test, expect } from "./fixtures";
import {
  computeExpectedBreakdown,
  inclusiveDayCount,
  toDisplayedCurrencyAmount,
} from "./utils/financials";

function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * E2E: logged-in booking flow with referral @e2e @booking @referral
 *
 * 1. Seed a car with deterministic pricing via /api/test/seed-car.
 * 2. User A (referrer) signs up → obtains referral code.
 * 3. User B (referee) signs up with referral → referral attributed.
 * 4. User B starts from homepage → verifies seeded car is listed →
 *    searches for cars → selects the seeded car → verifies cost
 *    breakdown → pays → booking confirmed.
 *
 * External services mocked when E2E_TESTING=true:
 *   - OTPs stored in-memory, retrieved via /api/test/otp
 *   - Flutterwave bypassed; mock checkout URL returned by the server
 *   - Booking activated via /api/test/activate-booking
 *   - Test car and supporting data seeded via /api/test/seed-car
 */

test.describe("Booking with Referral", () => {
  test("User B books a car from homepage and verifies financials @critical", async ({
    page,
    authPage,
    homePage,
    searchPage,
    carDetailPage,
    referralsPage,
    paymentStatusPage,
    signUp,
    logout,
    activateBooking,
    fetchBookingDetails,
    seedData,
    bookingDates,
    testEmails,
  }) => {
    const referrerEmail = testEmails.referrer;
    const refereeEmail = testEmails.referee;
    let referralCode = "";

    await test.step("create referrer and referral code", async () => {
      await homePage.goto();
      await homePage.clickRegisterOrLogIn();

      await signUp(referrerEmail);

      await referralsPage.goto();
      referralCode = await referralsPage.getReferralCode();

      expect(referralCode).toBeTruthy();

      await logout();
    });

    await test.step("sign in as referee with referral code", async () => {
      await homePage.goto();
      await homePage.clickRegisterOrLogIn();
      await authPage.goto({ ref: referralCode });
      await authPage.expectReferralBannerVisible(referralCode);
      await signUp(refereeEmail);
      await expect(page).not.toHaveURL(/\/auth|\/verify/);
    });

    await test.step("navigate to homepage and verify seeded car is listed", async () => {
      await homePage.goto();
      await homePage.expectCarsVisible();
      await homePage.expectCarListed(seedData.car);
    });

    await test.step("search for available cars and select the seeded car", async () => {
      const params = new URLSearchParams({
        from: bookingDates.fromStr,
        to: bookingDates.toStr,
        bookingType: "DAY",
        pickupTime: "10:00",
        pickupAddress: "Victoria Island, Lagos",
      });
      await page.goto(`/search?${params}`);
      await searchPage.expectResultsVisible();
      await searchPage.expectResultCount(1);
      await searchPage.selectCarByName(seedData.car.model);

      // Assert user-visible state on the destination page instead of URL shape.
      await carDetailPage.expectCostBreakdownVisible();
      await expect(carDetailPage.payButton).toBeVisible();
      await expect(carDetailPage.pickupAddressInput).toHaveValue("Victoria Island, Lagos");
    });

    let totalAmount = 0;
    await test.step("verify cost breakdown values are correct", async () => {
      await expect(
        carDetailPage.costBreakdown.locator('[aria-label="Referral discount"]'),
      ).toBeVisible({ timeout: 15_000 });

      const breakdown = await carDetailPage.getFullCostBreakdown();
      const expectedUnits = inclusiveDayCount(bookingDates.fromStr, bookingDates.toStr);
      const fuelUpgradeCost = breakdown.fuelUpgradeVisible ? breakdown.fuelUpgradeCost : 0;

      const { rates, referralConfig } = seedData;
      await test.step("assert policy constants are explicit and readable", () => {
        expect(rates.vatRatePercent, "Nigeria VAT should be 7.5%").toBe(7.5);
        expect(referralConfig.discountAmount, "Referral discount policy should be ₦10,000").toBe(
          10_000,
        );
        expect(
          referralConfig.minBookingAmount,
          "Referral minimum booking threshold should be ₦20,000",
        ).toBe(20_000);
      });

      // Compute expected breakdown first, then use its subtotalBeforeDiscounts for discount eligibility
      const preliminaryExpected = computeExpectedBreakdown({
        pricePerUnit: seedData.car.dayRate,
        units: expectedUnits,
        fuelUpgradeCost,
        platformFeeRatePercent: rates.platformFeeRatePercent,
        referralDiscountAmount: 0, // Initial pass to get subtotal
        creditsUsed: 0,
        vatRatePercent: rates.vatRatePercent,
      });

      const applicableDiscount =
        preliminaryExpected.subtotalBeforeDiscounts >= referralConfig.minBookingAmount
          ? Math.min(referralConfig.discountAmount, preliminaryExpected.subtotalBeforeDiscounts)
          : 0;

      const expected = computeExpectedBreakdown({
        pricePerUnit: seedData.car.dayRate,
        units: expectedUnits,
        fuelUpgradeCost,
        platformFeeRatePercent: rates.platformFeeRatePercent,
        referralDiscountAmount: applicableDiscount,
        creditsUsed: 0,
        vatRatePercent: rates.vatRatePercent,
      });

      await test.step("check base price matches seeded car dayRate", () => {
        const expectedPriceLabel = `${formatNaira(seedData.car.dayRate)} × ${expectedUnits}`;
        expect(breakdown.pricePerUnit, "UI per-unit price matches seeded dayRate").toBe(
          seedData.car.dayRate,
        );
        expect(breakdown.units, "UI booking units match date range").toBe(expectedUnits);
        expect(breakdown.baseTotal, "UI base total matches expected").toBe(expected.baseTotal);
        expect(
          breakdown.basePriceLabel,
          `Base price label should contain "${expectedPriceLabel}"`,
        ).toContain(expectedPriceLabel);
      });

      await test.step("check fuel handling", () => {
        if (breakdown.fuelUpgradeVisible) {
          expect(
            breakdown.fuelUpgradeCost,
            "fuel cost should be > 0 when row is visible",
          ).toBeGreaterThan(0);
        } else {
          expect(breakdown.fuelUpgradeCost, "fuel cost is 0 when not shown").toBe(0);
        }
      });

      await test.step("check referral, platform fee, VAT and total exact values", () => {
        expect(breakdown.platformFeeRate, "platform fee rate matches seeded config").toBe(
          rates.platformFeeRatePercent,
        );
        expect(breakdown.platformFee, "platform fee amount matches expected").toBe(
          expected.platformFee,
        );
        expect(breakdown.referralDiscountVisible, "referral discount row visibility").toBe(
          applicableDiscount > 0,
        );
        expect(
          breakdown.referralDiscount,
          `referral discount amount matches expected (${formatNaira(expected.referralDiscount)})`,
        ).toBe(expected.referralDiscount);
        expect(breakdown.vatRate, `VAT rate matches seeded config (${rates.vatRatePercent}%)`).toBe(
          rates.vatRatePercent,
        );
        expect(breakdown.vat, `VAT amount matches expected (${formatNaira(expected.vat)})`).toBe(
          expected.vat,
        );
        expect(
          breakdown.total,
          `total amount matches expected (${formatNaira(expected.total)})`,
        ).toBe(expected.total);
      });

      totalAmount = breakdown.total;
      expect(totalAmount, "total cost should be > 0").toBeGreaterThan(0);
    });

    let txRef: string;
    let bookingId: string;
    await test.step("submit booking and process payment", async () => {
      await carDetailPage.fillPickupAddress("Victoria Island, Lagos");
      await carDetailPage.submitBooking();

      await expect(page).toHaveURL(/\/bookings\/payment-status/);
      const ref = paymentStatusPage.getTxRefFromUrl();
      expect(ref).toBeTruthy();
      txRef = ref as string;

      const result = await activateBooking(txRef);
      expect(result.status).toBe("CONFIRMED");
      bookingId = result.bookingId;
    });

    await test.step("verify payment success page", async () => {
      await paymentStatusPage.expectPaymentSuccessful();
      await paymentStatusPage.expectTransactionReferenceVisible();

      const amountPaid = await paymentStatusPage.getAmountPaid();
      expect(amountPaid, "amount paid should be parseable from success page").not.toBeNull();
      expect(amountPaid, "amount paid matches cost breakdown total exactly").toBe(totalAmount);
    });

    await test.step("assert DB financials match UI values", async () => {
      const { booking: dbBooking, car: dbCar } = await fetchBookingDetails(bookingId);

      await test.step("car pricing in DB matches seeded values", () => {
        expect(dbCar.dayRate, "DB dayRate").toBe(seedData.car.dayRate);
        expect(dbCar.pricingIncludesFuel, "DB pricingIncludesFuel").toBe(
          seedData.car.pricingIncludesFuel,
        );
      });

      await test.step("booking total in DB matches UI total", () => {
        expect(dbBooking.totalAmount, "DB totalAmount not null").not.toBeNull();
        expect(
          toDisplayedCurrencyAmount(dbBooking.totalAmount as number),
          "DB total matches UI total exactly",
        ).toBe(totalAmount);
      });

      await test.step("VAT rate in DB matches seeded config", () => {
        expect(dbBooking.vatRatePercent, "DB VAT rate should be recorded").not.toBeNull();
        expect(dbBooking.vatRatePercent, "DB VAT rate").toBe(seedData.rates.vatRatePercent);
      });

      await test.step("referral discount in DB is applied", () => {
        expect(
          ["APPLIED", "REWARDED"],
          "referral status should be APPLIED (pending release) or REWARDED (released on payment)",
        ).toContain(dbBooking.referralStatus);
      });

      await test.step("booking is confirmed and paid", () => {
        expect(dbBooking.status).toBe("CONFIRMED");
        expect(dbBooking.paymentStatus).toBe("PAID");
      });
    });

    await test.step("navigate to booking detail and confirm status", async () => {
      await paymentStatusPage.clickViewBooking();
      await expect(page.getByText(/confirmed/i)).toBeVisible();
    });
  });
});
