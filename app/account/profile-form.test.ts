import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  Form: ({ children, ...props }: { children?: ReactNode }) =>
    createElement("form", props, children),
  useFetcher: () => ({
    state: "idle",
    data: undefined,
    load: () => undefined,
    submit: () => undefined,
  }),
  useNavigation: () => ({ state: "idle", formMethod: undefined, formAction: undefined }),
}));

vi.mock("~/auth/use-public-user", () => ({
  usePublicUser: () => null,
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
  it("shows a verified number inline and offers a change without leaving the page", () => {
    const markup = renderProfile(true, "+2348012345678");

    expect(markup).toContain("+2348012345678");
    expect(markup).toContain("Phone number verified");
    expect(markup).toContain("Change phone number");
    expect(markup).not.toContain("/verify-phone");
    expect(markup).not.toContain('name="phoneNumber"');
    expect(markup).toContain('id="profile-email"');
    expect(markup).toContain('readOnly=""');
  });

  it("shows the send-code row when the number is unverified or missing", () => {
    const unverified = renderProfile(false, "+2348012345678");
    expect(unverified).toContain("Send code");
    expect(unverified).toContain("+2348012345678");
    expect(unverified).not.toContain("/verify-phone");
    expect(unverified).not.toContain('name="phoneNumber"');

    const missing = renderProfile(false, null);
    expect(missing).toContain("Send code");
    expect(missing).toContain("send you a code to verify this number");
    expect(missing).not.toContain('name="phoneNumber"');
  });
});
