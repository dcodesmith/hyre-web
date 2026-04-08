import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Homepage (/) — hero search form and fleet showcase sections.
 */
export class HomePage {
  readonly page: Page;
  readonly bookingTypeGroup: Locator;
  readonly searchButton: Locator;
  readonly carTitles: Locator;
  readonly registerOrLoginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.bookingTypeGroup = page.getByRole("group", { name: "Booking type" });
    this.searchButton = page.getByRole("button", { name: "Search" });
    this.carTitles = page.getByRole("heading", { level: 3 }).filter({ hasText: /\(\d{4}\)/ });
    this.registerOrLoginButton = page.getByRole("button", {
      name: /register or log in/i,
    });
  }

  async goto() {
    await this.page.goto("/");
  }

  /** Assert that at least one car card with a price is visible. */
  async expectCarsVisible() {
    await expect(this.carTitles.first()).toBeVisible();
  }

  /** Assert a specific car title (Make Model (Year)) is shown on the homepage. */
  async expectCarListed(car: { make: string; model: string; year: number }) {
    const title = `${car.make} ${car.model} (${car.year})`;
    await expect(
      this.page.getByRole("heading", { level: 3, name: title, exact: true }).first(),
    ).toBeVisible();
  }

  /** Assert exact number of visible car cards on homepage. */
  async expectCarCount(expected: number) {
    await expect(this.carTitles).toHaveCount(expected);
  }

  /** Select a booking type (the toggle buttons in the hero search). */
  async selectBookingType(type: "Same Day" | "Night" | "Full Day" | "Airport") {
    await this.bookingTypeGroup.getByRole("button", { name: new RegExp(type, "i") }).click();
  }

  /** Open auth from homepage via the main unauthenticated CTA. */
  async clickRegisterOrLogIn() {
    await expect(this.registerOrLoginButton).toBeVisible();
    await this.registerOrLoginButton.click();
    await expect(this.page).toHaveURL(/\/auth/);
  }
}
