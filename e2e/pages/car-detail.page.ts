import { type Locator, type Page, expect } from "@playwright/test";

function parseCurrency(text: string): number {
  return Number(text.replaceAll(/[₦,\s]/g, ""));
}

/** Parse a currency value that may have a leading minus sign, always return positive. */
function parseAbsCurrency(text: string): number {
  return Math.abs(parseCurrency(text));
}

function extractRate(labelText: string): number | null {
  const match = /\((\d+(?:\.\d+)?)%\)/.exec(labelText);
  return match ? Number(match[1]) : null;
}

/**
 * Every value displayed in the cost breakdown section,
 * plus the rates extracted from the label text.
 */
export interface FullCostBreakdown {
  basePriceLabel: string;
  pricePerUnit: number;
  units: number;
  baseTotal: number;

  fuelUpgradeVisible: boolean;
  fuelUpgradeCost: number;

  platformFeeVisible: boolean;
  platformFeeRate: number;
  platformFee: number;

  referralDiscountVisible: boolean;
  referralDiscount: number;

  creditsVisible: boolean;
  creditsAmount: number;

  vatRate: number;
  vat: number;

  total: number;
}

/**
 * Car detail page (/cars/:id) — contains the booking card,
 * cost breakdown, and pay button.
 */
export class CarDetailPage {
  readonly page: Page;
  readonly costBreakdown: Locator;
  readonly payButton: Locator;
  readonly pickupAddressInput: Locator;

  private row(label: string): Locator {
    return this.costBreakdown.locator(`[aria-label="${label}"]`);
  }

  private rowValue(label: string): Locator {
    return this.row(label).getByRole("definition");
  }

  private rowTerm(label: string): Locator {
    return this.row(label).getByRole("term");
  }

  constructor(page: Page) {
    this.page = page;
    this.costBreakdown = page.getByRole("region", { name: /cost breakdown/i }).first();
    this.payButton = page.getByRole("button", { name: /pay now/i });
    this.pickupAddressInput = page.getByLabel("Pickup Address");
  }

  async fillPickupAddress(address: string) {
    if (await this.pickupAddressInput.isVisible().catch(() => false)) {
      await this.pickupAddressInput.fill(address);
      const suggestion = this.page.getByRole("option").first();
      if (await suggestion.isVisible().catch(() => false)) {
        await suggestion.click();
      }
    }
  }

  async expectCostBreakdownVisible() {
    await expect(this.costBreakdown).toBeVisible();
  }

  /**
   * Parse every visible line in the cost breakdown, extract rates from
   * label text, and return all values as numbers.
   */
  async getFullCostBreakdown(): Promise<FullCostBreakdown> {
    await this.expectCostBreakdownVisible();

    // ---- Base price row (always visible) ----
    const baseTerm = this.rowTerm("Base price");
    const promoRateLabel = this.costBreakdown.getByLabel("Promotional rate");
    const hasPromoRate = (await promoRateLabel.count()) > 0;
    const basePriceLabel = hasPromoRate
      ? ((await promoRateLabel.innerText()) ?? "")
      : ((await baseTerm.textContent()) ?? "");
    const payableBase = this.costBreakdown.getByLabel("Payable base total");
    const baseTotal = parseCurrency((await payableBase.innerText()) ?? "0");
    const priceMatch = basePriceLabel.match(/₦([\d,]+)\s*×\s*(\d+)/);
    const pricePerUnit = priceMatch ? parseCurrency(priceMatch[1]) : 0;
    const units = priceMatch ? Number(priceMatch[2]) : 0;

    // ---- Fuel upgrade (conditional) ----
    const fuelRow = this.row("Fuel upgrade");
    const fuelUpgradeVisible = await fuelRow.isVisible().catch(() => false);
    const fuelUpgradeCost = fuelUpgradeVisible
      ? parseCurrency((await this.rowValue("Fuel upgrade").textContent()) ?? "0")
      : 0;

    // ---- Platform fee (conditional) ----
    const platformFeeVisible = await this.row("Platform fee")
      .isVisible()
      .catch(() => false);
    let platformFeeRate = 0;
    let platformFee = 0;
    if (platformFeeVisible) {
      const pfLabel = (await this.rowTerm("Platform fee").textContent()) ?? "";
      platformFeeRate = extractRate(pfLabel) ?? 0;
      platformFee = parseCurrency((await this.rowValue("Platform fee").textContent()) ?? "0");
    }

    // ---- Referral discount (conditional, displayed with leading minus) ----
    const referralDiscountVisible = await this.row("Referral discount")
      .isVisible()
      .catch(() => false);
    let referralDiscount = 0;
    if (referralDiscountVisible) {
      const rdText = (await this.rowValue("Referral discount").textContent()) ?? "0";
      referralDiscount = parseAbsCurrency(rdText);
    }

    // ---- Booking credits (conditional, displayed with leading minus) ----
    const creditsVisible = await this.row("Booking credits")
      .isVisible()
      .catch(() => false);
    let creditsAmount = 0;
    if (creditsVisible) {
      const cText = (await this.rowValue("Booking credits").textContent()) ?? "0";
      creditsAmount = parseAbsCurrency(cText);
    }

    // ---- VAT (always visible) ----
    const vatLabel = (await this.rowTerm("VAT").textContent()) ?? "";
    const vatRate = extractRate(vatLabel) ?? 0;
    const vat = parseCurrency((await this.rowValue("VAT").textContent()) ?? "0");

    // ---- Total (desktop, hidden on mobile) ----
    const payableTotal = this.costBreakdown.getByLabel("Payable booking total");
    const total = parseCurrency((await payableTotal.innerText()) ?? "0");

    return {
      basePriceLabel,
      pricePerUnit,
      units,
      baseTotal,
      fuelUpgradeVisible,
      fuelUpgradeCost,
      platformFeeVisible,
      platformFeeRate,
      platformFee,
      referralDiscountVisible,
      referralDiscount,
      creditsVisible,
      creditsAmount,
      vatRate,
      vat,
      total,
    };
  }

  async submitBooking() {
    await expect(this.payButton).toBeVisible();
    await this.payButton.click();
  }
}

/**
 * Payment status page (/bookings/payment-status) — shown after
 * the mock payment redirect.
 */
export class PaymentStatusPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  getTxRefFromUrl(): string | null {
    return new URL(this.page.url()).searchParams.get("tx_ref");
  }

  async expectPaymentSuccessful() {
    await expect(this.page.getByText("Payment Successful")).toBeVisible();
  }

  async expectTransactionReferenceVisible() {
    await expect(this.page.getByText("Transaction Reference")).toBeVisible();
  }

  async getAmountPaid(): Promise<number | null> {
    const el = this.page.locator('[aria-label="Amount paid"]');
    const text = await el.textContent().catch(() => null);
    if (!text) return null;
    const match = text.match(/₦[\d,]+/);
    return match ? parseCurrency(match[0]) : null;
  }

  async clickViewBooking() {
    const link = this.page.getByRole("link", { name: /view booking/i });
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await expect(this.page).toHaveURL(/\/bookings\//);
    }
  }
}
