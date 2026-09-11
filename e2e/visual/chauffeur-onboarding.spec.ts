import { expect, type Page, test } from "@playwright/test";

import { expectVisualScreenshot } from "../expect-visual-screenshot";

const consentKey = "tripdly-cookie-consent:v1";

const stages = [
  {
    step: "",
    screenshot: "chauffeur-onboarding-unavailable.png",
    title: "This invitation is unavailable",
    heading: true,
  },
  {
    step: "consent",
    screenshot: "chauffeur-onboarding-consent.png",
    title: "Before you begin",
    heading: false,
  },
  {
    step: "phone",
    screenshot: "chauffeur-onboarding-phone.png",
    title: "Verify your phone",
    heading: false,
  },
  {
    step: "phone-code",
    screenshot: "chauffeur-onboarding-phone-code.png",
    title: "Verify your phone",
    heading: false,
    notice: "Code sent to +2348012345678",
  },
  {
    step: "nin",
    screenshot: "chauffeur-onboarding-nin.png",
    title: "Verify your identity",
    heading: false,
  },
  {
    step: "driving",
    screenshot: "chauffeur-onboarding-driving.png",
    title: "Verify your driving credentials",
    heading: false,
  },
  {
    step: "complete",
    screenshot: "chauffeur-onboarding-complete.png",
    title: "Verification complete",
    heading: true,
  },
] as const;

async function visitChauffeurOnboarding(page: Page, step: string) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
  const path = step
    ? `/__visual/chauffeur-onboarding?step=${step}`
    : "/__visual/chauffeur-onboarding";
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

for (const stage of stages) {
  test(`renders the chauffeur onboarding ${stage.screenshot.replace(".png", "")} stage`, async ({
    page,
  }) => {
    await visitChauffeurOnboarding(page, stage.step);

    if (stage.heading) {
      await expect(page.getByRole("heading", { name: stage.title })).toBeVisible();
    } else {
      await expect(page.getByText(stage.title, { exact: true })).toBeVisible();
    }
    if (stage.step) {
      await expect(page.getByRole("heading", { name: "Welcome, Bola Adebayo" })).toBeVisible();
    }
    if ("notice" in stage) {
      await expect(page.getByText(stage.notice)).toBeVisible();
    }

    await expectVisualScreenshot(page, stage.screenshot, { fullPage: true });
  });
}
