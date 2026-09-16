import { describe, expect, it } from "vitest";
import {
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
