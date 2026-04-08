import { type Page, type Locator, expect } from "@playwright/test";

export class ReferralsPage {
  readonly page: Page;
  readonly pageHeading: Locator;
  readonly referralCodeElement: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageHeading = page.getByRole("heading", { name: /referral program/i });
    this.referralCodeElement = page.getByLabel("Referral code");
  }

  async goto() {
    await this.page.goto("/referrals");
    await expect(this.pageHeading).toBeVisible();
  }

  async getReferralCode(): Promise<string> {
    await expect(this.referralCodeElement).toBeVisible();
    const code = (await this.referralCodeElement.textContent())?.trim() ?? "";
    expect(code).toMatch(/^[1-9A-HJ-NP-Z]{8}$/);
    return code;
  }
}
