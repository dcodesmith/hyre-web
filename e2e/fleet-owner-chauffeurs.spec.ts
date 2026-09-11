import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import {
  MOCK_APPROVED_CHAUFFEUR_ID,
  startMockFleetOwnerAuthApi,
  stopMockFleetOwnerAuthApi,
} from "./mock-fleet-owner-auth-api";

const TABLE_MIN_WIDTH = 768;

async function signInFleetOwner(context: BrowserContext, page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "tripdly-cookie-consent:v1",
      JSON.stringify({ analytics: false, timestamp: 1 }),
    );
  });
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "e2e-session",
      url: "http://localhost:5174",
    },
  ]);
}

function chauffeurName(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 0) >= TABLE_MIN_WIDTH) {
    return page.getByRole("cell", { name: new RegExp(name) }).first();
  }

  return page.getByText(name, { exact: true }).first();
}

test("lists, invites, and deactivates fleet chauffeurs", async ({ context, page }) => {
  const api = await startMockFleetOwnerAuthApi({ ownerDriver: false });

  try {
    await signInFleetOwner(context, page);
    await page.goto("/fleet-owner/chauffeurs");
    await expect(page.getByRole("heading", { name: "Chauffeurs", level: 2 })).toBeVisible();
    await expect(page.getByText("Page 1 of 2 · 21 chauffeurs")).toBeVisible();
    await expect(chauffeurName(page, "Bola Adebayo")).toBeVisible();

    if ((page.viewportSize()?.width ?? 0) >= TABLE_MIN_WIDTH) {
      await expect(page.getByRole("table")).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Chauffeur" })).toBeVisible();
    } else {
      await expect(page.getByRole("table")).toHaveCount(0);
      await expect(page.getByText("Phone", { exact: true }).first()).toBeVisible();
    }

    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL("/fleet-owner/chauffeurs?page=2");
    await expect(page.getByText("Page 2 of 2 · 21 chauffeurs")).toBeVisible();

    await page.goto("/fleet-owner/chauffeurs?page=99");
    await expect(page).toHaveURL("/fleet-owner/chauffeurs?page=2");

    await page.goto("/fleet-owner/chauffeurs");
    await page.getByRole("link", { name: "Invite chauffeur" }).click();
    await expect(page).toHaveURL("/fleet-owner/chauffeurs?invite=1");
    await expect(page.getByRole("heading", { name: "Invite a chauffeur" })).toBeVisible();
    await page.getByLabel("Full name").fill("Grace Hopper");
    await page.getByLabel("Email address").fill("Grace@Example.com");
    await page.getByLabel("Phone number").fill("+2348098765432");
    await page.getByRole("button", { name: "Send invitation" }).click();

    await expect(page).toHaveURL("/fleet-owner/chauffeurs");
    await expect(chauffeurName(page, "Grace Hopper")).toBeVisible();
    await expect
      .poll(() => api.requests.chauffeurInvitations.at(-1))
      .toEqual({
        name: "Grace Hopper",
        email: "grace@example.com",
        phoneNumber: "+2348098765432",
      });

    await page.getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByRole("button", { name: "Activate" })).toBeVisible();
    await expect
      .poll(() => api.requests.chauffeurUpdates.at(-1))
      .toEqual({
        chauffeurId: MOCK_APPROVED_CHAUFFEUR_ID,
        body: { isActive: false },
      });
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});

test("hides chauffeur invitations for owner-driver accounts", async ({ context, page }) => {
  const api = await startMockFleetOwnerAuthApi({ ownerDriver: true });

  try {
    await signInFleetOwner(context, page);
    await page.goto("/fleet-owner/chauffeurs");
    await expect(page.getByRole("heading", { name: "Chauffeurs", level: 2 })).toBeVisible();
    await expect(page.getByText("Your account is set up as owner-driver")).toBeVisible();
    await expect(page.getByRole("link", { name: "Invite chauffeur" })).toHaveCount(0);
    await expect(page.getByText("You are currently the driver for this fleet.")).toBeVisible();
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
