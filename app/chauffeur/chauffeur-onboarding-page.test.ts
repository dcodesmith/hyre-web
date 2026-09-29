import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/hooks/use-revalidate-interval", () => ({
  useRevalidateInterval: () => undefined,
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

function render(drivingSubmitted: boolean) {
  return renderToStaticMarkup(
    createElement(ChauffeurOnboardingPage, {
      idempotencyKey: "018f47a2-7b3c-7d4e-8f90-1234567894c2",
      onboarding: {
        ...onboarding,
        steps: { ...onboarding.steps, drivingSubmitted },
      },
    }),
  );
}

describe("chauffeur driving waiting state", () => {
  it("shows a generic wait and hides the photo form and provider names", () => {
    const markup = render(true);

    expect(markup).toContain("Checking your photo");
    expect(markup).not.toContain("Take selfie");
    expect(markup).not.toContain("Complete verification");
    expect(markup).not.toMatch(/smile|mono|prembly/i);
  });

  it("keeps the driving form available before a photo is submitted", () => {
    const markup = render(false);

    expect(markup).toContain("Verify your driving credentials");
    expect(markup).toContain("Take selfie");
    expect(markup).not.toContain("Checking your photo");
  });

  it("does not keep a previous invitation's wait state on a new onboarding id", () => {
    const waiting = renderToStaticMarkup(
      createElement(ChauffeurOnboardingPage, {
        key: onboarding.id,
        idempotencyKey: "018f47a2-7b3c-7d4e-8f90-1234567894c2",
        onboarding: {
          ...onboarding,
          steps: { ...onboarding.steps, drivingSubmitted: true },
        },
      }),
    );
    const nextId = "018f47a2-7b3c-7d4e-8f90-1234567894c9";
    const nextSession = renderToStaticMarkup(
      createElement(ChauffeurOnboardingPage, {
        key: nextId,
        idempotencyKey: "018f47a2-7b3c-7d4e-8f90-1234567894c3",
        onboarding: { ...onboarding, id: nextId },
      }),
    );

    expect(waiting).toContain("Checking your photo");
    expect(nextSession).toContain("Take selfie");
    expect(nextSession).not.toContain("Checking your photo");
  });

  it("shows the retake form when staff request a clearer selfie", () => {
    const markup = renderToStaticMarkup(
      createElement(ChauffeurOnboardingPage, {
        idempotencyKey: "018f47a2-7b3c-7d4e-8f90-1234567894c2",
        onboarding: {
          ...onboarding,
          steps: { ...onboarding.steps, selfieRetakeRequired: true },
        },
      }),
    );

    expect(markup).toContain("Take a new profile photo");
    expect(markup).toContain("Submit new selfie");
  });
});
