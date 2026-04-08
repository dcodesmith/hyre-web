import { test as base, expect } from "@playwright/test";
import { addDays, format, getDate } from "date-fns";
import { AuthPage } from "../pages/auth.page";
import { VerifyPage } from "../pages/verify.page";
import { ReferralsPage } from "../pages/referrals.page";
import { HomePage } from "../pages/home.page";
import { SearchPage } from "../pages/search.page";
import { CarDetailPage, PaymentStatusPage } from "../pages/car-detail.page";

const RUN_ID = Date.now();

export interface SeededCar {
  id: string;
  make: string;
  model: string;
  year: number;
  dayRate: number;
  pricingIncludesFuel: boolean;
}

export interface SeededRates {
  vatRatePercent: number;
  platformFeeRatePercent: number;
}

export interface SeededReferralConfig {
  discountAmount: number;
  minBookingAmount: number;
}

export interface SeedData {
  car: SeededCar;
  rates: SeededRates;
  referralConfig: SeededReferralConfig;
}

export interface BookingFinancials {
  booking: {
    id: string;
    status: string;
    type: string;
    totalAmount: number | null;
    subtotalBeforeVat: number | null;
    vatAmount: number | null;
    vatRatePercent: number | null;
    fuelUpgradeCost: number | null;
    referralDiscountAmount: number | null;
    referralCreditsUsed: number | null;
    referralStatus: string;
    platformFeeAmount: number | null;
    platformFeeRatePercent: number | null;
    netTotal: number | null;
    paymentStatus: string;
  };
  car: {
    id: string;
    make: string;
    model: string;
    dayRate: number;
    nightRate: number;
    fullDayRate: number;
    airportPickupRate: number;
    hourlyRate: number | null;
    fuelUpgradeRate: number | null;
    pricingIncludesFuel: boolean;
  };
}

type BookingFixtures = {
  authPage: AuthPage;
  verifyPage: VerifyPage;
  referralsPage: ReferralsPage;
  homePage: HomePage;
  searchPage: SearchPage;
  carDetailPage: CarDetailPage;
  paymentStatusPage: PaymentStatusPage;
  seedData: SeedData;
  fetchOTP: (email: string) => Promise<string>;
  signUp: (email: string, opts?: { referralCode?: string }) => Promise<void>;
  activateBooking: (txRef: string) => Promise<{ bookingId: string; status: string }>;
  fetchBookingDetails: (bookingId: string) => Promise<BookingFinancials>;
  logout: () => Promise<void>;
  testEmails: { referrer: string; referee: string };
  bookingDates: {
    from: Date;
    to: Date;
    fromStr: string;
    toStr: string;
    fromDay: number;
    toDay: number;
  };
};

export const test = base.extend<BookingFixtures>({
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },

  verifyPage: async ({ page }, use) => {
    await use(new VerifyPage(page));
  },

  referralsPage: async ({ page }, use) => {
    await use(new ReferralsPage(page));
  },

  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  searchPage: async ({ page }, use) => {
    await use(new SearchPage(page));
  },

  carDetailPage: async ({ page }, use) => {
    await use(new CarDetailPage(page));
  },

  paymentStatusPage: async ({ page }, use) => {
    await use(new PaymentStatusPage(page));
  },

  seedData: async ({ page }, use) => {
    const res = await page.request.post("/api/test/seed-car");
    expect(res.ok(), "seed-car endpoint should succeed").toBeTruthy();
    const data = await res.json();
    await use(data as SeedData);
  },

  fetchOTP: async ({ page }, use) => {
    await use(async (email: string) => {
      let otp = "";
      await expect
        .poll(
          async () => {
            const res = await page.request.get(`/api/test/otp?email=${encodeURIComponent(email)}`);
            if (res.ok()) {
              otp = (await res.json()).otp;
            }
            return otp;
          },
          { timeout: 15_000, intervals: [500, 1_000, 1_000, 2_000, 2_000, 3_000] },
        )
        .toBeTruthy();
      return otp;
    });
  },

  signUp: async ({ page, fetchOTP, authPage, verifyPage }, use) => {
    await use(async (email, opts = {}) => {
      await expect(authPage.emailInput).toBeVisible();
      await authPage.fillEmail(email);

      if (opts.referralCode) {
        await authPage.fillReferralCode(opts.referralCode);
      }

      await authPage.acceptTerms();
      await authPage.submit();

      await expect(page).toHaveURL(/\/verify/);
      await verifyPage.expectVisible();

      const otp = await fetchOTP(email);
      await verifyPage.verifyOTP(otp);

      await expect(page).not.toHaveURL(/\/verify/);
    });
  },

  activateBooking: async ({ page }, use) => {
    await use(async (txRef: string) => {
      const res = await page.request.post("/api/test/activate-booking", {
        data: { txRef },
      });
      expect(res.ok()).toBeTruthy();
      return res.json();
    });
  },

  fetchBookingDetails: async ({ page }, use) => {
    await use(async (bookingId: string) => {
      const res = await page.request.get(
        `/api/test/booking-details?bookingId=${encodeURIComponent(bookingId)}`,
      );
      expect(res.ok(), "booking-details endpoint should succeed").toBeTruthy();
      return res.json() as Promise<BookingFinancials>;
    });
  },

  logout: async ({ page }, use) => {
    await use(async () => {
      await page.goto("/logout");
      await expect(page).toHaveURL("/");
    });
  },

  testEmails: async ({}, use) => {
    await use({
      referrer: `e2e-referrer-${RUN_ID}@test.tripdly.com`,
      referee: `e2e-referee-${RUN_ID}@test.tripdly.com`,
    });
  },

  bookingDates: async ({}, use) => {
    const from = addDays(new Date(), 14);
    const to = addDays(new Date(), 16);
    await use({
      from,
      to,
      fromStr: format(from, "yyyy-MM-dd"),
      toStr: format(to, "yyyy-MM-dd"),
      fromDay: getDate(from),
      toDay: getDate(to),
    });
  },
});

export { expect } from "@playwright/test";
