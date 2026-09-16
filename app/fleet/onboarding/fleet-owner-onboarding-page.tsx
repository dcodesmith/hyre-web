import { Building2Icon, CheckCircle2Icon, Clock3Icon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { Form } from "react-router";

import type { FleetOwnerBank, FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import { QuestionnaireProgress } from "~/components/questionnaire-progress";
import { StatusBadge } from "~/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { OnboardingDriverLicenseForm } from "./onboarding-driver-license-form";
import type { OnboardingActionData } from "./onboarding-form-schema";
import { OnboardingPhoneCodeForm, OnboardingPhoneForm } from "./onboarding-phone-forms";
import {
  OnboardingDrivingForm,
  OnboardingIdentityForm,
  OnboardingPayoutForm,
  OnboardingSubmitForm,
} from "./onboarding-stage-forms";

type PageProps = {
  readonly actionData?: OnboardingActionData;
  readonly banks: FleetOwnerBank[];
  readonly idempotencyKey: string;
  readonly onboarding: FleetOwnerOnboarding;
};

const stages = [
  { key: "contact", label: "Contact" },
  { key: "identity", label: "Identity" },
  { key: "payout", label: "Payout" },
  { key: "driving", label: "Driving" },
  { key: "submission", label: "Submit" },
] as const;

export function getFleetOwnerOnboardingStage(
  onboarding: Pick<FleetOwnerOnboarding, "nextAction" | "requiredActions">,
) {
  if (onboarding.nextAction === "VERIFY_EMAIL" || onboarding.nextAction === "VERIFY_PHONE") {
    return "contact";
  }

  if (onboarding.requiredActions.includes("UPLOAD_DRIVERS_LICENSE")) return "driving";

  return (
    {
      VERIFY_IDENTITY: "identity",
      VERIFY_PAYOUT: "payout",
      PROVIDE_DRIVING_CREDENTIALS: "driving",
      SUBMIT_ACCOUNT: "submission",
      WAIT_FOR_REVIEW: "submission",
      COMPLETE: null,
    }[onboarding.nextAction] ?? null
  );
}

export function shouldShowFleetOwnerPhoneCodeStep(
  actionData?: Pick<OnboardingActionData, "intent" | "error">,
  enteringExistingCode = false,
) {
  if (enteringExistingCode || actionData?.intent === "check-phone") {
    return true;
  }
  return actionData?.intent === "send-phone" && !actionData.error;
}

export function getFleetOwnerOnboardingProgress(
  onboarding: Pick<FleetOwnerOnboarding, "nextAction" | "requiredActions" | "steps">,
) {
  const currentStage = getFleetOwnerOnboardingStage(onboarding);
  const completedStages = {
    contact: onboarding.steps.contact === "VERIFIED",
    identity: onboarding.steps.identity !== "PENDING",
    payout: onboarding.steps.payout !== "PENDING",
    driving: onboarding.steps.driving !== "PENDING",
    submission: onboarding.steps.submission !== "PENDING",
  };
  return stages.map((stage) => ({
    ...stage,
    complete: stage.key !== currentStage && completedStages[stage.key],
  }));
}

function OnboardingProgress({ onboarding }: { readonly onboarding: FleetOwnerOnboarding }) {
  const currentStage = getFleetOwnerOnboardingStage(onboarding);

  return (
    <QuestionnaireProgress
      ariaLabel="Fleet owner onboarding progress"
      currentStage={currentStage}
      stages={getFleetOwnerOnboardingProgress(onboarding)}
    />
  );
}

function PageHeader() {
  return (
    <header className="mx-auto mb-6 flex w-full max-w-3xl flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold tracking-wide text-primary">TRIPDLY FLEET</p>
        <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Verify Your Account
        </h1>
      </div>
      <Form method="post" action="/fleet-owner/logout">
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </Form>
    </header>
  );
}

function UnderReview({ onboarding }: { readonly onboarding: FleetOwnerOnboarding }) {
  return (
    <Card className="rounded-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Clock3Icon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle>
              <h2>Verification Under Review</h2>
            </CardTitle>
            <CardDescription>
              Your details were received. You can return here to see the latest status.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Identity</p>
            <p className="mt-1 break-words font-medium">
              {onboarding.identity?.legalName ?? "Submitted"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Bank account</p>
            <p className="mt-1 break-words font-medium">
              {onboarding.bank?.accountName ?? "Submitted"}
            </p>
          </div>
        </div>
        <StatusBadge tone="warning">Review in progress</StatusBadge>
      </CardContent>
    </Card>
  );
}

function OnboardingStep({ actionData, banks, idempotencyKey, onboarding }: PageProps) {
  const [enteringExistingCode, setEnteringExistingCode] = useState(false);
  const nextAction = onboarding.nextAction;

  if (nextAction === "VERIFY_EMAIL") {
    return (
      <Alert role="note">
        <Building2Icon aria-hidden="true" />
        <AlertTitle>Verify your email first</AlertTitle>
        <AlertDescription>
          Finish email verification, then reload this page to continue.
        </AlertDescription>
      </Alert>
    );
  }

  if (nextAction === "VERIFY_PHONE") {
    if (shouldShowFleetOwnerPhoneCodeStep(actionData, enteringExistingCode)) {
      return (
        <OnboardingPhoneCodeForm actionData={actionData} phoneNumber={actionData?.phoneNumber} />
      );
    }
    return (
      <OnboardingPhoneForm
        actionData={actionData}
        onHaveCode={() => setEnteringExistingCode(true)}
      />
    );
  }

  if (onboarding.requiredActions.includes("UPLOAD_DRIVERS_LICENSE")) {
    return <OnboardingDriverLicenseForm actionData={actionData} />;
  }

  if (nextAction === "WAIT_FOR_REVIEW" || onboarding.status === "UNDER_REVIEW") {
    return <UnderReview onboarding={onboarding} />;
  }

  if (nextAction === "VERIFY_IDENTITY") {
    return <OnboardingIdentityForm actionData={actionData} idempotencyKey={idempotencyKey} />;
  }

  if (nextAction === "VERIFY_PAYOUT") {
    return (
      <>
        <Alert
          role="note"
          className={
            onboarding.steps.identity === "REVIEW_REQUIRED" ? undefined : "[&>svg]:text-green-600!"
          }
        >
          <CheckCircle2Icon aria-hidden="true" />
          <AlertTitle>
            {onboarding.steps.identity === "REVIEW_REQUIRED"
              ? "Identity submitted"
              : "Identity verified"}
          </AlertTitle>
          <AlertDescription className="break-words">
            {onboarding.identity?.legalName ?? onboarding.phone.number}
          </AlertDescription>
        </Alert>
        <OnboardingPayoutForm
          actionData={actionData}
          banks={banks}
          idempotencyKey={idempotencyKey}
          onboarding={onboarding}
        />
      </>
    );
  }

  if (nextAction === "PROVIDE_DRIVING_CREDENTIALS") {
    return <OnboardingDrivingForm actionData={actionData} idempotencyKey={idempotencyKey} />;
  }

  return (
    <OnboardingSubmitForm
      actionData={actionData}
      idempotencyKey={idempotencyKey}
      onboarding={onboarding}
    />
  );
}

export function FleetOwnerOnboardingPage({
  actionData,
  banks,
  idempotencyKey,
  onboarding,
}: PageProps) {
  return (
    <>
      <PageHeader />
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <OnboardingProgress onboarding={onboarding} />
        <Alert role="note">
          <ShieldCheckIcon aria-hidden="true" />
          <AlertTitle>Why we verify</AlertTitle>
          <AlertDescription>
            Verification protects drivers, riders, and payouts. Your details are sent securely to
            our verification providers.
          </AlertDescription>
        </Alert>
        <OnboardingStep
          actionData={actionData}
          banks={banks}
          idempotencyKey={idempotencyKey}
          onboarding={onboarding}
        />
      </div>
    </>
  );
}
