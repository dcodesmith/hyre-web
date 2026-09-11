import { expect, type Page, test } from "@playwright/test";

const consentKey = "tripdly-cookie-consent:v1";

const stages = [
  {
    step: "",
    name: "unavailable",
    title: "This invitation is unavailable",
    heading: true,
  },
  {
    step: "consent",
    name: "consent",
    title: "Before you begin",
    heading: false,
  },
  {
    step: "phone",
    name: "phone",
    title: "Verify your phone",
    heading: false,
  },
  {
    step: "phone-code",
    name: "phone-code",
    title: "Verify your phone",
    heading: false,
    notice: "Code sent to +2348012345678",
  },
  {
    step: "nin",
    name: "nin",
    title: "Verify your identity",
    heading: false,
  },
  {
    step: "driving",
    name: "driving",
    title: "Verify your driving credentials",
    heading: false,
  },
  {
    step: "complete",
    name: "complete",
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
}

for (const stage of stages) {
  test(`renders the chauffeur onboarding ${stage.name} stage`, async ({ page }) => {
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
  });
}
