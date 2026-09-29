import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateInterval = vi.hoisted(() => vi.fn());

vi.mock("react-router", () => ({
  Form: ({ children, ...props }: { children?: ReactNode }) =>
    createElement("form", props, children),
  useNavigation: () => ({ state: "idle" }),
}));
vi.mock("~/hooks/use-revalidate-interval", () => ({
  useRevalidateInterval: revalidateInterval,
}));

import type { FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import {
  FleetOwnerOnboardingPage,
  getFleetOwnerOnboardingProgress,
  getFleetOwnerOnboardingStage,
  shouldShowFleetOwnerPhoneCodeStep,
} from "./fleet-owner-onboarding-page";

describe("shouldShowFleetOwnerPhoneCodeStep", () => {
  it("stays on the phone form when sending a code fails", () => {
    expect(
      shouldShowFleetOwnerPhoneCodeStep({
        intent: "send-phone",
        error: "Unable to complete this onboarding step. Please try again.",
      }),
    ).toBe(false);
  });

  it("opens the SMS code form after a code is sent", () => {
    expect(shouldShowFleetOwnerPhoneCodeStep({ intent: "send-phone" })).toBe(true);
  });

  it("keeps the SMS code form after a code check", () => {
    expect(
      shouldShowFleetOwnerPhoneCodeStep({
        intent: "check-phone",
        error: "The phone verification code is invalid or expired",
      }),
    ).toBe(true);
  });

  it("opens the SMS code form when the owner already has a code", () => {
    expect(shouldShowFleetOwnerPhoneCodeStep(undefined, true)).toBe(true);
  });
});

describe("getFleetOwnerOnboardingStage", () => {
  it("keeps contact current when email still needs verifying during licence recovery", () => {
    expect(
      getFleetOwnerOnboardingStage({
        nextAction: "VERIFY_EMAIL",
        requiredActions: ["VERIFY_EMAIL", "UPLOAD_DRIVERS_LICENSE"],
      }),
    ).toBe("contact");
  });

  it("keeps contact current when phone still needs verifying during licence recovery", () => {
    expect(
      getFleetOwnerOnboardingStage({
        nextAction: "VERIFY_PHONE",
        requiredActions: ["VERIFY_PHONE", "UPLOAD_DRIVERS_LICENSE"],
      }),
    ).toBe("contact");
  });

  it("gives a required driver licence upload precedence over waiting for review", () => {
    expect(
      getFleetOwnerOnboardingStage({
        nextAction: "WAIT_FOR_REVIEW",
        requiredActions: ["UPLOAD_DRIVERS_LICENSE"],
      }),
    ).toBe("driving");
  });

  it("keeps a selfie retake and a terminal rejection on their stages", () => {
    expect(
      getFleetOwnerOnboardingStage({
        nextAction: "RETAKE_SELFIE",
        requiredActions: [],
      }),
    ).toBe("driving");
    expect(
      getFleetOwnerOnboardingStage({
        nextAction: "REJECTED",
        requiredActions: [],
      }),
    ).toBe("submission");
  });

  it("maps the normal progression and completion states", () => {
    expect(
      getFleetOwnerOnboardingStage({
        nextAction: "VERIFY_IDENTITY",
        requiredActions: [],
      }),
    ).toBe("identity");
    expect(
      getFleetOwnerOnboardingStage({
        nextAction: "COMPLETE",
        requiredActions: [],
      }),
    ).toBeNull();
  });

  it("keeps submitted stages completed while a driving licence requires recovery", () => {
    const progress = getFleetOwnerOnboardingProgress({
      nextAction: "WAIT_FOR_REVIEW",
      requiredActions: ["UPLOAD_DRIVERS_LICENSE"],
      steps: {
        contact: "VERIFIED",
        identity: "VERIFIED",
        payout: "VERIFIED",
        driving: "COMPLETED",
        submission: "REVIEW_REQUIRED",
      },
    });

    expect(progress.find(({ key }) => key === "driving")?.complete).toBe(false);
    expect(progress.find(({ key }) => key === "submission")?.complete).toBe(true);
  });
});

const reviewingOwner = {
  status: "UNDER_REVIEW",
  accountType: "INDIVIDUAL",
  isOwnerDriver: true,
  emailVerified: true,
  phone: { number: "+2348012345678", verified: true },
  identity: { status: "SUCCEEDED", legalName: "Ada Lovelace", businessName: null },
  bank: {
    bankName: "GTBank",
    accountName: "ADA LOVELACE",
    accountNumber: "******6789",
    verified: true,
  },
  documents: { driversLicense: "APPROVED", lasdri: null },
  requiredActions: [],
  steps: {
    contact: "VERIFIED",
    identity: "VERIFIED",
    payout: "VERIFIED",
    driving: "COMPLETED",
    submission: "REVIEW_REQUIRED",
  },
  nextAction: "WAIT_FOR_REVIEW",
} satisfies FleetOwnerOnboarding;

function renderOwner(onboarding: FleetOwnerOnboarding) {
  return renderToStaticMarkup(
    createElement(FleetOwnerOnboardingPage, {
      banks: [],
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      onboarding,
    }),
  );
}

describe("fleet owner selfie review screens", () => {
  beforeEach(() => {
    revalidateInterval.mockClear();
  });

  it("polls while staff are reviewing the account", () => {
    const markup = renderOwner(reviewingOwner);

    expect(markup).toContain("Verification Under Review");
    expect(revalidateInterval).toHaveBeenCalledTimes(1);
    expect(revalidateInterval).toHaveBeenCalledWith(4_000);
  });

  it("shows the selfie retake form when that is the next action", () => {
    const markup = renderOwner({ ...reviewingOwner, nextAction: "RETAKE_SELFIE" });

    expect(markup).toContain("Take a New Profile Photo");
    expect(markup).toContain("Submit new selfie");
    expect(markup).toContain('name="intent" value="replace-selfie"');
    expect(markup).toContain(
      "Take a clear selfie in good light. After approval, this becomes your profile picture.",
    );
    expect(markup).not.toContain("Verification Under Review");
    expect(revalidateInterval).not.toHaveBeenCalled();
  });

  it("shows a terminal rejection without another form", () => {
    const markup = renderOwner({
      ...reviewingOwner,
      status: "ACTION_REQUIRED",
      nextAction: "REJECTED",
    });

    expect(markup).toContain("Verification not approved");
    expect(markup).not.toContain("Submit new selfie");
    expect(markup).not.toContain("Verification Under Review");
    expect(revalidateInterval).not.toHaveBeenCalled();
  });
});
