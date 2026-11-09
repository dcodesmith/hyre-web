import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  Form: ({ children, ...props }: { children?: ReactNode }) =>
    createElement("form", props, children),
  Link: ({ children, to, ...props }: { children?: ReactNode; to: string }) =>
    createElement("a", { href: to, ...props }, children),
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
  it("uses onboarding standard fields inside the booking detail card shell", () => {
    const markup = renderProfile(true, "+2348012345678");

    expect(markup).toContain("Your Profile");
    expect(markup).toContain("Update your information and manage your account");
    expect(markup).toContain("Personal Information");
    expect(markup).toContain("Privacy and Security");
    expect(markup).toContain("Delete Tripidly Account?");
    expect(markup).toContain('data-slot="input"');
    expect(markup).toContain('data-slot="button"');
    expect(markup.match(/h-10 rounded-sm/g)).toHaveLength(4);
    expect(markup).toContain("h-12 w-[152px] rounded-md");
    expect(markup).toMatch(/data-variant="destructive"[^>]*class="[^"]*\bh-12\b/);
    expect(markup.match(/data-profile-fields=/g)).toHaveLength(1);
    expect(markup).toContain('data-profile-fields="uniform"');
    expect(markup).toContain("space-y-5 text-foreground");
    expect(markup.match(/placeholder="Enter name"/g)).toHaveLength(1);
    expect(markup).toContain('placeholder="Enter city"');
    expect(markup).toContain('placeholder="Enter address"');
    expect(markup).not.toContain("data-profile-standard-fields");
    expect(markup).toContain(
      "overflow-hidden rounded border border-gray-200 bg-white text-gray-900",
    );
    expect(markup).toContain(
      "border-b border-gray-200 bg-gray-50 p-4 text-base leading-6 font-semibold",
    );
    expect(markup).not.toContain("min-h-[733px]");
    expect(markup).not.toContain("h-[395px]");
  });

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
    expect(unverified).toContain("h-10 rounded-sm");
    expect(unverified).toContain("+2348012345678");
    expect(unverified).not.toContain("/verify-phone");
    expect(unverified).not.toContain('name="phoneNumber"');

    const missing = renderProfile(false, null);
    expect(missing).toContain("Send code");
    expect(missing).toContain("send you a code to verify this number");
    expect(missing).not.toContain('name="phoneNumber"');
  });
});
