import { expect, test } from "@playwright/test";

import {
  MOCK_FLEET_CAR_ID,
  MOCK_FLEET_DOCUMENT_ID,
  MOCK_FLEET_IMAGE_ID,
  startMockFleetOwnerAuthApi,
  stopMockFleetOwnerAuthApi,
} from "./mock-fleet-owner-auth-api";

test("replaces rejected car files across responsive viewports", async ({ context, page }) => {
  const api = await startMockFleetOwnerAuthApi({ rejectedFiles: true });

  try {
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

    await page.goto(`/fleet-owner/cars/${MOCK_FLEET_CAR_ID}`);
    await expect(page.getByText("Approval needs attention")).toBeVisible();

    await page.getByLabel("Replacement vehicle image 1", { exact: true }).setInputFiles({
      name: "lexus-front-v2.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("replacement image"),
    });
    await page.getByRole("button", { name: "Upload replacement vehicle image 1" }).click();

    await expect(page.getByLabel("Replacement vehicle image 1", { exact: true })).toHaveCount(0);
    await expect
      .poll(() => api.requests.fileReplacements[0])
      .toMatchObject({
        assetId: MOCK_FLEET_IMAGE_ID,
        kind: "image",
      });
    expect(api.requests.fileReplacements[0]?.contentType).toMatch(
      /^multipart\/form-data; boundary=/,
    );
    expect(api.requests.fileReplacements[0]?.body).toContain('name="file"');
    expect(api.requests.fileReplacements[0]?.body).toContain('filename="lexus-front-v2.jpg"');

    await page.getByLabel("Replacement MOT certificate", { exact: true }).setInputFiles({
      name: "mot-v2.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 replacement"),
    });
    await page.getByRole("button", { name: "Upload replacement mot certificate" }).click();

    await expect(page.getByLabel("Replacement MOT certificate", { exact: true })).toHaveCount(0);
    await expect
      .poll(() => api.requests.fileReplacements[1])
      .toMatchObject({
        assetId: MOCK_FLEET_DOCUMENT_ID,
        kind: "document",
      });
    expect(api.requests.fileReplacements[1]?.contentType).toMatch(
      /^multipart\/form-data; boundary=/,
    );
    expect(api.requests.fileReplacements[1]?.body).toContain('filename="mot-v2.pdf"');
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
