import { parseWithZod } from "@conform-to/zod/v4";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  formData: null as FormData | null,
}));

vi.mock("react-router", () => ({
  Form: ({ children, ...props }: { children?: ReactNode }) =>
    createElement("form", props, children),
  Link: ({
    children,
    to,
    replace: _replace,
    ...props
  }: {
    children?: ReactNode;
    to?: string;
    replace?: boolean;
  }) => createElement("a", { ...props, href: to }, children),
  useLocation: () => ({ pathname: "/verify-phone", search: "?redirectTo=%2Fbookings" }),
  useNavigation: () => ({
    state: navigation.formData ? "submitting" : "idle",
    formData: navigation.formData,
    formMethod: navigation.formData ? "POST" : undefined,
    formAction: "/verify-phone",
  }),
}));

import { PhoneVerificationForm } from "./phone-verification-form";
import {
  phoneVerificationCheckSchema,
  phoneVerificationSendSchema,
} from "./phone-verification-schema";

function invalidSend() {
  const formData = new FormData();
  formData.set("phoneNumber", "08012345678");
  const submission = parseWithZod(formData, { schema: phoneVerificationSendSchema });
  if (submission.status !== "error") {
    throw new Error("expected an invalid phone number");
  }
  return submission.reply();
}

function invalidCode() {
  const formData = new FormData();
  formData.set("phoneNumber", "+2348012345678");
  formData.set("code", "12");
  const submission = parseWithZod(formData, { schema: phoneVerificationCheckSchema });
  if (submission.status !== "error") {
    throw new Error("expected an invalid code");
  }
  return submission.reply();
}

function renderForm(
  props: Partial<{
    actionData: {
      intent: "send-phone" | "check-phone";
      maskedPhoneNumber?: string;
      notice?: string;
      phoneNumber?: string;
      submission?: ReturnType<typeof invalidSend>;
    };
    changingPhone: boolean;
    initialPhoneNumber: string;
  }> = {},
) {
  return renderToStaticMarkup(
    createElement(PhoneVerificationForm, {
      changingPhone: false,
      ...props,
    }),
  );
}

describe("PhoneVerificationForm", () => {
  it("collects an E.164 number and explains why the number is used", () => {
    navigation.formData = null;
    const markup = renderForm({ initialPhoneNumber: "+2348012345678" });

    expect(markup).toContain("Verify your phone");
    expect(markup).toContain(
      "Used for booking updates, trip coordination and secure WhatsApp booking. Your number is never shared with fleet owners or chauffeurs.",
    );
    expect(markup).toContain("Phone number");
    expect(markup).toContain('type="tel"');
    expect(markup).toContain('inputMode="tel"');
    expect(markup).toContain('autoComplete="tel"');
    expect(markup).toContain('placeholder="+2348012345678"');
    expect(markup).toContain('value="+2348012345678"');
    expect(markup).toContain("Use international format, including the country code.");
    expect(markup).toContain('aria-label="Send phone verification code"');
    expect(markup).toContain('action="/logout"');
    expect(markup).toContain("Sign out");
    expect(markup).not.toContain("Resend code");
  });

  it("shows an international-format error on the phone field", () => {
    navigation.formData = null;
    const markup = renderForm({
      actionData: {
        intent: "send-phone",
        phoneNumber: "08012345678",
        submission: invalidSend(),
      },
    });

    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Enter a phone number in international format");
    expect(markup).not.toContain("Verification code");
  });

  it("names a phone change and keeps the code step available to resend or edit", () => {
    navigation.formData = null;
    const markup = renderForm({
      changingPhone: true,
      actionData: {
        intent: "send-phone",
        maskedPhoneNumber: "+234******5678",
        notice: "Code sent to +234******5678.",
        phoneNumber: "+2348012345678",
      },
    });

    expect(markup).toContain("Change your phone number");
    expect(markup).toContain("Code sent to +234******5678.");
    expect(markup).toContain("Verification code");
    expect(markup).toContain('inputMode="numeric"');
    expect(markup).toContain('autoComplete="one-time-code"');
    expect(markup).toContain('maxLength="10"');
    expect(markup).toContain('value="+2348012345678"');
    expect(markup).toContain('value="+234******5678"');
    expect(markup).toContain("Resend code");
    expect(markup).toContain('href="/verify-phone?redirectTo=%2Fbookings"');
    expect(markup).toContain("Edit number");
    expect(markup).toContain('aria-label="Verify phone"');
    expect(markup).toContain('action="/logout"');
  });

  it("shows a resend as pending and an invalid code on the code field", () => {
    const formData = new FormData();
    formData.set("intent", "send-phone");
    navigation.formData = formData;

    const markup = renderForm({
      actionData: {
        intent: "check-phone",
        maskedPhoneNumber: "+234******5678",
        phoneNumber: "+2348012345678",
        submission: invalidCode(),
      },
    });

    expect(markup).toContain("Resending…");
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("Enter the verification code");
    expect(markup).toContain('aria-invalid="true"');
  });
});
