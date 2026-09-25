import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The mobile sidebar first renders the desktop tree, then swaps to a closed sheet.
 * A single toggle during that swap leaves the target hidden, so retry until it is visible.
 */
export async function revealInSidebar(page: Page, item: Locator) {
  const toggle = page.getByRole("button", { name: "Toggle Sidebar" });

  await expect(async () => {
    if (await item.isVisible()) {
      return;
    }

    await toggle.click();
    await expect(item).toBeVisible({ timeout: 2_000 });
  }).toPass();
}
