import { useSearchParams } from "react-router";

import type { FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import { FleetOwnerOnboardingPage } from "~/fleet/onboarding/fleet-owner-onboarding-page";
import type { OnboardingActionData } from "~/fleet/onboarding/onboarding-form-schema";

const IDEMPOTENCY_KEY = "11111111-1111-4111-8111-111111111111";
const BANKS = [
  { code: "058", name: "GTBank" },
  { code: "033", name: "UBA" },
];

const pendingSteps = {
  contact: "PENDING",
  identity: "PENDING",
  payout: "PENDING",
  driving: "PENDING",
  submission: "PENDING",
} as const;

const accountOnboarding = {
  status: "ACTION_REQUIRED",
  accountType: null,
  isOwnerDriver: null,
  emailVerified: true,
  phone: { number: "+2348012345678", verified: true },
  identity: null,
  bank: null,
  documents: { driversLicense: null, lasdri: null },
  requiredActions: [],
  steps: { ...pendingSteps, contact: "VERIFIED" },
  nextAction: "VERIFY_IDENTITY",
} satisfies FleetOwnerOnboarding;

function onboardingForStep(step: string | null): FleetOwnerOnboarding {
  if (step === "email") {
    return {
      ...accountOnboarding,
      emailVerified: false,
      phone: { number: null, verified: false },
      requiredActions: ["VERIFY_EMAIL", "VERIFY_PHONE", "VERIFY_ACCOUNT"],
      steps: pendingSteps,
      nextAction: "VERIFY_EMAIL",
    };
  }

  if (step === "phone" || step === "phone-code" || step === "phone-error") {
    return {
      ...accountOnboarding,
      phone: { number: "+2348012345678", verified: false },
      requiredActions: ["VERIFY_PHONE", "VERIFY_ACCOUNT"],
      steps: pendingSteps,
      nextAction: "VERIFY_PHONE",
    };
  }

  if (step === "payout") {
    return {
      ...accountOnboarding,
      accountType: "INDIVIDUAL",
      identity: {
        status: "SUCCEEDED",
        legalName: "Ada Lovelace",
        businessName: null,
      },
      steps: { ...pendingSteps, contact: "VERIFIED", identity: "VERIFIED" },
      nextAction: "VERIFY_PAYOUT",
    };
  }

  if (step === "driving" || step === "driving-yes") {
    return {
      ...accountOnboarding,
      accountType: "INDIVIDUAL",
      identity: {
        status: "SUCCEEDED",
        legalName: "Ada Lovelace",
        businessName: null,
      },
      bank: {
        bankName: "GTBank",
        accountName: "ADA LOVELACE",
        accountNumber: "******6789",
        verified: false,
      },
      steps: {
        ...pendingSteps,
        contact: "VERIFIED",
        identity: "VERIFIED",
        payout: "VERIFIED",
      },
      nextAction: "PROVIDE_DRIVING_CREDENTIALS",
    };
  }

  if (step === "submit" || step === "submit-skipped" || step === "submit-business") {
    const isBusiness = step === "submit-business";
    const isDriver = step === "submit" || isBusiness;
    return {
      ...accountOnboarding,
      accountType: isBusiness ? "BUSINESS" : "INDIVIDUAL",
      isOwnerDriver: isDriver,
      identity: {
        status: "SUCCEEDED",
        legalName: "Ada Lovelace",
        businessName: isBusiness ? "Bamboo Ventures Ltd" : null,
      },
      bank: {
        bankName: "GTBank",
        accountName: isBusiness ? "BAMBOO VENTURES LTD" : "ADA LOVELACE",
        accountNumber: "******6789",
        verified: false,
      },
      documents: {
        driversLicense: isDriver ? "PENDING" : null,
        lasdri: null,
      },
      steps: {
        contact: "VERIFIED",
        identity: "VERIFIED",
        payout: "VERIFIED",
        driving: isDriver ? "COMPLETED" : "SKIPPED",
        submission: "PENDING",
      },
      nextAction: "SUBMIT_ACCOUNT",
    };
  }

  if (step === "license") {
    return {
      ...accountOnboarding,
      isOwnerDriver: true,
      requiredActions: ["UPLOAD_DRIVERS_LICENSE"],
      steps: {
        contact: "VERIFIED",
        identity: "VERIFIED",
        payout: "VERIFIED",
        driving: "COMPLETED",
        submission: "REVIEW_REQUIRED",
      },
      nextAction: "WAIT_FOR_REVIEW",
    };
  }

  if (step === "retake") {
    return {
      ...accountOnboarding,
      accountType: "INDIVIDUAL",
      isOwnerDriver: true,
      identity: {
        status: "SUCCEEDED",
        legalName: "Ada Lovelace",
        businessName: null,
      },
      bank: {
        bankName: "GTBank",
        accountName: "ADA LOVELACE",
        accountNumber: "******6789",
        verified: true,
      },
      steps: {
        contact: "VERIFIED",
        identity: "VERIFIED",
        payout: "VERIFIED",
        driving: "COMPLETED",
        submission: "REVIEW_REQUIRED",
      },
      nextAction: "RETAKE_SELFIE",
    };
  }

  if (step === "rejected") {
    return {
      ...accountOnboarding,
      status: "ACTION_REQUIRED",
      nextAction: "REJECTED",
    };
  }

  if (step === "review") {
    return {
      ...accountOnboarding,
      status: "UNDER_REVIEW",
      accountType: "INDIVIDUAL",
      identity: {
        status: "REVIEW_REQUIRED",
        legalName: "Ada Lovelace",
        businessName: null,
      },
      bank: {
        bankName: "GTBank",
        accountName: "ADA LOVELACE",
        accountNumber: "******6789",
        verified: true,
      },
      steps: {
        contact: "VERIFIED",
        identity: "REVIEW_REQUIRED",
        payout: "VERIFIED",
        driving: "COMPLETED",
        submission: "REVIEW_REQUIRED",
      },
      nextAction: "WAIT_FOR_REVIEW",
    };
  }

  return accountOnboarding;
}

function actionDataForStep(step: string | null): OnboardingActionData | undefined {
  if (step === "phone-code") {
    return {
      intent: "send-phone",
      notice: "Code sent to +2348012345678",
      phoneNumber: "+2348012345678",
    };
  }

  if (step === "identity-business") {
    return {
      intent: "verify-identity",
      submission: {
        status: "error",
        initialValue: { accountType: "BUSINESS" },
      } as OnboardingActionData["submission"],
    };
  }

  if (step === "phone-error") {
    return {
      intent: "send-phone",
      error: "This phone is already in use for a customer account and cannot be verified",
      phoneNumber: "+2348012345678",
    };
  }

  if (step === "driving-yes") {
    return {
      intent: "save-driving",
      submission: {
        status: "error",
        initialValue: { isOwnerDriver: "true" },
      } as OnboardingActionData["submission"],
    };
  }

  return undefined;
}

export default function FleetOnboardingFixture() {
  const [searchParams] = useSearchParams();
  const step = searchParams.get("step");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-background px-5 py-10 sm:px-6 sm:py-20"
    >
      <FleetOwnerOnboardingPage
        actionData={actionDataForStep(step)}
        banks={BANKS}
        idempotencyKey={IDEMPOTENCY_KEY}
        onboarding={onboardingForStep(step)}
      />
    </main>
  );
}
