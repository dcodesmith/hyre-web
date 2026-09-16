import { describe, expect, it } from "vitest";
import {
  getFleetOwnerOnboardingProgress,
  getFleetOwnerOnboardingStage,
} from "./fleet-owner-onboarding-page";

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
