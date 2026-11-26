import {
  Building2Icon,
  CheckCircle2Icon,
  Clock3Icon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { Form } from "react-router";

import type { FleetOwnerBank, FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import { StatusBadge } from "~/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { useRevalidateInterval } from "~/hooks/use-revalidate-interval";
import { OnboardingDriverLicenseForm } from "./onboarding-driver-license-form";
import type { OnboardingActionData } from "./onboarding-form-schema";
import { OnboardingPhoneCodeForm, OnboardingPhoneForm } from "./onboarding-phone-forms";
import {
  OnboardingDrivingForm,
  OnboardingIdentityForm,
  OnboardingPayoutForm,
  OnboardingSelfieForm,
} from "./onboarding-stage-forms";
import { OnboardingSubmitForm } from "./onboarding-submit-form";

type PageProps = {
  readonly actionData?: OnboardingActionData;
  readonly banks: FleetOwnerBank[];
  readonly idempotencyKey: string;
  readonly onboarding: FleetOwnerOnboarding;
};

const stages = [
  { key: "contact", label: "Phone verification", stepNumber: 1, progress: 20 },
  { key: "identity", label: "Confirm your identity", stepNumber: 2, progress: 40 },
  { key: "payout", label: "Payout Information", stepNumber: 3, progress: 60 },
  { key: "driving", label: "Driving credentials", stepNumber: 4, progress: 80 },
  { key: "submission", label: "Review and submit", stepNumber: 5, progress: 100 },
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
      RETAKE_SELFIE: "driving",
      REJECTED: "submission",
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

function OnboardingHeader({ onboarding }: { readonly onboarding: FleetOwnerOnboarding }) {
  const currentStage = getFleetOwnerOnboardingStage(onboarding);
  const activeStage = stages.find((stage) => stage.key === currentStage) ?? stages[0];

  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold leading-8 tracking-tight text-foreground sm:text-3xl sm:leading-9 sm:tracking-normal">
          Become a fleet owner
        </h1>
        <Form method="post" action="/fleet-owner/logout" className="shrink-0">
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </Form>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <span className="text-muted-foreground">
          {activeStage.stepNumber} of {stages.length} steps
        </span>
        <span className="text-muted-foreground" aria-hidden="true">
          /
        </span>
        <span className="text-foreground">{activeStage.label}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Fleet owner onboarding progress"
        aria-valuemin={1}
        aria-valuemax={stages.length}
        aria-valuenow={activeStage.stepNumber}
        aria-valuetext={`Step ${activeStage.stepNumber} of ${stages.length}: ${activeStage.label}`}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-300"
          style={{ width: `${activeStage.progress}%` }}
        />
      </div>
    </header>
  );
}

function UnderReview({ onboarding }: { readonly onboarding: FleetOwnerOnboarding }) {
  useRevalidateInterval(4_000);
  return (
    <section className="flex flex-col gap-5">
      <Separator />
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Clock3Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-xl font-semibold leading-7 text-foreground">Submitted for review</h2>
          <p className="text-sm leading-5 text-muted-foreground">
            Your details were received. You can return here to see the latest status.
          </p>
        </div>
      </div>

      <dl className="divide-y divide-border rounded-sm border border-border bg-background">
        <div className="flex items-center justify-between gap-4 p-4 text-sm">
          <dt className="shrink-0 text-muted-foreground">Identity</dt>
          <dd className="min-w-0 text-right font-medium break-words text-foreground">
            {onboarding.identity?.legalName ?? "Submitted"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 p-4 text-sm">
          <dt className="shrink-0 text-muted-foreground">Bank account</dt>
          <dd className="min-w-0 text-right font-medium break-words text-foreground">
            {onboarding.bank?.accountName ?? "Submitted"}
          </dd>
        </div>
      </dl>

      <div>
        <StatusBadge tone="warning">Review in progress</StatusBadge>
      </div>
    </section>
  );
}

function Rejected() {
  return (
    <section className="flex flex-col gap-5">
      <Separator />
      <div className="rounded-sm border border-border bg-background px-6 py-10 text-center">
        <XCircleIcon className="mx-auto size-10 text-destructive" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold text-foreground">Verification not approved</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Staff could not approve your account verification. Contact support if you need help.
        </p>
      </div>
    </section>
  );
}

function OnboardingStep({ actionData, banks, idempotencyKey, onboarding }: PageProps) {
  const [enteringExistingCode, setEnteringExistingCode] = useState(false);
  const nextAction = onboarding.nextAction;

  if (nextAction === "VERIFY_EMAIL") {
    return (
      <section className="flex flex-col gap-5">
        <Separator />
        <Alert role="note">
          <Building2Icon aria-hidden="true" />
          <AlertTitle>Verify your email first</AlertTitle>
          <AlertDescription>
            Finish email verification, then reload this page to continue.
          </AlertDescription>
        </Alert>
      </section>
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

  if (nextAction === "REJECTED") {
    return <Rejected />;
  }

  if (onboarding.requiredActions.includes("UPLOAD_DRIVERS_LICENSE")) {
    return <OnboardingDriverLicenseForm actionData={actionData} />;
  }

  if (nextAction === "RETAKE_SELFIE") {
    return <OnboardingSelfieForm actionData={actionData} idempotencyKey={idempotencyKey} />;
  }

  if (nextAction === "WAIT_FOR_REVIEW" || onboarding.status === "UNDER_REVIEW") {
    return <UnderReview onboarding={onboarding} />;
  }

  if (nextAction === "VERIFY_IDENTITY") {
    return <OnboardingIdentityForm actionData={actionData} idempotencyKey={idempotencyKey} />;
  }

  if (nextAction === "VERIFY_PAYOUT") {
    return (
      <div className="flex flex-col gap-6">
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
      </div>
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
  const currentStage = getFleetOwnerOnboardingStage(onboarding);

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-6">
      <OnboardingHeader onboarding={onboarding} />
      {currentStage === "contact" ? (
        <Alert role="note">
          <ShieldCheckIcon aria-hidden="true" />
          <AlertTitle>Why we verify</AlertTitle>
          <AlertDescription>
            Verification protects drivers, riders, and payouts. Your details are sent securely to
            our verification providers.
          </AlertDescription>
        </Alert>
      ) : null}
      <OnboardingStep
        actionData={actionData}
        banks={banks}
        idempotencyKey={idempotencyKey}
        onboarding={onboarding}
      />
    </div>
  );
}
