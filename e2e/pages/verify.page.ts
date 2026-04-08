import { type Page, type Locator, expect } from "@playwright/test";

export class VerifyPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly codeInput: Locator;
  readonly verifyButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /verification code/i });
    this.codeInput = page.getByLabel("Verification code");
    this.verifyButton = page.getByRole("button", { name: "Verify", exact: true });
  }

  async expectVisible() {
    await expect(this.heading).toBeVisible();
  }

  async fillCode(otp: string) {
    await this.codeInput.fill(otp);
  }

  async submit() {
    await this.verifyButton.click();
  }

  async verifyOTP(otp: string) {
    await this.fillCode(otp);
    await this.submit();
  }
}
