import { Clock3Icon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";

import type { ChauffeurOnboarding } from "~/api/chauffeurs/schema";
import { CookieConsentBanner } from "~/components/cookie-consent-banner";
import { BrandLink } from "~/components/layout/brand-link";
import { QuestionnaireProgress } from "~/components/questionnaire-progress";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { useRevalidateInterval } from "~/hooks/use-revalidate-interval";
import type { ChauffeurOnboardingActionData } from "./chauffeur-onboarding-form-schema";
import {
  ChauffeurConsentForm,
  ChauffeurDrivingForm,
  ChauffeurNinForm,
  ChauffeurPhoneForm,
} from "./chauffeur-onboarding-forms";

const DRIVING_APPROVAL_POLL_MS = 4_000;

const stages = [
  { key: "consent", label: "Consent" },
  { key: "phone", label: "Phone" },
  { key: "nin", label: "Identity" },
  { key: "driving", label: "Driving" },
] as const;

type ChauffeurOnboardingPageProps = {
  readonly actionData?: ChauffeurOnboardingActionData;
  readonly idempotencyKey: string;
  readonly onboarding: ChauffeurOnboarding | null;
};

function VerificationProgress({ onboarding }: { readonly onboarding: ChauffeurOnboarding }) {
  const progressStages = stages.map((stage) => ({
    ...stage,
    complete: onboarding.steps[stage.key],
  }));
  const currentStage = progressStages.find((stage) => !stage.complete)?.key ?? null;

  return (
    <QuestionnaireProgress
      ariaLabel="Verification progress"
      currentStage={currentStage}
      stages={progressStages}
    />
  );
}

function CurrentStage({
  actionData,
  awaitingDrivingApproval,
  idempotencyKey,
  onChangePhoto,
  onboarding,
}: {
  readonly actionData?: ChauffeurOnboardingActionData;
  readonly awaitingDrivingApproval: boolean;
  readonly idempotencyKey: string;
  readonly onChangePhoto: () => void;
  readonly onboarding: ChauffeurOnboarding;
}) {
  if (!onboarding.steps.consent) {
    return (
      <>
        <CardHeader>
          <CardTitle>
            <h2>Before you begin</h2>
          </CardTitle>
          <CardDescription>
            Review how Tripdly will verify your identity and driving credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChauffeurConsentForm actionData={actionData} />
        </CardContent>
      </>
    );
  }

  if (!onboarding.steps.phone) {
    return (
      <>
        <CardHeader>
          <CardTitle>
            <h2>Verify your phone</h2>
          </CardTitle>
          <CardDescription>
            Confirm the number your fleet owner provided for booking communications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChauffeurPhoneForm actionData={actionData} phoneNumber={onboarding.phoneNumber} />
        </CardContent>
      </>
    );
  }

  if (!onboarding.steps.nin) {
    return (
      <>
        <CardHeader>
          <CardTitle>
            <h2>Verify your identity</h2>
          </CardTitle>
          <CardDescription>
            We use your NIN to confirm your legal identity. It is never shared with the fleet owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChauffeurNinForm
            actionData={actionData}
            idempotencyKey={actionData?.idempotencyKey ?? idempotencyKey}
          />
        </CardContent>
      </>
    );
  }

  if (!onboarding.steps.driving) {
    if (awaitingDrivingApproval) {
      return <DrivingApprovalWaiting onChangePhoto={onChangePhoto} />;
    }

    return (
      <>
        <CardHeader>
          <CardTitle>
            <h2>Verify your driving credentials</h2>
          </CardTitle>
          <CardDescription>
            Provide your driver&apos;s licence number and a current photo to finish verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChauffeurDrivingForm
            actionData={actionData}
            idempotencyKey={actionData?.idempotencyKey ?? idempotencyKey}
          />
        </CardContent>
      </>
    );
  }

  return (
    <CardContent className="py-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700">
        <ShieldCheckIcon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-semibold">Verification complete</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        You are approved to drive for {onboarding.fleetOwnerName ?? "your fleet owner"}. They can
        now assign bookings to you.
      </p>
    </CardContent>
  );
}

function DrivingApprovalWaiting({ onChangePhoto }: { readonly onChangePhoto: () => void }) {
  useRevalidateInterval(DRIVING_APPROVAL_POLL_MS);

  return (
    <CardContent className="space-y-4 py-10">
      <Alert role="status">
        <Clock3Icon aria-hidden="true" />
        <AlertTitle>
          <h2>Checking your photo</h2>
        </AlertTitle>
        <AlertDescription>
          Approval is not instant. Keep this page open while we finish checking your licence and
          photo.
        </AlertDescription>
      </Alert>
      <Button type="button" variant="outline" className="w-full" onClick={onChangePhoto}>
        Submit a different photo
      </Button>
    </CardContent>
  );
}

function UnavailableInvitation() {
  return (
    <Card className="w-full max-w-lg rounded-sm">
      <CardContent className="py-10 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <Clock3Icon className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">This invitation is unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may have expired or already been used. Ask your fleet owner to send a new
          invitation.
        </p>
      </CardContent>
    </Card>
  );
}

export function ChauffeurOnboardingPage({
  actionData,
  idempotencyKey,
  onboarding,
}: ChauffeurOnboardingPageProps) {
  const drivingSubmitted =
    actionData?.intent === "verify-driving" && actionData.drivingPending === true;
  // Loader revalidation clears action data, so remember the submit until driving is approved.
  const [seenActionData, setSeenActionData] = useState(actionData);
  const [holdingDrivingWait, setHoldingDrivingWait] = useState(drivingSubmitted);
  const [skippedDrivingWait, setSkippedDrivingWait] = useState(false);
  if (actionData !== seenActionData) {
    setSeenActionData(actionData);
    setSkippedDrivingWait(false);
    if (drivingSubmitted) {
      setHoldingDrivingWait(true);
    }
  }
  const awaitingDrivingApproval = holdingDrivingWait && !skippedDrivingWait;

  function showDrivingForm() {
    setHoldingDrivingWait(false);
    setSkippedDrivingWait(true);
  }

  return (
    <>
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-60 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:ring-2 focus:ring-ring motion-reduce:transition-none"
      >
        Skip to main content
      </a>
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background">
          <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
            <BrandLink />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex max-w-5xl justify-center px-4 py-8 sm:px-6 sm:py-12"
        >
          {onboarding ? (
            <div className="w-full max-w-xl space-y-5">
              <div>
                <p className="text-sm font-medium text-primary">
                  Invited by {onboarding.fleetOwnerName ?? "your fleet owner"}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  Welcome, {onboarding.name}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Complete these checks so you can receive Tripdly bookings.
                </p>
              </div>
              <VerificationProgress onboarding={onboarding} />
              {actionData?.error && !actionData.submission ? (
                <Alert variant="destructive">
                  <AlertTitle>We could not complete that step</AlertTitle>
                  <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
              ) : null}
              <Card className="rounded-sm">
                <CurrentStage
                  actionData={actionData}
                  awaitingDrivingApproval={awaitingDrivingApproval}
                  idempotencyKey={idempotencyKey}
                  onChangePhoto={showDrivingForm}
                  onboarding={onboarding}
                />
              </Card>
            </div>
          ) : (
            <UnavailableInvitation />
          )}
        </main>
      </div>
      <CookieConsentBanner />
    </>
  );
}
