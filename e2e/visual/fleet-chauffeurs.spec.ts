import { expect, type Page, test } from "@playwright/test";

import { expectVisualScreenshot } from "../expect-visual-screenshot";

const TABLE_MIN_WIDTH = 768;

const states = [
  { state: "", screenshot: "fleet-chauffeurs-list.png" },
  { state: "empty", screenshot: "fleet-chauffeurs-empty.png", empty: "No chauffeurs yet" },
  {
    state: "owner-driver",
    screenshot: "fleet-chauffeurs-owner-driver.png",
    notice: "Your account is set up as owner-driver",
  },
] as const;

async function visitFleetChauffeurs(page: Page, state: string) {
  const path = state ? `/__visual/fleet-chauffeurs?state=${state}` : "/__visual/fleet-chauffeurs";
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

for (const fixture of states) {
  test(`renders the fleet chauffeur ${fixture.screenshot.replace(".png", "")} state`, async ({
    page,
    viewport,
  }) => {
    await visitFleetChauffeurs(page, fixture.state);

    await expect(page.getByRole("heading", { name: "Chauffeurs", level: 2 })).toBeVisible();
    if ("empty" in fixture) {
      await expect(page.getByText(fixture.empty)).toBeVisible();
    }
    if ("notice" in fixture) {
      await expect(page.getByText(fixture.notice)).toBeVisible();
      await expect(page.getByRole("link", { name: "Invite chauffeur" })).toHaveCount(0);
    }
    if (!fixture.state) {
      await expect(page.getByText("Bola Adebayo").filter({ visible: true }).first()).toBeVisible();
      if ((viewport?.width ?? 0) >= TABLE_MIN_WIDTH) {
        await expect(page.getByRole("table")).toBeVisible();
      } else {
        await expect(page.getByRole("table")).toHaveCount(0);
      }
    }

    await expectVisualScreenshot(page, fixture.screenshot, { fullPage: true });
  });
}
