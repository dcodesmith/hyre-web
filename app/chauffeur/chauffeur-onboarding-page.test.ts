import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateInterval = vi.hoisted(() => vi.fn());

vi.mock("~/hooks/use-revalidate-interval", () => ({
  useRevalidateInterval: revalidateInterval,
}));
vi.mock("~/components/cookie-consent-banner", () => ({
  CookieConsentBanner: () => null,
}));
vi.mock("~/components/layout/brand-link", () => ({
  BrandLink: () => null,
}));
vi.mock("./chauffeur-onboarding-forms", () => ({
  ChauffeurConsentForm: () => null,
  ChauffeurDrivingForm: () => "Take selfie",
  ChauffeurNinForm: () => null,
  ChauffeurPhoneForm: () => null,
  ChauffeurSelfieForm: () => "Submit new selfie",
}));

import type { ChauffeurOnboarding } from "~/api/chauffeurs/schema";
import { ChauffeurOnboardingPage } from "./chauffeur-onboarding-page";

const onboarding: ChauffeurOnboarding = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567894c1",
  name: "Bola Adebayo",
  email: "bola@example.com",
  phoneNumber: "+2348012345678",
  fleetOwnerName: "Ada Lovelace",
  status: "IDENTITY_VERIFIED",
  steps: {
    consent: true,
    phone: true,
    nin: true,
    driving: false,
    drivingSubmitted: false,
    rejected: false,
    selfieRetakeRequired: false,
  },
  complianceRequirements: [],
};

const idempotencyKey = "018f47a2-7b3c-7d4e-8f90-1234567894c2";

function renderPage(
  steps: Partial<ChauffeurOnboarding["steps"]> = {},
  actionData?: { intent: "verify-driving" },
) {
  return renderToStaticMarkup(
    createElement(ChauffeurOnboardingPage, {
      actionData,
      idempotencyKey,
      onboarding: {
        ...onboarding,
        steps: { ...onboarding.steps, ...steps },
      },
    }),
  );
}

describe("chauffeur driving review screens", () => {
  beforeEach(() => {
    revalidateInterval.mockClear();
  });

  it("waits only when the loader says the photo was submitted", () => {
    const waiting = renderPage({ drivingSubmitted: true });
    const submittedAction = renderPage({}, { intent: "verify-driving" });

    expect(waiting).toContain("Submitted for review");
    expect(waiting).not.toContain("Take selfie");
    expect(waiting).not.toContain("Complete verification");
    expect(waiting).not.toMatch(/smile|mono|prembly/i);
    expect(revalidateInterval).toHaveBeenCalledTimes(1);
    expect(revalidateInterval).toHaveBeenCalledWith(4_000);
    expect(submittedAction).toContain("Take selfie");
    expect(submittedAction).not.toContain("Submitted for review");
  });

  it("keeps the driving form available before a photo is submitted", () => {
    const markup = renderPage();

    expect(markup).toContain("Verify your driving credentials");
    expect(markup).toContain("Take selfie");
    expect(markup).not.toContain("Submitted for review");
    expect(revalidateInterval).not.toHaveBeenCalled();
  });

  it("shows the retake form when staff request a clearer selfie", () => {
    const markup = renderPage({ drivingSubmitted: true, selfieRetakeRequired: true });

    expect(markup).toContain("Take a new profile photo");
    expect(markup).toContain("Submit new selfie");
    expect(markup).not.toContain("Submitted for review");
    expect(markup).not.toContain("Take selfie");
    expect(revalidateInterval).not.toHaveBeenCalled();
  });

  it("shows a terminal rejection without another photo form", () => {
    const markup = renderPage({ drivingSubmitted: true, rejected: true });

    expect(markup).toContain("Verification not approved");
    expect(markup).toContain("Contact your fleet owner for help.");
    expect(markup).not.toContain("Take selfie");
    expect(markup).not.toContain("Submit new selfie");
    expect(markup).not.toContain("Submitted for review");
    expect(revalidateInterval).not.toHaveBeenCalled();
  });
});
