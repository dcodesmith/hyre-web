import { type Page, type Locator, expect } from "@playwright/test";

export class AuthPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly referralCodeInput: Locator;
  readonly termsCheckbox: Locator;
  readonly submitButton: Locator;
  readonly referralBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel("Email address");
    this.referralCodeInput = page.getByLabel(/referral code/i);
    this.termsCheckbox = page.getByRole("checkbox", {
      name: /i agree to tripdly's/i,
    });
    this.submitButton = page.getByRole("button", {
      name: "Continue with Email",
      exact: true,
    });
    this.referralBanner = page.getByText("signing up with referral code", { exact: false });
  }

  async goto(options?: { ref?: string }) {
    const url = options?.ref ? `/auth?ref=${options.ref}` : "/auth";
    await this.page.goto(url);
    await expect(this.emailInput).toBeVisible();
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillReferralCode(code: string) {
    if (await this.referralCodeInput.isVisible()) {
      await this.referralCodeInput.fill(code);
    }
  }

  async acceptTerms() {
    if (await this.termsCheckbox.isVisible()) {
      const isChecked = await this.termsCheckbox.isChecked();
      if (!isChecked) {
        await this.termsCheckbox.check();
      }
    }
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectReferralBannerVisible(code: string) {
    await expect(this.referralBanner).toBeVisible();
    await expect(this.page.getByText(code)).toBeVisible();
  }
}
