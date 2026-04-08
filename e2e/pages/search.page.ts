import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Search results page (/search) — car grid with filters.
 */
export class SearchPage {
  readonly page: Page;
  readonly carCards: Locator;
  readonly carTitles: Locator;

  constructor(page: Page) {
    this.page = page;
    this.carCards = page.locator('a[href*="/cars/"]');
    this.carTitles = page.getByRole("heading", { level: 3 }).filter({ hasText: /\(\d{4}\)/ });
  }

  async expectResultsVisible() {
    await expect(this.carTitles.first()).toBeVisible();
  }

  /** Assert exact number of visible car cards on search page. */
  async expectResultCount(expected: number) {
    await expect(this.carTitles).toHaveCount(expected);
  }

  /** Click the first car card whose text includes the given make or model. */
  async selectCarByName(name: string) {
    const card = this.carCards
      .filter({
        has: this.page.getByRole("heading", {
          level: 3,
          name: new RegExp(name, "i"),
        }),
      })
      .first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(this.page).toHaveURL(/\/cars\//);
  }

  /** Click the very first car card in the grid. */
  async selectFirstCar() {
    await expect(this.carCards.first()).toBeVisible();
    await this.carCards.first().click();
    await expect(this.page).toHaveURL(/\/cars\//);
  }
}
