import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const page = vi.hoisted(() => ({
  signedIn: true,
}));

const fetcher = vi.hoisted(() => ({
  state: "idle" as "idle" | "loading" | "submitting",
  data: undefined as
    | {
        intent: "send-phone" | "check-phone" | null;
        phoneNumber: string | null;
        phoneVerified: boolean;
        maskedPhoneNumber: string | null;
        notice: string | null;
        error: string | null;
        fieldErrors: null;
      }
    | undefined,
  load: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("react-router", () => ({
  useFetcher: () => fetcher,
}));

vi.mock("~/auth/use-public-user", () => ({
  usePublicUser: () => (page.signedIn ? { email: "ada@example.com", name: "Ada" } : null),
}));

import { nextPhoneActionResult, phoneVerificationFromProfile } from "~/auth/use-phone-verification";

import { useBookingPhoneVerification } from "./use-booking-phone-verification";

let latest: ReturnType<typeof useBookingPhoneVerification>;

function Probe({ initial }: { initial?: Parameters<typeof useBookingPhoneVerification>[0] }) {
  latest = useBookingPhoneVerification(initial);
  return null;
}

describe("nextPhoneActionResult", () => {
  const sent = {
    intent: "send-phone" as const,
    phoneNumber: "+2348012345678",
    phoneVerified: false,
    maskedPhoneNumber: "+234••••5678",
    notice: "Code sent.",
    error: null,
    fieldErrors: null,
  };
  const checked = {
    ...sent,
    intent: "check-phone" as const,
    phoneVerified: true,
    notice: null,
  };
  const loaded = {
    ...sent,
    intent: null,
    maskedPhoneNumber: null,
    notice: null,
  };

  it("keeps a send or check when the profile loader revalidates", () => {
    expect(nextPhoneActionResult(sent, { ...loaded, phoneVerified: false })).toEqual(sent);
    expect(nextPhoneActionResult(checked, { ...loaded, phoneVerified: true })).toEqual(checked);
  });

  it("takes a new send or check over the last action", () => {
    expect(nextPhoneActionResult(sent, checked)).toEqual(checked);
  });
});

describe("useBookingPhoneVerification", () => {
  beforeEach(() => {
    page.signedIn = true;
    fetcher.state = "idle";
    fetcher.data = undefined;
    fetcher.load.mockReset();
    fetcher.submit.mockReset();
  });

  it("treats a signed-in phone as verified only after the profile says so", () => {
    renderToStaticMarkup(createElement(Probe));
    expect(latest.phoneVerified).toBe(false);

    fetcher.data = {
      intent: null,
      phoneNumber: "+2348012345678",
      phoneVerified: false,
      maskedPhoneNumber: null,
      notice: null,
      error: null,
      fieldErrors: null,
    };
    renderToStaticMarkup(createElement(Probe));
    expect(latest.phoneVerified).toBe(false);

    fetcher.data = { ...fetcher.data, phoneVerified: true };
    renderToStaticMarkup(createElement(Probe));
    expect(latest.phoneVerified).toBe(true);
  });

  it("hides the row until a profile says the number is unverified", () => {
    renderToStaticMarkup(createElement(Probe));
    expect(latest.visible).toBeNull();

    fetcher.data = {
      intent: null,
      phoneNumber: "+2348012345678",
      phoneVerified: false,
      maskedPhoneNumber: null,
      notice: null,
      error: null,
      fieldErrors: null,
    };
    renderToStaticMarkup(createElement(Probe));

    expect(latest.visible?.phoneNumber).toBe("+2348012345678");
  });

  it("hides a number that was already verified", () => {
    fetcher.data = {
      intent: null,
      phoneNumber: "+2348012345678",
      phoneVerified: true,
      maskedPhoneNumber: null,
      notice: null,
      error: null,
      fieldErrors: null,
    };
    renderToStaticMarkup(createElement(Probe));

    expect(latest.visible).toBeNull();
  });

  it("stays ready for the code while the page revalidates after a send", () => {
    fetcher.state = "loading";
    fetcher.data = {
      intent: "send-phone",
      phoneNumber: "+2348012345678",
      phoneVerified: false,
      maskedPhoneNumber: "+234••••5678",
      notice: "Code sent.",
      error: null,
      fieldErrors: null,
    };
    renderToStaticMarkup(createElement(Probe));

    expect(latest.pending).toBe(false);
    expect(latest.visible?.maskedPhoneNumber).toBe("+234••••5678");

    fetcher.state = "submitting";
    renderToStaticMarkup(createElement(Probe));
    expect(latest.pending).toBe(true);
  });

  it("can seed a profile before the fetcher returns", () => {
    page.signedIn = false;
    renderToStaticMarkup(
      createElement(Probe, {
        initial: phoneVerificationFromProfile({
          phoneNumber: "+2348012345678",
          phoneVerified: true,
        }),
      }),
    );

    expect(latest.phoneVerified).toBe(true);
    expect(latest.result?.phoneNumber).toBe("+2348012345678");
    expect(fetcher.load).not.toHaveBeenCalled();
  });

  it("posts a code check without putting the number on the booking form", () => {
    fetcher.data = {
      intent: "send-phone",
      phoneNumber: "+2348012345678",
      phoneVerified: false,
      maskedPhoneNumber: "+234••••5678",
      notice: "Code sent.",
      error: null,
      fieldErrors: null,
    };
    renderToStaticMarkup(createElement(Probe));
    latest.check("+2348012345678", "123456");

    expect(fetcher.submit).toHaveBeenCalledWith(
      {
        intent: "check-phone",
        phoneNumber: "+2348012345678",
        code: "123456",
        maskedPhoneNumber: "+234••••5678",
      },
      { method: "post", action: "/api/phone-verification" },
    );
  });
});
