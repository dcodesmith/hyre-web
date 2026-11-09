import { expect, type Locator, type Page, test } from "@playwright/test";

import { clickUntilVisible } from "./click-until";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

async function inputStyles(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      height: style.height,
      padding: style.padding,
      border: style.border,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      fontWeight: style.fontWeight,
      boxShadow: style.boxShadow,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
    };
  });
}

async function shellStyles(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      overflow: style.overflow,
      border: style.border,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
      color: style.color,
      boxShadow: style.boxShadow,
      padding: style.padding,
    };
  });
}

async function verticalGap(top: Locator, bottom: Locator) {
  const [topBox, bottomBox] = await Promise.all([top.boundingBox(), bottom.boundingBox()]);
  expect(topBox).not.toBeNull();
  expect(bottomBox).not.toBeNull();
  return Math.round((bottomBox?.y ?? 0) - ((topBox?.y ?? 0) + (topBox?.height ?? 0)));
}

function fieldFor(input: Locator) {
  return input.locator("xpath=ancestor::*[@data-slot='field'][1]");
}

async function bottomGap(container: Locator, content: Locator) {
  const [containerBox, contentBox] = await Promise.all([
    container.boundingBox(),
    content.boundingBox(),
  ]);
  expect(containerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  return Math.round(
    (containerBox?.y ?? 0) +
      (containerBox?.height ?? 0) -
      ((contentBox?.y ?? 0) + (contentBox?.height ?? 0)),
  );
}

test("sends guests from /profile to login", async ({ page }) => {
  await page.goto("/profile");

  await expect(page).toHaveURL((url) => {
    return url.pathname === "/auth" && url.searchParams.get("redirectTo") === "/profile";
  });
});

test("renders the profile form fixture", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/profile");

  await expect(page.getByRole("heading", { name: "Your Profile" })).toBeVisible();
  await expect(page.getByText("Update your information and manage your account")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal Information" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Privacy and Security" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("ijeehenry@gmail.com");
  await expect(page.getByLabel("Email")).toBeDisabled();
  await expect(page.getByLabel("Name")).toHaveValue("Lydia");
  await expect(page.getByText("+234 813 603 0498", { exact: true })).toBeVisible();
  await expect(page.getByText("Phone number verified")).toBeVisible();
  await expect(page.getByRole("button", { name: "Change phone number" })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Marketing communications/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Delete Tripidly Account?" })).toBeVisible();

  const deleteAccount = page.getByRole("button", { name: "Delete Account" });
  const saveChanges = page.getByRole("button", { name: "Save Changes" });
  const [deleteAccountBox, saveChangesBox] = await Promise.all([
    deleteAccount.boundingBox(),
    saveChanges.boundingBox(),
  ]);
  expect(deleteAccountBox).not.toBeNull();
  expect(saveChangesBox).not.toBeNull();
  expect(Math.round(deleteAccountBox?.height ?? 0)).toBe(48);
  expect(Math.round(deleteAccountBox?.height ?? 0)).toBe(Math.round(saveChangesBox?.height ?? 0));

  const dialog = page.getByRole("dialog");
  await clickUntilVisible(
    deleteAccount,
    dialog.getByRole("heading", { name: "Are you absolutely sure?" }),
  );
  await expect(dialog).toContainText("This action cannot be undone.");

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  let deletionRequests = 0;
  await page.route("**/api/account/delete*", async (route) => {
    deletionRequests += 1;
    expect(route.request().method()).toBe("POST");
    await route.fulfill({ status: 204 });
  });

  const confirmDelete = page.getByRole("dialog").getByRole("button", { name: "Delete Account" });
  await clickUntilVisible(deleteAccount, confirmDelete);
  await confirmDelete.click();

  await expect.poll(() => deletionRequests).toBe(1);
});

test("matches onboarding standard fields and the Trip Timeline card shell", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/profile");

  const name = page.getByLabel("Name");
  const email = page.getByLabel("Email");
  const city = page.getByLabel("City");
  const address = page.getByLabel("Address");
  const phone = page.locator("[data-phone-verification-state=verified]");
  const fieldStack = page.locator("[data-profile-fields=uniform]");
  const profileCard = page.locator("section").filter({ hasText: "Personal Information" }).first();
  const profileHeader = profileCard.locator(":scope > div").first();
  const profileBody = profileCard.locator(":scope > div").nth(1);
  const privacyCard = page.locator("section").filter({ hasText: "Privacy and Security" }).first();
  const privacyBody = privacyCard.locator(":scope > div").nth(1);
  const saveChanges = page.getByRole("button", { name: "Save Changes" });
  const deleteAccount = page.getByRole("button", { name: "Delete Account" });

  const profileInputStyle = await inputStyles(name);
  const profileDisabledStyle = await inputStyles(email);
  const profileInputClassName = await name.getAttribute("class");
  const profileDisabledClassName = await email.getAttribute("class");
  await name.evaluate((element) => {
    element.setAttribute("aria-invalid", "true");
  });
  const profileInvalidStyle = await inputStyles(name);
  await name.evaluate((element) => {
    element.removeAttribute("aria-invalid");
  });

  await expect(fieldStack.locator(":scope > *")).toHaveCount(5);
  expect(await verticalGap(fieldFor(name), fieldFor(email))).toBe(20);
  expect(await verticalGap(fieldFor(email), phone)).toBe(20);
  expect(await verticalGap(phone, fieldFor(city))).toBe(20);
  expect(await verticalGap(fieldFor(city), fieldFor(address))).toBe(20);
  expect(await bottomGap(profileBody, saveChanges)).toBe(16);
  expect(await bottomGap(privacyBody, deleteAccount)).toBe(16);
  expect(await profileCard.evaluate((element) => getComputedStyle(element).minHeight)).toBe("0px");
  expect(await privacyCard.evaluate((element) => getComputedStyle(element).minHeight)).toBe("0px");
  expect(await profileCard.getAttribute("class")).not.toMatch(/\b(?:h|min-h)-\[/);
  expect(await privacyCard.getAttribute("class")).not.toMatch(/\b(?:h|min-h)-\[/);

  const profileCardStyle = await shellStyles(profileCard);
  const profileHeaderStyle = await shellStyles(profileHeader);
  const profileBodyStyle = await shellStyles(profileBody);

  await page.goto("/__visual/fleet-onboarding?step=phone");
  const onboardingInput = page.getByLabel("Phone number");
  const onboardingInputStyle = await inputStyles(onboardingInput);
  const onboardingInputClassName = await onboardingInput.getAttribute("class");
  await onboardingInput.evaluate((element) => {
    element.setAttribute("aria-invalid", "true");
  });
  const onboardingInvalidStyle = await inputStyles(onboardingInput);

  expect(profileInputStyle).toEqual(onboardingInputStyle);
  expect(profileInvalidStyle.boxShadow).toBe(onboardingInvalidStyle.boxShadow);
  expect(profileInvalidStyle.boxShadow).not.toBe(profileInputStyle.boxShadow);
  expect(profileInputClassName).toBe(onboardingInputClassName);
  expect(profileDisabledClassName).toBe(onboardingInputClassName);
  expect(profileDisabledStyle).toMatchObject({
    height: "40px",
    borderRadius: "4px",
    opacity: "0.5",
    pointerEvents: "none",
  });

  await page.goto("/__visual/booking");
  const timelineCard = page.locator("section").filter({ hasText: "Trip Timeline" }).first();
  const timelineHeader = timelineCard.locator(":scope > div").first();
  const timelineBody = timelineCard.locator(":scope > div").nth(1);

  expect(profileCardStyle).toEqual(await shellStyles(timelineCard));
  expect(profileHeaderStyle).toEqual(await shellStyles(timelineHeader));
  expect(profileBodyStyle).toEqual(await shellStyles(timelineBody));
});

test("matches the onboarding input recipe in the inline phone composite", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/profile?state=changing-phone");

  const phone = page.getByLabel("Phone Number");
  const name = page.getByLabel("Name");
  const email = page.getByLabel("Email");
  const city = page.getByLabel("City");
  const phoneState = page.locator("[data-phone-verification-state=unverified]");
  const sendCode = page.getByRole("button", { name: "Send code" });
  const phoneStyle = await inputStyles(phone);
  const nameStyle = await inputStyles(name);
  const phoneClassName = await phone.getAttribute("class");
  await phone.evaluate((element) => {
    element.setAttribute("aria-invalid", "true");
  });
  await name.evaluate((element) => {
    element.setAttribute("aria-invalid", "true");
  });
  const phoneInvalidStyle = await inputStyles(phone);
  const nameInvalidStyle = await inputStyles(name);
  const [phoneBox, sendBox] = await Promise.all([phone.boundingBox(), sendCode.boundingBox()]);

  expect(phoneBox).not.toBeNull();
  expect(sendBox).not.toBeNull();
  expect(Math.round(phoneBox?.y ?? 0)).toBe(Math.round(sendBox?.y ?? 0));
  expect(Math.round(phoneBox?.height ?? 0)).toBe(40);
  expect(Math.round(sendBox?.height ?? 0)).toBe(40);
  expect(phoneStyle).toMatchObject({
    height: "40px",
    borderRadius: "4px",
  });
  expect(phoneStyle).toEqual(nameStyle);
  expect(phoneInvalidStyle.boxShadow).toBe(nameInvalidStyle.boxShadow);
  expect(phoneInvalidStyle.boxShadow).not.toBe(phoneStyle.boxShadow);
  expect(await verticalGap(fieldFor(email), phoneState)).toBe(20);
  expect(await verticalGap(phoneState, fieldFor(city))).toBe(20);

  await page.goto("/__visual/fleet-onboarding?step=phone");
  const onboardingInput = page.getByLabel("Phone number");
  const onboardingStyle = await inputStyles(onboardingInput);
  const onboardingClassName = await onboardingInput.getAttribute("class");

  expect(phoneStyle).toEqual(onboardingStyle);
  expect(phoneClassName).toBe(onboardingClassName);
});
