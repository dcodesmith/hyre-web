import { expect, type Locator } from "@playwright/test";

async function scrollTriggerIntoView(trigger: Locator) {
  await trigger.evaluate((node) => {
    node.scrollIntoView({ block: "center", inline: "nearest" });
  });
}

export async function clickUntilVisible(trigger: Locator, target: Locator) {
  await expect(async () => {
    if (await target.isVisible()) {
      return;
    }

    await scrollTriggerIntoView(trigger);
    await trigger.click();
    await expect(target).toBeVisible({ timeout: 1500 });
  }).toPass();
}

export async function clickUntilAttribute(trigger: Locator, name: string, value: string) {
  await expect(async () => {
    if ((await trigger.getAttribute(name)) === value) {
      return;
    }

    await scrollTriggerIntoView(trigger);
    await trigger.click();
    await expect(trigger).toHaveAttribute(name, value, { timeout: 1500 });
  }).toPass();
}
