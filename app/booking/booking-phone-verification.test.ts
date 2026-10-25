import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingPhoneVerificationForm, phoneValidationMessage } from "./booking-phone-verification";

describe("phoneValidationMessage", () => {
  it("accepts an international number and a local Nigerian number", () => {
    expect(phoneValidationMessage("+234 813 603 0498")).toBeNull();
    expect(phoneValidationMessage("08012345678")).toBeNull();
  });

  it("rejects a number that is too short", () => {
    expect(phoneValidationMessage("12345")).toBe("Invalid phone number");
    expect(phoneValidationMessage("")).toBe("Invalid phone number");
  });
});

describe("BookingPhoneVerificationForm", () => {
  it("shows the send-code row before a code has been sent", () => {
    const markup = renderToStaticMarkup(
      createElement(BookingPhoneVerificationForm, {
        initialPhoneNumber: "+2348012345678",
        maskedPhoneNumber: null,
        notice: null,
        error: null,
        fieldErrors: null,
        pending: false,
        onSend: () => undefined,
        onCheck: () => undefined,
      }),
    );

    expect(markup).toContain("Phone Number");
    expect(markup).toContain("send you a code to verify this number");
    expect(markup).toContain("+234 803 123 4675");
    expect(markup).toContain('spellCheck="false"');
    expect(markup).toContain("Send code");
    expect(markup).toContain('id="booking-phone-number"');
    expect(markup).toContain('name="phone"');
    expect(markup).toContain("<form");
    expect(markup).not.toContain('name="phoneNumber"');
    expect(markup).not.toContain("Verification code");
  });

  it("shows the code field after a code is sent", () => {
    const markup = renderToStaticMarkup(
      createElement(BookingPhoneVerificationForm, {
        initialPhoneNumber: "+2348012345678",
        maskedPhoneNumber: "+234••••5678",
        notice: "Code sent to +234••••5678.",
        error: null,
        fieldErrors: null,
        pending: false,
        onSend: () => undefined,
        onCheck: () => undefined,
      }),
    );

    expect(markup).toContain("Enter Verification Code");
    expect(markup).toContain("We sent a code to +234••••5678");
    expect(markup).toContain("Edit number");
    expect(markup).toContain("6-digit code");
    expect(markup).toContain("Resend code");
    expect(markup).toContain('id="booking-phone-code"');
    expect(markup).toContain('name="code"');
    expect(markup).toContain("Verify");
  });
});
