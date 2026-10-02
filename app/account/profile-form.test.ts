import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  Form: ({ children, ...props }: { children?: ReactNode }) =>
    createElement("form", props, children),
  Link: ({ children, to, ...props }: { children?: ReactNode; to?: string }) =>
    createElement("a", { ...props, href: to }, children),
  useFetcher: () => ({
    state: "idle",
    data: undefined,
    Form: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("form", props, children),
  }),
  useNavigation: () => ({ state: "idle", formMethod: undefined, formAction: undefined }),
}));

import { ProfilePage } from "./profile-form";

function renderProfile(phoneVerified: boolean, phoneNumber: string | null) {
  return renderToStaticMarkup(
    createElement(ProfilePage, {
      email: "ada@example.com",
      profile: {
        name: "Ada Lovelace",
        phoneNumber,
        phoneVerified,
        city: "Lagos",
        address: "12 Marina",
        marketingConsent: false,
      },
    }),
  );
}

describe("ProfilePage phone", () => {
  it("shows a verified number as read-only and routes changes through verification", () => {
    const markup = renderProfile(true, "+2348012345678");

    expect(markup).toContain("+2348012345678");
    expect(markup).toContain("Verified");
    expect(markup).toContain('href="/verify-phone?redirectTo=%2Fprofile&amp;change=phone"');
    expect(markup).toContain("Change phone number");
    expect(markup).not.toContain('name="phoneNumber"');
    expect(markup).toContain('id="profile-email"');
    expect(markup).toContain('readOnly=""');
  });

  it("routes an unverified or missing number to verification", () => {
    const unverified = renderProfile(false, "+2348012345678");
    expect(unverified).toContain("Not verified");
    expect(unverified).toContain('href="/verify-phone?redirectTo=%2Fprofile"');
    expect(unverified).toContain("Verify phone number");
    expect(unverified).not.toContain("change=phone");

    const missing = renderProfile(false, null);
    expect(missing).toContain("Not added");
    expect(missing).toContain("Verify phone number");
    expect(missing).not.toContain('name="phoneNumber"');
  });
});
