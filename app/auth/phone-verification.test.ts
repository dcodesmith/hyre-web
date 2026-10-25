import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PhoneVerificationData } from "~/routes/api.phone-verification";

import { nextPhoneChangeState, PhoneVerification } from "./phone-verification";

const verified: PhoneVerificationData = {
  intent: null,
  phoneNumber: "+2348012345678",
  phoneVerified: true,
  maskedPhoneNumber: null,
  notice: null,
  error: null,
  fieldErrors: null,
};

const sent: PhoneVerificationData = {
  ...verified,
  intent: "send-phone",
  phoneVerified: false,
  maskedPhoneNumber: "+234••••5678",
  notice: "Code sent to +234••••5678.",
};

const checked: PhoneVerificationData = {
  ...verified,
  intent: "check-phone",
  maskedPhoneNumber: "+2348012345678",
};

const failedCheck: PhoneVerificationData = {
  ...sent,
  intent: "check-phone",
  phoneVerified: false,
  error: null,
  fieldErrors: { code: ["That code is not valid."] },
};

function phone(result: PhoneVerificationData | null) {
  return {
    result,
    visible: result,
    pending: false,
    phoneVerified: result?.phoneVerified === true,
    send: () => undefined,
    check: () => undefined,
  };
}

describe("nextPhoneChangeState", () => {
  it("keeps a fresh change on a stale successful check so Change can run again", () => {
    expect(nextPhoneChangeState({ changing: true, fresh: true }, checked)).toEqual({
      changing: true,
      fresh: true,
    });
  });

  it("clears fresh after a new send so the code row can appear", () => {
    expect(nextPhoneChangeState({ changing: true, fresh: true }, sent)).toEqual({
      changing: true,
      fresh: false,
    });
  });

  it("stays on the code row when the check fails", () => {
    expect(nextPhoneChangeState({ changing: true, fresh: false }, failedCheck)).toEqual({
      changing: true,
      fresh: false,
    });
  });

  it("returns to the verified row after a check that started after Change", () => {
    expect(nextPhoneChangeState({ changing: true, fresh: false }, checked)).toEqual({
      changing: false,
      fresh: false,
    });
  });
});

describe("PhoneVerification", () => {
  it("hides an already-verified number on the booking card", () => {
    const markup = renderToStaticMarkup(
      createElement(PhoneVerification, { phone: phone(verified), hideWhenVerified: true }),
    );

    expect(markup).toBe("");
  });

  it("shows a change control on profile", () => {
    const markup = renderToStaticMarkup(
      createElement(PhoneVerification, { phone: phone(verified), allowChange: true }),
    );

    expect(markup).toContain("+2348012345678");
    expect(markup).toContain("Phone number verified");
    expect(markup).toContain("Change phone number");
  });
});
