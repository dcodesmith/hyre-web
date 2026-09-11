import { useSearchParams } from "react-router";

import type { ChauffeurOnboarding } from "~/api/chauffeurs/schema";
import type { ChauffeurOnboardingActionData } from "~/chauffeur/chauffeur-onboarding-form-schema";
import { ChauffeurOnboardingPage } from "~/chauffeur/chauffeur-onboarding-page";

const IDEMPOTENCY_KEY = "11111111-1111-4111-8111-111111111111";

const invitedOnboarding = {
  id: "chauffeur-1",
  name: "Bola Adebayo",
  email: "bola@example.com",
  phoneNumber: "+2348012345678",
  fleetOwnerName: "Ada Lovelace",
  status: "INVITED",
  steps: { consent: false, phone: false, nin: false, driving: false },
  complianceRequirements: [
    { type: "LASDRI", label: "LASDRI card", required: false },
    { type: "LASRRA", label: "LASRRA card", required: false },
    { type: "DRIVER_BADGE", label: "Lagos driver badge", required: false },
  ],
} satisfies ChauffeurOnboarding;

function onboardingForStep(step: string | null): ChauffeurOnboarding | null {
  if (!step || step === "unavailable") {
    return null;
  }

  if (step === "phone" || step === "phone-code") {
    return {
      ...invitedOnboarding,
      status: "CONSENTED",
      steps: { ...invitedOnboarding.steps, consent: true },
    };
  }

  if (step === "nin") {
    return {
      ...invitedOnboarding,
      status: "PHONE_VERIFIED",
      steps: { consent: true, phone: true, nin: false, driving: false },
    };
  }

  if (step === "driving") {
    return {
      ...invitedOnboarding,
      status: "IDENTITY_VERIFIED",
      steps: { consent: true, phone: true, nin: true, driving: false },
    };
  }

  if (step === "complete") {
    return {
      ...invitedOnboarding,
      status: "APPROVED",
      steps: { consent: true, phone: true, nin: true, driving: true },
    };
  }

  return invitedOnboarding;
}

function actionDataForStep(step: string | null): ChauffeurOnboardingActionData | undefined {
  if (step === "phone-code") {
    return {
      intent: "send-phone",
      notice: "Code sent to +2348012345678",
    };
  }

  return undefined;
}

export default function ChauffeurOnboardingFixture() {
  const [searchParams] = useSearchParams();
  const step = searchParams.get("step");

  return (
    <ChauffeurOnboardingPage
      actionData={actionDataForStep(step)}
      idempotencyKey={IDEMPOTENCY_KEY}
      onboarding={onboardingForStep(step)}
    />
  );
}
