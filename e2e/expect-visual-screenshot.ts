import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Screenshot baselines are captured in CI
 * (`mcr.microsoft.com/playwright:v1.62.1-noble`). macOS and Linux paint
 * fonts and images differently enough to fail a 1% pixel budget.
 */
export async function expectVisualScreenshot(
  target: Page | Locator,
  name: string,
  options?: {
    fullPage?: boolean;
    mask?: Locator[];
    maskColor?: string;
  },
) {
  if (process.platform !== "linux") {
    test.info().annotations.push({
      type: "note",
      description: "Skipped screenshot compare; baselines are Linux CI only.",
    });
    return;
  }

  await expect(target).toHaveScreenshot(name, options);
}
